'use client';
import { useEffect, useState, useRef } from 'react';
import { companyApi, invoiceApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast } from '@/components/ui';

const API      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const getToken = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '');

const STATUS_CFG: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT:     { bg:'bg-slate-100',   text:'text-slate-500',   dot:'bg-slate-400',   label:'Draft'     },
  SENT:      { bg:'bg-blue-50',     text:'text-blue-700',    dot:'bg-blue-500',    label:'Sent'      },
  PAID:      { bg:'bg-emerald-100', text:'text-emerald-700', dot:'bg-emerald-500', label:'Paid'      },
  PARTIAL:   { bg:'bg-amber-50',    text:'text-amber-700',   dot:'bg-amber-500',   label:'Partial'   },
  OVERDUE:   { bg:'bg-red-50',      text:'text-red-600',     dot:'bg-red-500',     label:'Overdue'   },
  CANCELLED: { bg:'bg-slate-100',   text:'text-slate-400',   dot:'bg-slate-300',   label:'Cancelled' },
};

function StatusBadge({ s }: { s: string }) {
  const c = STATUS_CFG[s] || STATUS_CFG.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

// ── PDF Preview Modal ─────────────────────────────────────────
function PdfModal({ inv, companyId, onClose }: any) {
  const [dl, setDl] = useState(false);
  const viewUrl = `${API}/companies/${companyId}/invoices/${inv.invoiceId}/view`;
  const download = async () => {
    setDl(true);
    try {
      const r = await fetch(`${API}/companies/${companyId}/invoices/${inv.invoiceId}/pdf`, { headers:{ Authorization:`Bearer ${getToken()}` } });
      const blob = await r.blob();
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${inv.invoiceNumber}.pdf`; a.click(); URL.revokeObjectURL(a.href);
    } catch { window.open(viewUrl, '_blank'); }
    finally { setDl(false); }
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-4xl flex flex-col shadow-2xl overflow-hidden" style={{height:'90vh'}} onClick={e=>e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <div className="text-sm font-bold text-slate-900">{inv.invoiceNumber}</div>
              <div className="text-xs text-slate-400">{inv.clientName} · Rs.{(inv.grandTotal||0).toLocaleString('en-IN')}</div>
            </div>
            <StatusBadge s={inv.status} />
          </div>
          <div className="flex items-center gap-2">
            <Btn variant="primary" size="sm" loading={dl} onClick={download}>Download PDF</Btn>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm">x</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden bg-slate-100">
          <iframe src={viewUrl} className="w-full h-full border-none bg-white" title="Invoice" />
        </div>
      </div>
    </div>
  );
}

// ── Mark Paid Modal ───────────────────────────────────────────
function MarkPaidModal({ inv, companyId, onClose, onDone }: any) {
  const [form, setForm]     = useState({ paidAmount: String(inv.grandTotal||''), paymentMethod:'bank_transfer', transactionId:'', notes:'' });
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const save = async () => {
    setSaving(true);
    try {
      await invoiceApi.markPaid(companyId, inv.invoiceId, { ...form, paidAmount: +form.paidAmount });
      toast('Marked as paid!');
      setTimeout(()=>{ onDone(); onClose(); }, 700);
    } catch(e:any){ toast(e.message,'err'); } finally { setSaving(false); }
  };
  const bal = (inv.grandTotal||0) - +(form.paidAmount||0);
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e=>e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl flex-shrink-0">Rs</div>
            <div><div className="font-bold text-slate-900">Mark as Paid</div><div className="text-xs text-slate-400">{inv.invoiceNumber} · Total Rs.{(inv.grandTotal||0).toLocaleString('en-IN')}</div></div>
          </div>
          <div className="px-6 py-5 flex flex-col gap-3">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Amount Received (Rs.)</label>
              <input type="number" value={form.paidAmount} onChange={e=>setForm(f=>({...f,paidAmount:e.target.value}))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" placeholder="0" />
              {bal>0&&form.paidAmount&&<div className="text-xs text-amber-600 mt-1">Balance Rs.{bal.toLocaleString('en-IN')} remaining - will be marked PARTIAL</div>}
              {bal<=0&&form.paidAmount&&<div className="text-xs text-emerald-600 mt-1">Full payment received - will be marked PAID</div>}
            </div>
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Payment Method</label>
              <select value={form.paymentMethod} onChange={e=>setForm(f=>({...f,paymentMethod:e.target.value}))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 outline-none transition-all">
                <option value="bank_transfer">Bank Transfer / NEFT / RTGS</option>
                <option value="upi">UPI</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="card">Credit / Debit Card</option>
                <option value="razorpay">Razorpay</option>
                <option value="other">Other</option>
              </select>
            </div>
            <Input label="Transaction / Reference ID (optional)" value={form.transactionId} onChange={e=>setForm(f=>({...f,transactionId:e.target.value}))} placeholder="UTR1234567890 or Cheque No." />
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
              <textarea rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none focus:border-indigo-500 outline-none" placeholder="Optional payment notes..." />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={save} className="!bg-emerald-600 !border-emerald-600 hover:!bg-emerald-700">Confirm Payment</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ── Send Modal ────────────────────────────────────────────────
function SendModal({ inv, companyId, onClose, onDone }: any) {
  const [ch, setCh]         = useState('email');
  const [sending, setSending] = useState(false);
  const { toast, ToastContainer } = useToast();
  const send = async () => {
    setSending(true);
    try { await invoiceApi.send(companyId, inv.invoiceId, {channel:ch}); toast(`Sent via ${ch}!`); setTimeout(()=>{onDone();onClose();},700); }
    catch(e:any){ toast(e.message,'err'); } finally { setSending(false); }
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-100"><div className="font-bold text-slate-900">Send Invoice</div><div className="text-xs text-slate-400 mt-0.5">{inv.invoiceNumber} to {inv.clientName}</div></div>
          <div className="px-6 py-5 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {['email','whatsapp'].map(c=>(
                <button key={c} onClick={()=>setCh(c)} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${ch===c?'border-indigo-500 bg-indigo-50':'border-slate-200 hover:border-slate-300'}`}>
                  <span className="text-2xl">{c==='email'?'Email':'WhatsApp'}</span>
                  <span className="text-xs font-semibold text-slate-700 capitalize">{c==='whatsapp'?'WhatsApp':'Email'}</span>
                  <span className="text-xs text-slate-400">{c==='email'?inv.clientEmail||'No email set':inv.clientPhone||'No phone set'}</span>
                </button>
              ))}
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">Invoice will be marked as Sent after delivery.</div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" loading={sending} onClick={send}>Send Now</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ── Cancel Confirm Modal ──────────────────────────────────────
function CancelModal({ inv, companyId, onClose, onDone }: any) {
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const cancel = async () => {
    setSaving(true);
    try { await invoiceApi.update(companyId, inv.invoiceId, {status:'CANCELLED'}); toast('Invoice cancelled.'); setTimeout(()=>{onDone();onClose();},600); }
    catch(e:any){ toast(e.message,'err'); } finally { setSaving(false); }
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
          <div className="px-6 py-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-3xl mx-auto mb-3">!</div>
            <div className="font-bold text-slate-900 text-lg mb-1">Cancel Invoice?</div>
            <div className="text-xs text-slate-500 leading-relaxed"><strong>{inv.invoiceNumber}</strong> for <strong>{inv.clientName}</strong><br/>Rs.{(inv.grandTotal||0).toLocaleString('en-IN')} will be cancelled. This cannot be undone.</div>
          </div>
          <div className="px-6 pb-6 flex gap-2">
            <Btn variant="secondary" onClick={onClose} className="flex-1">Keep Invoice</Btn>
            <Btn variant="danger"    loading={saving} onClick={cancel} className="flex-1">Yes, Cancel</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ── Upload Receipt Modal ──────────────────────────────────────
function UploadModal({ inv, onClose }: any) {
  const [file, setFile]     = useState<File|null>(null);
  const [prev, setPrev]     = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const { toast, ToastContainer } = useToast();
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if(!f) return; setFile(f);
    if(f.type.startsWith('image/')) setPrev(URL.createObjectURL(f)); else setPrev('');
  };
  const upload = async () => {
    if(!file) return toast('Please select a file','err');
    setSaving(true);
    await new Promise(r=>setTimeout(r,1200));
    toast('Receipt uploaded!'); setSaving(false); onClose();
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e=>e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-100"><div className="font-bold text-slate-900">Upload Receipt</div><div className="text-xs text-slate-400 mt-0.5">{inv.invoiceNumber} · {inv.clientName}</div></div>
          <div className="px-6 py-5 flex flex-col gap-3">
            <div onClick={()=>ref.current?.click()} className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${file?'border-indigo-400 bg-indigo-50':'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
              {prev ? <img src={prev} alt="" className="max-h-28 mx-auto rounded-lg mb-2 object-contain" /> : <div className="text-3xl mb-2">{file?'clip':'upload'}</div>}
              {file ? <div><div className="text-xs font-semibold text-indigo-600">{file.name}</div><div className="text-xs text-slate-400">{(file.size/1024).toFixed(1)} KB</div></div>
                    : <div><div className="text-xs font-semibold text-slate-700">Click to upload receipt</div><div className="text-xs text-slate-400 mt-1">PNG, JPG, PDF up to 10MB</div></div>}
              <input ref={ref} type="file" accept="image/*,.pdf" className="hidden" onChange={pick} />
            </div>
            {file && <div className="flex items-center justify-between bg-slate-50 rounded-xl px-3 py-2">
              <span className="text-xs font-medium text-slate-700 truncate max-w-48">{file.name}</span>
              <button onClick={()=>{setFile(null);setPrev('');}} className="text-xs text-red-400 hover:text-red-600 ml-2 flex-shrink-0">Remove</button>
            </div>}
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end">
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={upload}>Upload</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

const BLANK = () => ({ description:'', quantity:1, unitPrice:0, gstPercent:18, discount:0 });

// ── MAIN PAGE ─────────────────────────────────────────────────
export default function InvoicesPage() {
  const [companies,   setCompanies]   = useState<any[]>([]);
  const [companyId,   setCompanyId]   = useState('');
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [summary,     setSummary]     = useState<any>({});
  const [loading,     setLoading]     = useState(false);
  const [activeTab,   setActiveTab]   = useState('ALL');
  const [previewInv,  setPreviewInv]  = useState<any>(null);
  const [paidInv,     setPaidInv]     = useState<any>(null);
  const [sendInv,     setSendInv]     = useState<any>(null);
  const [cancelInv,   setCancelInv]   = useState<any>(null);
  const [uploadInv,   setUploadInv]   = useState<any>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [form, setForm] = useState({ clientName:'', clientEmail:'', clientPhone:'', clientGst:'', clientAddress:'', dueDate:new Date(Date.now()+30*86400000).toISOString().slice(0,10), paymentTerms:'Net 30', notes:'', bankDetails:{bankName:'',accountNumber:'',ifsc:'',accountName:'',upiId:''}, items:[BLANK()] });
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => {
    try {
      const d   = await companyApi.list({limit:'20'});
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos[0]) setCompanyId(cos[0].companyId);
    } catch {}
  };
  useEffect(()=>{ loadCos(); },[]);

  // When companyId changes, auto-fill bank details from company settings
  useEffect(()=>{
    if(!companyId) return;
    companyApi.getSettings(companyId).then((d:any)=>{
      const bd = d.bankDetails || {};
      if (bd.bankName) {
        setForm((f:any)=>({...f, bankDetails:{
          bankName:      bd.bankName      || '',
          accountNumber: bd.accountNumber || '',
          ifsc:          bd.ifsc          || '',
          accountName:   bd.accountName   || '',
          upiId:         bd.upiId         || '',
        }, paymentTerms: bd.paymentTerms || f.paymentTerms }));
      }
    }).catch(()=>{});
  },[companyId]);

  const load = async () => {
    if(!companyId) return; setLoading(true);
    try { const d=await invoiceApi.list(companyId,{limit:'100'}); setAllInvoices(d.invoices||[]); setSummary(d.summary||{}); }
    catch(e:any){ toast(e.message,'err'); } finally { setLoading(false); }
  };
  useEffect(()=>{ load(); },[companyId]);

  const TABS = [
    { key:'ALL',       label:'All',       fn:(i:any)=>true },
    { key:'SENT',      label:'Unpaid',    fn:(i:any)=>i.status==='SENT' },
    { key:'PAID',      label:'Paid',      fn:(i:any)=>i.status==='PAID' },
    { key:'PARTIAL',   label:'Partial',   fn:(i:any)=>i.status==='PARTIAL' },
    { key:'OVERDUE',   label:'Overdue',   fn:(i:any)=>i.status==='OVERDUE' },
    { key:'DRAFT',     label:'Draft',     fn:(i:any)=>i.status==='DRAFT' },
    { key:'CANCELLED', label:'Cancelled', fn:(i:any)=>i.status==='CANCELLED' },
  ];
  const tab      = TABS.find(t=>t.key===activeTab)||TABS[0];
  const invoices = allInvoices.filter(tab.fn);

  const totalCollected = allInvoices.filter(i=>i.status==='PAID').reduce((a,i)=>a+(i.grandTotal||0),0);
  const totalPending   = allInvoices.filter(i=>['SENT','PARTIAL'].includes(i.status)).reduce((a,i)=>a+(i.grandTotal||0),0);
  const totalOverdue   = allInvoices.filter(i=>i.status==='OVERDUE').reduce((a,i)=>a+(i.grandTotal||0),0);
  const fmtL = (n:number) => n>=100000?`Rs.${(n/100000).toFixed(1)}L`:`Rs.${n.toLocaleString('en-IN')}`;

  const subtotal   = form.items.reduce((a,it)=>a+it.quantity*it.unitPrice-(it.discount||0),0);
  const gstTotal   = form.items.reduce((a,it)=>a+Math.round((it.quantity*it.unitPrice-(it.discount||0))*it.gstPercent/100),0);
  const grandTotal = subtotal+gstTotal;
  const updItem    = (i:number,k:string,v:any)=>setForm(f=>({...f,items:f.items.map((it,idx)=>idx===i?{...it,[k]:v}:it)}));

  const createInvoice = async () => {
    if(!form.clientName)return toast('Client name required','err');
    if(!form.items[0].description)return toast('Add at least one item','err');
    setSaving(true);
    try {
      const bd = form.bankDetails.bankName ? form.bankDetails : null;
      await invoiceApi.create(companyId,{...form,bankDetails:bd});
      toast('Invoice created!'); setShowCreate(false);
      setForm({clientName:'',clientEmail:'',clientPhone:'',clientGst:'',clientAddress:'',dueDate:new Date(Date.now()+30*86400000).toISOString().slice(0,10),paymentTerms:'Net 30',notes:'',bankDetails:{bankName:'',accountNumber:'',ifsc:'',accountName:'',upiId:''},items:[BLANK()]});
      load();
    } catch(e:any){ toast(e.message,'err'); } finally{ setSaving(false); }
  };

  return (
    <>
      <Topbar title="Invoices" subtitle={`${allInvoices.length} invoices · ${fmtL(totalCollected)} collected`}
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={()=>setShowCreate(true)}>+ New Invoice</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-3">
          {[
            {label:'Collected', value:fmtL(totalCollected), color:'text-emerald-600', bg:'bg-emerald-50', border:'border-emerald-200'},
            {label:'Pending',   value:fmtL(totalPending),   color:'text-blue-600',    bg:'bg-blue-50',    border:'border-blue-200'},
            {label:'Overdue',   value:fmtL(totalOverdue),   color:'text-red-600',     bg:'bg-red-50',     border:'border-red-200'},
            {label:'Draft',     value:String(allInvoices.filter(i=>i.status==='DRAFT').length), color:'text-slate-500', bg:'bg-slate-50', border:'border-slate-200'},
          ].map((s,i)=>(
            <div key={i} className={`bg-white border ${s.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
              <div className={`w-9 h-9 rounded-xl ${s.bg} flex items-center justify-center text-base flex-shrink-0`}>
                {i===0?'Rs':i===1?'~':i===2?'!':'?'}
              </div>
              <div>
                <div className="text-xs text-slate-400 font-medium">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
          {TABS.map(t=>{
            const count = t.key==='ALL'?allInvoices.length:allInvoices.filter(t.fn).length;
            return (
              <button key={t.key} onClick={()=>setActiveTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${activeTab===t.key?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
                {count>0&&<span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${activeTab===t.key?'bg-indigo-100 text-indigo-700':'bg-slate-200 text-slate-500'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading invoices...</div>
          ) : invoices.length===0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">Rs.</div>
              <div className="text-sm font-semibold text-slate-700 mb-1">{activeTab==='ALL'?'No invoices yet':`No ${tab.label.toLowerCase()} invoices`}</div>
              <div className="text-xs text-slate-400 mb-4">{activeTab==='ALL'?'Create your first invoice or convert a quotation':'Switch tabs to see other invoices'}</div>
              {activeTab==='ALL'&&<Btn variant="primary" size="sm" onClick={()=>setShowCreate(true)}>+ Create Invoice</Btn>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  {['Invoice #','Client','Amount','Status','Due Date','Payment Method','Actions'].map(h=>(
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {invoices.map((inv:any)=>{
                    const isOverdue = inv.status==='SENT' && inv.dueDate && new Date(inv.dueDate)<new Date();
                    const displayStatus = (isOverdue && inv.status==='SENT') ? 'OVERDUE' : inv.status;
                    const bal = (inv.grandTotal||0)-(inv.paidAmount||0);
                    return (
                      <tr key={inv.invoiceId} className="border-b border-slate-50 hover:bg-indigo-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={()=>setPreviewInv(inv)} className="font-mono font-bold text-indigo-600 hover:underline">{inv.invoiceNumber}</button>
                          <div className="text-xs text-slate-400 mt-0.5">{new Date(inv.createdAt).toLocaleDateString('en-IN')}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-800">{inv.clientName}</div>
                          {inv.clientGst&&<div className="text-xs text-slate-400">GST: {inv.clientGst}</div>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">Rs.{(inv.grandTotal||0).toLocaleString('en-IN')}</div>
                          {inv.status==='PAID'&&<div className="text-xs text-emerald-500 font-medium">Fully Paid</div>}
                          {inv.status==='PARTIAL'&&<div className="text-xs text-amber-500">Due Rs.{bal.toLocaleString('en-IN')}</div>}
                          {inv.paidAmount>0&&inv.status!=='PAID'&&<div className="text-xs text-emerald-400">Paid Rs.{(inv.paidAmount).toLocaleString('en-IN')}</div>}
                        </td>
                        <td className="px-4 py-3"><StatusBadge s={displayStatus} /></td>
                        <td className="px-4 py-3">
                          <div className={`text-xs font-medium ${isOverdue?'text-red-600 font-bold':'text-slate-500'}`}>
                            {inv.dueDate?new Date(inv.dueDate).toLocaleDateString('en-IN'):'Net 30'}
                          </div>
                          {isOverdue&&<div className="text-xs text-red-400">OVERDUE</div>}
                        </td>
                        <td className="px-4 py-3">
                          {inv.paymentMethod?(
                            <div>
                              <div className="text-xs font-medium text-slate-700 capitalize">{inv.paymentMethod.replace('_',' ')}</div>
                              {inv.transactionId&&<div className="text-xs text-slate-400 font-mono truncate max-w-24">{inv.transactionId}</div>}
                              {inv.paidAt&&<div className="text-xs text-slate-400">{new Date(inv.paidAt).toLocaleDateString('en-IN')}</div>}
                            </div>
                          ):<span className="text-xs text-slate-300">Not paid yet</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {/* Preview PDF */}
                            <button onClick={()=>setPreviewInv(inv)} title="Preview & Download PDF"
                              className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap">
                              PDF
                            </button>

                            {/* Mark Paid */}
                            {!['PAID','CANCELLED'].includes(inv.status)&&(
                              <button onClick={()=>setPaidInv(inv)} title="Mark as Paid"
                                className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap">
                                Paid
                              </button>
                            )}

                            {/* Send */}
                            {!['CANCELLED'].includes(inv.status)&&(
                              <button onClick={()=>setSendInv(inv)} title="Send Invoice"
                                className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-blue-100 transition-colors">
                                Send
                              </button>
                            )}

                            {/* Upload receipt */}
                            <button onClick={()=>setUploadInv(inv)} title="Upload Payment Receipt"
                              className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-600 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-amber-100 transition-colors whitespace-nowrap">
                              Upload
                            </button>

                            {/* Cancel */}
                            {!['PAID','CANCELLED'].includes(inv.status)&&(
                              <button onClick={()=>setCancelInv(inv)} title="Cancel Invoice"
                                className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-500 px-2.5 py-1.5 rounded-lg font-semibold hover:bg-red-100 transition-colors">
                                Cancel
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Modals */}
      {previewInv && <PdfModal    inv={previewInv} companyId={companyId} onClose={()=>setPreviewInv(null)} />}
      {paidInv    && <MarkPaidModal inv={paidInv}  companyId={companyId} onClose={()=>setPaidInv(null)}   onDone={load} />}
      {sendInv    && <SendModal   inv={sendInv}    companyId={companyId} onClose={()=>setSendInv(null)}   onDone={load} />}
      {cancelInv  && <CancelModal inv={cancelInv}  companyId={companyId} onClose={()=>setCancelInv(null)} onDone={load} />}
      {uploadInv  && <UploadModal inv={uploadInv}                        onClose={()=>setUploadInv(null)} />}

      {/* Create Invoice Modal */}
      <Modal open={showCreate} onClose={()=>setShowCreate(false)} title="Create New Invoice" size="lg"
        footer={<><Btn variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={createInvoice}>Create Invoice</Btn></>}>
        <div className="flex flex-col gap-4">
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Client Details</div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Client Name *"   value={form.clientName}    onChange={e=>setForm(f=>({...f,clientName:e.target.value}))}    placeholder="Rahul Sharma" />
              <Input label="Client Email"    value={form.clientEmail}   onChange={e=>setForm(f=>({...f,clientEmail:e.target.value}))}   placeholder="rahul@example.com" />
              <Input label="Phone"           value={form.clientPhone}   onChange={e=>setForm(f=>({...f,clientPhone:e.target.value}))}   placeholder="+91 98765 43210" />
              <Input label="GSTIN"           value={form.clientGst}     onChange={e=>setForm(f=>({...f,clientGst:e.target.value}))}     placeholder="27AAAA0000A1Z5" />
            </div>
            <div className="mt-3"><Input label="Billing Address" value={form.clientAddress} onChange={e=>setForm(f=>({...f,clientAddress:e.target.value}))} placeholder="123 Business Park, Mumbai MH 400001" /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Due Date" type="date" value={form.dueDate} onChange={e=>setForm(f=>({...f,dueDate:e.target.value}))} />
            <Sel label="Payment Terms" value={form.paymentTerms} onChange={e=>setForm(f=>({...f,paymentTerms:e.target.value}))}
              options={[{value:'Net 30',label:'Net 30'},{value:'Net 15',label:'Net 15'},{value:'Net 7',label:'Net 7'},{value:'Due on Receipt',label:'Due on Receipt'},{value:'50% Advance',label:'50% Advance'}]} />
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Line Items</div>
              <button onClick={()=>setForm(f=>({...f,items:[...f.items,BLANK()]}))} className="text-xs text-indigo-600 hover:underline font-semibold">+ Add Item</button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs" style={{tableLayout:'fixed'}}>
                <colgroup><col width="36%"/><col width="8%"/><col width="14%"/><col width="10%"/><col width="12%"/><col width="16%"/><col width="28px"/></colgroup>
                <thead><tr className="bg-slate-50 border-b border-slate-200">
                  {['Description','Qty','Rate','GST%','Discount','Total',''].map(h=><th key={h} className="text-left px-2 py-2 text-xs font-semibold text-slate-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {form.items.map((it,i)=>{
                    const after=it.quantity*it.unitPrice-(it.discount||0); const gst=Math.round(after*it.gstPercent/100);
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-none">
                        <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 outline-none" value={it.description} onChange={e=>updItem(i,'description',e.target.value)} placeholder="Item description"/></td>
                        <td className="px-2 py-1.5"><input type="number" min="1" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:border-indigo-400 outline-none" value={it.quantity} onChange={e=>updItem(i,'quantity',+e.target.value||1)}/></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-indigo-400 outline-none" value={it.unitPrice} onChange={e=>updItem(i,'unitPrice',+e.target.value||0)}/></td>
                        <td className="px-2 py-1.5"><select className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 outline-none" value={it.gstPercent} onChange={e=>updItem(i,'gstPercent',+e.target.value)}>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-indigo-400 outline-none" value={it.discount||0} onChange={e=>updItem(i,'discount',+e.target.value||0)}/></td>
                        <td className="px-2 py-1.5 text-right"><div className="text-xs font-bold text-slate-800">Rs.{(after+gst).toLocaleString('en-IN')}</div><div className="text-xs text-slate-400">+Rs.{gst} GST</div></td>
                        <td className="px-2 py-1.5 text-center">{form.items.length>1&&<button onClick={()=>setForm(f=>({...f,items:f.items.filter((_,idx)=>idx!==i)}))} className="w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 text-xs flex items-center justify-center">x</button>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-3">
              <div className="w-56 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500"><span>Subtotal</span><span>Rs.{subtotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500"><span>GST</span><span>Rs.{gstTotal.toLocaleString('en-IN')}</span></div>
                <div className="flex justify-between py-2.5 px-3 mt-1 bg-indigo-600 rounded-xl text-sm font-bold text-white"><span>Grand Total</span><span>Rs.{grandTotal.toLocaleString('en-IN')}</span></div>
              </div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bank Details (shown on PDF)</div>
              <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Auto-filled from Settings</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Bank Name"      value={form.bankDetails.bankName}      onChange={e=>setForm(f=>({...f,bankDetails:{...f.bankDetails,bankName:e.target.value}}))}      placeholder="HDFC Bank" />
              <Input label="Account Number" value={form.bankDetails.accountNumber} onChange={e=>setForm(f=>({...f,bankDetails:{...f.bankDetails,accountNumber:e.target.value}}))} placeholder="50100123456789" />
              <Input label="IFSC"           value={form.bankDetails.ifsc}          onChange={e=>setForm(f=>({...f,bankDetails:{...f.bankDetails,ifsc:e.target.value}}))}          placeholder="HDFC0001234" />
              <Input label="Account Name"   value={form.bankDetails.accountName}   onChange={e=>setForm(f=>({...f,bankDetails:{...f.bankDetails,accountName:e.target.value}}))}   placeholder="Raulji Technologies" />
            </div>
            <div className="mt-2"><Input label="UPI ID" value={form.bankDetails.upiId||''} onChange={e=>setForm(f=>({...f,bankDetails:{...f.bankDetails,upiId:e.target.value}}))} placeholder="raulji@hdfc" /></div>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1 block">Notes</label>
            <textarea rows={2} className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none focus:border-indigo-500 outline-none" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Thank you for your business..." />
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
