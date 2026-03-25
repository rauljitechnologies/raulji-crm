'use client';
import { useEffect, useState } from 'react';
import { companyApi, analyticsApi } from '@/lib/api';
import { Topbar, Card, KpiCard } from '@/components/ui';

export default function AnalyticsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [overview,  setOverview]  = useState<any>({});
  const [team,      setTeam]      = useState<any[]>([]);
  const [pipeline,  setPipeline]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);

  const loadCos = async () => { try { const d=await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [ov, tm, pl] = await Promise.all([
        analyticsApi.overview(companyId),
        analyticsApi.team(companyId),
        analyticsApi.pipeline(companyId),
      ]);
      setOverview(ov); setTeam(tm.team||[]); setPipeline(pl.pipeline||[]);
    } catch {} finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [companyId]);

  const s = overview.summary || {};
  const fmtL = (n:number) => n>=100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${(n||0).toLocaleString('en-IN')}`;

  const STAGE_COLORS: Record<string,string> = { NEW_LEAD:'#6366f1', CONTACTED:'#60a5fa', PROPOSAL:'#34d399', NEGOTIATION:'#f97316', WON:'#10b981', LOST:'#ef4444' };
  const SOURCE_COLORS: Record<string,string> = { facebook:'#6366f1', google:'#22c55e', whatsapp:'#25d366', referral:'#f97316', organic:'#06b6d4', manual:'#94a3b8', website_form:'#8b5cf6' };
  const bySource = Object.entries(overview.leadsBySource || {});
  const byStatus = Object.entries(overview.leadsByStatus || {});
  const maxSource = Math.max(...bySource.map(([,v]:any) => v), 1);

  return (
    <>
      <Topbar title="Analytics" subtitle="Performance insights"
        actions={
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard label="Total Leads"     value={(s.totalLeads||0).toLocaleString()}  change="All time" up color="#6366f1" />
          <KpiCard label="Deals Won"        value={(s.wonDeals||0).toLocaleString()}    change="All time" up color="#22c55e" />
          <KpiCard label="Revenue Collected"value={fmtL(s.totalRevenue||0)}            change="Paid invoices" up color="#f97316" />
          <KpiCard label="Conversion Rate"  value={`${s.conversionRate||0}%`}          change="Leads → Won" up color="#06b6d4" />
        </div>

        <div className="grid grid-cols-3 gap-4">

          {/* Lead Sources */}
          <Card>
            <div className="text-xs font-bold text-slate-900 mb-3">Lead Sources</div>
            {bySource.length === 0 ? <div className="text-xs text-slate-400 py-4 text-center">No data yet</div>
            : bySource.sort(([,a]:any,[,b]:any) => b-a).map(([src, cnt]:any) => (
              <div key={src} className="flex items-center gap-2 mb-2">
                <span className="w-20 text-xs text-slate-500 capitalize flex-shrink-0">{src}</span>
                <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width:`${(cnt/maxSource)*100}%`, background: SOURCE_COLORS[src]||'#94a3b8' }} />
                </div>
                <span className="w-6 text-right text-xs font-bold text-slate-700">{cnt}</span>
              </div>
            ))}
          </Card>

          {/* Lead Status Funnel */}
          <Card>
            <div className="text-xs font-bold text-slate-900 mb-3">Lead Status</div>
            {byStatus.length === 0 ? <div className="text-xs text-slate-400 py-4 text-center">No data yet</div>
            : byStatus.map(([st, cnt]:any) => {
              const total = byStatus.reduce((a:number,[,v]:any) => a+v, 0);
              const pct = total > 0 ? Math.round((cnt/total)*100) : 0;
              const colors: Record<string,string> = { new:'#6366f1',contacted:'#22c55e',qualified:'#8b5cf6',proposal:'#f97316',negotiation:'#eab308',won:'#10b981',lost:'#ef4444' };
              return (
                <div key={st} className="flex items-center gap-2 mb-2">
                  <span className="w-20 text-xs text-slate-500 capitalize flex-shrink-0">{st}</span>
                  <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width:`${pct}%`, background: colors[st]||'#94a3b8' }} />
                  </div>
                  <span className="w-10 text-right text-xs font-bold text-slate-700">{cnt} <span className="font-normal text-slate-400">({pct}%)</span></span>
                </div>
              );
            })}
          </Card>

          {/* Pipeline Value */}
          <Card>
            <div className="text-xs font-bold text-slate-900 mb-3">Pipeline by Stage</div>
            {pipeline.length === 0 ? <div className="text-xs text-slate-400 py-4 text-center">No deals yet</div>
            : pipeline.map((p:any) => (
              <div key={p.stage} className="flex items-center justify-between py-1.5 border-b border-slate-50 last:border-none">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ background: STAGE_COLORS[p.stage]||'#94a3b8' }} />
                  <span className="text-xs text-slate-600 capitalize">{p.stage?.replace('_',' ').toLowerCase()}</span>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-slate-900">{p._count?.stage||0}</div>
                  <div className="text-xs text-slate-400">₹{((p._sum?.value||0)/100000).toFixed(1)}L</div>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Team Leaderboard */}
        <Card>
          <div className="text-xs font-bold text-slate-900 mb-3">Team Leaderboard</div>
          {team.length === 0 ? <div className="text-xs text-slate-400 py-4 text-center">No team data</div>
          : (
            <div className="grid grid-cols-3 gap-3">
              {team.slice(0,6).map((m:any, i:number) => (
                <div key={m.userId} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i===0?'bg-amber-400 text-white':i===1?'bg-slate-300 text-slate-700':i===2?'bg-orange-300 text-white':'bg-slate-100 text-slate-500'}`}>{i+1}</span>
                  <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{m.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-800 truncate">{m.name}</div>
                    <div className="text-xs text-slate-400">{m.leadsAssigned} leads · {m.dealsWon} won</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}
