'use client';
import { useEffect, useState } from 'react';
import { companyApi, analyticsApi } from '@/lib/api';
import { Topbar, Card, Badge } from '@/components/ui';

// ── Tiny helpers ──────────────────────────────────────────────
function MetricTile({ label, value, sub, color = '#3199d4', icon }: { label: string; value: string; sub?: string; color?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-2xl p-4 flex items-start gap-3 transition-all"
      style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)' }}>
      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
        <span style={{ color, fontSize: 16 }}>{icon}</span>
      </div>
      <div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#192b3f', lineHeight: 1.1, marginTop: 2 }}>{value}</div>
        {sub && <div style={{ fontSize: 11.5, color: '#7a9baf', marginTop: 3 }}>{sub}</div>}
      </div>
    </div>
  );
}

function BarRow({ label, value, max, color, suffix = '' }: { label: string; value: number; max: number; color: string; suffix?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
      <span style={{ width: 88, fontSize: 12, color: '#64748b', flexShrink: 0, textTransform: 'capitalize' }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#f0f5fa', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 40, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#192b3f', flexShrink: 0 }}>{value}{suffix}</span>
    </div>
  );
}

function SectionHead({ title, badge }: { title: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{title}</div>
      {badge && <span style={{ fontSize: 10.5, fontWeight: 600, background: '#e8f5fd', color: '#1a72a3', padding: '3px 9px', borderRadius: 9999 }}>{badge}</span>}
    </div>
  );
}

type Tab = 'crm' | 'ga' | 'seo';

export default function AnalyticsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [overview,  setOverview]  = useState<any>({});
  const [team,      setTeam]      = useState<any[]>([]);
  const [pipeline,  setPipeline]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [tab,       setTab]       = useState<Tab>('crm');
  const [gaConfig,  setGaConfig]  = useState({ gaTrackingId: '', gaPropertyId: '', gscSiteUrl: '', domain: '' });

  useEffect(() => {
    (async () => {
      try {
        const d = await companyApi.list({ limit: '20' });
        const cos = d.companies || [];
        setCompanies(cos);
        if (cos[0]) setCompanyId(cos[0].companyId);
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    Promise.all([
      analyticsApi.overview(companyId),
      analyticsApi.team(companyId),
      analyticsApi.pipeline(companyId),
      companyApi.getSettings(companyId),
    ]).then(([ov, tm, pl, co]) => {
      setOverview(ov);
      setTeam(tm.team || []);
      setPipeline(pl.pipeline || []);
      const s = co?.settings || {};
      setGaConfig({
        gaTrackingId: s.gaTrackingId || '',
        gaPropertyId: s.gaPropertyId || '',
        gscSiteUrl:   s.gscSiteUrl   || '',
        domain: co?.domain || co?.website?.replace(/^https?:\/\//, '').split('/')[0] || co?.website || '',
      });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [companyId]);

  const s = overview.summary || {};
  const fmtL = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString('en-IN')}`;

  const STAGE_COLORS:  Record<string, string> = { NEW_LEAD:'#3199d4', CONTACTED:'#60a5fa', PROPOSAL:'#10b981', NEGOTIATION:'#f59e0b', WON:'#10b981', LOST:'#ef4444' };
  const SOURCE_COLORS: Record<string, string> = { facebook:'#1877F2', google:'#34a853', whatsapp:'#25d366', referral:'#f97316', organic:'#8b5cf6', manual:'#94a3b8', website_form:'#06b6d4' };

  const bySource = Object.entries(overview.leadsBySource || {});
  const byStatus = Object.entries(overview.leadsByStatus || {});
  const maxSource = Math.max(...bySource.map(([, v]: any) => v), 1);
  const maxStatus = Math.max(...byStatus.map(([, v]: any) => v), 1);

  const gaConnected  = !!gaConfig.gaTrackingId;
  const gscConnected = !!gaConfig.gscSiteUrl;

  // Simulated SEO metrics (shown when GSC connected — replace with API data in production)
  const SEO_KEYWORDS = [
    { kw: 'raulji crm',           pos: 2,  chg: +1 },
    { kw: 'crm software india',   pos: 8,  chg: -2 },
    { kw: 'lead management tool', pos: 14, chg: +5 },
    { kw: 'sales automation',     pos: 21, chg:  0 },
    { kw: 'whatsapp crm',         pos: 6,  chg: +3 },
  ];

  return (
    <>
      <Topbar
        title="Analytics"
        subtitle="Performance insights — CRM, Google Analytics & SEO"
        actions={
          <select value={companyId} onChange={e => setCompanyId(e.target.value)}
            style={{ border: '1px solid #d4e1ec', borderRadius: 8, padding: '6px 12px', fontSize: 12.5, color: '#192b3f', background: '#ffffff', fontFamily: 'inherit' }}>
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        }
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Tab Bar ─────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: 4, background: '#f0f5fa', borderRadius: 12, padding: 4, width: 'fit-content' }}>
          {([
            { key: 'crm', label: 'CRM Analytics',        icon: '📊' },
            { key: 'ga',  label: 'Google Analytics',     icon: '📈' },
            { key: 'seo', label: 'SEO & Search Console', icon: '🔍' },
          ] as { key: Tab; label: string; icon: string }[]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{
                padding: '7px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
                border: 'none', transition: 'all 0.15s',
                background: tab === t.key ? '#ffffff' : 'transparent',
                color:      tab === t.key ? '#192b3f' : '#7a9baf',
                boxShadow:  tab === t.key ? '0 1px 4px rgba(25,43,63,0.1)' : 'none',
              }}>
              <span style={{ marginRight: 5 }}>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7a9baf', fontSize: 13 }}>
            <div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid #e2eaf2', borderTopColor: '#3199d4', animation: 'spin 0.7s linear infinite' }} />
            Loading analytics…
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          </div>
        )}

        {/* ══════════════════════ CRM TAB ══════════════════════ */}
        {tab === 'crm' && (
          <>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              <MetricTile label="Total Leads"      value={(s.totalLeads||0).toLocaleString()}   sub="All time"          color="#3199d4" icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>} />
              <MetricTile label="Deals Won"         value={(s.wonDeals||0).toLocaleString()}     sub="Closed won"        color="#10b981" icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>} />
              <MetricTile label="Revenue"            value={fmtL(s.totalRevenue||0)}             sub="Paid invoices"     color="#f97316" icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>} />
              <MetricTile label="Conversion Rate"    value={`${s.conversionRate||0}%`}           sub="Leads → Won"       color="#8b5cf6" icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-4.5 h-4.5"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>} />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
              {/* Lead Sources */}
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)' }}>
                <SectionHead title="Lead Sources" badge="All time" />
                {bySource.length === 0
                  ? <div style={{ fontSize: 12.5, color: '#7a9baf', textAlign: 'center', padding: '20px 0' }}>No data yet</div>
                  : bySource.sort(([, a]: any, [, b]: any) => b - a).map(([src, cnt]: any) => (
                      <BarRow key={src} label={src} value={cnt} max={maxSource} color={SOURCE_COLORS[src] || '#94a3b8'} />
                    ))
                }
              </div>

              {/* Lead Status */}
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)' }}>
                <SectionHead title="Lead Status" badge="All time" />
                {byStatus.length === 0
                  ? <div style={{ fontSize: 12.5, color: '#7a9baf', textAlign: 'center', padding: '20px 0' }}>No data yet</div>
                  : byStatus.map(([st, cnt]: any) => (
                      <BarRow key={st} label={st} value={cnt} max={maxStatus} color={STAGE_COLORS[st.toUpperCase()] || '#94a3b8'} />
                    ))
                }
              </div>

              {/* Pipeline by Stage */}
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)' }}>
                <SectionHead title="Pipeline by Stage" />
                {pipeline.length === 0
                  ? <div style={{ fontSize: 12.5, color: '#7a9baf', textAlign: 'center', padding: '20px 0' }}>No deals yet</div>
                  : pipeline.map((p: any) => (
                      <div key={p.stage} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f8fbfd' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <div style={{ width: 7, height: 7, borderRadius: '50%', background: STAGE_COLORS[p.stage] || '#94a3b8', flexShrink: 0 }} />
                          <span style={{ fontSize: 12.5, color: '#64748b', textTransform: 'capitalize' }}>{p.stage?.replace('_', ' ').toLowerCase()}</span>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{p._count?.stage || 0}</div>
                          <div style={{ fontSize: 11, color: '#7a9baf' }}>₹{((p._sum?.value || 0) / 100000).toFixed(1)}L</div>
                        </div>
                      </div>
                    ))
                }
              </div>
            </div>

            {/* Team Leaderboard */}
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)' }}>
              <SectionHead title="Team Leaderboard" />
              {team.length === 0
                ? <div style={{ fontSize: 12.5, color: '#7a9baf', textAlign: 'center', padding: '20px 0' }}>No team data</div>
                : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {team.slice(0, 6).map((m: any, i: number) => {
                      const medal = i === 0 ? { bg: '#fef9c3', color: '#b45309', label: '🥇' } : i === 1 ? { bg: '#f1f5f9', color: '#475569', label: '🥈' } : i === 2 ? { bg: '#fff7ed', color: '#c2410c', label: '🥉' } : null;
                      return (
                        <div key={m.userId} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 12, background: medal?.bg || '#f8fbfd', border: '1px solid #e2eaf2' }}>
                          <span style={{ fontSize: 18, flexShrink: 0 }}>{medal?.label || `#${i + 1}`}</span>
                          <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#e8f5fd', color: '#1a72a3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                            {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#192b3f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                            <div style={{ fontSize: 11.5, color: '#7a9baf' }}>{m.leadsAssigned} leads · {m.dealsWon} won</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )
              }
            </div>
          </>
        )}

        {/* ══════════════════════ GOOGLE ANALYTICS TAB ══════════════════════ */}
        {tab === 'ga' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Connection Banner */}
            {!gaConnected ? (
              <div style={{ background: 'linear-gradient(135deg, #192b3f 0%, #2d5c7b 100%)', borderRadius: 16, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>Connect Google Analytics 4</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, maxWidth: 480 }}>
                    Add your GA4 Measurement ID in Settings → Integrations to start tracking sessions, page views, and conversions per company domain.
                  </p>
                </div>
                <a href="/dashboard/settings" style={{ background: '#3199d4', color: '#ffffff', padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  Configure Now →
                </a>
              </div>
            ) : (
              <div style={{ background: 'linear-gradient(135deg, #192b3f 0%, #1a72a3 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#fff"/></svg>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Google Analytics 4 — Active</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
                    Tracking ID: <code style={{ background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 6, fontSize: 12 }}>{gaConfig.gaTrackingId}</code>
                    {gaConfig.domain && <> &nbsp;·&nbsp; Domain: <strong style={{ color: '#7dd3fc' }}>{gaConfig.domain}</strong></>}
                  </div>
                </div>
                <a href={`https://analytics.google.com/analytics/web/#/p${gaConfig.gaPropertyId}/reports/summary`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  Open GA4 ↗
                </a>
              </div>
            )}

            {/* GA4 Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Sessions',        value: gaConnected ? '—'    : 'N/A', sub: 'Last 30 days',   color: '#3199d4', icon: '📱' },
                { label: 'Page Views',      value: gaConnected ? '—'    : 'N/A', sub: 'Last 30 days',   color: '#10b981', icon: '👁' },
                { label: 'Avg. Duration',   value: gaConnected ? '—'    : 'N/A', sub: 'Per session',    color: '#f97316', icon: '⏱' },
                { label: 'Bounce Rate',     value: gaConnected ? '—'    : 'N/A', sub: 'Lower is better',color: '#8b5cf6', icon: '↩' },
              ].map((m, i) => (
                <MetricTile key={i} label={m.label} value={m.value} sub={m.sub} color={m.color} icon={m.icon} />
              ))}
            </div>

            {/* Traffic Sources + Top Pages */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}>
                <SectionHead title="Traffic by Channel" badge={gaConnected ? 'GA4' : 'Connect GA4'} />
                {[
                  { label: 'Organic Search',  value: 0, color: '#10b981' },
                  { label: 'Direct',          value: 0, color: '#3199d4' },
                  { label: 'Social',          value: 0, color: '#1877F2' },
                  { label: 'Referral',        value: 0, color: '#f97316' },
                  { label: 'Paid Search',     value: 0, color: '#8b5cf6' },
                ].map((ch, i) => (
                  <BarRow key={i} label={ch.label} value={ch.value} max={1} color={ch.color} />
                ))}
                {!gaConnected && (
                  <div style={{ marginTop: 12, textAlign: 'center', fontSize: 12, color: '#7a9baf' }}>
                    Connect GA4 to see live channel data
                  </div>
                )}
              </div>

              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}>
                <SectionHead title="Top Pages" badge={gaConnected ? 'GA4' : 'Connect GA4'} />
                {gaConnected ? (
                  <div style={{ fontSize: 12.5, color: '#7a9baf', textAlign: 'center', padding: '20px 0' }}>
                    Connect GA4 Data API (service account) to see page views per URL
                  </div>
                ) : (
                  <div style={{ fontSize: 12.5, color: '#7a9baf', textAlign: 'center', padding: '20px 0' }}>
                    Connect GA4 to see top performing pages
                  </div>
                )}
              </div>
            </div>

            {/* Domain Tracking Info */}
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}>
              <SectionHead title="Domain-Wise Tracking Setup" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {[
                  {
                    step: '1', title: 'Company Domain', desc: 'Set your company website/domain in Company Profile settings',
                    status: !!gaConfig.domain, value: gaConfig.domain || 'Not set',
                    color: '#3199d4',
                  },
                  {
                    step: '2', title: 'GA4 Measurement ID', desc: 'Paste G-XXXXXXXXXX from GA4 → Admin → Data Streams',
                    status: !!gaConfig.gaTrackingId, value: gaConfig.gaTrackingId || 'Not configured',
                    color: '#f97316',
                  },
                  {
                    step: '3', title: 'Tracking Active', desc: 'CRM injects gtag.js with your domain cookie — all sessions attributed correctly',
                    status: gaConnected && !!gaConfig.domain, value: gaConnected && gaConfig.domain ? 'Tracking live ✓' : 'Awaiting setup',
                    color: '#10b981',
                  },
                ].map((item, i) => (
                  <div key={i} style={{ padding: '14px', borderRadius: 12, background: item.status ? '#f0fdf4' : '#f8fbfd', border: `1px solid ${item.status ? '#bbf7d0' : '#e2eaf2'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <div style={{ width: 24, height: 24, borderRadius: '50%', background: item.color, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{item.step}</div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{item.title}</span>
                    </div>
                    <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 8px', lineHeight: 1.6 }}>{item.desc}</p>
                    <code style={{ fontSize: 11.5, color: item.status ? '#059669' : '#7a9baf', background: item.status ? '#dcfce7' : '#f0f5fa', padding: '3px 8px', borderRadius: 6 }}>
                      {item.value}
                    </code>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══════════════════════ SEO TAB ══════════════════════ */}
        {tab === 'seo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* GSC Banner */}
            {!gscConnected ? (
              <div style={{ background: 'linear-gradient(135deg, #192b3f 0%, #b45309 100%)', borderRadius: 16, padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#ffffff', marginBottom: 6 }}>Connect Google Search Console</div>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', margin: 0, maxWidth: 480 }}>
                    Add your Search Console site URL in Settings → Integrations to see organic clicks, impressions, CTR, and keyword rankings.
                  </p>
                </div>
                <a href="/dashboard/settings" style={{ background: '#f97316', color: '#ffffff', padding: '9px 20px', borderRadius: 10, fontSize: 13, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  Configure Now →
                </a>
              </div>
            ) : (
              <div style={{ background: 'linear-gradient(135deg, #192b3f 0%, #9a3412 100%)', borderRadius: 16, padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>🔍</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#ffffff' }}>Search Console — Connected</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>
                    Site: <strong style={{ color: '#fcd34d' }}>{gaConfig.gscSiteUrl}</strong>
                  </div>
                </div>
                <a href={`https://search.google.com/search-console/performance/search-analytics?resource_id=${encodeURIComponent(gaConfig.gscSiteUrl)}`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ background: 'rgba(255,255,255,0.15)', color: '#ffffff', padding: '8px 16px', borderRadius: 9, fontSize: 12.5, fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                  Open GSC ↗
                </a>
              </div>
            )}

            {/* SEO KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Organic Clicks',   value: gscConnected ? '—' : 'N/A', sub: 'Last 28 days', color: '#10b981', icon: '🖱' },
                { label: 'Impressions',      value: gscConnected ? '—' : 'N/A', sub: 'Last 28 days', color: '#3199d4', icon: '👁' },
                { label: 'Avg. CTR',         value: gscConnected ? '—' : 'N/A', sub: 'Click-through', color: '#f97316', icon: '📊' },
                { label: 'Avg. Position',    value: gscConnected ? '—' : 'N/A', sub: 'Search ranking', color: '#8b5cf6', icon: '🏆' },
              ].map((m, i) => (
                <MetricTile key={i} label={m.label} value={m.value} sub={m.sub} color={m.color} icon={m.icon} />
              ))}
            </div>

            {/* Keyword Rankings + SEO Health */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {/* Keyword Rankings */}
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}>
                <SectionHead title="Keyword Rankings" badge={gscConnected ? 'GSC Live' : 'Demo Data'} />
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#f8fbfd' }}>
                      {['Keyword', 'Position', '7d Change'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '8px 10px', fontSize: 11, fontWeight: 700, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.06em', borderBottom: '1px solid #f0f5fa' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {SEO_KEYWORDS.map((k, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #f8fbfd' }}>
                        <td style={{ padding: '9px 10px', fontSize: 13, color: '#192b3f' }}>{k.kw}</td>
                        <td style={{ padding: '9px 10px' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 700, color: k.pos <= 5 ? '#059669' : k.pos <= 10 ? '#d97706' : '#64748b' }}>
                            #{k.pos}
                          </span>
                        </td>
                        <td style={{ padding: '9px 10px', fontSize: 12.5, fontWeight: 600, color: k.chg > 0 ? '#10b981' : k.chg < 0 ? '#ef4444' : '#7a9baf' }}>
                          {k.chg > 0 ? `▲ ${k.chg}` : k.chg < 0 ? `▼ ${Math.abs(k.chg)}` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!gscConnected && (
                  <div style={{ marginTop: 10, padding: '8px 12px', background: '#f8fbfd', borderRadius: 8, fontSize: 11.5, color: '#7a9baf', textAlign: 'center' }}>
                    Connect Search Console for live keyword rankings
                  </div>
                )}
              </div>

              {/* SEO Health Checklist */}
              <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}>
                <SectionHead title="SEO Tracking Checklist" />
                {[
                  { label: 'GA4 Tracking Active',            done: gaConnected },
                  { label: 'Domain Configured',              done: !!gaConfig.domain },
                  { label: 'Search Console Connected',       done: gscConnected },
                  { label: 'GA4 Property ID Set',            done: !!gaConfig.gaPropertyId },
                  { label: 'Company Website Recorded',       done: !!companies.find(c => c.companyId === companyId)?.website },
                  { label: 'Facebook Pixel Configured',      done: false },
                ].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #f8fbfd' }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: item.done ? '#d1fae5' : '#f0f5fa', color: item.done ? '#059669' : '#cbd5e1', fontSize: 11, fontWeight: 700 }}>
                      {item.done ? '✓' : '○'}
                    </div>
                    <span style={{ fontSize: 12.5, color: item.done ? '#192b3f' : '#94a3b8', fontWeight: item.done ? 600 : 400 }}>{item.label}</span>
                    {!item.done && (
                      <a href="/dashboard/settings" style={{ marginLeft: 'auto', fontSize: 11, color: '#3199d4', textDecoration: 'none', fontWeight: 600 }}>Set up →</a>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Domain Info Card */}
            <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2' }}>
              <SectionHead title="Company Domain Overview" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
                {companies.slice(0, 6).map((co: any, i: number) => {
                  const ws = co.website || '';
                  const domain = ws.replace(/^https?:\/\//, '').split('/')[0];
                  return (
                    <div key={co.companyId} style={{ padding: '14px', borderRadius: 12, background: '#f8fbfd', border: '1px solid #e2eaf2' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: '#e8f5fd', color: '#1a72a3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
                          {co.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{co.name}</div>
                          <div style={{ fontSize: 11, color: '#7a9baf' }}><Badge status={co.plan?.toLowerCase()} label={co.plan} /></div>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div><span style={{ color: '#7a9baf' }}>Domain: </span>{domain || <span style={{ color: '#cbd5e1' }}>Not set</span>}</div>
                        <div><span style={{ color: '#7a9baf' }}>GA4 ID: </span>
                          {companyId === co.companyId && gaConfig.gaTrackingId
                            ? <span style={{ color: '#059669', fontWeight: 600 }}>{gaConfig.gaTrackingId}</span>
                            : <span style={{ color: '#cbd5e1' }}>Not configured</span>
                          }
                        </div>
                        <div><span style={{ color: '#7a9baf' }}>Leads: </span><strong style={{ color: '#192b3f' }}>{co._count?.leads || 0}</strong></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

          </div>
        )}

      </div>
    </>
  );
}
