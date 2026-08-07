import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'Perusahaan';

export const metadata: Metadata = {
  title: `Struktur Organisasi — ${orgName}`,
  description: `Struktur organisasi ${orgName}, disinkronkan otomatis dari Lark.`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${inter.variable} min-h-screen font-sans`}>{children}</body>
    </html>
  );
}
