'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { companyApi, leadApi, analyticsApi } from '@/lib/api';
import { Topbar, Card, KpiCard, Badge, ScoreBar, Btn } from '@/components/ui';

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
            leadApi.list(cos[0].companyId, { limit: '6', sortBy: 'createdAt', sortOrder: 'desc' }),
            analyticsApi.overview(cos[0].companyId),
          ]);
          setLeads(lData.leads || []);
          setSummary(aData.summary || {});
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, []);

  const fmt = (n: number) => n?.toLocaleString('en-IN') || '0';
  const fmtL = (n: number) => n >= 100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${fmt(n)}`;

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-center">
        <svg className="animate-spin w-8 h-8 text-indigo-600 mx-auto mb-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
        <p className="text-sm text-slate-500">Loading dashboard...</p>
      </div>
    </div>
  );

  const PIPELINE_STAGES = [
    { label: 'New Lead',    pct: 100, color: '#6366f1' },
    { label: 'Contacted',   pct: 78,  color: '#60a5fa' },
    { label: 'Proposal',    pct: 52,  color: '#34d399' },
    { label: 'Negotiation', pct: 33,  color: '#f97316' },
    { label: 'Won',         pct: 19,  color: '#10b981' },
  ];

  return (
    <>
      <Topbar title="Dashboard" subtitle={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        actions={<>
          <Btn variant="secondary" size="sm" onClick={() => router.push('/dashboard/leads')}>+ Add Lead</Btn>
          <Btn variant="primary"   size="sm" onClick={() => router.push('/dashboard/pipeline')}>Pipeline</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* KPI Row */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Total Leads"     value={fmt(summary.totalLeads)}         change="vs last month" up color="#6366f1" />
          <KpiCard label="Deals Won"        value={fmt(summary.wonDeals)}           change="vs last month" up color="#22c55e" />
          <KpiCard label="Revenue"          value={fmtL(summary.totalRevenue || 0)} change="vs last month" up color="#f97316" />
          <KpiCard label="Conversion Rate"  value={`${summary.conversionRate || 0}%`} change="this week" up color="#06b6d4" />
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-3 gap-4">

          {/* Lead Source Bars */}
          <Card>
            <div className="text-xs font-bold text-slate-900 mb-3">Lead Sources</div>
            {[
              { label: 'Facebook',  pct: 38, color: '#6366f1' },
              { label: 'Google',    pct: 26, color: '#22c55e' },
              { label: 'WhatsApp',  pct: 18, color: '#25d366' },
              { label: 'Referral',  pct: 11, color: '#f97316' },
              { label: 'Organic',   pct: 7,  color: '#06b6d4' },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-16 text-xs text-slate-500 flex-shrink-0">{s.label}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
                <span className="w-8 text-right text-xs font-bold text-slate-700">{s.pct}%</span>
              </div>
            ))}
          </Card>

          {/* Pipeline Funnel */}
          <Card>
            <div className="text-xs font-bold text-slate-900 mb-3">Pipeline Funnel</div>
            {PIPELINE_STAGES.map((s, i) => (
              <div key={i} className="flex items-center gap-2 mb-2">
                <span className="w-20 text-xs text-slate-500 flex-shrink-0">{s.label}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: s.color }} />
                </div>
              </div>
            ))}
          </Card>

          {/* Companies Summary */}
          <Card>
            <div className="text-xs font-bold text-slate-900 mb-3">Companies ({companies.length})</div>
            <div className="flex flex-col gap-2">
              {companies.slice(0, 5).map((co: any) => (
                <div key={co.companyId} className="flex items-center gap-2 cursor-pointer hover:bg-slate-50 rounded-lg p-1 -mx-1 transition-colors" onClick={() => router.push('/dashboard/companies')}>
                  <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {co.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{co.name}</div>
                    <div className="text-xs text-slate-400">{co._count?.leads || 0} leads</div>
                  </div>
                  <Badge status={co.plan?.toLowerCase()} label={co.plan} />
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Recent Leads Table */}
        <Card className="p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-900">Recent Leads</div>
            <Btn variant="primary" size="sm" onClick={() => router.push('/dashboard/leads')}>View All</Btn>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ tableLayout: 'fixed' }}>
              <colgroup><col width="160"/><col width="100"/><col width="90"/><col width="90"/><col width="70"/><col width="60"/><col width="90"/></colgroup>
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {['Name','Source','Status','Phone','Score','Assigned','Created'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {leads.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-slate-400">No leads yet. <button onClick={() => router.push('/dashboard/leads')} className="text-indigo-600 underline">Add your first lead →</button></td></tr>
                ) : leads.map((l: any) => (
                  <tr key={l.leadId} className="border-b border-slate-50 hover:bg-slate-50 cursor-pointer" onClick={() => router.push('/dashboard/leads')}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{l.name.split(' ').map((n: string) => n[0]).join('').slice(0,2)}</div>
                        <span className="font-semibold text-slate-800 truncate">{l.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 capitalize">{l.source?.toLowerCase()}</td>
                    <td className="px-3 py-2.5"><Badge status={l.status?.toLowerCase()} label={l.status} /></td>
                    <td className="px-3 py-2.5 text-slate-500">{l.phone}</td>
                    <td className="px-3 py-2.5"><ScoreBar score={l.aiScore} /></td>
                    <td className="px-3 py-2.5 text-slate-500">{l.assignedTo?.name?.split(' ')[0] || '—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{new Date(l.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    </>
  );
}
