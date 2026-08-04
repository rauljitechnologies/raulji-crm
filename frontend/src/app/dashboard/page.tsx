'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { companyApi, leadApi, analyticsApi } from '@/lib/api';
import { Topbar, Badge, ScoreBar, Btn, Avatar, Sparkline, Skeleton, UIIcons } from '@/components/ui';
import { NavIcon } from '@/components/layout/nav';

/* ══════════════════════════════════════════════════════════════
   Dashboard — hero, KPI tiles, live charts, recent leads.
   All chart data is computed from real leads; nothing is mocked.
   ══════════════════════════════════════════════════════════════ */

// ── Animated counter (respects prefers-reduced-motion) ────────
function useCountUp(target: number, duration = 900) {
  const [value, setValue] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target); prev.current = target; return;
    }
    const from = prev.current;
    prev.current = target;
    if (from === target) { setValue(target); return; }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(from + (target - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

// ── Formatters ────────────────────────────────────────────────
const fmt = (n: number) => Math.round(n || 0).toLocaleString('en-IN');
const fmtMoney = (n: number) => {
  const v = n || 0;
  if (v >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (v >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return `₹${fmt(v)}`;
};

// ── Derive chart series from raw leads ────────────────────────
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function monthlyBuckets(leads: any[], months = 6) {
  const now = new Date();
  const buckets: { label: string; year: number; month: number; count: number }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({ label: MONTH_LABELS[d.getMonth()], year: d.getFullYear(), month: d.getMonth(), count: 0 });
  }
  leads.forEach(l => {
    const d = new Date(l.createdAt);
    const b = buckets.find(x => x.year === d.getFullYear() && x.month === d.getMonth());
    if (b) b.count++;
  });
  return buckets;
}

const SOURCE_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];
const FUNNEL_STAGES = [
  { key: 'NEW',           label: 'New' },
  { key: 'CONTACTED',     label: 'Contacted' },
  { key: 'QUALIFIED',     label: 'Qualified' },
  { key: 'PROPOSAL_SENT', label: 'Proposal' },
  { key: 'NEGOTIATION',   label: 'Negotiation' },
  { key: 'WON',           label: 'Won' },
];

// ── Card shell ────────────────────────────────────────────────
function Panel({ title, meta, children, className = '' }: { title: string; meta?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <div className={`lux-card p-5 ${className}`} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
      <div className="flex items-center justify-between mb-4">
        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
        {meta}
      </div>
      {children}
    </div>
  );
}

function PillTag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--text-2)', background: 'var(--surface-2)', border: '1px solid var(--border)', padding: '3px 9px', borderRadius: 9999 }}>
      {children}
    </span>
  );
}

