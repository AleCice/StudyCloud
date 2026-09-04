import './globals.css';
import 'katex/dist/katex.min.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'StudyCloud',
  description: 'La tua piattaforma personale per lo studio e la gestione dei materiali',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'StudyCloud',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: '#000000',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="it">
      <head>
        {/* Google Fonts: preconnect + non-blocking stylesheet (moved from CSS @import) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body>
        {children}

        {/* iOS Standalone: prevent internal links from escaping to Safari */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                if (!window.navigator.standalone) return;
                document.addEventListener('click', function(e) {
                  var t = e.target;
                  while (t && t.tagName !== 'A') t = t.parentNode;
                  if (!t || t.tagName !== 'A') return;
                  var href = t.getAttribute('href');
                  if (!href) return;
                  // Allow external links, mailto, tel, and hash links to behave normally
                  if (href.startsWith('http') && !href.startsWith(window.location.origin)) return;
                  if (href.startsWith('mailto:') || href.startsWith('tel:') || href.startsWith('#')) return;
                  if (t.getAttribute('target') === '_blank') return;
                  e.preventDefault();
                  window.location.href = href;
                }, false);
              })();
            `,
          }}
        />
      </body>
    </html>
  );
}
