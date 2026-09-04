import './globals.css';
import 'katex/dist/katex.min.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'StudyCloud',
  description: 'La tua piattaforma personale per lo studio e la gestione dei materiali',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#ffffff',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <body>{children}</body>
    </html>
  );
}
