'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { NAV, NavIcon, getEffectivePerms } from '@/components/layout/nav';

/* ══════════════════════════════════════════════════════════════
   Raulji CRM UI Kit — premium SaaS components.
   All values come from the token system in globals.css so every
   component works in both light and dark themes.
   ══════════════════════════════════════════════════════════════ */

// ── Hooks ─────────────────────────────────────────────────────
function useClickOutside<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);
  return ref;
}

export function useTheme() {
  const [theme, setThemeState] = useState<'light' | 'dark'>('light');
  useEffect(() => {
    setThemeState(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light');
  }, []);
  const setTheme = useCallback((t: 'light' | 'dark') => {
    setThemeState(t);
    if (t === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.style.colorScheme = 'light';
    }
    try { localStorage.setItem('theme', t); } catch {}
  }, []);
  const toggle = useCallback(() => setTheme(theme === 'dark' ? 'light' : 'dark'), [theme, setTheme]);
  return { theme, setTheme, toggle };
}

// ── Small shared icons (24 grid, stroke) ──────────────────────
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const ic = (size: number) => ({ width: size, height: size, viewBox: '0 0 24 24', ...S });

export const UIIcons = {
  search:  (s = 15) => <svg {...ic(s)}><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  plus:    (s = 15) => <svg {...ic(s)}><path d="M12 5v14M5 12h14"/></svg>,
  bell:    (s = 16) => <svg {...ic(s)}><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M10.3 19a2 2 0 0 0 3.4 0"/></svg>,
  sun:     (s = 16) => <svg {...ic(s)}><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>,
  moon:    (s = 16) => <svg {...ic(s)}><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/></svg>,
  check:   (s = 15) => <svg {...ic(s)}><path d="m4.5 12.5 5 5 10-11"/></svg>,
  x:       (s = 15) => <svg {...ic(s)}><path d="M6 6l12 12M18 6 6 18"/></svg>,
  chevronDown: (s = 14) => <svg {...ic(s)}><path d="m6 9 6 6 6-6"/></svg>,
  arrowRight:  (s = 14) => <svg {...ic(s)}><path d="M5 12h14M13 6l6 6-6 6"/></svg>,
  trendUp:  (s = 12) => <svg {...ic(s)}><path d="m4 17 5.5-6 3.5 3 7-8"/><path d="M15 6h5v5"/></svg>,
  trendDown:(s = 12) => <svg {...ic(s)}><path d="m4 7 5.5 6 3.5-3 7 8"/><path d="M15 18h5v-5"/></svg>,
  logout:  (s = 15) => <svg {...ic(s)}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/></svg>,
  user:    (s = 15) => <svg {...ic(s)}><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.2c.8-3.8 3.5-5.7 7-5.7s6.2 1.9 7 5.7"/></svg>,
  sparkle: (s = 15) => <svg {...ic(s)}><path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3Z"/><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6Z"/></svg>,
  command: (s = 13) => <svg {...ic(s)}><path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3"/></svg>,
  trash:   (s = 15) => <svg {...ic(s)}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>,
};

// ── Avatar ────────────────────────────────────────────────────
const AVATAR_HUES = [216, 262, 174, 32, 340, 200, 150, 280];
export function Avatar({ name, size = 30, gradient = false }: { name?: string; size?: number; gradient?: boolean }) {
  const initials = (name || 'U').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const hue = AVATAR_HUES[(name || 'U').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_HUES.length];
  return (
    <div className="flex items-center justify-center flex-shrink-0 font-bold text-white select-none"
      style={{
        width: size, height: size, borderRadius: '32%',
        fontSize: size * 0.36,
        background: gradient ? 'var(--grad-brand)' : `linear-gradient(135deg, hsl(${hue},72%,54%), hsl(${hue + 24},70%,44%))`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 2px 6px -2px rgba(17,24,39,0.3)',
      }}>
      {initials}
    </div>
  );
}

// ── Sparkline (12-point line, de-emphasis hue + accent tail) ──
export function Sparkline({ points, color = 'var(--chart-1)', width = 116, height = 30 }: { points: number[]; color?: string; width?: number; height?: number }) {
  if (!points || points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const pad = 3;
  const xy = points.map((v, i) => [
    pad + (i / (points.length - 1)) * (width - pad * 2),
    height - pad - ((v - min) / range) * (height - pad * 2),
  ]);
  const d = xy.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const last = xy[xy.length - 1];
  const gid = useRef(`sp${Math.random().toString(36).slice(2, 8)}`).current;
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.16" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} L${last[0].toFixed(1)},${height} L${xy[0][0].toFixed(1)},${height} Z`} fill={`url(#${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85" />
      <circle cx={last[0]} cy={last[1]} r="3.4" fill={color} stroke="var(--surface)" strokeWidth="2" />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
export function Skeleton({ w = '100%', h = 14, r = 8, className = '' }: { w?: number | string; h?: number; r?: number; className?: string }) {
  return <div className={`shimmer ${className}`} style={{ width: w, height: h, borderRadius: r }} />;
}

/* ══════════════════════════════════════════════════════════════
   TOPBAR — sticky glass header. Page supplies title/subtitle/
   actions; the kit supplies the global chrome: quick-add, ⌘K
   command palette, notifications, theme switch, profile menu.
   ══════════════════════════════════════════════════════════════ */

const QUICK_ADD = [
  { label: 'New Lead',      href: '/dashboard/leads',      key: 'leads' },
  { label: 'New Deal',      href: '/dashboard/deals',      key: 'deals' },
  { label: 'New Client',    href: '/dashboard/clients',    key: 'clients' },
  { label: 'New Quotation', href: '/dashboard/quotations', key: 'quotations' },
  { label: 'New Invoice',   href: '/dashboard/invoices',   key: 'invoices' },
];

function IconBtn({ title, onClick, children, active = false }: { title: string; onClick?: () => void; children: React.ReactNode; active?: boolean }) {
  return (
    <button onClick={onClick} title={title} aria-label={title}
      className="flex items-center justify-center flex-shrink-0 transition-all"
      style={{
        width: 32, height: 32, borderRadius: 10,
        color: active ? 'var(--primary)' : 'var(--text-2)',
        background: active ? 'var(--primary-soft)' : 'transparent',
        border: '1px solid transparent',
      }}
      onMouseEnter={e => { if (!active) { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.color = 'var(--text)'; } }}
      onMouseLeave={e => { if (!active) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-2)'; } }}>
      {children}
    </button>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (open) {
      setQ(''); setIdx(0);
      try { setPerms(getEffectivePerms(JSON.parse(localStorage.getItem('user') || '{}'))); } catch {}
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  const items = useMemo(() => {
    const all = NAV.flatMap(g => g.items.map(i => ({ ...i, section: g.section })))
      .filter(i => perms[i.perm] !== false);
    if (!q.trim()) return all;
    const lq = q.toLowerCase();
    return all.filter(i => i.label.toLowerCase().includes(lq) || i.section.toLowerCase().includes(lq));
  }, [q, perms]);

  useEffect(() => { setIdx(0); }, [q]);

  if (!open) return null;
  return (
    <div className="lux-modal-backdrop fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[14vh]"
      style={{ background: 'rgba(11,17,32,0.45)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="lux-modal-panel w-full flex flex-col overflow-hidden"
        style={{ maxWidth: 560, background: 'var(--surface)', borderRadius: 18, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 px-4" style={{ borderBottom: '1px solid var(--border)', height: 52 }}>
          <span style={{ color: 'var(--text-3)' }}>{UIIcons.search(17)}</span>
          <input ref={inputRef} value={q} onChange={e => setQ(e.target.value)}
            placeholder="Search pages, jump anywhere…"
            className="flex-1 bg-transparent"
            style={{ fontSize: 14, color: 'var(--text)', border: 'none' }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setIdx(i => Math.min(i + 1, items.length - 1)); }
              if (e.key === 'ArrowUp')   { e.preventDefault(); setIdx(i => Math.max(i - 1, 0)); }
              if (e.key === 'Enter' && items[idx]) { router.push(items[idx].href); onClose(); }
              if (e.key === 'Escape') onClose();
            }} />
          <kbd style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-3)', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px' }}>ESC</kbd>
        </div>
        <div className="overflow-y-auto py-2" style={{ maxHeight: 360 }}>
          {items.length === 0 && (
            <div className="px-4 py-8 text-center" style={{ fontSize: 13, color: 'var(--text-2)' }}>No results for “{q}”</div>
          )}
          {items.map((item, i) => (
            <button key={item.href} onClick={() => { router.push(item.href); onClose(); }}
              onMouseEnter={() => setIdx(i)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
              style={{ background: i === idx ? 'var(--primary-soft)' : 'transparent', border: 'none', cursor: 'pointer' }}>
              <span className="flex items-center justify-center flex-shrink-0"
                style={{ width: 28, height: 28, borderRadius: 8, color: i === idx ? 'var(--primary)' : 'var(--text-2)', background: i === idx ? 'transparent' : 'var(--surface-2)' }}>
                <NavIcon name={item.key} size={15} />
              </span>
              <span className="flex-1" style={{ fontSize: 13.5, fontWeight: 600, color: i === idx ? 'var(--primary)' : 'var(--text)' }}>{item.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.section}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [openMenu, setOpenMenu] = useState<'' | 'add' | 'bell' | 'user'>('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const menuRef = useClickOutside<HTMLDivElement>(useCallback(() => setOpenMenu(''), []));

  useEffect(() => {
    try { setUser(JSON.parse(localStorage.getItem('user') || '{}')); } catch {}
  }, []);

  // ⌘K / Ctrl+K opens the command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const logout = () => {
    localStorage.clear();
    document.cookie = 'accessToken=; max-age=0; path=/';
    router.push('/login');
  };

  return (
    <>
      <header className="glass flex-shrink-0 sticky top-0 z-30 pl-14 pr-3 md:px-5 flex items-center gap-2 topbar-mobile"
        style={{ borderBottom: '1px solid var(--border)', height: 58, minHeight: 58 }}>
        {/* Page identity */}
        <div className="min-w-0 flex-1 mr-1">
          <h1 className="truncate" style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', lineHeight: 1.2, letterSpacing: '-0.015em' }}>{title}</h1>
          {subtitle && <p className="truncate" style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{subtitle}</p>}
        </div>

        {/* Page-specific actions */}
        <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>

        {/* Global chrome */}
        <div ref={menuRef} className="hidden sm:flex items-center gap-1 flex-shrink-0 pl-2 ml-1 relative" style={{ borderLeft: '1px solid var(--border)' }}>
          {/* Search / command palette trigger */}
          <button onClick={() => setPaletteOpen(true)}
            className="hidden lg:flex items-center gap-2 transition-all"
            style={{
              height: 32, padding: '0 10px', borderRadius: 10, cursor: 'pointer',
              background: 'var(--surface-2)', border: '1px solid var(--border)',
              color: 'var(--text-3)', fontSize: 12.5, minWidth: 150,
            }}>
            {UIIcons.search(14)}
            <span className="flex-1 text-left" style={{ fontWeight: 500 }}>Search…</span>
            <kbd style={{ fontSize: 9.5, fontWeight: 700, color: 'var(--text-3)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 5, padding: '1px 5px' }}>⌘K</kbd>
          </button>
          <span className="lg:hidden"><IconBtn title="Search (⌘K)" onClick={() => setPaletteOpen(true)}>{UIIcons.search(16)}</IconBtn></span>

          {/* Quick add */}
          <IconBtn title="Quick add" active={openMenu === 'add'} onClick={() => setOpenMenu(m => m === 'add' ? '' : 'add')}>{UIIcons.plus(17)}</IconBtn>

          {/* Notifications */}
          <IconBtn title="Notifications" active={openMenu === 'bell'} onClick={() => setOpenMenu(m => m === 'bell' ? '' : 'bell')}>{UIIcons.bell(17)}</IconBtn>

          {/* Theme */}
          <IconBtn title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>
            {theme === 'dark' ? UIIcons.sun(16) : UIIcons.moon(15)}
          </IconBtn>

          {/* Profile */}
          <button onClick={() => setOpenMenu(m => m === 'user' ? '' : 'user')} title="Account"
            className="flex items-center flex-shrink-0 ml-0.5" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, borderRadius: 10 }}>
            <Avatar name={user?.name} size={30} gradient />
          </button>

          {/* ── Dropdowns ── */}
          {openMenu === 'add' && (
            <div className="pop-panel absolute right-0 top-11 w-52 py-1.5 z-50">
              <div className="px-3.5 pt-1.5 pb-1" style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Create</div>
              {QUICK_ADD.map(item => (
                <button key={item.label} onClick={() => { setOpenMenu(''); router.push(item.href); }}
                  className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-[var(--surface-2)]"
                  style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                  <span style={{ color: 'var(--primary)' }}><NavIcon name={item.key} size={14} /></span>
                  {item.label}
                </button>
              ))}
            </div>
          )}
          {openMenu === 'bell' && (
            <div className="pop-panel absolute right-0 top-11 w-72 z-50 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Notifications</span>
              </div>
              <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
                <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 14, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                  {UIIcons.check(18)}
                </div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>You’re all caught up</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', textAlign: 'center' }}>New activity on your leads and deals will show up here.</div>
              </div>
            </div>
          )}
          {openMenu === 'user' && (
            <div className="pop-panel absolute right-0 top-11 w-60 py-1.5 z-50">
              <div className="flex items-center gap-2.5 px-3.5 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                <Avatar name={user?.name} size={34} gradient />
                <div className="min-w-0">
                  <div className="truncate" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{user?.name || 'User'}</div>
                  <div className="truncate" style={{ fontSize: 11, color: 'var(--text-2)' }}>{user?.email || ''}</div>
                </div>
              </div>
              <button onClick={() => { setOpenMenu(''); router.push('/dashboard/account'); }}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 mt-1 text-left hover:bg-[var(--surface-2)]"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>
                <span style={{ color: 'var(--text-2)' }}>{UIIcons.user(14)}</span> My account
              </button>
              <button onClick={logout}
                className="w-full flex items-center gap-2.5 px-3.5 py-2 text-left hover:bg-[var(--danger-soft)]"
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, color: 'var(--danger-ink)' }}>
                <span>{UIIcons.logout(14)}</span> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const hasCustomPadding = /\bp-\d/.test(className);
  return (
    <div className={`lux-card ${hasCustomPadding ? '' : 'p-4'} ${className}`}
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, ...style }}>
      {children}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean;
}
export function Btn({ variant = 'secondary', size = 'md', loading, children, className = '', style, ...props }: BtnProps) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background: 'var(--grad-brand)', color: '#ffffff', border: '1px solid transparent' },
    secondary: { background: 'var(--surface)', color: 'var(--text)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-xs)' },
    danger:    { background: 'linear-gradient(135deg, #F05252 0%, #DC2626 100%)', color: '#ffffff', border: '1px solid transparent' },
    ghost:     { background: 'transparent', color: 'var(--text-2)', border: '1px solid transparent' },
  };
  const sz = size === 'sm'
    ? { padding: '5px 12px', fontSize: 12, borderRadius: 9 }
    : { padding: '7px 15px', fontSize: 12.5, borderRadius: 10 };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`lux-btn ${variant === 'primary' ? 'lux-btn-primary' : ''} inline-flex items-center gap-1.5 font-semibold disabled:opacity-50 cursor-pointer ${className}`}
      style={{ ...styles[variant], ...sz, ...style, fontFamily: 'inherit', fontWeight: 600 }}>
      {loading && (
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/>
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      )}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className = '', style, type, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  const isPassword = type === 'password';
  const [show, setShow] = useState(false);
  const effectiveType = isPassword ? (show ? 'text' : 'password') : type;

  return (
    <div className="flex flex-col gap-1">
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          {...props}
          type={effectiveType}
          className={`w-full transition-all ${className}`}
          style={{
            padding: '8px 12px',
            ...(isPassword ? { paddingRight: 38 } : null),
            fontSize: 13,
            borderRadius: 10,
            border: `1px solid ${error ? 'var(--danger)' : 'var(--border-strong)'}`,
            background: 'var(--surface)',
            color: 'var(--text)',
            fontFamily: 'inherit',
            ...(style as any),
          }}
          onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-ring)'; }}
          onBlur={e => { e.target.style.borderColor = error ? 'var(--danger)' : 'var(--border-strong)'; e.target.style.boxShadow = 'none'; }}
        />
        {isPassword && (
          <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', display: 'flex', cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}>
            {show ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && <span style={{ fontSize: 11, color: 'var(--danger-ink)' }}>{error}</span>}
    </div>
  );
}

// ── Password show/hide icons ──────────────────────────────────
export function EyeIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
export function EyeOffIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

// ── Select ────────────────────────────────────────────────────
export function Sel({ label, options, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</label>}
      <select
        {...props}
        className={`w-full transition-all ${className}`}
        style={{ padding: '8px 12px', fontSize: 13, borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const w = { sm: 440, md: 560, lg: 720, xl: 1040 }[size];
  return (
    <div className="lux-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(11,17,32,0.5)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="lux-modal-panel w-full max-h-[90vh] flex flex-col overflow-hidden modal-inner"
        style={{ maxWidth: w, background: 'var(--surface)', borderRadius: 20, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" className="flex items-center justify-center transition-all hover:bg-[var(--surface-2)]"
            style={{ width: 28, height: 28, borderRadius: 9, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}>
            {UIIcons.x(14)}
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Badge (status colors are semantic tokens, dark-mode aware) ─
const BADGE_STYLES: Record<string, { bg: string; fg: string }> = {
  new:           { bg: 'var(--primary-soft)',  fg: 'var(--primary)' },
  contacted:     { bg: 'var(--accent-soft)',   fg: 'var(--accent)' },
  qualified:     { bg: 'rgba(139,92,246,0.12)', fg: '#8B5CF6' },
  won:           { bg: 'var(--success-soft)',  fg: 'var(--success-ink)' },
  lost:          { bg: 'var(--danger-soft)',   fg: 'var(--danger-ink)' },
  proposal:      { bg: 'var(--warning-soft)',  fg: 'var(--warning-ink)' },
  proposal_sent: { bg: 'var(--warning-soft)',  fg: 'var(--warning-ink)' },
  negotiation:   { bg: 'var(--warning-soft)',  fg: 'var(--warning-ink)' },
  paid:          { bg: 'var(--success-soft)',  fg: 'var(--success-ink)' },
  draft:         { bg: 'var(--surface-2)',     fg: 'var(--text-2)' },
  sent:          { bg: 'var(--primary-soft)',  fg: 'var(--primary)' },
  overdue:       { bg: 'var(--danger-soft)',   fg: 'var(--danger-ink)' },
  partial:       { bg: 'var(--warning-soft)',  fg: 'var(--warning-ink)' },
  active:        { bg: 'var(--success-soft)',  fg: 'var(--success-ink)' },
  growth:        { bg: 'var(--primary-soft)',  fg: 'var(--primary)' },
  starter:       { bg: 'var(--surface-2)',     fg: 'var(--text-2)' },
  enterprise:    { bg: 'rgba(139,92,246,0.12)', fg: '#8B5CF6' },
  cancelled:     { bg: 'var(--danger-soft)',   fg: 'var(--danger-ink)' },
  completed:     { bg: 'var(--success-soft)',  fg: 'var(--success-ink)' },
  running:       { bg: 'var(--primary-soft)',  fg: 'var(--primary)' },
};
export function Badge({ status, label }: { status: string; label?: string }) {
  const s = BADGE_STYLES[status?.toLowerCase()] || { bg: 'var(--surface-2)', fg: 'var(--text-2)' };
  return (
    <span style={{
      background: s.bg, color: s.fg,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2.5px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.01em', boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.08)',
      textTransform: 'capitalize', whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: s.fg, flexShrink: 0 }} />
      {(label || status)?.toLowerCase().replace(/_/g, ' ')}
    </span>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────
export function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: 'var(--text-3)', fontSize: 12 }}>—</span>;
  const c = score >= 75 ? 'var(--success)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  const track = score >= 75 ? 'var(--success-soft)' : score >= 50 ? 'var(--warning-soft)' : 'var(--danger-soft)';
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{score}</div>
      <div style={{ width: 38, height: 4, background: track, borderRadius: 9999, marginTop: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: c, borderRadius: 9999 }} />
      </div>
    </div>
  );
}

// ── KPI Card (stat tile: label · value · delta · trend) ───────
export function KpiCard({ label, value, change, up, color = 'var(--chart-1)' }: { label: string; value: string; change?: string; up?: boolean; color?: string }) {
  return (
    <div className="lux-card p-4 flex flex-col gap-1.5"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.02em' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{value}</div>
      {change && (
        <div style={{ fontSize: 11.5, fontWeight: 600, color: up ? 'var(--success-ink)' : 'var(--danger-ink)', display: 'flex', alignItems: 'center', gap: 4 }}>
          {up ? UIIcons.trendUp(12) : UIIcons.trendDown(12)}
          <span>{change}</span>
        </div>
      )}
      <div style={{ marginTop: 4 }}>
        <Sparkline points={[30, 45, 35, 60, 48, 72, 55, 80, 65, 88, 72, 95]} color={color} width={120} height={26} />
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([]);
  const n = useRef(0);
  const toast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = ++n.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const ToastContainer = () => (
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
      {toasts.map(t => (
        <div key={t.id} className="animate-slide-in-right" style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 16px', borderRadius: 14,
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderLeft: `3px solid ${t.type === 'ok' ? 'var(--success)' : 'var(--danger)'}`,
          color: 'var(--text)', fontSize: 12.5, fontWeight: 600,
          boxShadow: 'var(--shadow-lg)', minWidth: 220,
        }}>
          <span className="flex items-center justify-center flex-shrink-0"
            style={{ width: 22, height: 22, borderRadius: 8, color: '#fff', background: t.type === 'ok' ? 'var(--grad-green)' : 'linear-gradient(135deg,#F87171,#DC2626)' }}>
            {t.type === 'ok' ? UIIcons.check(12) : UIIcons.x(12)}
          </span>
          {t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastContainer };
}

// ── RichTextEditor ────────────────────────────────────────────
export function RichTextEditor({
  value, onChange, label, minHeight = 120,
}: {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [fmts, setFmts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!focused && editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value, focused]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    refresh();
    emit();
  };

  const refresh = () => {
    const s = new Set<string>();
    if (document.queryCommandState('bold')) s.add('bold');
    if (document.queryCommandState('italic')) s.add('italic');
    if (document.queryCommandState('underline')) s.add('underline');
    setFmts(s);
  };

  const emit = () => { if (editorRef.current) onChange(editorRef.current.innerHTML); };

  const tbBtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', border: `1px solid ${active ? 'var(--primary)' : 'var(--border-strong)'}`,
    borderRadius: 7, background: active ? 'var(--primary-soft)' : 'var(--surface)',
    color: active ? 'var(--primary)' : 'var(--text-2)', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, lineHeight: 1, minWidth: 28,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  });

  return (
    <div className="flex flex-col gap-1">
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{label}</label>}
      <div style={{ border: `1px solid ${focused ? 'var(--primary)' : 'var(--border-strong)'}`, borderRadius: 12, overflow: 'hidden', boxShadow: focused ? '0 0 0 3px var(--primary-ring)' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 4, padding: '5px 8px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={tbBtn(fmts.has('bold'))} onMouseDown={e => { e.preventDefault(); exec('bold'); }}><b>B</b></button>
          <button type="button" style={tbBtn(fmts.has('italic'))} onMouseDown={e => { e.preventDefault(); exec('italic'); }}><i>I</i></button>
          <button type="button" style={tbBtn(fmts.has('underline'))} onMouseDown={e => { e.preventDefault(); exec('underline'); }}><u>U</u></button>
          <div style={{ width: 1, height: 18, background: 'var(--border-strong)', margin: '0 2px' }} />
          <select
            value=""
            onChange={e => { if (e.target.value) { exec('fontSize', e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
            onMouseDown={e => e.stopPropagation()}
            style={{ padding: '3px 6px', border: '1px solid var(--border-strong)', borderRadius: 7, fontSize: 11.5, background: 'var(--surface)', color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <option value="" disabled>Size</option>
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">X-Large</option>
          </select>
          <div style={{ width: 1, height: 18, background: 'var(--border-strong)', margin: '0 2px' }} />
          <button type="button" style={tbBtn(false)} onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}>• List</button>
          <button type="button" style={tbBtn(false)} onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}>1. List</button>
          <div style={{ width: 1, height: 18, background: 'var(--border-strong)', margin: '0 2px' }} />
          <button type="button" style={{ ...tbBtn(false), fontSize: 10 }} onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}>✕ Clear</button>
        </div>
        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => { setFocused(true); refresh(); }}
          onBlur={() => { setFocused(false); emit(); }}
          onInput={() => { refresh(); emit(); }}
          onKeyUp={refresh}
          onMouseUp={refresh}
          style={{ minHeight, padding: '10px 12px', fontSize: 13, color: 'var(--text)', outline: 'none', lineHeight: 1.6, fontFamily: 'inherit', background: 'var(--surface)' }}
        />
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
export function Empty({ icon, title, desc, action }: { icon?: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 14 }}>
      <div style={{
        width: 60, height: 60, borderRadius: 20,
        background: 'var(--primary-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26,
        boxShadow: 'inset 0 0 0 1px var(--primary-ring)',
      }}>
        {icon || <span style={{ color: 'var(--primary)' }}>{UIIcons.sparkle(24)}</span>}
      </div>
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 5, lineHeight: 1.55 }}>{desc}</div>}
      </div>
      {action}
    </div>
  );
}
