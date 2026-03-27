'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { companyApi, invoiceApi, clientApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast } from '@/components/ui';

const API      = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
const tok      = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '');
const inr      = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const BLANK    = () => ({ description: '', hsnCode: '', quantity: 1, unitPrice: 0, gstPercent: 18, discount: 0 });
const dateStr  = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Status badge ────────────────────────────────────────────
const S: Record<string, { bg: string; text: string; dot: string }> = {
  DRAFT:     { bg: 'bg-slate-100',   text: 'text-slate-500',   dot: 'bg-slate-400'   },
  SENT:      { bg: 'bg-blue-50',     text: 'text-blue-700',    dot: 'bg-blue-500'    },
  PAID:      { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  PARTIAL:   { bg: 'bg-amber-50',    text: 'text-amber-700',   dot: 'bg-amber-500'   },
  OVERDUE:   { bg: 'bg-red-50',      text: 'text-red-600',     dot: 'bg-red-500'     },
  CANCELLED: { bg: 'bg-slate-100',   text: 'text-slate-400',   dot: 'bg-slate-300'   },
};
function Badge({ s }: { s: string }) {
  const c = S[s] || S.DRAFT;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

// ─── PDF Preview + Download modal ────────────────────────────
function PdfModal({ inv, cid, onClose }: { inv: any; cid: string; onClose: () => void }) {
  const [loading,   setLoading]   = useState(false);
  const [iframeSrc, setIframeSrc] = useState('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const blobUrlRef = useRef('');
  const viewUrl = `${API}/companies/${cid}/invoices/${inv.invoiceId}/view`;

  // Fetch invoice HTML with auth token → blob URL for iframe (bypasses auth on iframe)
  useEffect(() => {
    setIframeLoading(true);
    fetch(viewUrl, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.text())
      .then(html => {
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
        const blob = new Blob([html], { type: 'text/html' });
        blobUrlRef.current = URL.createObjectURL(blob);
        setIframeSrc(blobUrlRef.current);
      })
      .catch(() => setIframeSrc(''))
      .finally(() => setIframeLoading(false));
    return () => { if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current); };
  }, [viewUrl]);

  const download = async () => {
    setLoading(true);
    try {
      const r    = await fetch(`${API}/companies/${cid}/invoices/${inv.invoiceId}/pdf`, { headers: { Authorization: `Bearer ${tok()}` } });
      const blob = await r.blob();
      if (blob.type === 'application/pdf') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${inv.invoiceNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        window.open(viewUrl, '_blank');
      }
    } catch { window.open(viewUrl, '_blank'); }
    finally { setLoading(false); }
  };

  const print = () => {
    if (iframeSrc) {
      const w = window.open('', '_blank');
      if (w) { w.document.write(`<iframe src="${iframeSrc}" style="width:100%;height:100%;border:none"></iframe>`); w.print(); }
    } else { window.open(viewUrl, '_blank'); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden" style={{ maxWidth: 860, height: '93vh' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-sm flex-shrink-0">₹</div>
            <div>
              <div className="font-bold text-slate-900 text-sm">{inv.invoiceNumber}</div>
              <div className="text-xs text-slate-400">{inv.clientName} · {inr(inv.grandTotal)}</div>
            </div>
            <Badge s={inv.status} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={print} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">🖨 Print</button>
            <Btn variant="primary" size="sm" loading={loading} onClick={download}>⬇ Download PDF</Btn>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors text-sm font-bold">✕</button>
          </div>
        </div>
        {/* Preview */}
        <div className="flex-1 overflow-hidden bg-slate-200 relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <svg className="animate-spin w-6 h-6 text-blue-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
            </div>
          )}
          {iframeSrc
            ? <iframe src={iframeSrc} className="w-full h-full border-none" title="Invoice Preview" onLoad={() => setIframeLoading(false)} />
            : !iframeLoading && <div className="flex items-center justify-center h-full text-slate-400 text-sm">Unable to load preview</div>
          }
        </div>
      </div>
    </div>
  );
}

// ─── Mark Paid modal ─────────────────────────────────────────
function PaidModal({ inv, cid, onClose, onDone }: any) {
  const [f, setF] = useState({ paidAmount: String(inv.grandTotal || ''), paymentMethod: 'bank_transfer', transactionId: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  const save = async () => {
    if (!f.paidAmount || +f.paidAmount <= 0) return toast('Enter valid amount', 'err');
    setSaving(true);
    try {
      await invoiceApi.markPaid(cid, inv.invoiceId, { ...f, paidAmount: +f.paidAmount });
      toast(+f.paidAmount >= inv.grandTotal ? 'Invoice marked as Paid!' : 'Invoice marked as Partial!');
      setTimeout(() => { onDone(); onClose(); }, 700);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const bal    = Math.max(0, inv.grandTotal - +f.paidAmount);
  const isFull = +f.paidAmount >= inv.grandTotal;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-lg">✓</div>
            <div>
              <div className="font-bold text-slate-900">Mark as Paid</div>
              <div className="text-xs text-slate-400">{inv.invoiceNumber} · Total {inr(inv.grandTotal)}</div>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Amount Received *</label>
              <input type="number" value={f.paidAmount} onChange={e => setF(p => ({ ...p, paidAmount: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="0.00" />
              {f.paidAmount && (
                <div className={`text-xs mt-1.5 flex items-center gap-1 ${isFull ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <span>{isFull ? '✓' : '⚠'}</span>
                  {isFull ? 'Full payment — will be marked PAID' : `Balance ₹${bal.toLocaleString('en-IN')} remaining — will be marked PARTIAL`}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Payment Method</label>
              <select value={f.paymentMethod} onChange={e => setF(p => ({ ...p, paymentMethod: e.target.value }))}
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
            <Input label="Transaction / Reference ID" value={f.transactionId} onChange={e => setF(p => ({ ...p, transactionId: e.target.value }))} placeholder="UTR1234567890 / Cheque No." />
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes (optional)</label>
              <textarea rows={2} value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none focus:border-indigo-500 outline-none" placeholder="Any payment notes..." />
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

// ─── Edit Invoice modal ───────────────────────────────────────
function EditModal({ inv, cid, onClose, onDone }: any) {
  const [f, setF] = useState({
    clientName:   inv.clientName   || '',
    clientEmail:  inv.clientEmail  || '',
    clientPhone:  inv.clientPhone  || '',
    clientGst:    inv.clientGst    || '',
    clientAddress:inv.clientAddress|| '',
    dueDate:      inv.dueDate      ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
    paymentTerms: inv.paymentTerms || 'Net 30',
    notes:        inv.notes        || '',
    bankDetails:  inv.bankDetails  || { bankName: '', accountNumber: '', ifsc: '', accountName: '', upiId: '' },
    items:        inv.items        || [BLANK()],
  });
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  const updItem = (i: number, k: string, v: any) => setF(p => ({ ...p, items: p.items.map((it: any, idx: number) => idx === i ? { ...it, [k]: v } : it) }));
  const subtotal   = f.items.reduce((a: number, it: any) => a + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const gstTotal   = f.items.reduce((a: number, it: any) => a + Math.round((it.quantity * it.unitPrice - (it.discount || 0)) * it.gstPercent / 100), 0);
  const grandTotal = subtotal + gstTotal;

  const save = async () => {
    if (!f.clientName) return toast('Client name required', 'err');
    setSaving(true);
    try {
      await invoiceApi.update(cid, inv.invoiceId, f);
      toast('Invoice updated!');
      setTimeout(() => { onDone(); onClose(); }, 700);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[95vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="font-bold text-slate-900">Edit Invoice — {inv.invoiceNumber}</div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            {/* Client */}
            <div>
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Client Details</div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Client Name *"    value={f.clientName}    onChange={e => setF(p => ({ ...p, clientName:    e.target.value }))} placeholder="Rahul Sharma" />
                <Input label="Client Email"     value={f.clientEmail}   onChange={e => setF(p => ({ ...p, clientEmail:   e.target.value }))} placeholder="rahul@example.com" />
                <Input label="Client Phone"     value={f.clientPhone}   onChange={e => setF(p => ({ ...p, clientPhone:   e.target.value }))} placeholder="+91 98765 43210" />
                <Input label="Client GSTIN"     value={f.clientGst}     onChange={e => setF(p => ({ ...p, clientGst:     e.target.value }))} placeholder="27AAAA0000A1Z5" />
              </div>
              <div className="mt-3">
                <Input label="Billing Address"  value={f.clientAddress} onChange={e => setF(p => ({ ...p, clientAddress: e.target.value }))} placeholder="123 Park, Mumbai MH 400001" />
              </div>
            </div>
            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <Input label="Due Date" type="date" value={f.dueDate} onChange={e => setF(p => ({ ...p, dueDate: e.target.value }))} />
              <Sel label="Payment Terms" value={f.paymentTerms} onChange={e => setF(p => ({ ...p, paymentTerms: e.target.value }))}
                options={[{value:'Net 30',label:'Net 30'},{value:'Net 15',label:'Net 15'},{value:'Net 7',label:'Net 7'},{value:'Due on Receipt',label:'Due on Receipt'}]} />
            </div>
            {/* Items */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items</div>
                <button onClick={() => setF(p => ({ ...p, items: [...p.items, BLANK()] }))} className="text-xs text-indigo-600 hover:underline font-semibold">+ Add Item</button>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                  <colgroup><col width="28%"/><col width="10%"/><col width="7%"/><col width="12%"/><col width="9%"/><col width="10%"/><col width="14%"/><col width="28px"/></colgroup>
                  <thead><tr className="bg-slate-50 border-b border-slate-100">
                    {['Description','HSN/SAC','Qty','Rate','GST%','Disc.','Total',''].map(h => <th key={h} className="text-left px-2 py-2 text-xs font-semibold text-slate-400">{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {f.items.map((it: any, i: number) => {
                      const after = it.quantity * it.unitPrice - (it.discount || 0);
                      const gst   = Math.round(after * it.gstPercent / 100);
                      return (
                        <tr key={i} className="border-b border-slate-50 last:border-none">
                          <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none" value={it.description} onChange={e => updItem(i,'description',e.target.value)} placeholder="Item"/></td>
                          <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 font-mono focus:border-blue-400 outline-none" value={it.hsnCode||''} onChange={e => updItem(i,'hsnCode',e.target.value)} placeholder="998311"/></td>
                          <td className="px-2 py-1.5"><input type="number" min="1" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:border-blue-400 outline-none" value={it.quantity} onChange={e => updItem(i,'quantity',+e.target.value||1)}/></td>
                          <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.unitPrice} onChange={e => updItem(i,'unitPrice',+e.target.value||0)}/></td>
                          <td className="px-2 py-1.5"><select className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 outline-none" value={it.gstPercent} onChange={e => updItem(i,'gstPercent',+e.target.value)}>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                          <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.discount||0} onChange={e => updItem(i,'discount',+e.target.value||0)}/></td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="text-xs font-bold text-slate-800">{inr(after+gst)}</div>
                            <div className="text-xs text-slate-400">+{inr(gst)} GST</div>
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            {f.items.length > 1 && <button onClick={() => setF(p => ({ ...p, items: p.items.filter((_: any, idx: number) => idx !== i) }))} className="w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 text-xs flex items-center justify-center">×</button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-end mt-2">
                <div className="w-52 text-xs">
                  <div className="flex justify-between py-1 text-slate-500 border-b border-slate-100"><span>Subtotal</span><span>{inr(subtotal)}</span></div>
                  <div className="flex justify-between py-1 text-slate-500 border-b border-slate-100"><span>GST</span><span>{inr(gstTotal)}</span></div>
                  <div className="flex justify-between py-2 px-3 mt-1 rounded-xl text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
                </div>
              </div>
            </div>
            {/* Notes */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
              <textarea rows={2} value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none focus:border-indigo-500 outline-none" placeholder="Payment notes..." />
            </div>
          </div>
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end flex-shrink-0">
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={save}>Save Changes</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ─── Cancel confirm ───────────────────────────────────────────
function CancelModal({ inv, cid, onClose, onDone }: any) {
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const go = async () => {
    setSaving(true);
    try { await invoiceApi.update(cid, inv.invoiceId, { status: 'CANCELLED' }); toast('Cancelled.'); setTimeout(() => { onDone(); onClose(); }, 600); }
    catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-3xl mx-auto mb-3">!</div>
            <div className="font-bold text-slate-900 mb-1">Cancel Invoice?</div>
            <div className="text-xs text-slate-500 leading-relaxed"><strong>{inv.invoiceNumber}</strong> · {inv.clientName}<br/>{inr(inv.grandTotal)} will be cancelled. This cannot be undone.</div>
          </div>
          <div className="px-6 pb-6 flex gap-2">
            <Btn variant="secondary" onClick={onClose} className="flex-1">Keep</Btn>
            <Btn variant="danger"    loading={saving} onClick={go} className="flex-1">Yes, Cancel</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ─── Create invoice form ──────────────────────────────────────
function emptyForm() {
  return {
    clientName: '', clientEmail: '', clientPhone: '', clientGst: '', clientAddress: '',
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    paymentTerms: 'Net 30', notes: '',
    bankDetails: { bankName: '', accountNumber: '', ifsc: '', accountName: '', upiId: '' },
    items: [BLANK()],
  };
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function InvoicesPage() {
  const [companies,   setCompanies]   = useState<any[]>([]);
  const [cid,         setCid]         = useState('');
  const [coProfile,   setCoProfile]   = useState<any>({});
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [summary,     setSummary]     = useState<any>({});
  const [loading,     setLoading]     = useState(false);
  const [tab,         setTab]         = useState('ALL');
  const [previewInv,  setPreviewInv]  = useState<any>(null);
  const [paidInv,     setPaidInv]     = useState<any>(null);
  const [editInv,     setEditInv]     = useState<any>(null);
  const [cancelInv,   setCancelInv]   = useState<any>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [form,        setForm]        = useState(emptyForm());
  const [clients,     setClients]     = useState<any[]>([]);
  const [clientSearch,setClientSearch]= useState('');
  const [showClientDrop,setShowClientDrop]= useState(false);
  const { toast, ToastContainer }     = useToast();

  // Load companies
  const loadCos = useCallback(async () => {
    try {
      const d   = await companyApi.list({ limit: '20' });
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos[0]) setCid(cos[0].companyId);
    } catch {}
  }, []);
  useEffect(() => { loadCos(); }, []);

  // When company changes — load profile + invoices + clients
  useEffect(() => {
    if (!cid) return;
    companyApi.getSettings(cid).then((d: any) => {
      setCoProfile(d);
      const bd = d.bankDetails || {};
      setForm(f => ({
        ...f,
        paymentTerms: (bd.paymentTerms || f.paymentTerms),
        bankDetails: {
          bankName:      bd.bankName      || '',
          accountNumber: bd.accountNumber || '',
          ifsc:          bd.ifsc          || '',
          accountName:   bd.accountName   || '',
          upiId:         bd.upiId         || '',
        }
      }));
    }).catch(() => {});
    // Load clients for auto-fill
    clientApi.list(cid, { limit: '200' }).then((d: any) => setClients(d.clients || [])).catch(() => {});
    loadInvoices();
  }, [cid]);

  const loadInvoices = async () => {
    if (!cid) return;
    setLoading(true);
    try {
      const d = await invoiceApi.list(cid, { limit: '100' });
      setAllInvoices(d.invoices || []);
      setSummary(d.summary || {});
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  };

  // Tabs
  const TABS = [
    { key: 'ALL',       label: 'All',       fn: () => true },
    { key: 'SENT',      label: 'Unpaid',    fn: (i: any) => i.status === 'SENT' },
    { key: 'PAID',      label: 'Paid',      fn: (i: any) => i.status === 'PAID' },
    { key: 'PARTIAL',   label: 'Partial',   fn: (i: any) => i.status === 'PARTIAL' },
    { key: 'OVERDUE',   label: 'Overdue',   fn: (i: any) => i.status === 'OVERDUE' || (i.status === 'SENT' && new Date(i.dueDate) < new Date()) },
    { key: 'DRAFT',     label: 'Draft',     fn: (i: any) => i.status === 'DRAFT' },
    { key: 'CANCELLED', label: 'Cancelled', fn: (i: any) => i.status === 'CANCELLED' },
  ];
  const activeTab = TABS.find(t => t.key === tab) || TABS[0];
  const invoices  = allInvoices.filter(activeTab.fn);

  // Summary
  const collected = allInvoices.filter(i => i.status === 'PAID').reduce((a, i) => a + (i.grandTotal || 0), 0);
  const pending   = allInvoices.filter(i => ['SENT','PARTIAL'].includes(i.status)).reduce((a, i) => a + (i.grandTotal || 0), 0);
  const overdue   = allInvoices.filter(i => i.status === 'SENT' && new Date(i.dueDate) < new Date()).reduce((a, i) => a + (i.grandTotal || 0), 0);
  const fmtL      = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : inr(n);

  // Item helpers
  const updItem = (i: number, k: string, v: any) => setForm(f => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, [k]: v } : it) }));
  const subtotal   = form.items.reduce((a, it: any) => a + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const gstTotal   = form.items.reduce((a, it: any) => a + Math.round((it.quantity * it.unitPrice - (it.discount || 0)) * it.gstPercent / 100), 0);
  const grandTotal = subtotal + gstTotal;

  const openCreate = () => {
    setForm(emptyForm());
    setClientSearch('');
    setShowClientDrop(false);
    const bd = coProfile?.bankDetails || {};
    setForm(f => ({
      ...f,
      paymentTerms: bd.paymentTerms || 'Net 30',
      bankDetails: { bankName: bd.bankName||'', accountNumber: bd.accountNumber||'', ifsc: bd.ifsc||'', accountName: bd.accountName||'', upiId: bd.upiId||'' }
    }));
    setShowCreate(true);
  };

  // Select client → auto-fill invoice client fields
  const selectLead = (c: any) => {
    const addr = [c.address, c.city, c.state, c.pincode].filter(Boolean).join(', ');
    setForm(f => ({
      ...f,
      clientName:    c.name    || '',
      clientEmail:   c.email   || '',
      clientPhone:   c.phone   || '',
      clientGst:     c.gst     || '',
      clientAddress: addr || c.address || '',
    }));
    setClientSearch(c.name || '');
    setShowClientDrop(false);
  };

  const create = async () => {
    if (!form.clientName)               return toast('Client name required', 'err');
    if (!form.items[0]?.description)    return toast('Add at least one item', 'err');
    setSaving(true);
    try {
      const bd = form.bankDetails.bankName ? form.bankDetails : null;
      await invoiceApi.create(cid, { ...form, bankDetails: bd });
      toast('Invoice created!');
      setShowCreate(false);
      loadInvoices();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Topbar title="Invoices" subtitle={`${allInvoices.length} invoices · ${fmtL(collected)} collected`}
        actions={<>
          <select value={cid} onChange={e => setCid(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 bg-white">
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={openCreate}>+ New Invoice</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Collected', value: fmtL(collected), color: 'text-emerald-600', border: 'border-emerald-200', icon: '₹' },
            { label: 'Pending',   value: fmtL(pending),   color: 'text-blue-600',    border: 'border-blue-200',    icon: '⏳' },
            { label: 'Overdue',   value: fmtL(overdue),   color: 'text-red-600',     border: 'border-red-200',     icon: '!' },
            { label: 'Total',     value: String(allInvoices.length), color: 'text-slate-700', border: 'border-slate-200', icon: '#' },
          ].map((s, i) => (
            <div key={i} className={`bg-white border ${s.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
              <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">{s.icon}</div>
              <div>
                <div className="text-xs text-slate-400 font-medium">{s.label}</div>
                <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit flex-wrap">
          {TABS.map(t => {
            const count = t.key === 'ALL' ? allInvoices.length : allInvoices.filter(t.fn).length;
            return (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
                {count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="py-14 text-center flex flex-col items-center gap-2">
              <svg className="animate-spin w-6 h-6 text-indigo-600" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
              <span className="text-xs text-slate-400">Loading...</span>
            </div>
          ) : invoices.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">🧾</div>
              <div className="text-sm font-semibold text-slate-700 mb-1">
                {tab === 'ALL' ? 'No invoices yet' : `No ${activeTab.label.toLowerCase()} invoices`}
              </div>
              <div className="text-xs text-slate-400 mb-4">
                {tab === 'ALL' ? 'Create your first invoice or convert a quotation' : 'Switch tabs to see other invoices'}
              </div>
              {tab === 'ALL' && <Btn variant="primary" size="sm" onClick={openCreate}>+ Create Invoice</Btn>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Invoice #', 'Bill To', 'Amount', 'Status', 'Due Date', 'Payment', 'Actions'].map(h => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv: any) => {
                    const isOverdue = inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < new Date();
                    const displayS  = isOverdue ? 'OVERDUE' : inv.status;
                    const balance   = (inv.grandTotal || 0) - (inv.paidAmount || 0);
                    return (
                      <tr key={inv.invoiceId} className="border-b border-slate-50 hover:bg-indigo-50/20 transition-colors group">
                        {/* Invoice # */}
                        <td className="px-4 py-3">
                          <button onClick={() => setPreviewInv(inv)} className="font-mono font-bold text-indigo-600 hover:underline">{inv.invoiceNumber}</button>
                          <div className="text-xs text-slate-400 mt-0.5">{dateStr(inv.createdAt)}</div>
                        </td>
                        {/* Bill To */}
                        <td className="px-4 py-3" style={{ maxWidth: 180 }}>
                          <div className="font-semibold text-slate-800 truncate">{inv.clientName}</div>
                          {inv.clientGst   && <div className="text-xs text-slate-400 font-mono">GST: {inv.clientGst}</div>}
                          {inv.clientEmail && <div className="text-xs text-indigo-400 truncate">{inv.clientEmail}</div>}
                          {inv.clientPhone && <div className="text-xs text-slate-400">{inv.clientPhone}</div>}
                        </td>
                        {/* Amount */}
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-900">{inr(inv.grandTotal)}</div>
                          {inv.status === 'PAID' && <div className="text-xs text-emerald-500 font-medium">✓ Fully Paid</div>}
                          {inv.status === 'PARTIAL' && balance > 0 && <div className="text-xs text-amber-500">Due {inr(balance)}</div>}
                          {inv.paidAmount > 0 && !['PAID'].includes(inv.status) && <div className="text-xs text-slate-400">Paid {inr(inv.paidAmount)}</div>}
                        </td>
                        {/* Status */}
                        <td className="px-4 py-3"><Badge s={displayS} /></td>
                        {/* Due Date */}
                        <td className="px-4 py-3">
                          <div className={`text-xs font-medium ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{dateStr(inv.dueDate)}</div>
                          {isOverdue && <div className="text-xs text-red-400">Overdue!</div>}
                        </td>
                        {/* Payment */}
                        <td className="px-4 py-3">
                          {inv.paymentMethod ? (
                            <div>
                              <div className="text-xs font-medium text-slate-700 capitalize">{inv.paymentMethod.replace(/_/g, ' ')}</div>
                              {inv.transactionId && <div className="text-xs text-slate-400 font-mono truncate max-w-28">{inv.transactionId}</div>}
                              {inv.paidAt        && <div className="text-xs text-slate-400">{dateStr(inv.paidAt)}</div>}
                            </div>
                          ) : <span className="text-xs text-slate-300">—</span>}
                        </td>
                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <button onClick={() => setPreviewInv(inv)} title="Preview & Download"
                              className="px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap">PDF</button>

                            {!['PAID','CANCELLED'].includes(inv.status) && (
                              <button onClick={() => setPaidInv(inv)} title="Mark Paid"
                                className="px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-600 rounded-lg font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap">Paid</button>
                            )}

                            {inv.status !== 'CANCELLED' && (
                              <button onClick={() => setEditInv(inv)} title="Edit"
                                className="px-2.5 py-1.5 text-xs bg-slate-50 text-slate-600 rounded-lg font-semibold hover:bg-slate-100 transition-colors">Edit</button>
                            )}

                            {!['PAID','CANCELLED'].includes(inv.status) && (
                              <button onClick={() => setCancelInv(inv)} title="Cancel"
                                className="px-2.5 py-1.5 text-xs bg-red-50 text-red-500 rounded-lg font-semibold hover:bg-red-100 transition-colors">Cancel</button>
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

      {/* ── Modals ── */}
      {previewInv && <PdfModal    inv={previewInv} cid={cid} onClose={() => setPreviewInv(null)} />}
      {paidInv    && <PaidModal   inv={paidInv}    cid={cid} onClose={() => setPaidInv(null)}   onDone={loadInvoices} />}
      {editInv    && <EditModal   inv={editInv}    cid={cid} onClose={() => setEditInv(null)}   onDone={loadInvoices} />}
      {cancelInv  && <CancelModal inv={cancelInv}  cid={cid} onClose={() => setCancelInv(null)} onDone={loadInvoices} />}

      {/* ── Create Invoice ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Invoice" size="lg"
        footer={<><Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create Invoice</Btn></>}>
        <div className="flex flex-col gap-4">

          {/* Company profile preview (auto-filled) */}
          {coProfile?.name && (
            <div className="flex items-center gap-3 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              {coProfile.logo
                ? <img src={coProfile.logo} alt="" className="h-10 w-10 rounded-lg object-contain flex-shrink-0 bg-white p-1 border border-slate-200" />
                : <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}>{coProfile.name.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}</div>
              }
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-indigo-900">{coProfile.name}</div>
                <div className="text-xs text-indigo-500">{coProfile.gst ? `GSTIN: ${coProfile.gst}` : ''} {coProfile.email || ''}</div>
                {(coProfile.address?.city || coProfile.address?.state) && (
                  <div className="text-xs text-indigo-400">{[coProfile.address?.city, coProfile.address?.state].filter(Boolean).join(', ')}</div>
                )}
              </div>
              <div className="text-xs text-indigo-400 flex-shrink-0">Billing Company ✓</div>
            </div>
          )}

          {/* Client Search / Bill To */}
          <div>
            <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Client / Bill To</div>

            {/* Lead search */}
            <div className="relative mb-3">
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Select Saved Client
                <a href="/dashboard/clients" target="_blank" className="ml-2 text-blue-500 hover:underline font-normal">+ Add New Client</a>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                <input
                  className="w-full pl-8 pr-8 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none transition-all"
                  placeholder="Search clients by name, email, or GST..."
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true); }}
                  onFocus={() => setShowClientDrop(true)}
                  onBlur={() => setTimeout(() => setShowClientDrop(false), 150)}
                />
                {clientSearch && (
                  <button onClick={() => { setClientSearch(''); setShowClientDrop(false); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-sm">✕</button>
                )}
              </div>
              {clients.length === 0 && !clientSearch && (
                <p className="text-xs text-slate-400 mt-1">No saved clients yet. <a href="/dashboard/clients" target="_blank" className="text-blue-500 hover:underline">Add clients here</a>, or fill manually below.</p>
              )}
              {showClientDrop && clients.filter(c => (c.name||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.email||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.gst||'').toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8).length > 0 && (
                <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                  {clients.filter(c => (c.name||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.email||'').toLowerCase().includes(clientSearch.toLowerCase()) || (c.gst||'').toLowerCase().includes(clientSearch.toLowerCase())).slice(0, 8).map((c: any) => (
                    <button key={c.clientId} onMouseDown={() => selectLead(c)}
                      className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors border-b border-slate-50 last:border-none">
                      <div className="font-semibold text-slate-800 text-xs">{c.name}</div>
                      <div className="text-xs text-slate-400 flex gap-3">
                        {c.email && <span>{c.email}</span>}
                        {c.phone && <span>{c.phone}</span>}
                        {c.gst   && <span className="font-mono">GST: {c.gst}</span>}
                        {(c.city || c.state) && <span>{[c.city, c.state].filter(Boolean).join(', ')}</span>}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Client Name *"    value={form.clientName}    onChange={e => setForm(f => ({ ...f, clientName:    e.target.value }))} placeholder="Rahul Sharma / Ariya Corp" />
              <Input label="Client GSTIN"     value={form.clientGst}     onChange={e => setForm(f => ({ ...f, clientGst:     e.target.value }))} placeholder="27AAAA0000A1Z5" />
              <Input label="Client Email"     value={form.clientEmail}   onChange={e => setForm(f => ({ ...f, clientEmail:   e.target.value }))} placeholder="client@example.com" />
              <Input label="Client Phone"     value={form.clientPhone}   onChange={e => setForm(f => ({ ...f, clientPhone:   e.target.value }))} placeholder="+91 98765 43210" />
            </div>
            <div className="mt-3">
              <Input label="Billing Address"  value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="123 Park, Mumbai, Maharashtra 400001" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Due Date" type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            <Sel label="Payment Terms" value={form.paymentTerms} onChange={e => setForm(f => ({ ...f, paymentTerms: e.target.value }))}
              options={[{value:'Net 30',label:'Net 30'},{value:'Net 15',label:'Net 15'},{value:'Net 7',label:'Net 7'},{value:'Due on Receipt',label:'Due on Receipt'},{value:'50% Advance',label:'50% Advance'}]} />
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Line Items</div>
              <button onClick={() => setForm(f => ({ ...f, items: [...f.items, BLANK()] }))} className="text-xs text-indigo-600 hover:underline font-semibold">+ Add Item</button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup><col width="27%"/><col width="10%"/><col width="7%"/><col width="12%"/><col width="9%"/><col width="10%"/><col width="15%"/><col width="28px"/></colgroup>
                <thead><tr className="bg-slate-50 border-b border-slate-100">
                  {['Description','HSN/SAC','Qty','Rate (₹)','GST%','Disc.','Total',''].map(h => <th key={h} className="text-left px-2 py-2 text-xs font-semibold text-slate-400">{h}</th>)}
                </tr></thead>
                <tbody>
                  {form.items.map((it: any, i: number) => {
                    const after = it.quantity * it.unitPrice - (it.discount || 0);
                    const gst   = Math.round(after * it.gstPercent / 100);
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-none">
                        <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none" value={it.description} onChange={e => updItem(i,'description',e.target.value)} placeholder="Item description"/></td>
                        <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 font-mono focus:border-blue-400 outline-none" value={it.hsnCode||''} onChange={e => updItem(i,'hsnCode',e.target.value)} placeholder="998311"/></td>
                        <td className="px-2 py-1.5"><input type="number" min="1" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:border-blue-400 outline-none" value={it.quantity} onChange={e => updItem(i,'quantity',+e.target.value||1)}/></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.unitPrice} onChange={e => updItem(i,'unitPrice',+e.target.value||0)}/></td>
                        <td className="px-2 py-1.5"><select className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 outline-none" value={it.gstPercent} onChange={e => updItem(i,'gstPercent',+e.target.value)}>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.discount||0} onChange={e => updItem(i,'discount',+e.target.value||0)}/></td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="text-xs font-bold text-slate-800">{inr(after+gst)}</div>
                          <div className="text-xs text-slate-400">GST {inr(gst)}</div>
                        </td>
                        <td className="px-2 py-1.5 text-center">
                          {form.items.length > 1 && <button onClick={() => setForm(f => ({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }))} className="w-5 h-5 rounded-full bg-red-50 text-red-400 hover:bg-red-100 text-xs flex items-center justify-center">×</button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-2">
              <div className="w-56 text-xs">
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500"><span>Subtotal</span><span className="font-medium">{inr(subtotal)}</span></div>
                <div className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500"><span>GST Total</span><span className="font-medium">{inr(gstTotal)}</span></div>
                <div className="flex justify-between py-2.5 px-3 mt-1.5 rounded-xl text-white font-bold text-sm" style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
              </div>
            </div>
          </div>

          {/* Bank details — auto-filled from settings */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Bank Details (shown on PDF)</div>
              {form.bankDetails.bankName && <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">✓ Auto-filled from Settings</span>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Bank Name"      value={form.bankDetails.bankName}      onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, bankName:      e.target.value } }))} placeholder="HDFC Bank" />
              <Input label="Account Name"   value={form.bankDetails.accountName}   onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountName:   e.target.value } }))} placeholder="Raulji Technologies" />
              <Input label="Account Number" value={form.bankDetails.accountNumber} onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, accountNumber: e.target.value } }))} placeholder="50100123456789" />
              <Input label="IFSC Code"      value={form.bankDetails.ifsc}          onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, ifsc:          e.target.value } }))} placeholder="HDFC0001234" />
              <Input label="UPI ID"         value={form.bankDetails.upiId || ''}   onChange={e => setForm(f => ({ ...f, bankDetails: { ...f.bankDetails, upiId:         e.target.value } }))} placeholder="raulji@hdfc" className="col-span-2" />
            </div>
            {!form.bankDetails.bankName && (
              <div className="mt-2 text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2">
                💡 Save bank details in <strong>Settings → Billing Details</strong> to auto-fill here every time.
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
            <textarea rows={2} value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs resize-none focus:border-indigo-500 outline-none" placeholder="Thank you for your business. Payment within due date is appreciated." />
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
