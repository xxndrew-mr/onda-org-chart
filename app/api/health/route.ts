import { NextResponse } from 'next/server';
import { LarkApiError, getTenantAccessToken, larkConfig } from '@/lib/lark';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint diagnostik: cek apakah credential Lark sudah benar
 * sebelum menyalahkan bagian lain. Buka /api/health di browser.
 */
export async function GET() {
  const config = {
    domain: larkConfig.domain,
    rootDepartmentId: larkConfig.rootDepartmentId,
    orgName: larkConfig.orgName,
    appIdSet: Boolean(process.env.LARK_APP_ID),
    appSecretSet: Boolean(process.env.LARK_APP_SECRET),
  };

  try {
    const token = await getTenantAccessToken(true);
    return NextResponse.json({
      ok: true,
      message: 'Berhasil terhubung ke Lark. Credential valid.',
      tokenPreview: `${token.slice(0, 6)}...${token.slice(-4)}`,
      config,
    });
  } catch (error) {
    const isLark = error instanceof LarkApiError;
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : 'Gagal terhubung ke Lark.',
        hint: isLark ? error.hint : undefined,
        code: isLark ? error.code : 'UNKNOWN',
        config,
      },
      { status: 500 },
    );
  }
}
