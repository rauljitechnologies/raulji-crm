import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Raulji CRM — Sales Intelligence Platform',
  description: 'Multi-tenant CRM for modern sales teams',
  icons: {
    icon: [
      { url: 'https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: 'https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png',
    shortcut: 'https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png',
  },
};

// Applies the saved theme before first paint so dark mode never flashes light.
const themeBootScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark');document.documentElement.style.colorScheme='dark';}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
