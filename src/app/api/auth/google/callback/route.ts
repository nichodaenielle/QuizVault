import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { audit } from '@/lib/access';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { homePathFor } from '@/lib/auth';

export const runtime = 'nodejs';

interface GoogleUserInfo {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');
  const failRedirect = (msg: string) =>
    NextResponse.redirect(new URL(`/sign-in?error=${encodeURIComponent(msg)}`, url.origin));

  if (errorParam) return failRedirect('Google sign-in was cancelled.');
  if (!code || !state) return failRedirect('Missing OAuth parameters.');

  const expectedState = req.cookies.get('qv_oauth_state')?.value;
  if (!expectedState || expectedState !== state) {
    return failRedirect('Invalid OAuth state. Please try again.');
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return failRedirect('OAuth is not configured.');

  const redirectUri = `${process.env.NEXTAUTH_URL?.replace(/\/$/, '') ?? url.origin}/api/auth/google/callback`;

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!tokenRes.ok) return failRedirect('Could not exchange the authorization code.');
  const tokens = (await tokenRes.json()) as { access_token?: string };
  if (!tokens.access_token) return failRedirect('Google did not return an access token.');

  const infoRes = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!infoRes.ok) return failRedirect('Could not load your Google profile.');
  const info = (await infoRes.json()) as GoogleUserInfo;

  if (!info.sub || !info.email) return failRedirect('Google profile is incomplete.');
  if (info.email_verified === false) return failRedirect('Your Google email is not verified.');

  const email = info.email.toLowerCase();
  const firstAdmin = process.env.FIRST_ADMIN_EMAIL?.toLowerCase();

  const user = await prisma.$transaction(async (tx) => {
    let u = await tx.user.findUnique({ where: { googleSub: info.sub } });
    if (u && u.email !== email) {
      u = await tx.user.update({
        where: { id: u.id },
        data: { email, name: info.name ?? u.name, image: info.picture ?? u.image },
      });
    }
    if (!u) {
      const role = firstAdmin && email === firstAdmin ? 'ADMIN' : 'LEARNER';
      u = await tx.user.create({
        data: {
          googleSub: info.sub,
          email,
          name: info.name ?? null,
          image: info.picture ?? null,
          role,
        },
      });
      if (role === 'ADMIN') {
        await tx.roleChange.create({
          data: { userId: u.id, fromRole: 'LEARNER', toRole: 'ADMIN', changedBy: u.id },
        });
      }
      await audit(u.id, 'USER_CREATED', 'User', u.id, { email }, tx);
    } else if (firstAdmin && email === firstAdmin && u.role === 'LEARNER') {
      // First-admin bootstrap via configured verified email. Only applies
      // while no admin exists, so a deliberate demotion is never undone.
      const adminCount = await tx.user.count({ where: { role: 'ADMIN' } });
      if (adminCount === 0) {
        await tx.user.update({ where: { id: u.id }, data: { role: 'ADMIN' } });
        await tx.roleChange.create({
          data: { userId: u.id, fromRole: 'LEARNER', toRole: 'ADMIN', changedBy: u.id },
        });
        u = await tx.user.findUniqueOrThrow({ where: { id: u.id } });
      }
    }
    return u;
  });

  const token = await createSessionToken(user.id);
  const next = req.cookies.get('qv_next')?.value;
  const dest =
    next && next.startsWith('/') && !next.startsWith('//') ? next : homePathFor(user.role);
  const res = NextResponse.redirect(new URL(dest, url.origin));
  res.cookies.delete('qv_next');
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  res.cookies.delete('qv_oauth_state');
  return res;
}
