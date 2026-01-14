import type { Metadata, Viewport } from 'next';
import { Space_Mono, DM_Sans } from 'next/font/google';
import './globals.css';

const spaceMono = Space_Mono({
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

const dmSans = DM_Sans({
  weight: ['400', '500', '600'],
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'KATALOG — Things in Life',
  description: 'A personal catalog of everyday objects, furniture, and 3D models.',
  keywords: ['catalog', '3D', 'objects', 'furniture', 'collection', 'GLB'],
  authors: [{ name: 'iverfinne' }],
  openGraph: {
    title: 'KATALOG',
    description: 'A personal catalog of things in life',
    type: 'website',
    url: 'https://katalog.iverfinne.no',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#f5f5f5',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="no" className={`${spaceMono.variable} ${dmSans.variable}`}>
      <body className="font-sans antialiased bg-[#f5f5f5] text-gray-900">
        {children}
      </body>
    </html>
  );
}
