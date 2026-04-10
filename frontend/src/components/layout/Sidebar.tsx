'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

type PermKey = 'dashboard'|'companies'|'leads'|'pipeline'|'deals'|'clients'|'quotations'|'invoices'|'analytics'|'users'|'settings'|'api'|'whatsapp'|'campaigns'|'templates'|'backup'|'project'|'expenses';

const ROLE_DEFAULTS: Record<string, Record<PermKey, boolean>> = {
  SUPER_ADMIN:   { dashboard:true,companies:true,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,users:true,settings:true,api:true,whatsapp:true,campaigns:true,templates:true,backup:true,project:true,expenses:true },
  ADMIN:         { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,users:true,settings:true,api:true,whatsapp:true,campaigns:true,templates:true,backup:false,project:true,expenses:true },
  SALES_MANAGER: { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,users:false,settings:false,api:false,whatsapp:true,campaigns:true,templates:true,backup:false,project:true,expenses:true },
  SALES_REP:     { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:false,analytics:false,users:false,settings:false,api:false,whatsapp:true,campaigns:false,templates:false,backup:false,project:false,expenses:false },
  VIEWER:        { dashboard:true,companies:false,leads:true,pipeline:false,deals:false,clients:false,quotations:false,invoices:false,analytics:true,users:false,settings:false,api:false,whatsapp:false,campaigns:false,templates:false,backup:false,project:false,expenses:false },
};

function getEffectivePerms(user: any): Record<string, boolean> {
  const base = ROLE_DEFAULTS[user?.role] || ROLE_DEFAULTS.VIEWER;
  const overrides = user?.permissions || {};
  return { ...base, ...overrides };
}

// SVG Icons for crisp rendering
const Icons: Record<string, React.ReactNode> = {
  dashboard:   <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z"/></svg>,
  companies:   <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd"/></svg>,
  leads:       <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z"/></svg>,
  pipeline:    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3zM16 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM6.5 18a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/></svg>,
  deals:       <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd"/></svg>,
  clients:     <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
  quotations:  <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"/></svg>,
  invoices:    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z"/><path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd"/></svg>,
  whatsapp:    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd"/></svg>,
  campaigns:   <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z"/></svg>,
  templates:   <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/><path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd"/></svg>,
  analytics:   <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>,

  users:       <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/></svg>,
  settings:    <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd"/></svg>,
  api:         <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"/></svg>,
  backup:      <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path d="M7.707 10.293a1 1 0 10-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 11.586V6h5a2 2 0 012 2v7a2 2 0 01-2 2H4a2 2 0 01-2-2V8a2 2 0 012-2h5v5.586l-1.293-1.293zM9 4a1 1 0 012 0v2H9V4z"/></svg>,
  project:     <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M6 6V5a3 3 0 013-3h2a3 3 0 013 3v1h2a2 2 0 012 2v3.57A22.952 22.952 0 0110 13a22.95 22.95 0 01-8-1.43V8a2 2 0 012-2h2zm2-1a1 1 0 011-1h2a1 1 0 011 1v1H8V5zm1 5a1 1 0 011-1h.01a1 1 0 110 2H10a1 1 0 01-1-1z" clipRule="evenodd"/><path d="M2 13.692V16a2 2 0 002 2h12a2 2 0 002-2v-2.308A24.974 24.974 0 0110 15c-2.796 0-5.487-.46-8-1.308z"/></svg>,
  expenses: <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4"><path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/></svg>,
};

