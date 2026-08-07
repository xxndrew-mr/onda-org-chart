import OrgExplorer from '@/components/OrgExplorer';

export default function Page() {
  const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'Perusahaan';
  return <OrgExplorer orgName={orgName} />;
}
