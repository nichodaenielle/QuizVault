import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = `${baseUrl(req)}/api/auth/google/callback`;
  if (!clientId) {
    return NextResponse.json(
      { error: 'Google OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.' },
      { status: 500 },
    );
  }
  const state = randomBytes(24).toString('base64url');
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  const res = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
  res.cookies.set('qv_oauth_state', state, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 600,
    path: '/',
  });
  return res;
}

function baseUrl(req: NextRequest) {
  // In development, derive the base URL from the request so the OAuth callback
  // (and its state cookie) stays on the same host the user is browsing —
  // e.g. localhost vs 127.0.0.1. In production, NEXTAUTH_URL is authoritative.
  if (process.env.NODE_ENV !== 'production') return req.nextUrl.origin;
  const envUrl = process.env.NEXTAUTH_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');
  return req.nextUrl.origin;
}