const NAV = [
  { section: 'Main', items: [
    { href: '/dashboard',             label: 'Dashboard',      key: 'dashboard',  perm: 'dashboard'  },
    { href: '/dashboard/companies',   label: 'Companies',      key: 'companies',  perm: 'companies'  },
    { href: '/dashboard/leads',       label: 'Leads',          key: 'leads',      perm: 'leads'      },
    { href: '/dashboard/pipeline',    label: 'Pipeline',       key: 'pipeline',   perm: 'pipeline'   },
    { href: '/dashboard/deals',       label: 'Deals',          key: 'deals',      perm: 'deals'      },
    { href: '/dashboard/projects',    label: 'Projects',       key: 'project',    perm: 'project'    },
  ]},
  { section: 'Finance', items: [
    { href: '/dashboard/clients',     label: 'Clients',        key: 'clients',    perm: 'clients'    },
    { href: '/dashboard/quotations',  label: 'Quotations',     key: 'quotations', perm: 'quotations' },
    { href: '/dashboard/invoices',    label: 'Invoices',       key: 'invoices',   perm: 'invoices'   },
    { href: '/dashboard/expenses',    label: 'Expenses',       key: 'expenses',   perm: 'expenses'   },
  ]},
  { section: 'Automation', items: [
    { href: '/dashboard/whatsapp',    label: 'WhatsApp Hub',   key: 'whatsapp',   perm: 'whatsapp'   },
    { href: '/dashboard/campaigns',   label: 'Campaigns',      key: 'campaigns',  perm: 'campaigns'  },
    { href: '/dashboard/templates',   label: 'Templates',      key: 'templates',  perm: 'templates'  },
  ]},
  { section: 'Insights', items: [
    { href: '/dashboard/analytics',   label: 'Analytics',      key: 'analytics',  perm: 'analytics'  },
  ]},
  { section: 'System', items: [
    { href: '/dashboard/users',         label: 'Users',          key: 'users',        perm: 'users'        },
    { href: '/dashboard/settings',      label: 'Settings',       key: 'settings',     perm: 'settings'     },
    { href: '/dashboard/api-docs',      label: 'API & Webhooks', key: 'api',          perm: 'api'          },
    { href: '/dashboard/backup',        label: 'Backups',        key: 'backup',       perm: 'backup'       },
  ]},
];

export default function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<any>(null);
  const [perms, setPerms] = useState<Record<string,boolean>>({});

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(u);
      setPerms(getEffectivePerms(u));
    } catch {}
  }, []);

  // Auto-close mobile sidebar on route change
  useEffect(() => { onMobileClose?.(); }, [pathname]);

  const logout = () => {
    localStorage.clear();
    document.cookie = 'accessToken=; max-age=0; path=/';
    router.push('/login');
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const roleFmt  = user?.role?.replace(/_/g, ' ') || 'User';

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onMobileClose}
        />
      )}

    <aside
      className={`flex-col flex-shrink-0 overflow-y-auto ${mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden md:flex'}`}
      style={{ width: 228, background: '#192b3f' }}>

      {/* Logo */}
      <div className="px-4 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex-shrink-0 rounded-xl overflow-hidden" style={{ width: 36, height: 36, background: '#ffffff', padding: 2 }}>
          <Image
            src="https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png"
            alt="Raulji Logo"
            width={32}
            height={32}
            style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8 }}
            priority
          />
        </div>
        <div>
          <div className="font-bold text-sm tracking-wide" style={{ color: '#ffffff', fontFamily: 'var(--font-montserrat)' }}>RAULJI CRM</div>
          <div className="text-xs mt-0.5" style={{ color: '#4a6a85', fontSize: 10 }}>Sales Intelligence</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2">
        {NAV.map(group => {
          const visibleItems = group.items.filter(item => perms[item.perm] !== false);
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.section} className="mb-1">
              <div className="px-3 pt-3 pb-1.5 uppercase tracking-widest font-semibold"
                style={{ color: '#3a5870', fontSize: 10, letterSpacing: '0.1em' }}>
                {group.section}
              </div>
              {visibleItems.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all mb-0.5"
                    style={{
                      color:      active ? '#ffffff' : '#7a9baf',
                      background: active ? 'rgba(49,153,212,0.18)' : 'transparent',
                      borderLeft: active ? '2.5px solid #3199d4' : '2.5px solid transparent',
                    }}>
                    <span style={{ color: active ? '#3199d4' : '#4a6a85', flexShrink: 0 }}>{Icons[item.key]}</span>
                    <span style={{ fontSize: 12.5 }}>{item.label}</span>
                    {active && <span className="ml-auto w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3199d4' }} />}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Footer */}
      <div className="p-3 mx-2 mb-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2.5">
          {/* Clicking avatar/name → account page */}
          <Link href="/dashboard/account" className="flex items-center gap-2.5 flex-1 min-w-0 group">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 group-hover:ring-2 group-hover:ring-sky-400 transition-all"
              style={{ background: 'linear-gradient(135deg, #3199d4, #1a72a3)' }}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate group-hover:text-white transition-colors" style={{ color: '#d0e8f5' }}>{user?.name || 'User'}</div>
              <div className="text-xs truncate capitalize" style={{ color: '#4a6a85', fontSize: 10 }}>{roleFmt.toLowerCase()}</div>
            </div>
          </Link>
          {/* Logout button — clearly separated */}
          <button onClick={logout} title="Sign out"
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-500/20 flex-shrink-0"
            style={{ color: '#4a6a85' }}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
            </svg>
          </button>
        </div>
      </div>

    </aside>
    </>
  );
}
