'use client';
import { useEffect, useState } from 'react';
import { companyApi, dealApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, useToast } from '@/components/ui';

export default function DealsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [deals,     setDeals]     = useState<any[]>([]);
  const [pipeline,  setPipeline]  = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => { try { const d=await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const load = async () => { if(!companyId) return; setLoading(true); try { const d=await dealApi.list(companyId,{limit:'50'}); setDeals(d.deals||[]); setPipeline(d.pipeline||[]); } catch(e:any){toast(e.message,'err');} finally{setLoading(false);} };
  useEffect(() => { load(); }, [companyId]);

  const STAGE_COLOR: Record<string,string> = { NEW_LEAD:'bg-indigo-50 text-indigo-700', CONTACTED:'bg-blue-50 text-blue-700', PROPOSAL:'bg-green-50 text-green-700', NEGOTIATION:'bg-orange-50 text-orange-700', WON:'bg-emerald-100 text-emerald-700', LOST:'bg-red-50 text-red-600' };

  return (
    <>
      <Topbar title="Deals" subtitle={`${deals.length} deals`}
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="secondary" size="sm" onClick={() => window.location.href='/dashboard/pipeline'}>Kanban View</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{tableLayout:'fixed'}}>
              <colgroup><col width="180"/><col width="140"/><col width="100"/><col width="100"/><col width="100"/><col width="90"/><col width="100"/></colgroup>
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {['Deal Name','Lead','Value','Stage','Probability','Close Date','Assigned'].map(h=>(
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={7} className="text-center py-10 text-slate-400">Loading...</td></tr>
                : deals.length===0 ? <tr><td colSpan={7} className="text-center py-10 text-slate-400">No deals yet. Convert a lead to create one.</td></tr>
                : deals.map((d:any)=>(
                  <tr key={d.dealId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-semibold text-slate-800 truncate">{d.name}</td>
                    <td className="px-3 py-2.5 text-slate-500 truncate">{d.lead?.name||'—'}</td>
                    <td className="px-3 py-2.5 font-bold text-indigo-600">₹{(d.value||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STAGE_COLOR[d.stage]||'bg-slate-100 text-slate-500'}`}>{d.stage?.replace('_',' ')}</span></td>
                    <td className="px-3 py-2.5 text-slate-500">{d.probability}%</td>
                    <td className="px-3 py-2.5 text-slate-500">{d.expectedCloseDate ? new Date(d.expectedCloseDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{d.assignedTo?.name?.split(' ')[0]||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
      <ToastContainer />
    </>
  );
}
