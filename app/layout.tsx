import type { Metadata } from 'next';
import './globals.css';

const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'Perusahaan';

export const metadata: Metadata = {
  title: `Struktur Organisasi — ${orgName}`,
  description: `Struktur organisasi ${orgName}, disinkronkan otomatis dari Lark.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
