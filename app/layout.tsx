import type { Metadata } from 'next';
import { Bricolage_Grotesque, Space_Grotesk, Space_Mono } from 'next/font/google';
import Footer from '@/components/Footer';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

const display = Bricolage_Grotesque({
  subsets: ['latin'],
  weight: ['700', '800'],
  variable: '--font-display',
  display: 'swap',
});
const body = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-body',
  display: 'swap',
});
const mono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-data',
  display: 'swap',
});

const orgName = process.env.NEXT_PUBLIC_ORG_NAME || 'Perusahaan';

export const metadata: Metadata = {
  title: `Struktur Organisasi — ${orgName}`,
  description: `Struktur organisasi ${orgName}, disinkronkan otomatis dari Lark.`,
};

/** Set data-theme SEBELUM paint supaya tema tersimpan tidak flash.
 *  Default LIGHT — dark hanya bila pengguna memilih lewat toggle. */
const themeInitScript = `try{var t=localStorage.getItem('onda-theme');if(t!=='dark'&&t!=='light'){t='light'}document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='light'}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} min-h-screen bg-paper font-sans text-ink`}
      >
        <SmoothScroll>
          {children}
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
