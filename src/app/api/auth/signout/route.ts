import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/sign-in', req.nextUrl.origin));
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
