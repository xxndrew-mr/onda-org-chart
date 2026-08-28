import { NextResponse } from 'next/server';
import { authConfig, buildAuthorizeUrl, resolveOrigin } from '@/lib/auth';
import { OAUTH_STATE_COOKIE } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** Hanya izinkan redirect ke path internal (cegah open redirect) */
function safeNext(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

/** Mulai alur login: arahkan ke halaman otorisasi Lark */
export async function GET(request: Request) {
  const cfg = authConfig();
  if (!cfg.appId || !cfg.appSecret) {
    return NextResponse.json(
      { ok: false, error: 'LARK_APP_ID / LARK_APP_SECRET belum diisi.' },
      { status: 500 },
    );
  }
  if (!cfg.sessionSecret) {
    return NextResponse.json(
      { ok: false, error: 'SESSION_SECRET belum diisi — login tidak bisa membuat sesi.' },
      { status: 500 },
    );
  }

  const origin = resolveOrigin(request.url);
  const redirectUri = `${origin}/api/auth/callback`;
  const state = crypto.randomUUID();
  const next = safeNext(new URL(request.url).searchParams.get('next'));

  const response = NextResponse.redirect(buildAuthorizeUrl(redirectUri, state));
  // state dipakai callback untuk menolak kode yang tidak kita minta (CSRF)
  response.cookies.set(OAUTH_STATE_COOKIE, `${state}|${next}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
    path: '/',
    maxAge: 10 * 60,
  });
  return response;
}
