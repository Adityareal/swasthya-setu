import type { Metadata, Viewport } from 'next';
import { Mukta } from 'next/font/google';
import './globals.css';

/**
 * Mukta (Ek Type, Girish Dalvi) is the load-bearing typography choice: it is
 * drawn as ONE family across Devanagari and Latin, proportioned together. Most
 * Latin-first webfonts draw no Devanagari at all, so Hindi silently falls back
 * to whatever Android serves and the two scripts then render at visibly
 * different optical sizes on the same line.
 */
const mukta = Mukta({
  variable: '--font-mukta',
  weight: ['400', '600', '800'],
  subsets: ['latin', 'devanagari'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Swasthya Setu',
  description:
    'Right Patient → Right Care → Right Facility → Right Time. One continuous health record across Patient, ASHA and Doctor.',
  applicationName: 'Swasthya Setu',
  /* Installability. Two reasons this is worth the four lines: a browser-installed
     PWA is a working demo path that does not depend on the APK build landing, and
     the same manifest is what makes the Android WebView report a sane app
     identity. `metadata.manifest` emits the <link rel="manifest"> for every route
     in the export, so it survives static generation. */
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
  },
  appleWebApp: {
    capable: true,
    title: 'Swasthya Setu',
    statusBarStyle: 'black-translucent',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0B3B33',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* `lang` is corrected on the client by the i18n layer when the locale
       changes; en-IN is the SSR default. */
    <html lang="en-IN">
      <body className={`${mukta.variable} antialiased`}>{children}</body>
    </html>
  );
}
