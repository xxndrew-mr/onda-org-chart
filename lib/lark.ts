import type { LarkDepartment, LarkUser } from './types';

/* ============================================================
 *  Konfigurasi
 * ========================================================== */

const LARK_DOMAIN = (process.env.LARK_DOMAIN || 'https://open.larksuite.com').replace(/\/+$/, '');
const APP_ID = process.env.LARK_APP_ID || '';
const APP_SECRET = process.env.LARK_APP_SECRET || '';

/** Lark membatasi page_size departemen/user maksimal 50 */
const PAGE_SIZE = 50;

/** Berapa request user-per-departemen yang jalan barengan (hindari rate limit) */
const CONCURRENCY = 5;

export class LarkApiError extends Error {
  constructor(
    message: string,
    public code: number | string,
    public hint?: string,
  ) {
    super(message);
    this.name = 'LarkApiError';
  }
}

export function assertLarkConfigured() {
  if (!APP_ID || !APP_SECRET) {
    throw new LarkApiError(
      'LARK_APP_ID / LARK_APP_SECRET belum diisi.',
      'ENV_MISSING',
      'Copy .env.local.example jadi .env.local, lalu isi credential dari Lark Developer Console.',
    );
  }
}

/* ============================================================
 *  Tenant access token (di-cache di memori proses)
 * ========================================================== */

let tokenCache: { token: string; expiresAt: number } | null = null;

