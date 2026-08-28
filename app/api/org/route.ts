import { NextResponse } from 'next/server';
import { authConfig, getViewer } from '@/lib/auth';
import { clearCache, getCached, setCached } from '@/lib/cache';
import { LarkApiError } from '@/lib/lark';
import { buildOrgTree } from '@/lib/org';
import { flattenPeople } from '@/lib/tree-utils';
import type { OrgErrorResponse, OrgResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Bangun pohon org bisa makan waktu kalau departemennya banyak */
export const maxDuration = 60;

const CACHE_KEY = 'org-tree';
const TTL = Number(process.env.ORG_CACHE_TTL_SECONDS || 600);
/** Jarak minimal antar "Sinkron ulang" tanpa key — cegah banjir request ke Lark */
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;

type CachedPayload = Pick<OrgResponse, 'root' | 'stats' | 'deptLevel' | 'generatedAt'>;

let lastBuiltAt = 0;

/**
 * Pengguna login harus benar-benar ada di struktur organisasi. Karyawan yang
 * sudah dinonaktifkan di Lark tidak lagi muncul di pohon, jadi sesinya yang
 * masih tersisa otomatis kehilangan akses ke data.
 */
function viewerStillInOrg(payload: CachedPayload, openId: string): boolean {
  return flattenPeople(payload.root).some((p) => p.id === openId);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const refreshKey = process.env.ORG_REFRESH_KEY;
  const hasValidKey = Boolean(refreshKey) && url.searchParams.get('key') === refreshKey;
  const wantsRefresh = url.searchParams.get('refresh') === '1';

  // Refresh: dengan key → selalu; tanpa key → dibatasi 1x per menit, dan bila
  // ORG_REFRESH_KEY dikonfigurasi, permintaan tanpa key cukup dilayani dari cache
  // (bukan error) supaya tombol "Sinkron ulang" tidak pernah mengosongkan bagan.
  let refreshThrottled = false;
  if (wantsRefresh) {
    if (hasValidKey) {
      clearCache(CACHE_KEY);
    } else if (!refreshKey && Date.now() - lastBuiltAt >= MIN_REFRESH_INTERVAL_MS) {
      clearCache(CACHE_KEY);
    } else {
      refreshThrottled = true;
    }
  }

  const { disabled: authDisabled } = authConfig();
  const viewer = authDisabled ? null : await getViewer();

  const respond = (payload: CachedPayload, cachedHit: boolean) => {
    if (!authDisabled && (!viewer || !viewerStillInOrg(payload, viewer.openId))) {
      return NextResponse.json<OrgErrorResponse>(
        {
          ok: false,
          error: 'Akun Anda tidak ditemukan di struktur organisasi (mungkin sudah nonaktif).',
          hint: 'Hubungi admin Lark bila Anda merasa masih aktif.',
          code: 'NOT_IN_ORG',
        },
        { status: 403 },
      );
    }
    return NextResponse.json<OrgResponse & { refreshThrottled?: boolean }>(
      { ok: true, ...payload, cached: cachedHit, source: 'lark', refreshThrottled },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  };

  const cached = getCached<CachedPayload>(CACHE_KEY);
  if (cached) return respond(cached, true);

  try {
    const { root, stats, deptLevel } = await buildOrgTree();
    const payload: CachedPayload = { root, stats, deptLevel, generatedAt: new Date().toISOString() };
    setCached(CACHE_KEY, payload, TTL);
    lastBuiltAt = Date.now();

    return respond(payload, false);
  } catch (error) {
    console.error('[api/org] gagal membangun struktur organisasi:', error);

    if (error instanceof LarkApiError) {
      return NextResponse.json<OrgErrorResponse>(
        { ok: false, error: error.message, hint: error.hint, code: error.code },
        { status: error.code === 'ENV_MISSING' ? 500 : 502 },
      );
    }

    return NextResponse.json<OrgErrorResponse>(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Terjadi kesalahan tidak dikenal.',
        code: 'UNKNOWN',
      },
      { status: 500 },
    );
  }
}
