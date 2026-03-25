'use client';
import { useEffect, useState } from 'react';
import { companyApi, quotationApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, Input, Sel, Modal, useToast } from '@/components/ui';

export default function QuotationsPage() {
  const [companies,   setCompanies]  = useState<any[]>([]);
  const [companyId,   setCompanyId]  = useState('');
  const [quotations,  setQuotations] = useState<any[]>([]);
  const [loading,     setLoading]    = useState(false);
  const [showCreate,  setShowCreate] = useState(false);
  const [saving,      setSaving]     = useState(false);
  const { toast, ToastContainer }    = useToast();

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '', clientAddress: '', clientGst: '',
    validUntil: new Date(Date.now() + 30*86400000).toISOString().slice(0,10),
    notes: '', items: [{ description:'', quantity:1, unitPrice:0, gstPercent:18, discount:0 }]
  });

  const loadCos = async () => { try { const d = await companyApi.list({limit:'20'}); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const load = async () => { if (!companyId) return; setLoading(true); try { const d = await quotationApi.list(companyId, {limit:'50'}); setQuotations(d.quotations||[]); } catch (e:any) { toast(e.message,'err'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, [companyId]);

  const addItem    = () => setForm(f => ({...f, items: [...f.items, {description:'',quantity:1,unitPrice:0,gstPercent:18,discount:0}]}));
  const removeItem = (i: number) => setForm(f => ({...f, items: f.items.filter((_,idx) => idx!==i)}));
  const updateItem = (i: number, key: string, val: any) => setForm(f => ({...f, items: f.items.map((it,idx) => idx===i ? {...it,[key]:val} : it)}));

  const subtotal   = form.items.reduce((a,it) => a + it.quantity*it.unitPrice - (it.discount||0), 0);
  const gstTotal   = form.items.reduce((a,it) => a + Math.round((it.quantity*it.unitPrice-(it.discount||0))*it.gstPercent/100), 0);
  const grandTotal = subtotal + gstTotal;

  const create = async () => {
    if (!form.clientName || !form.items[0].description) return toast('Client name and items required','err');
    setSaving(true);
    try { await quotationApi.create(companyId, form); toast('Quotation created!'); setShowCreate(false); load(); }
    catch (e:any) { toast(e.message,'err'); } finally { setSaving(false); }
  };

  const send = async (qt: any, channel: string) => {
    try { await quotationApi.send(companyId, qt.quotationId, {channel}); toast(`Sent via ${channel}!`); load(); }
    catch (e:any) { toast(e.message,'err'); }
  };

  const convert = async (qt: any) => {
    try { await quotationApi.convert(companyId, qt.quotationId); toast('Converted to invoice!'); load(); }
    catch (e:any) { toast(e.message,'err'); }
  };

  const STATUS_COLOR: Record<string,string> = { DRAFT:'bg-slate-100 text-slate-500', SENT:'bg-blue-50 text-blue-700', ACCEPTED:'bg-green-50 text-green-700', REJECTED:'bg-red-50 text-red-600', EXPIRED:'bg-amber-50 text-amber-700', CONVERTED:'bg-violet-50 text-violet-700' };

  return (
    <>
      <Topbar title="Quotations" subtitle={`${quotations.length} quotations`}
        actions={<>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Quotation</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5">
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {['#','Client','Items','Subtotal','GST','Total','Status','Valid Until','Actions'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="text-center py-10 text-slate-400">Loading...</td></tr>
                : quotations.length === 0 ? <tr><td colSpan={9} className="text-center py-10 text-slate-400">No quotations yet. Create your first one!</td></tr>
                : quotations.map((qt:any) => (
                  <tr key={qt.quotationId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-mono text-indigo-600 font-semibold whitespace-nowrap">{qt.quotationNumber}</td>
                    <td className="px-3 py-2.5"><div className="font-semibold text-slate-800">{qt.clientName}</div><div className="text-slate-400" style={{fontSize:10}}>{qt.clientEmail}</div></td>
                    <td className="px-3 py-2.5 text-slate-500">{qt.items?.length||0}</td>
                    <td className="px-3 py-2.5 text-slate-700">₹{(qt.subtotal||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 text-slate-500">₹{(qt.totalGst||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5 font-bold text-slate-900">₹{(qt.grandTotal||0).toLocaleString('en-IN')}</td>
                    <td className="px-3 py-2.5"><span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[qt.status]||'bg-slate-100 text-slate-500'}`}>{qt.status}</span></td>
                    <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{qt.validUntil ? new Date(qt.validUntil).toLocaleDateString('en-IN') : '—'}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1">
                        <button onClick={() => send(qt,'email')} className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded font-medium hover:bg-blue-100">📧</button>
                        <button onClick={() => send(qt,'whatsapp')} className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded font-medium hover:bg-green-100">💬</button>
                        {qt.status === 'ACCEPTED' && <button onClick={() => convert(qt)} className="text-xs bg-violet-50 text-violet-600 px-2 py-1 rounded font-medium hover:bg-violet-100">→ Inv</button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Quotation" size="lg"
        footer={<><Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create Quotation</Btn></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Client Name *" value={form.clientName} onChange={e=>setForm(f=>({...f,clientName:e.target.value}))} placeholder="Rahul Sharma" />
            <Input label="Client Email"  value={form.clientEmail} onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))} placeholder="rahul@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Phone"       value={form.clientPhone}   onChange={e=>setForm(f=>({...f,clientPhone:e.target.value}))}   placeholder="+91 98765 43210" />
            <Input label="Valid Until" type="date" value={form.validUntil} onChange={e=>setForm(f=>({...f,validUntil:e.target.value}))} />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-slate-700">Line Items</span>
              <button onClick={addItem} className="text-xs text-indigo-600 hover:underline font-medium">+ Add Item</button>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-xs" style={{tableLayout:'fixed'}}>
                <colgroup><col width="38%"/><col width="8%"/><col width="16%"/><col width="10%"/><col width="12%"/><col width="14%"/><col width="28px"/></colgroup>
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  {['Description','Qty','Rate (₹)','GST%','Discount','Total',''].map(h=><th key={h} className="text-left px-2 py-1.5 text-xs font-semibold text-slate-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {form.items.map((item,i) => {
                    const lineTotal = (item.quantity*item.unitPrice-(item.discount||0)) + Math.round((item.quantity*item.unitPrice-(item.discount||0))*item.gstPercent/100);
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-none">
                        <td className="px-2 py-1"><input className="w-full text-xs border border-slate-200 rounded px-2 py-1 focus:border-indigo-400" value={item.description} onChange={e=>updateItem(i,'description',e.target.value)} placeholder="Item description" /></td>
                        <td className="px-2 py-1"><input type="number" className="w-full text-xs border border-slate-200 rounded px-1 py-1 focus:border-indigo-400" value={item.quantity} onChange={e=>updateItem(i,'quantity',+e.target.value||1)} /></td>
                        <td className="px-2 py-1"><input type="number" className="w-full text-xs border border-slate-200 rounded px-1 py-1 focus:border-indigo-400" value={item.unitPrice} onChange={e=>updateItem(i,'unitPrice',+e.target.value||0)} /></td>
                        <td className="px-2 py-1">
                          <select className="w-full text-xs border border-slate-200 rounded px-1 py-1" value={item.gstPercent} onChange={e=>updateItem(i,'gstPercent',+e.target.value)}>
                            {[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1"><input type="number" className="w-full text-xs border border-slate-200 rounded px-1 py-1 focus:border-indigo-400" value={item.discount} onChange={e=>updateItem(i,'discount',+e.target.value||0)} /></td>
                        <td className="px-2 py-1 font-bold text-slate-800">₹{lineTotal.toLocaleString('en-IN')}</td>
                        <td className="px-2 py-1">{form.items.length>1&&<button onClick={()=>removeItem(i)} className="text-red-400 hover:text-red-600 text-sm leading-none">×</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col items-end gap-1 mt-2 text-xs">
              <div className="flex gap-6 text-slate-500"><span>Subtotal:</span><span className="font-medium text-slate-700 w-24 text-right">₹{subtotal.toLocaleString('en-IN')}</span></div>
              <div className="flex gap-6 text-slate-500"><span>GST:</span><span className="font-medium text-slate-700 w-24 text-right">₹{gstTotal.toLocaleString('en-IN')}</span></div>
              <div className="flex gap-6 font-bold text-slate-900 border-t border-slate-200 pt-1 mt-0.5"><span>Grand Total:</span><span className="text-indigo-600 w-24 text-right">₹{grandTotal.toLocaleString('en-IN')}</span></div>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea rows={2} className="border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:border-indigo-500" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Payment terms, notes..." />
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
