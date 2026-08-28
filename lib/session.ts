/**
 * Sesi login berbasis cookie bertanda tangan HMAC-SHA256.
 * Hanya memakai Web Crypto sehingga aman dipakai di middleware (edge)
 * maupun route handler (node).
 */

export const SESSION_COOKIE = 'onda_session';
export const OAUTH_STATE_COOKIE = 'onda_oauth_state';
/**
 * Umur sesi: 24 jam. Sesi ini stateless (tidak bisa dicabut dari server),
 * jadi TTL sengaja pendek — login ulang di Lark Workplace berlangsung otomatis.
 */
export const SESSION_TTL_SECONDS = 24 * 60 * 60;

export interface SessionUser {
  openId: string;
  name: string;
  avatar?: string;
  email?: string;
  /** Unix seconds */
  exp: number;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((value.length + 3) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function sign(data: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  return toBase64Url(new Uint8Array(signature));
}

/** Perbandingan waktu-konstan supaya tanda tangan tidak bisa ditebak lewat timing */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(
  user: Omit<SessionUser, 'exp'>,
  secret: string,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: SessionUser = { ...user, exp: Math.floor(Date.now() / 1000) + ttlSeconds };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  return `${body}.${await sign(body, secret)}`;
}

export async function verifySessionToken(
  token: string | undefined,
  secret: string,
): Promise<SessionUser | null> {
  if (!token || !secret) return null;
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (!timingSafeEqual(signature, await sign(body, secret))) return null;

  try {
    const user = JSON.parse(decoder.decode(fromBase64Url(body))) as SessionUser;
    if (!user.openId || typeof user.exp !== 'number') return null;
    if (user.exp < Date.now() / 1000) return null;
    return user;
  } catch {
    return null;
  }
}
