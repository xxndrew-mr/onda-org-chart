import { NextResponse } from 'next/server';
import { clearCache, getCached, setCached } from '@/lib/cache';
import { LarkApiError } from '@/lib/lark';
import { buildOrgTree } from '@/lib/org';
import type { OrgErrorResponse, OrgResponse } from '@/lib/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/** Bangun pohon org bisa makan waktu kalau departemennya banyak */
export const maxDuration = 60;

const CACHE_KEY = 'org-tree';
const TTL = Number(process.env.ORG_CACHE_TTL_SECONDS || 600);

type CachedPayload = Pick<OrgResponse, 'root' | 'stats' | 'deptLevel' | 'generatedAt'>;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const wantsRefresh = url.searchParams.get('refresh') === '1';
  const refreshKey = process.env.ORG_REFRESH_KEY;

  if (wantsRefresh) {
    if (refreshKey && url.searchParams.get('key') !== refreshKey) {
      return NextResponse.json<OrgErrorResponse>(
        { ok: false, error: 'Refresh key tidak valid.', code: 'BAD_REFRESH_KEY' },
        { status: 401 },
      );
    }
    clearCache(CACHE_KEY);
  }

  const cached = getCached<CachedPayload>(CACHE_KEY);
  if (cached) {
    return NextResponse.json<OrgResponse>(
      { ok: true, ...cached, cached: true, source: 'lark' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const { root, stats, deptLevel } = await buildOrgTree();
    const payload: CachedPayload = { root, stats, deptLevel, generatedAt: new Date().toISOString() };
    setCached(CACHE_KEY, payload, TTL);

    return NextResponse.json<OrgResponse>(
      { ok: true, ...payload, cached: false, source: 'lark' },
      { headers: { 'Cache-Control': 'no-store' } },
    );
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
