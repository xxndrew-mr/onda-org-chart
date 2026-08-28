import { NextResponse } from 'next/server';
import { getViewer } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** Identitas pengguna yang sedang login (untuk klien) */
export async function GET() {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json({ ok: false, error: 'Belum login' }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    viewer: { openId: viewer.openId, name: viewer.name, avatar: viewer.avatar, email: viewer.email },
  });
}
