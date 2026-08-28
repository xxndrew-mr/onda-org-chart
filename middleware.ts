import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/session';

/**
 * Pelindung halaman & API data: tanpa sesi login Lark yang valid,
 * halaman dialihkan ke /api/auth/login dan API menjawab 401.
 * /api/auth/* sengaja tidak dicakup matcher (dibutuhkan untuk login).
 */
export const config = {
  matcher: ['/', '/api/org', '/api/health'],
};

export async function middleware(request: NextRequest) {
  const bypass = process.env.AUTH_DISABLED === 'true' && process.env.NODE_ENV !== 'production';
  if (bypass) return NextResponse.next();

  const secret = process.env.SESSION_SECRET || '';
  const user = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value, secret);
  if (user) return NextResponse.next();

  if (request.nextUrl.pathname.startsWith('/api/')) {
    return NextResponse.json(
      { ok: false, error: 'Belum login. Silakan login dengan Lark.', code: 'UNAUTHENTICATED' },
      { status: 401 },
    );
  }

  const loginUrl = new URL('/api/auth/login', request.url);
  loginUrl.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}
