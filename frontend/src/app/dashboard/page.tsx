'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { companyApi, leadApi, analyticsApi } from '@/lib/api';
import { Topbar, Card, Badge, ScoreBar, Btn } from '@/components/ui';

// ── Mini Sparkline ────────────────────────────────────────────
function Sparkline({ color = '#3199d4', bars = [30,45,35,60,48,72,55,80,65,88,72,95] }: { color?: string; bars?: number[] }) {
  const max = Math.max(...bars);
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 28 }}>
      {bars.map((h, i) => (
        <div key={i} style={{ flex: 1, borderRadius: 2, height: `${(h/max)*100}%`, background: color, opacity: i === bars.length-1 ? 1 : 0.2 }} />
      ))}
    </div>
  );
}

// ── KPI Metric Card ───────────────────────────────────────────
function MetricCard({ label, value, change, up, color, icon, bars }: { label: string; value: string; change?: string; up?: boolean; color: string; icon: React.ReactNode; bars?: number[] }) {
  return (
    <div className="rounded-2xl p-5 flex flex-col gap-3 transition-all cursor-default"
      style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }}>
      <div className="flex items-start justify-between">
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: '#192b3f', lineHeight: 1.1, marginTop: 6, letterSpacing: '-0.03em' }}>{value}</div>
          {change && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 5, fontSize: 11.5, fontWeight: 600, color: up ? '#10b981' : '#ef4444' }}>
              <span style={{ fontSize: 9 }}>{up ? '▲' : '▼'}</span>
              {change}
            </div>
          )}
        </div>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: `${color}18` }}>
          <span style={{ color, fontSize: 18 }}>{icon}</span>
        </div>
      </div>
      <Sparkline color={color} bars={bars} />
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ── Source/Funnel Bar Row ─────────────────────────────────────
function BarRow({ label, pct, color, extra }: { label: string; pct: number; color: string; extra?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
      <span style={{ width: 80, fontSize: 12, color: '#64748b', flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: '#f0f5fa', borderRadius: 9999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 9999, transition: 'width 0.6s ease' }} />
      </div>
      <span style={{ width: 34, textAlign: 'right', fontSize: 12, fontWeight: 700, color: '#192b3f', flexShrink: 0 }}>{extra || `${pct}%`}</span>
    </div>
  );
}

// ── Status Dot ────────────────────────────────────────────────
function Dot({ color }: { color: string }) {
  return <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: color, flexShrink: 0 }} />;
}