// ── KPI stat tile ─────────────────────────────────────────────
function MetricCard({ label, value, delta, deltaUp, gradient, chartColor, icon, spark, loading, money }: {
  label: string; value: number; delta?: string; deltaUp?: boolean;
  gradient: string; chartColor: string; icon: React.ReactNode;
  spark?: number[]; loading?: boolean; money?: boolean;
}) {
  const animated = useCountUp(value);
  const display = money ? fmtMoney(animated) : label.includes('Rate') ? `${Math.round(animated)}%` : fmt(animated);
  return (
    <div className="lux-card p-5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)', letterSpacing: '0.02em' }}>{label}</div>
          {loading ? (
            <div className="mt-2"><Skeleton w={90} h={26} /></div>
          ) : (
            <div style={{ fontSize: 27, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15, marginTop: 4, letterSpacing: '-0.025em' }}>{display}</div>
          )}
          {delta && !loading && (
            <div className="flex items-center gap-1.5 mt-1.5" style={{ fontSize: 11.5, fontWeight: 600, color: deltaUp ? 'var(--success-ink)' : 'var(--danger-ink)' }}>
              {deltaUp ? UIIcons.trendUp(12) : UIIcons.trendDown(12)}
              <span>{delta}</span>
              <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>vs last month</span>
            </div>
          )}
        </div>
        <div className="flex items-center justify-center flex-shrink-0"
          style={{ width: 40, height: 40, borderRadius: 13, background: gradient, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px -6px rgba(17,24,39,0.35)' }}>
          {icon}
        </div>
      </div>
      {spark && spark.length > 1 && !loading && (
        <div className="flex items-end justify-between gap-3">
          <Sparkline points={spark} color={chartColor} width={130} height={30} />
          <span style={{ fontSize: 10, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>last 6 months</span>
        </div>
      )}
    </div>
  );
}

// ── Area chart with crosshair + tooltip (single series) ───────
function TrendChart({ buckets }: { buckets: { label: string; count: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 620, H = 200, PAD_L = 36, PAD_R = 14, PAD_T = 14, PAD_B = 26;
  const max = Math.max(...buckets.map(b => b.count), 4);
  // clean tick ceiling
  const step = Math.pow(10, Math.floor(Math.log10(max)));
  const top = Math.ceil(max / step) * step;
  const ticks = [0, top / 2, top];

  const x = (i: number) => PAD_L + (i / (buckets.length - 1)) * (W - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / top) * (H - PAD_T - PAD_B);
  const pts = buckets.map((b, i) => [x(i), y(b.count)]);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${y(0)} L${pts[0][0].toFixed(1)},${y(0)} Z`;

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    pts.forEach(([px], i) => { const d = Math.abs(px - mx); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ display: 'block' }} role="img"
        aria-label={`Leads captured per month: ${buckets.map(b => `${b.label} ${b.count}`).join(', ')}`}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity="0.14" />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* hairline grid + clean ticks */}
        {ticks.map(t => (
          <g key={t}>
            <line x1={PAD_L} x2={W - PAD_R} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" strokeWidth="1" />
            <text x={PAD_L - 8} y={y(t) + 3.5} textAnchor="end" fontSize="10" fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(t)}</text>
          </g>
        ))}
        {/* x labels */}
        {buckets.map((b, i) => (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="var(--text-3)">{b.label}</text>
        ))}
        <path d={area} fill="url(#trendFill)" />
        <path d={line} fill="none" stroke="var(--chart-1)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* crosshair */}
        {hover != null && (
          <g>
            <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PAD_T} y2={y(0)} stroke="var(--chart-axis)" strokeWidth="1" />
            <circle cx={pts[hover][0]} cy={pts[hover][1]} r="4.5" fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />
          </g>
        )}
        {/* end marker */}
        {hover == null && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="4" fill="var(--chart-1)" stroke="var(--surface)" strokeWidth="2" />}
      </svg>
      {hover != null && (
        <div className="absolute pointer-events-none px-3 py-2"
          style={{
            left: `${(pts[hover][0] / W) * 100}%`, top: 0, transform: pts[hover][0] > W * 0.72 ? 'translateX(-108%)' : 'translateX(10px)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap',
          }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600 }}>{buckets[hover].label}</div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--chart-1)', display: 'inline-block' }} />
            {fmt(buckets[hover].count)} leads
          </div>
        </div>
      )}
    </div>
  );
}

// ── Horizontal bar row (≤24px thick, rounded data-end) ────────
function SourceBar({ label, count, maxCount, color, delayIdx }: { label: string; count: number; maxCount: number; color: string; delayIdx: number }) {
  const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
  return (
    <div className="flex items-center gap-3 mb-3 group" title={`${label}: ${fmt(count)} leads`}>
      <span className="truncate capitalize" style={{ width: 84, fontSize: 12, fontWeight: 600, color: 'var(--text-2)', flexShrink: 0 }}>{label}</span>
      <div className="flex-1" style={{ height: 12, background: 'var(--surface-2)', borderRadius: '3px 6px 6px 3px', overflow: 'hidden' }}>
        <div className="animate-grow-bar" style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: '0 6px 6px 0', animationDelay: `${delayIdx * 60}ms` }} />
      </div>
      <span style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: 'var(--text)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{fmt(count)}</span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const router = useRouter();
  const [companies,    setCompanies]    = useState<any[]>([]);
  const [selectedCid,  setSelectedCid]  = useState<string>('ALL');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [leads,        setLeads]        = useState<any[]>([]);
  const [summary,      setSummary]      = useState<any>({});
  const [coSummaries,  setCoSummaries]  = useState<Record<string, any>>({});
  const [loading,      setLoading]      = useState(true);
  const [loadingData,  setLoadingData]  = useState(false);
  const [user,         setUser]         = useState<any>(null);

  // ── initial load ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        setUser(u);
        const isAdmin = u?.role === 'SUPER_ADMIN';
        setIsSuperAdmin(isAdmin);

        let coList: any[] = [];
        if (isAdmin) {
          const all = await companyApi.list({ limit: '200' });
          coList = all.companies || all || [];
        } else {
          const mine = await companyApi.mine();
          coList = mine.companies || [];
        }
        setCompanies(coList);

        if (coList.length === 0) return;

        if (isAdmin) {
          setSelectedCid('ALL');
          await loadAllCompanies(coList);
        } else {
          const firstCid = coList[0]?.companyId || '';
          setSelectedCid(firstCid);
          if (firstCid) await loadCompanyData(firstCid);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  // ── load single company ───────────────────────────────────
  async function loadCompanyData(cid: string) {
    setLoadingData(true);
    try {
      const [lData, aData] = await Promise.all([
        // 200 most-recent leads drive the trend/source/funnel charts client-side
        leadApi.list(cid, { limit: '200', sortBy: 'createdAt', sortOrder: 'desc' }),
        analyticsApi.overview(cid),
      ]);
      setLeads(lData.leads || []);
      setSummary(aData.summary || {});
    } catch (e) { console.error(e); }
    finally { setLoadingData(false); }
  }

  // ── load ALL companies (aggregate) ───────────────────────
  async function loadAllCompanies(coList: any[]) {
    setLoadingData(true);
    try {
      const results = await Promise.all(
        coList.map(co =>
          Promise.all([
            leadApi.list(co.companyId, { limit: '50', sortBy: 'createdAt', sortOrder: 'desc' }).catch(() => ({ leads: [] })),
            analyticsApi.overview(co.companyId).catch(() => ({ summary: {} })),
          ]).then(([lData, aData]) => ({ companyId: co.companyId, name: co.name, leads: lData.leads || [], summary: aData.summary || {} }))
        )
      );

      const agg = results.reduce((acc, r) => ({
        totalLeads:   (acc.totalLeads   || 0) + (r.summary.totalLeads   || 0),
        wonDeals:     (acc.wonDeals     || 0) + (r.summary.wonDeals     || 0),
        totalRevenue: (acc.totalRevenue || 0) + (r.summary.totalRevenue || 0),
        conversionRate: 0,
      }), {} as any);

      const totalLeads = agg.totalLeads || 0;
      const wonDeals   = agg.wonDeals   || 0;
      agg.conversionRate = totalLeads > 0 ? Math.round((wonDeals / totalLeads) * 100) : 0;
      setSummary(agg);

      const allLeads = results.flatMap(r => r.leads.map((l: any) => ({ ...l, _companyName: r.name })));
      allLeads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setLeads(allLeads);

      const byCompany: Record<string, any> = {};
      results.forEach(r => { byCompany[r.companyId] = r.summary; });
      setCoSummaries(byCompany);
    } catch (e) { console.error(e); }
    finally { setLoadingData(false); }
  }

  const handleCompanyChange = async (cid: string) => {
    setSelectedCid(cid);
    if (cid === 'ALL') await loadAllCompanies(companies);
    else await loadCompanyData(cid);
  };

  // ── derived analytics (all real, from fetched leads) ──────
  const buckets = useMemo(() => monthlyBuckets(leads, 6), [leads]);

  const monthDelta = useMemo(() => {
    if (buckets.length < 2) return null;
    const cur = buckets[buckets.length - 1].count;
    const prevC = buckets[buckets.length - 2].count;
    if (prevC === 0) return cur > 0 ? { text: `+${cur} new`, up: true } : null;
    const pct = Math.round(((cur - prevC) / prevC) * 100);
    return { text: `${pct >= 0 ? '+' : ''}${pct}%`, up: pct >= 0 };
  }, [buckets]);

  const sources = useMemo(() => {
    const map: Record<string, number> = {};
    leads.forEach(l => {
      const s = (l.source || 'Other').toLowerCase().replace(/_/g, ' ');
      map[s] = (map[s] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [leads]);

  const funnel = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach(l => { const s = (l.status || '').toUpperCase(); counts[s] = (counts[s] || 0) + 1; });
    return FUNNEL_STAGES.map(st => ({ ...st, count: counts[st.key] || 0 }));
  }, [leads]);

  const wonSpark = useMemo(() => {
    const now = new Date();
    const arr = new Array(6).fill(0);
    leads.forEach(l => {
      if ((l.status || '').toUpperCase() !== 'WON') return;
      const d = new Date(l.createdAt);
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + now.getMonth() - d.getMonth();
      if (diff >= 0 && diff < 6) arr[5 - diff]++;
    });
    return arr;
  }, [leads]);

  const showSelector    = isSuperAdmin || companies.length > 1;
  const isAll           = selectedCid === 'ALL';
  const selectedCompany = companies.find(c => c.companyId === selectedCid);
  const subtitleLabel   = isAll ? `All companies (${companies.length})` : (selectedCompany?.name || '');

  const heroRevenue = useCountUp(summary.totalRevenue || 0, 1100);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const firstName = user?.name?.split(' ')[0] || 'there';
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const avgDeal = (summary.wonDeals || 0) > 0 ? (summary.totalRevenue || 0) / summary.wonDeals : 0;
  const maxSource = sources.length ? sources[0][1] : 0;
  const maxFunnel = Math.max(...funnel.map(f => f.count), 1);
  const recentLeads = leads.slice(0, 8);

  const QUICK_ACTIONS = [
    { label: 'Create Lead',   href: '/dashboard/leads',    icon: 'leads' },
    { label: 'Create Deal',   href: '/dashboard/deals',    icon: 'deals' },
    { label: 'New Quotation', href: '/dashboard/quotations', icon: 'quotations' },
    { label: 'New Invoice',   href: '/dashboard/invoices', icon: 'invoices' },
  ];

  // ── first-paint skeleton ──────────────────────────────────
  if (loading) return (
    <>
      <Topbar title="Dashboard" subtitle="Loading your workspace…" />
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
        <Skeleton h={148} r={18} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[0, 1, 2, 3].map(i => <Skeleton key={i} h={140} r={18} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => <Skeleton key={i} h={260} r={18} />)}
        </div>
      </div>
    </>
  );

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle={subtitleLabel}
        actions={<>
          {showSelector && (
            <select
              value={selectedCid}
              onChange={e => handleCompanyChange(e.target.value)}
              style={{
                fontSize: 12.5, fontWeight: 600, color: 'var(--text)',
                background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
                borderRadius: 10, padding: '6px 10px', cursor: 'pointer',
                minWidth: 160, maxWidth: 250,
              }}>
              {isSuperAdmin && (
                <option value="ALL">All Companies ({companies.length})</option>
              )}
              {companies.map((co: any) => (
                <option key={co.companyId} value={co.companyId}>{co.name}</option>
              ))}
            </select>
          )}
        </>}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex flex-col gap-5 p-4 md:p-6" style={{ maxWidth: 1440 }}>

          {/* ── HERO ─────────────────────────────────────────── */}
          <section className="animate-fade-in-up relative overflow-hidden p-6 md:p-7"
            style={{ borderRadius: 22, background: 'var(--grad-brand-deep)', boxShadow: '0 24px 60px -20px rgba(37,99,235,0.45)' }}>
            {/* decorative glows */}
            <div aria-hidden className="absolute pointer-events-none" style={{ width: 420, height: 420, right: -120, top: -220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.14) 0%, transparent 65%)' }} />
            <div aria-hidden className="absolute pointer-events-none" style={{ width: 300, height: 300, left: '30%', bottom: -220, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.25) 0%, transparent 65%)' }} />

            <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.75)', letterSpacing: '0.02em' }}>{today}</div>
                <h2 className="mt-1.5" style={{ fontSize: 26, fontWeight: 800, color: '#fff', letterSpacing: '-0.025em', lineHeight: 1.2 }}>
                  {greeting}, {firstName} <span aria-hidden>👋</span>
                </h2>
                <p className="mt-1.5" style={{ fontSize: 13, color: 'rgba(255,255,255,0.78)', maxWidth: 460 }}>
                  Here’s what’s happening across {isAll ? 'all your companies' : (selectedCompany?.name || 'your workspace')} — pipeline, leads and revenue at a glance.
                </p>
                <div className="flex flex-wrap gap-2 mt-5">
                  {QUICK_ACTIONS.map(a => (
                    <button key={a.label} onClick={() => router.push(a.href)}
                      className="lux-btn flex items-center gap-2"
                      style={{
                        padding: '7px 14px', borderRadius: 11, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                        background: 'rgba(255,255,255,0.12)', color: '#fff',
                        border: '1px solid rgba(255,255,255,0.22)',
                        backdropFilter: 'blur(8px)',
                      }}>
                      <NavIcon name={a.icon} size={14} />
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hero figure — total revenue */}
              <div className="flex-shrink-0 lg:text-right">
                <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.72)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Total revenue</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.1, marginTop: 4 }}>
                  {loadingData ? '—' : fmtMoney(heroRevenue)}
                </div>
                <div className="flex lg:justify-end items-center gap-1.5 mt-1.5" style={{ fontSize: 12, color: 'rgba(255,255,255,0.78)', fontWeight: 600 }}>
                  <span className="inline-block" style={{ width: 7, height: 7, borderRadius: '50%', background: '#34D399', animation: 'pulseDot 2s ease-in-out infinite' }} />
                  {fmt(summary.wonDeals || 0)} deals won · {summary.conversionRate || 0}% conversion
                </div>
              </div>
            </div>
          </section>

          {/* ── "All companies" pills ────────────────────────── */}
          {isAll && companies.length > 0 && (
            <div className="flex gap-2 flex-wrap animate-fade-in">
              {companies.map((co: any) => {
                const cs = coSummaries[co.companyId];
                return (
                  <button key={co.companyId}
                    onClick={() => handleCompanyChange(co.companyId)}
                    className="lux-btn flex items-center gap-2"
                    style={{
                      padding: '5px 11px 5px 6px', borderRadius: 11, cursor: 'pointer',
                      background: 'var(--surface)', border: '1px solid var(--border-strong)',
                      fontSize: 12, fontWeight: 600, color: 'var(--text)',
                    }}>
                    <span className="flex items-center justify-center flex-shrink-0"
                      style={{ width: 24, height: 24, borderRadius: 8, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 9, fontWeight: 800 }}>
                      {co.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                    </span>
                    {co.name}
                    {cs && <span style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 500 }}>· {cs.totalLeads || 0} leads</span>}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── KPI tiles ────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 stagger">
            <MetricCard
              label={isAll ? 'Total leads · all companies' : 'Total leads'}
              value={summary.totalLeads || 0}
              delta={monthDelta?.text} deltaUp={monthDelta?.up}
              gradient="var(--grad-brand)" chartColor="var(--chart-1)"
              icon={<NavIcon name="leads" size={19} />}
              spark={buckets.map(b => b.count)}
              loading={loadingData}
            />
            <MetricCard
              label={isAll ? 'Deals won · all companies' : 'Deals won'}
              value={summary.wonDeals || 0}
              gradient="var(--grad-green)" chartColor="var(--chart-2)"
              icon={<NavIcon name="deals" size={19} />}
              spark={wonSpark}
              loading={loadingData}
            />
            <MetricCard
              label="Conversion Rate"
              value={summary.conversionRate || 0}
              gradient="var(--grad-violet)" chartColor="var(--chart-4)"
              icon={<NavIcon name="analytics" size={19} />}
              loading={loadingData}
            />
            <MetricCard
              label="Avg. deal value"
              value={avgDeal} money
              gradient="var(--grad-amber)" chartColor="var(--chart-3)"
              icon={<NavIcon name="finance" size={19} />}
              loading={loadingData}
            />
          </div>

          {/* ── Charts row ───────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
            <Panel title="Lead volume" meta={<PillTag>Last 6 months</PillTag>} className="lg:col-span-2">
              {loadingData ? <Skeleton h={200} r={12} /> : <TrendChart buckets={buckets} />}
            </Panel>

            <Panel title="Lead sources" meta={<PillTag>{isAll ? 'Recent leads' : 'Top 5'}</PillTag>}>
              {loadingData ? (
                <div className="flex flex-col gap-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={14} />)}</div>
              ) : sources.length === 0 ? (
                <div className="py-10 text-center" style={{ fontSize: 12.5, color: 'var(--text-2)' }}>No lead data yet</div>
              ) : (
                <div className="pt-1">
                  {sources.map(([label, count], i) => (
                    <SourceBar key={label} label={label} count={count} maxCount={maxSource} color={SOURCE_COLORS[i]} delayIdx={i} />
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 stagger">
            {/* Funnel */}
            <Panel title="Conversion funnel" meta={<PillTag>Live</PillTag>}>
              {loadingData ? (
                <div className="flex flex-col gap-3">{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} h={16} />)}</div>
              ) : (
                <div className="pt-1">
                  {funnel.map((s, i) => (
                    <div key={s.key} className="mb-3" title={`${s.label}: ${fmt(s.count)} leads`}>
                      <div className="flex justify-between mb-1">
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>{s.label}</span>
                        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{fmt(s.count)}</span>
                      </div>
                      <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: '3px 6px 6px 3px', overflow: 'hidden' }}>
                        <div className="animate-grow-bar" style={{
                          height: '100%', width: `${(s.count / maxFunnel) * 100}%`,
                          background: s.key === 'WON' ? 'var(--grad-green)' : 'var(--chart-1)',
                          opacity: s.key === 'WON' ? 1 : 1 - i * 0.09,
                          borderRadius: '0 6px 6px 0', animationDelay: `${i * 60}ms`,
                        }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>

            {/* Companies / workspace snapshot */}
            {companies.length > 1 ? (
              <Panel title="Companies" meta={<PillTag>{companies.length} total</PillTag>} className="lg:col-span-2">
                <div className="flex flex-col gap-1.5">
                  {companies.slice(0, 5).map((co: any) => {
                    const cs = coSummaries[co.companyId];
                    const isSelected = co.companyId === selectedCid;
                    return (
                      <div key={co.companyId}
                        className="flex items-center gap-3 cursor-pointer transition-all"
                        style={{
                          padding: '8px 10px', borderRadius: 12,
                          background: isSelected ? 'var(--primary-soft)' : 'transparent',
                          border: isSelected ? '1px solid var(--primary-ring)' : '1px solid transparent',
                        }}
                        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--surface-2)'; }}
                        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                        onClick={() => handleCompanyChange(co.companyId)}>
                        <div className="flex items-center justify-center flex-shrink-0"
                          style={{ width: 32, height: 32, borderRadius: 10, background: 'var(--primary-soft)', color: 'var(--primary)', fontSize: 11, fontWeight: 800 }}>
                          {co.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="truncate" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>{co.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                            {cs ? `${cs.totalLeads || 0} leads · ${fmtMoney(cs.totalRevenue || 0)}` : `${co._count?.leads || 0} leads`}
                          </div>
                        </div>
                        <Badge status={co.plan?.toLowerCase()} label={co.plan} />
                      </div>
                    );
                  })}
                  {companies.length > 5 && (
                    <button onClick={() => router.push('/dashboard/companies')}
                      className="flex items-center gap-1.5 mt-1"
                      style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 10px' }}>
                      View all {companies.length} companies {UIIcons.arrowRight(13)}
                    </button>
                  )}
                </div>
              </Panel>
            ) : (
              <Panel title="This month" meta={<PillTag>{buckets[buckets.length - 1]?.label}</PillTag>} className="lg:col-span-2">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                  {[
                    { label: 'New leads captured', value: fmt(buckets[buckets.length - 1]?.count || 0), grad: 'var(--grad-brand)', icon: 'leads' },
                    { label: 'Top source', value: sources[0] ? sources[0][0] : '—', grad: 'var(--grad-teal)', icon: 'campaigns', cap: true },
                    { label: 'Deals won (6 mo)', value: fmt(wonSpark.reduce((a, b) => a + b, 0)), grad: 'var(--grad-green)', icon: 'deals' },
                  ].map(s => (
                    <div key={s.label} className="flex items-center gap-3 p-3.5" style={{ borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
                      <div className="flex items-center justify-center flex-shrink-0"
                        style={{ width: 36, height: 36, borderRadius: 12, background: s.grad, color: '#fff' }}>
                        <NavIcon name={s.icon} size={17} />
                      </div>
                      <div className="min-w-0">
                        <div className={`truncate ${s.cap ? 'capitalize' : ''}`} style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>{s.value}</div>
                        <div className="truncate" style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 500 }}>{s.label}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-4" style={{ fontSize: 11.5, color: 'var(--text-3)', lineHeight: 1.6 }}>
                  Numbers are computed from your {leads.length} most recent leads. Open{' '}
                  <button onClick={() => router.push('/dashboard/analytics')} style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11.5 }}>
                    Analytics
                  </button>{' '}
                  for the full picture.
                </p>
              </Panel>
            )}
          </div>

          {/* ── Recent leads ─────────────────────────────────── */}
          <div className="lux-card overflow-hidden animate-fade-in-up" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
            <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>
                  Recent leads{isAll ? ' — all companies' : (selectedCompany ? ` — ${selectedCompany.name}` : '')}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>Latest {recentLeads.length} entries</div>
              </div>
              <Btn variant="primary" size="sm" onClick={() => router.push('/dashboard/leads')}>
                View all {UIIcons.arrowRight(13)}
              </Btn>
            </div>
            <div className="table-scroll">
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['Name', ...(isAll ? ['Company'] : []), 'Source', 'Status', 'Phone', 'Score', 'Assigned', 'Created'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loadingData ? (
                    [0, 1, 2, 3, 4].map(i => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '13px 16px' }}><div className="flex items-center gap-2.5"><Skeleton w={28} h={28} r={9} /><Skeleton w={120} h={13} /></div></td>
                        {isAll && <td style={{ padding: '13px 16px' }}><Skeleton w={80} h={13} /></td>}
                        <td style={{ padding: '13px 16px' }}><Skeleton w={64} h={13} /></td>
                        <td style={{ padding: '13px 16px' }}><Skeleton w={70} h={18} r={9999} /></td>
                        <td style={{ padding: '13px 16px' }}><Skeleton w={84} h={13} /></td>
                        <td style={{ padding: '13px 16px' }}><Skeleton w={38} h={13} /></td>
                        <td style={{ padding: '13px 16px' }}><Skeleton w={56} h={13} /></td>
                        <td style={{ padding: '13px 16px' }}><Skeleton w={48} h={13} /></td>
                      </tr>
                    ))
                  ) : recentLeads.length === 0 ? (
                    <tr>
                      <td colSpan={isAll ? 8 : 7} style={{ textAlign: 'center', padding: '44px 0', fontSize: 13, color: 'var(--text-2)' }}>
                        No leads yet.{' '}
                        <button onClick={() => router.push('/dashboard/leads')} style={{ color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                          Add your first lead →
                        </button>
                      </td>
                    </tr>
                  ) : recentLeads.map((l: any) => (
                    <tr key={l.leadId}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
                      onClick={() => router.push(`/dashboard/leads/${l.leadId}`)}>
                      <td style={{ padding: '12px 16px' }}>
                        <div className="flex items-center gap-2.5">
                          <Avatar name={l.name} size={28} />
                          <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', maxWidth: 180 }}>{l.name}</span>
                        </div>
                      </td>
                      {isAll && (
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{ fontSize: 11, fontWeight: 600, background: 'var(--primary-soft)', color: 'var(--primary)', padding: '2px 8px', borderRadius: 7, whiteSpace: 'nowrap' }}>
                            {l._companyName || '—'}
                          </span>
                        </td>
                      )}
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-2)', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{l.source?.toLowerCase().replace(/_/g, ' ')}</td>
                      <td style={{ padding: '12px 16px' }}><Badge status={l.status?.toLowerCase()} label={l.status} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{l.phone}</td>
                      <td style={{ padding: '12px 16px' }}><ScoreBar score={l.aiScore} /></td>
                      <td style={{ padding: '12px 16px', fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{l.assignedTo?.name?.split(' ')[0] || '—'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
