import OrgExplorer from '@/components/OrgExplorer';
import { getViewer } from '@/lib/auth';

// Membaca cookie sesi → halaman dirender per-request
export const dynamic = 'force-dynamic';

export default async function Page() {
  const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'Perusahaan';
  const session = await getViewer();
  const viewer = session
    ? { openId: session.openId, name: session.name, avatar: session.avatar }
    : null;

  return <OrgExplorer orgName={orgName} viewer={viewer} />;
}