export default function DashboardPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<any[]>([]);
  const [leads,     setLeads]     = useState<any[]>([]);
  const [summary,   setSummary]   = useState<any>({});
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const coData = await companyApi.list({ limit: '10' });
        const cos = coData.companies || [];
        setCompanies(cos);
        if (cos[0]) {
          const [lData, aData] = await Promise.all([
            leadApi.list(cos[0].companyId, { limit: '8', sortBy: 'createdAt', sortOrder: 'desc' }),
            analyticsApi.overview(cos[0].companyId),
          ]);
          setLeads(lData.leads || []);
          setSummary(aData.summary || {});
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const fmt  = (n: number) => n?.toLocaleString('en-IN') || '0';
  const fmtL = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${fmt(n)}`;

  if (loading) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 12 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #e2eaf2', borderTopColor: '#3199d4', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ fontSize: 13, color: '#7a9baf' }}>Loading dashboard…</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const LEAD_SOURCES = [
    { label: 'Facebook',  pct: 38, color: '#3b82f6' },
    { label: 'Google',    pct: 26, color: '#22c55e' },
    { label: 'WhatsApp',  pct: 18, color: '#25d366' },
    { label: 'Referral',  pct: 11, color: '#f97316' },
    { label: 'Organic',   pct:  7, color: '#8b5cf6' },
  ];

  const FUNNEL = [
    { label: 'New Lead',    pct: 100, color: '#3199d4',  count: summary.totalLeads || 0 },
    { label: 'Contacted',   pct:  78, color: '#60a5fa',  count: Math.round((summary.totalLeads||0)*0.78) },
    { label: 'Proposal',    pct:  52, color: '#10b981',  count: Math.round((summary.totalLeads||0)*0.52) },
    { label: 'Negotiation', pct:  33, color: '#f59e0b',  count: Math.round((summary.totalLeads||0)*0.33) },
    { label: 'Won',         pct:  19, color: '#10b981',  count: summary.wonDeals || 0 },
  ];

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <>
      <Topbar
        title="Dashboard"
        subtitle={today}
        actions={<>
          <Btn variant="secondary" size="sm" onClick={() => router.push('/dashboard/leads')}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd"/></svg>
            Add Lead
          </Btn>
          <Btn variant="primary" size="sm" onClick={() => router.push('/dashboard/pipeline')}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5"><path d="M3 1a1 1 0 000 2h1.22l.305 1.222a.997.997 0 00.01.042l1.358 5.43-.893.892C3.74 11.846 4.632 14 6.414 14H15a1 1 0 000-2H6.414l1-1H14a1 1 0 00.894-.553l3-6A1 1 0 0017 3H6.28l-.31-1.243A1 1 0 005 1H3z"/></svg>
            Pipeline
          </Btn>
        </>}
      />

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── KPI Metrics ───────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
          <MetricCard
            label="Total Leads"
            value={fmt(summary.totalLeads)}
            change="vs last month" up
            color="#3199d4"
            icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z"/></svg>}
            bars={[20,35,28,50,40,62,48,70,55,80,65,90]}
          />
          <MetricCard
            label="Deals Won"
            value={fmt(summary.wonDeals)}
            change="vs last month" up
            color="#10b981"
            icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/></svg>}
            bars={[15,25,20,40,30,55,42,65,50,75,60,85]}
          />
          <MetricCard
            label="Revenue"
            value={fmtL(summary.totalRevenue || 0)}
            change="vs last month" up
            color="#f97316"
            icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z"/><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd"/></svg>}
            bars={[25,40,32,58,45,70,55,82,68,90,75,95]}
          />
          <MetricCard
            label="Conversion Rate"
            value={`${summary.conversionRate || 0}%`}
            change="this week" up
            color="#8b5cf6"
            icon={<svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5"><path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/></svg>}
            bars={[35,42,38,55,48,65,52,72,60,80,68,88]}
          />
        </div>

        {/* ── Charts Row ────────────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">

          {/* Lead Sources */}
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionTitle>Lead Sources</SectionTitle>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#3199d4', background: '#e8f5fd', padding: '3px 8px', borderRadius: 9999 }}>This Month</span>
            </div>
            {LEAD_SOURCES.map((s, i) => <BarRow key={i} label={s.label} pct={s.pct} color={s.color} />)}
          </div>

          {/* Pipeline Funnel */}
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionTitle>Pipeline Funnel</SectionTitle>
              <span style={{ fontSize: 10, fontWeight: 600, color: '#7a9baf', background: '#f0f5fa', padding: '3px 8px', borderRadius: 9999 }}>Live</span>
            </div>
            {FUNNEL.map((s, i) => (
              <div key={i} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Dot color={s.color} />
                    <span style={{ fontSize: 12, color: '#64748b' }}>{s.label}</span>
                  </div>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: '#192b3f' }}>{s.count}</span>
                </div>
                <div style={{ height: 5, background: '#f0f5fa', borderRadius: 9999, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${s.pct}%`, background: s.color, borderRadius: 9999 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Companies */}
          <div className="rounded-2xl p-5" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <SectionTitle>Companies</SectionTitle>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf' }}>{companies.length} total</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {companies.length === 0 ? (
                <div style={{ fontSize: 12, color: '#7a9baf', textAlign: 'center', padding: '16px 0' }}>No companies yet</div>
              ) : companies.slice(0, 5).map((co: any) => (
                <div key={co.companyId}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 10, cursor: 'pointer', transition: 'background 0.15s' }}
                  className="hover:bg-slate-50"
                  onClick={() => router.push('/dashboard/companies')}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, background: '#e8f5fd', color: '#1a72a3', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {co.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#192b3f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{co.name}</div>
                    <div style={{ fontSize: 11, color: '#7a9baf' }}>{co._count?.leads || 0} leads</div>
                  </div>
                  <Badge status={co.plan?.toLowerCase()} label={co.plan} />
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* ── Recent Leads Table ────────────────────────────── */}
        <div className="rounded-2xl overflow-hidden" style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 4px rgba(25,43,63,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderBottom: '1px solid #f0f5fa' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>Recent Leads</div>
              <div style={{ fontSize: 11.5, color: '#7a9baf', marginTop: 2 }}>Latest {leads.length} entries</div>
            </div>
            <Btn variant="primary" size="sm" onClick={() => router.push('/dashboard/leads')}>View All →</Btn>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 180 }}/><col style={{ width: 110 }}/><col style={{ width: 110 }}/>
                <col style={{ width: 120 }}/><col style={{ width: 70 }}/><col style={{ width: 90 }}/><col style={{ width: 100 }}/>
              </colgroup>
              <thead>
                <tr style={{ background: '#f8fbfd', borderBottom: '1px solid #f0f5fa' }}>
                  {['Name', 'Source', 'Status', 'Phone', 'Score', 'Assigned', 'Created'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', fontSize: 13, color: '#7a9baf' }}>
                      No leads yet.{' '}
                      <button onClick={() => router.push('/dashboard/leads')} style={{ color: '#3199d4', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13 }}>
                        Add your first lead →
                      </button>
                    </td>
                  </tr>
                ) : leads.map((l: any, idx: number) => (
                  <tr key={l.leadId}
                    style={{ borderBottom: '1px solid #f8fbfd', cursor: 'pointer', transition: 'background 0.12s' }}
                    className="hover:bg-slate-50/60"
                    onClick={() => router.push(`/dashboard/leads/${l.leadId}`)}>
                    <td style={{ padding: '11px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                        <div style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${(idx*47)%360},65%,92%)`, color: `hsl(${(idx*47)%360},55%,38%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700, flexShrink: 0 }}>
                          {l.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#192b3f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</span>
                      </div>
                    </td>
                    <td style={{ padding: '11px 16px', fontSize: 12.5, color: '#64748b', textTransform: 'capitalize' }}>{l.source?.toLowerCase().replace(/_/g,' ')}</td>
                    <td style={{ padding: '11px 16px' }}><Badge status={l.status?.toLowerCase()} label={l.status} /></td>
                    <td style={{ padding: '11px 16px', fontSize: 12.5, color: '#64748b' }}>{l.phone}</td>
                    <td style={{ padding: '11px 16px' }}><ScoreBar score={l.aiScore} /></td>
                    <td style={{ padding: '11px 16px', fontSize: 12.5, color: '#64748b' }}>{l.assignedTo?.name?.split(' ')[0] || '—'}</td>
                    <td style={{ padding: '11px 16px', fontSize: 12, color: '#7a9baf' }}>{new Date(l.createdAt).toLocaleDateString('en-IN', { day:'numeric', month:'short' })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  );
}
