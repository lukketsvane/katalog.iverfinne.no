import type { Metadata, Viewport } from 'next';
import './globals.css';

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
    <html lang="no">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" 
          rel="stylesheet" 
        />
      </head>
      <body className="font-sans antialiased bg-[#f5f5f5] text-gray-900">
        {children}
      </body>
    </html>
  );
}
