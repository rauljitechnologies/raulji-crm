import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Raulji CRM',
  description: 'Multi-tenant CRM for modern sales teams',
  icons: {
    icon: '/icon.svg',
    shortcut: '/icon.svg',
    apple: '/icon.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
