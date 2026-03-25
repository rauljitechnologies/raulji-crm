'use client';
import { useEffect, useState } from 'react';
import { companyApi, invoiceApi } from '@/lib/api';
import { Topbar, Card, Btn, useToast } from '@/components/ui';

export default function InvoicesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [invoices,  setInvoices]  = useState<any[]>([]);
  const [summary,   setSummary]   = useState<any>({});
  const [loading,   setLoading]   = useState(false);
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => { try { const d = await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const load = async () => { if(!companyId) return; setLoading(true); try { const d = await invoiceApi.list(companyId,{limit:'50'}); setInvoices(d.invoices||[]); setSummary(d.summary||{}); } catch(e:any){toast(e.message,'err');} finally{setLoading(false);} };
  useEffect(() => { load(); }, [companyId]);

  const markPaid = async (inv: any) => { try { await invoiceApi.markPaid(companyId, inv.invoiceId, {paidAmount:inv.grandTotal}); toast('Marked as paid!'); load(); } catch(e:any){toast(e.message,'err');} };
  const send     = async (inv: any, channel: string) => { try { await invoiceApi.send(companyId, inv.invoiceId, {channel}); toast(`Sent via ${channel}!`); load(); } catch(e:any){toast(e.message,'err');} };

  const STATUS_COLOR: Record<string,string> = { DRAFT:'bg-slate-100 text-slate-500', SENT:'bg-blue-50 text-blue-700', PAID:'bg-emerald-100 text-emerald-700', PARTIAL:'bg-amber-50 text-amber-700', OVERDUE:'bg-red-50 text-red-600', CANCELLED:'bg-slate-100 text-slate-400' };
  const fmtL = (n:number) => n>=100000 ? `₹${(n/100000).toFixed(1)}L` : `₹${n.toLocaleString('en-IN')}`;

  return (
    <>
      <Topbar title="Invoices" subtitle={`${invoices.length} invoices`}
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm">+ New Invoice</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'Total Paid',    value: fmtL(summary.paid?.amount||0),    color:'text-emerald-600' },
            { label:'Pending',       value: `${(summary.sent?.count||0)} invoices`, color:'text-blue-600' },
            { label:'Overdue',       value: fmtL(summary.overdue?.amount||0), color:'text-red-500'     },
            { label:'Draft',         value: `${summary.draft?.count||0}`,     color:'text-slate-500'   },
          ].map((s,i)=>(
            <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-xs font-medium text-slate-400 mb-1">{s.label}</div>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {['#','Client','Amount','GST','Total','Status','Due Date','Actions'].map(h=>(
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="text-center py-10 text-slate-400">Loading...</td></tr>
                : invoices.length===0 ? <tr><td colSpan={8} className="text-center py-10 text-slate-400">No invoices. Convert a quotation to create one.</td></tr>
                : invoices.map((inv:any)=>(
                  <tr key={inv.invoiceId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-indigo-600 font-semibold whitespace-nowrap">{inv.invoiceNumber}</td>
                    <td className="px-3 py-2.5"><div className="font-semibold text-slate-800">{inv.clientName}</div><div className="text-slate-400" style={{fontSize:10}}>{inv.clientEmail}</div></td>
                    <td className="px-3 py-2.5 text-slate-700">₹{(inv.subtotal||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-slate-500">₹{(inv.totalGst||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">₹{(inv.grandTotal||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[inv.status]||'bg-slate-100 text-slate-500'}`}>{inv.status}</span></td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        {!['PAID','CANCELLED'].includes(inv.status) && <button onClick={()=>markPaid(inv)} className="text-xs bg-emerald-50 text-emerald-600 px-2 py-1 rounded font-medium hover:bg-emerald-100 whitespace-nowrap">✓ Paid</button>}
                        <button onClick={()=>send(inv,'email')} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium hover:bg-blue-100">📧</button>
                        <button onClick={()=>send(inv,'whatsapp')} className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded font-medium hover:bg-green-100">💬</button>
                      </div>
                    </td>
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
