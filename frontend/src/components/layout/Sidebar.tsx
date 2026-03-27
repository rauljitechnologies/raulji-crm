'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const NAV = [
  { section: 'Main', items: [
    { href: '/dashboard',             label: 'Dashboard',      icon: '▦' },
    { href: '/dashboard/companies',   label: 'Companies',      icon: '🏢' },
    { href: '/dashboard/leads',       label: 'Leads',          icon: '👤' },
    { href: '/dashboard/pipeline',    label: 'Pipeline',       icon: '⬛' },
    { href: '/dashboard/deals',       label: 'Deals',          icon: '★' },
  ]},
  { section: 'Finance', items: [
    { href: '/dashboard/clients',     label: 'Clients',        icon: '🏛' },
    { href: '/dashboard/quotations',  label: 'Quotations',     icon: '📄' },
    { href: '/dashboard/invoices',    label: 'Invoices',       icon: '💳' },
  ]},
  { section: 'Insights', items: [
    { href: '/dashboard/analytics',   label: 'Analytics',      icon: '📊' },
    { href: '/dashboard/ai',          label: 'AI Insights',    icon: '✨' },
  ]},
  { section: 'System', items: [
    { href: '/dashboard/users',       label: 'Users',          icon: '👥' },
    { href: '/dashboard/settings',    label: 'Settings',       icon: '⚙' },
  ]},
];

export default function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('user') || '{}')); } catch {}
  }, []);

  const logout = () => {
    localStorage.clear();
    document.cookie = 'accessToken=; max-age=0; path=/';
    router.push('/login');
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';

  return (
    <aside className="w-56 flex flex-col flex-shrink-0 overflow-y-auto" style={{ background: '#1e1b4b' }}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>R</div>
        <div>
          <div className="text-white font-bold text-sm">RAULJI CRM</div>
          <div className="text-xs mt-0.5" style={{ color: '#7c7fab' }}>v1.0</div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-2">
        {NAV.map(group => (
          <div key={group.section}>
            <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest" style={{ color: '#4c4a7a', fontSize: 10 }}>{group.section}</div>
            {group.items.map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  className="flex items-center gap-2.5 mx-2 px-3 py-2 rounded-lg text-xs transition-all"
                  style={{ color: active ? '#a5b4fc' : '#8b8db8', background: active ? 'rgba(99,102,241,0.15)' : 'transparent' }}>
                  <span style={{ fontSize: 13, opacity: active ? 1 : 0.6 }}>{item.icon}</span>
                  <span className="font-medium">{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="p-3 border-t border-white/10 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0" style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)' }}>{initials}</div>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-semibold truncate" style={{ color: '#c7d2fe' }}>{user?.name || 'User'}</div>
          <div className="text-xs truncate" style={{ color: '#6366a0', fontSize: 10 }}>{user?.role?.replace('_', ' ').toLowerCase()}</div>
        </div>
        <button onClick={logout} title="Logout" style={{ color: '#6366a0', opacity: 0.7 }}
          className="hover:opacity-100 transition-opacity text-sm">⎋</button>
      </div>
    </aside>
  );
}
