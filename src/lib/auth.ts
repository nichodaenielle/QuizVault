import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { prisma } from './prisma';
import type { Role, User } from '@prisma/client';

export const SESSION_COOKIE = 'qv_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error('AUTH_SECRET is not set');
  return new TextEncoder().encode(s);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, secret());
    return typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}

export type SessionUser = Pick<User, 'id' | 'email' | 'name' | 'image' | 'role' | 'timezone'>;

export async function getSessionUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const userId = await verifySessionToken(token);
  if (!userId) return null;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, image: true, role: true, timezone: true },
  });
  return user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect('/sign-in');
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect('/dashboard?denied=1');
  return user;
}

export function isStaff(role: Role) {
  return role === 'INSTRUCTOR' || role === 'ADMIN';
}

export function homePathFor(role: Role) {
  if (role === 'ADMIN') return '/admin';
  if (role === 'INSTRUCTOR') return '/teach';
  return '/learn';
}
