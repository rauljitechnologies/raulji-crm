// Shared navigation model — consumed by the Sidebar, the command palette
// and the Quick Add menu so all three stay in sync.

export type PermKey = 'dashboard'|'companies'|'leads'|'pipeline'|'deals'|'clients'|'quotations'|'invoices'|'analytics'|'users'|'settings'|'api'|'backup'|'expenses'|'finance'|'payroll';

export const ROLE_DEFAULTS: Record<string, Record<PermKey, boolean>> = {
  SUPER_ADMIN:   { dashboard:true,companies:true,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,users:true,settings:true,api:true,backup:true,expenses:true,finance:true,payroll:true },
  ADMIN:         { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,users:true,settings:true,api:true,backup:false,expenses:true,finance:true,payroll:true },
  SALES_MANAGER: { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,users:false,settings:false,api:false,backup:false,expenses:true,finance:false,payroll:false },
  SALES_REP:     { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:false,analytics:false,users:false,settings:false,api:false,backup:false,expenses:false,finance:false,payroll:false },
  VIEWER:        { dashboard:true,companies:false,leads:true,pipeline:false,deals:false,clients:false,quotations:false,invoices:false,analytics:true,users:false,settings:false,api:false,backup:false,expenses:false,finance:false,payroll:false },
};

export function getEffectivePerms(user: any): Record<string, boolean> {
  const base = ROLE_DEFAULTS[user?.role] || ROLE_DEFAULTS.VIEWER;
  const overrides = user?.permissions || {};
  return { ...base, ...overrides };
}

export interface NavItem { href: string; label: string; key: string; perm: PermKey; }
export interface NavSection { section: string; items: NavItem[]; }

export const NAV: NavSection[] = [
  { section: 'Workspace', items: [
    { href: '/dashboard',             label: 'Dashboard',      key: 'dashboard',  perm: 'dashboard'  },
    { href: '/dashboard/companies',   label: 'Companies',      key: 'companies',  perm: 'companies'  },
    { href: '/dashboard/leads',       label: 'Leads',          key: 'leads',      perm: 'leads'      },
    { href: '/dashboard/pipeline',    label: 'Pipeline',       key: 'pipeline',   perm: 'pipeline'   },
    { href: '/dashboard/deals',       label: 'Deals',          key: 'deals',      perm: 'deals'      },
  ]},
  { section: 'Finance', items: [
    { href: '/dashboard/clients',     label: 'Clients',        key: 'clients',    perm: 'clients'    },
    { href: '/dashboard/quotations',  label: 'Quotations',     key: 'quotations', perm: 'quotations' },
    { href: '/dashboard/invoices',    label: 'Invoices',       key: 'invoices',   perm: 'invoices'   },
    { href: '/dashboard/expenses',    label: 'Expenses',       key: 'expenses',   perm: 'expenses'   },
    { href: '/dashboard/finance',     label: 'Finance',        key: 'finance',    perm: 'finance'    },
  ]},
  { section: 'People', items: [
    { href: '/dashboard/payroll',     label: 'Payroll',        key: 'payroll',    perm: 'payroll'    },
  ]},
  { section: 'Insights', items: [
    { href: '/dashboard/analytics',   label: 'Analytics',      key: 'analytics',  perm: 'analytics'  },
  ]},
  { section: 'System', items: [
    { href: '/dashboard/users',       label: 'Users',          key: 'users',      perm: 'users'      },
    { href: '/dashboard/settings',    label: 'Settings',       key: 'settings',   perm: 'settings'   },
    { href: '/dashboard/api-docs',    label: 'API & Webhooks', key: 'api',        perm: 'api'        },
    { href: '/dashboard/backup',      label: 'Backups',        key: 'backup',     perm: 'backup'     },
  ]},
];

// ── Icons — 24px grid, 1.8px stroke (Lucide-style) ────────────
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

