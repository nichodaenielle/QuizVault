import { NextRequest, NextResponse } from 'next/server';

const SESSION_COOKIE = 'qv_session';

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = !!req.cookies.get(SESSION_COOKIE)?.value;

  const isPublic =
    pathname.startsWith('/sign-in') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/health') ||
    pathname.startsWith('/api/cron');

  if (!hasSession && !isPublic) {
    const url = new URL('/sign-in', req.url);
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && pathname === '/sign-in') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|webp)$).*)'],
};