export async function getTenantAccessToken(force = false): Promise<string> {
  assertLarkConfigured();

  if (!force && tokenCache && Date.now() < tokenCache.expiresAt) {
    return tokenCache.token;
  }

  const res = await fetch(`${LARK_DOMAIN}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET }),
    cache: 'no-store',
  });

  if (!res.ok) {
    throw new LarkApiError(
      `Gagal menghubungi Lark (HTTP ${res.status}).`,
      res.status,
      `Cek apakah LARK_DOMAIN sudah benar. Sekarang: ${LARK_DOMAIN}`,
    );
  }

  const json = (await res.json()) as {
    code: number;
    msg: string;
    tenant_access_token?: string;
    expire?: number;
  };

  if (json.code !== 0 || !json.tenant_access_token) {
    throw new LarkApiError(
      `Gagal ambil tenant_access_token: ${json.msg}`,
      json.code,
      json.code === 10003 || json.code === 10014
        ? 'app_id atau app_secret salah, atau domain-nya keliru (Lark vs Feishu).'
        : undefined,
    );
  }

  // expire dalam detik; sisakan buffer 5 menit
  const ttlMs = Math.max((json.expire ?? 7200) - 300, 60) * 1000;
  tokenCache = { token: json.tenant_access_token, expiresAt: Date.now() + ttlMs };
  return tokenCache.token;
}

/* ============================================================
 *  HTTP helper
 * ========================================================== */

type Params = Record<string, string | number | boolean | undefined>;

interface LarkListEnvelope<T> {
  code: number;
  msg: string;
  data?: {
    items?: T[];
    has_more?: boolean;
    page_token?: string;
  };
}

function buildUrl(path: string, params: Params): string {
  const url = new URL(`${LARK_DOMAIN}/open-apis${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function friendlyHint(code: number): string | undefined {
  switch (code) {
    case 99991672:
    case 99991679:
      return 'App belum punya permission. Aktifkan scope "Read Contacts as an app" + field scope departemen & user, lalu publish ulang app-nya (butuh approval admin).';
    case 40004:
      return 'Contact scope app belum mencakup departemen ini. Buka Developer Console > Permissions & Scopes > Data Scope, set ke seluruh perusahaan, lalu publish ulang.';
    case 41050:
      return 'Contact scope app belum mencakup karyawan tersebut. Perluas Data Scope ke seluruh perusahaan.';
    case 40014:
      return 'Tidak punya akses ke departemen induk. Cek LARK_ROOT_DEPARTMENT_ID dan contact scope app.';
    case 43010:
      return 'Departemen terlalu besar untuk query rekursif. Coba set LARK_ROOT_DEPARTMENT_ID ke sub-departemen tertentu.';
    case 40008:
      return 'Departemen tidak ditemukan — cek nilai LARK_ROOT_DEPARTMENT_ID (harus "0" atau open_department_id yang valid).';
    case 40011:
    case 40012:
      return 'Masalah paginasi dari Lark. Coba sinkron ulang.';
    case 42008:
      return 'Tenant tidak valid — pastikan app dibuat di tenant Lark yang sama dengan LARK_DOMAIN.';
    default:
      return undefined;
  }
}

/** GET satu halaman, otomatis refresh token kalau kedaluwarsa. */
async function larkGetPage<T>(path: string, params: Params, retry = true): Promise<LarkListEnvelope<T>['data']> {
  const token = await getTenantAccessToken();
  const res = await fetch(buildUrl(path, params), {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    cache: 'no-store',
  });

  const json = (await res.json()) as LarkListEnvelope<T>;

  // Token invalid / expired → sekali retry dengan token baru
  if ((json.code === 99991663 || json.code === 99991664 || json.code === 99991668) && retry) {
    await getTenantAccessToken(true);
    return larkGetPage<T>(path, params, false);
  }

  if (json.code !== 0) {
    throw new LarkApiError(`Lark API error pada ${path}: ${json.msg}`, json.code, friendlyHint(json.code));
  }

  return json.data;
}

/** GET semua halaman sampai has_more == false. */
async function larkGetAll<T>(path: string, params: Params): Promise<T[]> {
  const items: T[] = [];
  let pageToken: string | undefined;
  let guard = 0;

  do {
    const data = await larkGetPage<T>(path, { ...params, page_size: PAGE_SIZE, page_token: pageToken });
    if (data?.items?.length) items.push(...data.items);
    pageToken = data?.has_more ? data.page_token : undefined;
    guard += 1;
  } while (pageToken && guard < 500);

  return items;
}

/** Jalankan task secara paralel terbatas. */
async function mapWithConcurrency<TIn, TOut>(
  input: TIn[],
  limit: number,
  worker: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results = new Array<TOut>(input.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, input.length) }, async () => {
    while (cursor < input.length) {
      const index = cursor++;
      results[index] = await worker(input[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

/* ============================================================
 *  Endpoint spesifik
 * ========================================================== */

/**
 * Ambil SEMUA departemen turunan dari sebuah root (rekursif, satu panggilan
 * berkat fetch_child=true).
 */
export async function fetchAllDepartments(rootId = '0'): Promise<LarkDepartment[]> {
  const items = await larkGetAll<LarkDepartment>(`/contact/v3/departments/${encodeURIComponent(rootId)}/children`, {
    department_id_type: 'open_department_id',
    user_id_type: 'open_id',
    fetch_child: true,
  });

  return items.filter((d) => !d.status?.is_deleted);
}

/** Ambil info satu departemen (dipakai untuk menamai node root). */
export async function fetchDepartment(departmentId: string): Promise<LarkDepartment | null> {
  try {
    const token = await getTenantAccessToken();
    const url = buildUrl(`/contact/v3/departments/${encodeURIComponent(departmentId)}`, {
      department_id_type: 'open_department_id',
      user_id_type: 'open_id',
    });
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
    const json = (await res.json()) as { code: number; data?: { department?: LarkDepartment } };
    if (json.code !== 0) return null;
    return json.data?.department ?? null;
  } catch {
    return null;
  }
}

/** Ambil anggota langsung sebuah departemen (tidak termasuk sub-departemen). */
export async function fetchUsersInDepartment(departmentId: string): Promise<LarkUser[]> {
  const items = await larkGetAll<LarkUser>('/contact/v3/users/find_by_department', {
    department_id: departmentId,
    department_id_type: 'open_department_id',
    user_id_type: 'open_id',
  });

  // Buang karyawan yang sudah resign / dibekukan
  return items.filter((u) => !u.status?.is_resigned && !u.status?.is_exited);
}

/** Ambil anggota untuk banyak departemen sekaligus, dengan batas paralel. */
export async function fetchUsersForDepartments(
  departmentIds: string[],
): Promise<Map<string, LarkUser[]>> {
  const map = new Map<string, LarkUser[]>();

  await mapWithConcurrency(departmentIds, CONCURRENCY, async (id) => {
    try {
      map.set(id, await fetchUsersInDepartment(id));
    } catch (err) {
      // Satu departemen gagal jangan sampai merusak seluruh chart
      console.error(`[lark] gagal ambil user untuk departemen ${id}:`, err);
      map.set(id, []);
    }
  });

  return map;
}

export const larkConfig = {
  domain: LARK_DOMAIN,
  rootDepartmentId: process.env.LARK_ROOT_DEPARTMENT_ID || '0',
  orgName: process.env.NEXT_PUBLIC_ORG_NAME || 'Perusahaan',
};
