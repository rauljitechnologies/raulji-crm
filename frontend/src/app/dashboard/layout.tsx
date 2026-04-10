'use client';
import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import GoogleAnalytics from '@/components/GoogleAnalytics';
import { companyApi } from '@/lib/api';

function HamburgerIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function GALoader() {
  const [gaId,   setGaId]   = useState('');
  const [domain, setDomain] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const coData = await companyApi.mine();
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: '#f0f5fa' }}>
      <CookieGuard />
      <GALoader />
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={closeSidebar} />

      {/* Mobile hamburger button — fixed over topbar area */}
      <button
        className="md:hidden fixed top-3.5 left-3.5 z-30 w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: '#192b3f', color: '#ffffff' }}
        onClick={() => setSidebarOpen(true)}
        aria-label="Open menu"
      >
        <HamburgerIcon />
      </button>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {children}
      </main>
    </div>
  );
}
