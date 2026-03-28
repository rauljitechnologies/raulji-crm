import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, Montserrat } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  variable: '--font-plus-jakarta',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const montserrat = Montserrat({
  subsets: ['latin'],
  variable: '--font-montserrat',
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Raulji CRM',
  description: 'Multi-tenant CRM for modern sales teams',
  icons: {
    icon: [
      { url: 'https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png', sizes: '192x192', type: 'image/png' },
    ],
    apple: 'https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png',
    shortcut: 'https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${montserrat.variable}`}>
      <body>{children}</body>
    </html>
  );
}