export function NavIcon({ name, size = 17 }: { name: string; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', ...S };
  switch (name) {
    case 'dashboard':  return <svg {...p}><rect x="3" y="3" width="7.5" height="9" rx="2"/><rect x="13.5" y="3" width="7.5" height="5.5" rx="2"/><rect x="13.5" y="12" width="7.5" height="9" rx="2"/><rect x="3" y="15.5" width="7.5" height="5.5" rx="2"/></svg>;
    case 'companies':  return <svg {...p}><path d="M3 21h18"/><path d="M5 21V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><path d="M15 9h3a2 2 0 0 1 2 2v10"/><path d="M9 7h2M9 11h2M9 15h2"/></svg>;
    case 'leads':      return <svg {...p}><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M16 3.8a3.4 3.4 0 0 1 0 8.4"/><path d="M17.8 15.3c1.7.7 2.8 2.2 3.2 4.7"/></svg>;
    case 'pipeline':   return <svg {...p}><path d="M4 5h16"/><path d="M6.5 12h11"/><path d="M9.5 19h5"/></svg>;
    case 'deals':      return <svg {...p}><path d="M12 8 9.5 5.5a2.1 2.1 0 0 0-3 0l-3 3a2.1 2.1 0 0 0 0 3L6 14"/><path d="m12 8 2.5-2.5a2.1 2.1 0 0 1 3 0l3 3a2.1 2.1 0 0 1 0 3L18 14"/><path d="m7.5 12.5 4 4a1.8 1.8 0 0 0 2.5-2.5"/><path d="m10.5 15.5 1.5 1.5a1.8 1.8 0 0 1-2.5 2.5l-3.5-3.5"/></svg>;
    case 'project':    return <svg {...p}><rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7"/><path d="M3 12.5c3 1.2 6 1.8 9 1.8s6-.6 9-1.8"/></svg>;
    case 'clients':    return <svg {...p}><circle cx="12" cy="7.5" r="3.5"/><path d="M5 20.2c.8-3.8 3.5-5.7 7-5.7s6.2 1.9 7 5.7"/></svg>;
    case 'quotations': return <svg {...p}><path d="M6 2.8h8.2L19 7.6V19a2.2 2.2 0 0 1-2.2 2.2H6A2.2 2.2 0 0 1 3.8 19V5A2.2 2.2 0 0 1 6 2.8Z"/><path d="M14 3v5h5"/><path d="M8 13h8M8 17h5"/></svg>;
    case 'invoices':   return <svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9.5h18"/><path d="M7 14.5h3"/></svg>;
    case 'expenses':   return <svg {...p}><rect x="2.8" y="6" width="18.4" height="13" rx="2.5"/><path d="M2.8 10h18.4"/><circle cx="16.5" cy="14.8" r="1.6"/></svg>;
    case 'finance':    return <svg {...p}><path d="M3.5 20.5v-5.2"/><path d="M9.2 20.5V10"/><path d="M14.8 20.5v-7.8"/><path d="M20.5 20.5V6.5"/><path d="M3.5 9.8 9 5.5l4.5 3.4 6-5"/><path d="M16 3.5h3.5V7"/></svg>;
    case 'payroll':    return <svg {...p}><circle cx="9" cy="7.5" r="3.2"/><path d="M3.2 20c.6-3.4 2.9-5.2 5.8-5.2 1 0 1.9.2 2.7.6"/><rect x="13" y="13" width="8.5" height="7.5" rx="1.8"/><path d="M13 16h8.5"/><path d="M15.5 18.6h1.8"/></svg>;
    case 'whatsapp':   return <svg {...p}><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.4-1.1A8.5 8.5 0 1 0 12 3.5Z"/><path d="M8.8 9.5c.4 2.6 2.9 5.2 5.6 5.7l1.2-1.3-2-1.2-1 .7c-1-.5-1.8-1.3-2.3-2.3l.8-.9-1.2-2-1.1 1.3Z"/></svg>;
    case 'campaigns':  return <svg {...p}><path d="m4 10 12-5.5v15L4 14v-4Z"/><path d="M4 10H3a1.5 1.5 0 0 0 0 4h1"/><path d="M8 14.5V18a1.5 1.5 0 0 0 3 0v-2.4"/><path d="M19.5 8.5 21 7M19.5 15.5 21 17M20.5 12H22"/></svg>;
    case 'templates':  return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/></svg>;
    case 'analytics':  return <svg {...p}><path d="M4 4v14.5A1.5 1.5 0 0 0 5.5 20H20"/><path d="m7.5 14.5 3.5-4 3 2.5 4.5-6"/><circle cx="18.5" cy="7" r="1" fill="currentColor" stroke="none"/></svg>;
    case 'users':      return <svg {...p}><circle cx="9" cy="8" r="3.4"/><path d="M3.5 20c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5"/><path d="M16 3.8a3.4 3.4 0 0 1 0 8.4"/><path d="M17.8 15.3c1.7.7 2.8 2.2 3.2 4.7"/></svg>;
    case 'settings':   return <svg {...p}><circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.08a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55h.08a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.08a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"/></svg>;
    case 'api':        return <svg {...p}><path d="m14.5 4-5 16"/><path d="m7 8-4.2 4L7 16"/><path d="m17 8 4.2 4L17 16"/></svg>;
    case 'backup':     return <svg {...p}><ellipse cx="12" cy="5.5" rx="8" ry="2.8"/><path d="M4 5.5V12c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V5.5"/><path d="M4 12v6.5c0 1.5 3.6 2.8 8 2.8s8-1.3 8-2.8V12"/></svg>;
    default:           return <svg {...p}><circle cx="12" cy="12" r="8"/></svg>;
  }
}
