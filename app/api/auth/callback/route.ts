import { NextResponse } from 'next/server';
import { authConfig, exchangeCodeForViewer, resolveOrigin } from '@/lib/auth';
import {
  OAUTH_STATE_COOKIE,
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  createSessionToken,
} from '@/lib/session';

export const dynamic = 'force-dynamic';

function failPage(message: string, status = 400) {
  return new NextResponse(
    `<!doctype html><meta charset="utf-8"><title>Login gagal</title>
<body style="font-family:system-ui;padding:40px;color:#0b1020">
<h1 style="font-size:20px">Login Lark gagal</h1>
<p style="color:#5a6178">${message}</p>
<p><a href="/api/auth/login" style="color:#005da6">Coba login lagi</a></p></body>`,
    { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

/** Lark kembali ke sini membawa ?code&state → tukar jadi sesi */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const larkError = url.searchParams.get('error');

  if (larkError) return failPage(`Lark menolak otorisasi: ${larkError}`);
  if (!code || !state) return failPage('Parameter code/state tidak lengkap.');

  const cookieHeader = request.headers.get('cookie') || '';
  const stateCookie = cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);
  const [expectedState, next = '/'] = (stateCookie ? decodeURIComponent(stateCookie) : '').split('|');
  if (!expectedState || expectedState !== state) {
    return failPage('State tidak cocok (sesi login kedaluwarsa atau permintaan tidak valid).');
  }

  const cfg = authConfig();
  if (!cfg.sessionSecret) return failPage('SESSION_SECRET belum diset di server.', 500);

  const origin = resolveOrigin(request.url);
  const redirectUri = `${origin}/api/auth/callback`;

  let viewer;
  try {
    viewer = await exchangeCodeForViewer(code, redirectUri);
  } catch (error) {
    console.error('[auth/callback]', error);
    return failPage(error instanceof Error ? error.message : 'Gagal menukar kode otorisasi.', 502);
  }

  const token = await createSessionToken(viewer, cfg.sessionSecret);
  const response = NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/'}`);
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: origin.startsWith('https://'),
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  response.cookies.set(OAUTH_STATE_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
