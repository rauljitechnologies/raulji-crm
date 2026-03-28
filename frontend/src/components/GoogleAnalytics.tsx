'use client';
import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

declare global {
  interface Window {
    gtag: (...args: any[]) => void;
    dataLayer: any[];
  }
}

interface Props {
  gaId: string;
  domain?: string;
}

export default function GoogleAnalytics({ gaId, domain }: Props) {
  const pathname      = usePathname();
  const searchParams  = useSearchParams();

  // Inject gtag.js once
  useEffect(() => {
    if (!gaId || typeof window === 'undefined') return;
    if (document.getElementById('gtag-script')) return; // already loaded

    // gtag.js script
    const s = document.createElement('script');
    s.id  = 'gtag-script';
    s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
    s.async = true;
    document.head.appendChild(s);

    // inline init
    const i = document.createElement('script');
    i.id = 'gtag-init';
    i.innerHTML = `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${gaId}', {
        page_path: window.location.pathname,
        ${domain ? `cookie_domain: '${domain}',` : ''}
        send_page_view: false
      });
    `;
    document.head.appendChild(i);
  }, [gaId, domain]);

  // Track page views on route change
  useEffect(() => {
    if (!gaId || typeof window === 'undefined' || typeof window.gtag !== 'function') return;
    const url = pathname + (searchParams.toString() ? `?${searchParams.toString()}` : '');
    window.gtag('config', gaId, { page_path: url });
  }, [gaId, pathname, searchParams]);

  return null;
}
