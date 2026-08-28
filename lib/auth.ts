import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken, type SessionUser } from './session';

/* ============================================================
 *  Login dengan Lark (OAuth 2.0 / SSO)
 *
 *  Alur: /api/auth/login → halaman otorisasi Lark → /api/auth/callback
 *  (tukar code → user_access_token → user_info) → cookie sesi.
 *  Di dalam Lark Workplace, otorisasi lolos otomatis (pengguna sudah
 *  login Lark) sehingga terasa seperti seamless login.
 * ========================================================== */

export interface AuthConfig {
  appId: string;
  appSecret: string;
  /** Domain Open API, mis. https://open.larksuite.com */
  openDomain: string;
  /** Domain halaman otorisasi, mis. https://accounts.larksuite.com */
  accountsDomain: string;
  sessionSecret: string;
  /** Override origin publik (opsional, mis. di balik proxy) */
  appUrl: string;
  /** Bypass login — hanya berlaku di luar production */
  disabled: boolean;
}

export function authConfig(): AuthConfig {
  const openDomain = (process.env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/+$/, '');
  const isFeishu = /feishu\.cn/i.test(openDomain);
  return {
    appId: process.env.LARK_APP_ID || '',
    appSecret: process.env.LARK_APP_SECRET || '',
    openDomain,
    accountsDomain: isFeishu ? 'https://accounts.feishu.cn' : 'https://accounts.larksuite.com',
    sessionSecret: process.env.SESSION_SECRET || '',
    appUrl: (process.env.APP_URL || '').replace(/\/+$/, ''),
    disabled: process.env.AUTH_DISABLED === 'true' && process.env.NODE_ENV !== 'production',
  };
}

/** Origin publik aplikasi — dari env APP_URL bila ada, selain itu dari request */
export function resolveOrigin(requestUrl: string): string {
  const { appUrl } = authConfig();
  return appUrl || new URL(requestUrl).origin;
}

export function buildAuthorizeUrl(redirectUri: string, state: string): string {
  const { accountsDomain, appId } = authConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: 'code',
    state,
  });
  return `${accountsDomain}/open-apis/authen/v1/authorize?${params.toString()}`;
}

export interface LarkViewer {
  openId: string;
  name: string;
  avatar?: string;
  email?: string;
}

/** Tukar authorization code menjadi identitas pengguna Lark */
export async function exchangeCodeForViewer(code: string, redirectUri: string): Promise<LarkViewer> {
  const { openDomain, appId, appSecret } = authConfig();

  const tokenRes = await fetch(`${openDomain}/open-apis/authen/v2/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: appId,
      client_secret: appSecret,
      code,
      redirect_uri: redirectUri,
    }),
    cache: 'no-store',
  });
  const tokenJson = (await tokenRes.json()) as {
    code?: number;
    access_token?: string;
    error?: string;
    error_description?: string;
    msg?: string;
  };
  if (tokenJson.code !== 0 || !tokenJson.access_token) {
    throw new Error(
      `Lark menolak kode otorisasi: ${tokenJson.error_description || tokenJson.msg || tokenJson.error || 'unknown'}`,
    );
  }

  const infoRes = await fetch(`${openDomain}/open-apis/authen/v1/user_info`, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
    cache: 'no-store',
  });
  const infoJson = (await infoRes.json()) as {
    code: number;
    msg?: string;
    data?: {
      open_id: string;
      name?: string;
      en_name?: string;
      avatar_thumb?: string;
      avatar_url?: string;
      email?: string;
      enterprise_email?: string;
    };
  };
  if (infoJson.code !== 0 || !infoJson.data?.open_id) {
    throw new Error(`Gagal membaca profil Lark: ${infoJson.msg || 'unknown'}`);
  }

  const d = infoJson.data;
  return {
    openId: d.open_id,
    name: d.name || d.en_name || 'Pengguna Lark',
    avatar: d.avatar_thumb || d.avatar_url || undefined,
    email: d.enterprise_email || d.email || undefined,
  };
}

/** Pengguna yang sedang login (dibaca dari cookie sesi) — untuk server component */
export async function getViewer(): Promise<SessionUser | null> {
  const { sessionSecret } = authConfig();
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value, sessionSecret);
}
