import { NextResponse } from 'next/server';
import { LarkApiError, getTenantAccessToken, larkConfig } from '@/lib/lark';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Endpoint diagnostik (hanya untuk pengguna yang sudah login — dijaga middleware):
 * cek apakah credential Lark sudah benar. Memakai token yang di-cache supaya
 * tidak bisa dipakai membanjiri endpoint token Lark.
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
    await getTenantAccessToken();
    return NextResponse.json({
      ok: true,
      message: 'Berhasil terhubung ke Lark. Credential valid.',
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
