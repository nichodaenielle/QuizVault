import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createSessionToken, SESSION_COOKIE } from '@/lib/auth';
import { homePathFor } from '@/lib/auth';

export const runtime = 'nodejs';

/**
 * Development-only sign-in bypass so the app can be exercised without Google
 * OAuth credentials. Disabled unless DEV_AUTH=1 and NODE_ENV !== production.
 */
export async function POST(req: NextRequest) {
  if (process.env.DEV_AUTH !== '1' || process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    role?: 'LEARNER' | 'INSTRUCTOR' | 'ADMIN';
  };
  const email = (body.email ?? 'dev@example.com').toLowerCase();
  const requestedRole = body.role ?? 'LEARNER';
  const firstAdmin = process.env.FIRST_ADMIN_EMAIL?.toLowerCase();
  const role = firstAdmin && email === firstAdmin ? 'ADMIN' : requestedRole;

  const googleSub = `dev:${email}`;
  const user = await prisma.user.upsert({
    where: { googleSub },
    update: { email, name: body.name ?? undefined },
    create: { googleSub, email, name: body.name ?? 'Dev User', role },
  });
  const token = await createSessionToken(user.id);
  const res = NextResponse.json({ ok: true, redirect: homePathFor(user.role) });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  return res;
}
