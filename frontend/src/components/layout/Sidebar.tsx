'use client';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { NAV, NavIcon, getEffectivePerms } from '@/components/layout/nav';
import { Avatar, UIIcons, useTheme } from '@/components/ui';
import { companyApi } from '@/lib/api';

const COLLAPSED_KEY = 'sidebarCollapsed';

export default function Sidebar({ mobileOpen = false, onMobileClose }: { mobileOpen?: boolean; onMobileClose?: () => void }) {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]   = useState<any>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [collapsed, setCollapsed] = useState(false);
  const [workspace, setWorkspace] = useState<{ name: string; plan?: string } | null>(null);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(u);
      setPerms(getEffectivePerms(u));
      setCollapsed(localStorage.getItem(COLLAPSED_KEY) === '1');
      const cached = localStorage.getItem('workspaceInfo');
      if (cached) setWorkspace(JSON.parse(cached));
      // Refresh workspace label in the background
      companyApi.mine().then(res => {
        const co = res?.companies?.[0];
        if (co?.name) {
          const ws = { name: co.name, plan: co.plan };
          setWorkspace(ws);
          localStorage.setItem('workspaceInfo', JSON.stringify(ws));
        }
      }).catch(() => {});
    } catch {}
  }, []);

  // Auto-close mobile sidebar on route change
  useEffect(() => { onMobileClose?.(); }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapsed = () => {
    setCollapsed(c => {
      const next = !c;
      try { localStorage.setItem(COLLAPSED_KEY, next ? '1' : '0'); } catch {}
      return next;
    });
  };

  const logout = () => {
    localStorage.clear();
    document.cookie = 'accessToken=; max-age=0; path=/';
    router.push('/login');
  };

  const roleFmt = user?.role?.replace(/_/g, ' ').toLowerCase() || 'user';

  const filteredNav = useMemo(() => {
    const lq = query.trim().toLowerCase();
    return NAV.map(g => ({
      ...g,
      items: g.items.filter(i => perms[i.perm] !== false && (!lq || i.label.toLowerCase().includes(lq))),
    })).filter(g => g.items.length > 0);
  }, [perms, query]);

  // Collapse applies on desktop only; the mobile drawer is always full width.
  const isCollapsed = collapsed && !mobileOpen;
  const width = isCollapsed ? 70 : 236;

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          style={{ background: 'rgba(11,17,32,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={onMobileClose}
        />
      )}

      <aside
        className={`flex-col flex-shrink-0 ${mobileOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden md:flex'}`}
        style={{
          width,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          transition: 'width 0.28s cubic-bezier(0.22,1,0.36,1)',
        }}>

        {/* ── Logo + collapse ─────────────────────────────── */}
        <div className={`flex items-center gap-2.5 flex-shrink-0 ${isCollapsed ? 'justify-center px-2' : 'px-4'}`}
          style={{ height: 58, borderBottom: '1px solid var(--border)' }}>
          <div className="flex-shrink-0 flex items-center justify-center overflow-hidden"
            style={{ width: 34, height: 34, borderRadius: 11, background: 'var(--grad-brand)', padding: 3, boxShadow: '0 4px 12px -4px rgba(37,99,235,0.5)' }}>
            <Image
              src="https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png"
              alt="Raulji Logo"
              width={28}
              height={28}
              style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 8, background: '#fff' }}
              priority
            />
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <div className="truncate" style={{ color: 'var(--text)', fontSize: 13.5, fontWeight: 800, letterSpacing: '-0.01em' }}>Raulji CRM</div>
              <div className="truncate" style={{ color: 'var(--text-3)', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sales Intelligence</div>
            </div>
          )}
          {!isCollapsed && (
            <button onClick={toggleCollapsed} title="Collapse sidebar" aria-label="Collapse sidebar"
              className="hidden md:flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[var(--surface-2)]"
              style={{ width: 26, height: 26, borderRadius: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/><path d="m15 10-2 2 2 2"/>
              </svg>
            </button>
          )}
        </div>

        {/* ── Workspace chip ──────────────────────────────── */}
        {!isCollapsed && workspace && (
          <div className="px-3 pt-3 flex-shrink-0">
            <Link href={perms.companies !== false ? '/dashboard/companies' : '/dashboard'}
              className="flex items-center gap-2.5 transition-all hover:border-[var(--border-strong)]"
              style={{ padding: '8px 10px', borderRadius: 12, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <div className="flex items-center justify-center flex-shrink-0"
                style={{ width: 26, height: 26, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 10, fontWeight: 800 }}>
                {workspace.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="truncate" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{workspace.name}</div>
                <div className="truncate capitalize" style={{ fontSize: 10, color: 'var(--text-3)' }}>{workspace.plan?.toLowerCase() || 'workspace'}</div>
              </div>
              <span style={{ color: 'var(--text-3)' }}>{UIIcons.chevronDown(12)}</span>
            </Link>
          </div>
        )}

        {/* ── Nav search ──────────────────────────────────── */}
        {!isCollapsed && (
          <div className="px-3 pt-3 flex-shrink-0">
            <div className="flex items-center gap-2" style={{ padding: '6px 10px', borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text-3)', flexShrink: 0 }}>{UIIcons.search(13)}</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Find in menu…"
                className="w-full bg-transparent"
                style={{ fontSize: 12, color: 'var(--text)', border: 'none' }}
              />
            </div>
          </div>
        )}

        {/* ── Nav ─────────────────────────────────────────── */}
        <nav className={`flex-1 overflow-y-auto py-2 ${isCollapsed ? 'px-2.5' : 'px-3'}`}>
          {filteredNav.map(group => (
            <div key={group.section} className="mb-1">
              {!isCollapsed ? (
                <div className="px-2 pt-3 pb-1.5 uppercase font-bold"
                  style={{ color: 'var(--text-3)', fontSize: 10, letterSpacing: '0.1em' }}>
                  {group.section}
                </div>
              ) : (
                <div className="mx-1 my-2.5" style={{ height: 1, background: 'var(--border)' }} />
              )}
              {group.items.map(item => {
                const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                return (
                  <Link key={item.href} href={item.href}
                    title={isCollapsed ? item.label : undefined}
                    className={`nav-item ${active ? 'is-active' : ''} flex items-center gap-2.5 mb-0.5 ${isCollapsed ? 'justify-center' : ''}`}
                    style={{
                      padding: isCollapsed ? '9px 0' : '8px 10px',
                      borderRadius: 10,
                      color: active ? 'var(--primary)' : 'var(--text-2)',
                      fontSize: 12.5,
                      fontWeight: active ? 700 : 600,
                    }}>
                    <span className="flex-shrink-0 flex items-center" style={{ color: active ? 'var(--primary)' : 'var(--text-3)' }}>
                      <NavIcon name={item.key} size={17} />
                    </span>
                    {!isCollapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
          {filteredNav.length === 0 && (
            <div className="px-2 py-6 text-center" style={{ fontSize: 12, color: 'var(--text-3)' }}>Nothing matches “{query}”</div>
          )}
        </nav>

        {/* ── Footer ──────────────────────────────────────── */}
        <div className={`flex-shrink-0 ${isCollapsed ? 'px-2.5' : 'px-3'} pb-3 pt-2`} style={{ borderTop: '1px solid var(--border)' }}>

          {/* Theme switch */}
          {!isCollapsed ? (
            <div className="flex items-center gap-1 mb-2 p-1" style={{ borderRadius: 11, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
              {(['light', 'dark'] as const).map(t => (
                <button key={t} onClick={() => theme !== t && toggle()}
                  className="flex-1 flex items-center justify-center gap-1.5 transition-all capitalize"
                  style={{
                    padding: '5px 0', borderRadius: 8, cursor: 'pointer', fontSize: 11.5, fontWeight: 600,
                    background: theme === t ? 'var(--surface)' : 'transparent',
                    color: theme === t ? 'var(--text)' : 'var(--text-3)',
                    border: theme === t ? '1px solid var(--border)' : '1px solid transparent',
                    boxShadow: theme === t ? 'var(--shadow-xs)' : 'none',
                  }}>
                  {t === 'light' ? UIIcons.sun(13) : UIIcons.moon(12)} {t}
                </button>
              ))}
            </div>
          ) : (
            <button onClick={toggle} title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
              className="w-full flex items-center justify-center mb-2 transition-colors hover:bg-[var(--surface-2)]"
              style={{ padding: '8px 0', borderRadius: 10, color: 'var(--text-2)', background: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}>
              {theme === 'dark' ? UIIcons.sun(15) : UIIcons.moon(14)}
            </button>
          )}

          {/* Expand button when collapsed */}
          {isCollapsed && (
            <button onClick={toggleCollapsed} title="Expand sidebar" aria-label="Expand sidebar"
              className="w-full flex items-center justify-center mb-2 transition-colors hover:bg-[var(--surface-2)]"
              style={{ padding: '8px 0', borderRadius: 10, color: 'var(--text-2)', background: 'none', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="16" rx="3"/><path d="M9.5 4v16"/><path d="m13 10 2 2-2 2"/>
              </svg>
            </button>
          )}

          {/* User card */}
          <div className={`flex items-center gap-2.5 ${isCollapsed ? 'justify-center' : ''}`}
            style={{ padding: isCollapsed ? '6px 0' : '8px 10px', borderRadius: 12, background: isCollapsed ? 'transparent' : 'var(--surface-2)', border: isCollapsed ? 'none' : '1px solid var(--border)' }}>
            <Link href="/dashboard/account" className="flex items-center gap-2.5 flex-1 min-w-0 group" title={isCollapsed ? (user?.name || 'Account') : undefined} style={{ justifyContent: isCollapsed ? 'center' : 'flex-start' }}>
              <Avatar name={user?.name} size={30} gradient />
              {!isCollapsed && (
                <div className="flex-1 min-w-0">
                  <div className="truncate group-hover:text-[var(--primary)] transition-colors" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{user?.name || 'User'}</div>
                  <div className="truncate capitalize" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{roleFmt}</div>
                </div>
              )}
            </Link>
            {!isCollapsed && (
              <button onClick={logout} title="Sign out" aria-label="Sign out"
                className="flex items-center justify-center flex-shrink-0 transition-all hover:bg-[var(--danger-soft)] hover:text-[var(--danger-ink)]"
                style={{ width: 28, height: 28, borderRadius: 9, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
                {UIIcons.logout(14)}
              </button>
            )}
          </div>
        </div>

      </aside>
    </>
  );
}
