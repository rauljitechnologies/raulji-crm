'use client';
import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { companyApi } from '@/lib/api';

function GALoader() {
  const [gaId,   setGaId]   = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const coData = await companyApi.list({ limit: '1' });
        const co = coData.companies?.[0];
        if (!co) return;
        const s = await companyApi.getSettings(co.companyId);
        const gaTrackingId = s?.settings?.gaTrackingId || '';
        const siteDomain   = s?.domain || s?.website?.replace(/^https?:\/\//, '').split('/')[0] || '';
        if (gaTrackingId) {
          setGaId(gaTrackingId);
          setDomain(siteDomain);
        }
      } catch {}
    })();
  }, []);

  if (!gaId) return null;
  return (
    <Suspense fallback={null}>
      <GoogleAnalytics gaId={gaId} domain={domain} />
    </Suspense>
  );
}

function CookieGuard() {
  const router = useRouter();
  useEffect(() => {
    // If cookie is missing but localStorage has a token, restore it so middleware doesn't redirect to /login
    const token = localStorage.getItem('accessToken');
    if (!token) { router.replace('/login'); return; }
    const hasCookie = document.cookie.split(';').some(c => c.trim().startsWith('accessToken='));
    if (!hasCookie) {
      document.cookie = `accessToken=${token}; path=/; max-age=604800`;
    }
  }, [router]);
  return null;
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f5fa' }}>
      <CookieGuard />
      <GALoader />
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
