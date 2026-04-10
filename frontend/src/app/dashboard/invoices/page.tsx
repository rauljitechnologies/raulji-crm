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
const STATUS_STYLE: Record<string, { style: React.CSSProperties; icon: string }> = {
  DRAFT:     { style: { background: '#64748b', color: '#fff' },                          icon: '✏️' },
  SENT:      { style: { background: '#2563eb', color: '#fff' },                          icon: '📤' },
  PAID:      { style: { background: '#16a34a', color: '#fff' },                          icon: '✅' },
  PARTIAL:   { style: { background: '#d97706', color: '#fff' },                          icon: '⏳' },
  OVERDUE:   { style: { background: '#dc2626', color: '#fff' },                          icon: '🔴' },
  CANCELLED: { style: { background: '#94a3b8', color: '#fff', textDecoration: 'line-through' }, icon: '🚫' },
};
function Badge({ s }: { s: string }) {
  const c = STATUS_STYLE[s] || STATUS_STYLE.DRAFT;
  return (
    <span style={{ ...c.style, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '0.03em', whiteSpace: 'nowrap' }}>
      <span style={{ fontSize: 10 }}>{c.icon}</span>
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

// ─── PDF Preview + Download modal ────────────────────────────
function PdfModal({ inv, cid, onClose }: { inv: any; cid: string; onClose: () => void }) {
  const isDraft = inv.status === 'DRAFT';
  const [loading,      setLoading]      = useState(false);
  const [iframeSrc,    setIframeSrc]    = useState('');
  const [iframeLoading,setIframeLoading]= useState(true);
  const blobUrlRef = useRef('');
  const viewUrl = `${API}/companies/${cid}/invoices/${inv.invoiceId}/view`;

  // Always load preview — drafts get a banner, not a block
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
        // Server returned HTML fallback — open as blob so no auth header needed
        const blobUrl = URL.createObjectURL(new Blob([await blob.text()], { type: 'text/html' }));
        window.open(blobUrl, '_blank');
      }
    } catch {
      // Network error — fetch HTML view with auth and open as blob
      try {
        const r = await fetch(viewUrl, { headers: { Authorization: `Bearer ${tok()}` } });
        const html = await r.text();
        window.open(URL.createObjectURL(new Blob([html], { type: 'text/html' })), '_blank');
      } catch { /* silent */ }
    }
    finally { setLoading(false); }
  };

  const print = async () => {
    if (iframeSrc) {
      const w = window.open('', '_blank');
      if (w) { w.document.write(`<iframe src="${iframeSrc}" style="width:100%;height:100%;border:none"></iframe>`); w.print(); }
    } else {
      try {
        const r = await fetch(viewUrl, { headers: { Authorization: `Bearer ${tok()}` } });
        const html = await r.text();
        const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        const w = window.open(blobUrl, '_blank');
        if (w) w.onload = () => w.print();
      } catch { /* silent */ }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full flex flex-col shadow-2xl overflow-hidden" style={{ maxWidth: 860, height: '93vh' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: '#e8f5fd', color: '#1a72a3' }}>₹</div>
            <div>
              <div className="font-bold text-sm" style={{ color: '#192b3f' }}>{inv.invoiceNumber}</div>
              <div className="text-xs" style={{ color: '#7a9baf' }}>{inv.clientName} · {inr(inv.grandTotal)}</div>
            </div>
            <Badge s={inv.status} />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={print} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">🖨 Print</button>
            <Btn variant="primary" size="sm" loading={loading} onClick={download}>⬇ Download PDF</Btn>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors text-sm font-bold">✕</button>
          </div>
        </div>

        {/* Draft banner */}
        {isDraft && (
          <div className="flex items-center gap-2 px-5 py-2 flex-shrink-0" style={{ background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
            <span style={{ fontSize: 14 }}>📝</span>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#92400e' }}>Draft — </span>
            <span style={{ fontSize: 12.5, color: '#b45309' }}>This is a preview of your draft invoice. Send or mark as paid to finalise.</span>
          </div>
        )}

        {/* Preview */}
        <div className="flex-1 overflow-hidden bg-slate-200 relative">
          {iframeLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-100 z-10">
              <svg className="animate-spin w-6 h-6" style={{ color: '#3199d4' }} viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/>
                <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
              </svg>
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

// ─── TDS rates ───────────────────────────────────────────────
const TDS_RATES = [
  { label: '1% — Sec 194C (Small Contractor)',       value: 1   },
  { label: '2% — Sec 194C (Contractor/Sub-Contract)',value: 2   },
  { label: '5% — Sec 194J (Professional Services)',  value: 5   },
  { label: '10% — Sec 194J (Technical/Royalty)',     value: 10  },
  { label: '7.5% — Sec 194A (Interest)',             value: 7.5 },
  { label: '20% — Sec 194J (No PAN)',                value: 20  },
];

// ─── Mark Paid modal ─────────────────────────────────────────
function PaidModal({ inv, cid, onClose, onDone }: any) {
  const today = new Date().toISOString().split('T')[0];
  const [tdsEnabled,      setTdsEnabled]      = useState(false);
  const [tdsMode,         setTdsMode]         = useState<'percent' | 'amount'>('percent');
  const [tdsRate,         setTdsRate]         = useState(10);
  const [tdsCustomRate,   setTdsCustomRate]   = useState('');   // free-typed % in percent mode
  const [tdsCustomAmount, setTdsCustomAmount] = useState('');
  const [f, setF] = useState({
    paidAmount:    String(inv.grandTotal || ''),
    paymentMethod: 'bank_transfer',
    transactionId: '',
    paymentDate:   today,
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  // TDS amount: percent mode = calc from rate, amount mode = custom entry
  const tdsAmt = tdsEnabled
    ? tdsMode === 'percent'
      ? Math.round(inv.grandTotal * tdsRate / 100)
      : Math.max(0, Math.round(+(tdsCustomAmount || 0)))
    : 0;
  const autoAmt = inv.grandTotal - tdsAmt;

  const syncPaidAmount = (tds: number) => {
    setF(p => ({ ...p, paidAmount: String(Math.max(0, inv.grandTotal - tds)) }));
  };

  const handleTdsToggle = (on: boolean) => {
    setTdsEnabled(on);
    if (on) {
      const tds = tdsMode === 'percent'
        ? Math.round(inv.grandTotal * tdsRate / 100)
        : Math.max(0, +(tdsCustomAmount || 0));
      syncPaidAmount(tds);
    } else {
      setTdsCustomRate('');
      setF(p => ({ ...p, paidAmount: String(inv.grandTotal) }));
    }
  };

  const handleTdsRateChange = (rate: number) => {
    setTdsRate(rate);
    setTdsCustomRate('');          // clear custom input when preset is clicked
    if (tdsEnabled && tdsMode === 'percent') {
      syncPaidAmount(Math.round(inv.grandTotal * rate / 100));
    }
  };

  const handleCustomRateChange = (val: string) => {
    setTdsCustomRate(val);
    const parsed = parseFloat(val);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      setTdsRate(parsed);
      if (tdsEnabled) syncPaidAmount(Math.round(inv.grandTotal * parsed / 100));
    }
  };

  const handleModeSwitch = (mode: 'percent' | 'amount') => {
    setTdsMode(mode);
    if (tdsEnabled) {
      if (mode === 'percent') {
        syncPaidAmount(Math.round(inv.grandTotal * tdsRate / 100));
      } else {
        syncPaidAmount(Math.max(0, +(tdsCustomAmount || 0)));
      }
    }
  };

  const handleCustomAmountChange = (val: string) => {
    setTdsCustomAmount(val);
    if (tdsEnabled && tdsMode === 'amount') {
      syncPaidAmount(Math.max(0, +(val || 0)));
    }
  };

  const cleared = +f.paidAmount + tdsAmt;
  const bal     = Math.max(0, inv.grandTotal - cleared);
  const isFull  = cleared >= inv.grandTotal;

  // Effective TDS rate for display/saving
  const effectiveTdsRate = tdsMode === 'percent'
    ? tdsRate
    : inv.grandTotal > 0 ? +((tdsAmt / inv.grandTotal) * 100).toFixed(2) : 0;

  const save = async () => {
    if (!f.paidAmount || +f.paidAmount < 0) return toast('Enter valid amount', 'err');
    if (!f.paymentDate) return toast('Payment received date is required', 'err');
    if (tdsEnabled && tdsMode === 'amount' && (!tdsCustomAmount || +tdsCustomAmount <= 0))
      return toast('Enter a valid TDS amount', 'err');
    setSaving(true);
    try {
      const payload: any = { ...f, paidAmount: +f.paidAmount };
      if (tdsEnabled && tdsAmt > 0) { payload.tdsAmount = tdsAmt; payload.tdsRate = effectiveTdsRate; }
      await invoiceApi.markPaid(cid, inv.invoiceId, payload);
      const msg = isFull ? 'Invoice marked as Paid!' : 'Invoice marked as Partial!';
      toast(tdsEnabled ? `${msg} TDS ₹${tdsAmt.toLocaleString('en-IN')} recorded.` : msg);
      setTimeout(() => { onDone(); onClose(); }, 700);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 py-5 border-b border-slate-100 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0 text-lg">✓</div>
            <div>
              <div className="font-bold text-slate-900">Mark as Paid</div>
              <div className="text-xs text-slate-400">{inv.invoiceNumber} · Invoice Total {inr(inv.grandTotal)}</div>
            </div>
          </div>
          <div className="px-6 py-4 flex flex-col gap-3">

            {/* TDS toggle */}
            <button
              type="button"
              onClick={() => handleTdsToggle(!tdsEnabled)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${
                tdsEnabled ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-slate-50 hover:border-slate-300'
              }`}>
              <div className="flex items-center gap-2.5">
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
                  tdsEnabled ? 'border-indigo-500 bg-indigo-500' : 'border-slate-300'
                }`}>
                  {tdsEnabled && <svg viewBox="0 0 12 12" className="w-3 h-3" fill="white"><path d="M1.5 6l3 3 6-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                </div>
                <div className="text-left">
                  <div className={`text-sm font-semibold ${tdsEnabled ? 'text-indigo-800' : 'text-slate-600'}`}>TDS Deducted by Client</div>
                  <div className="text-xs text-slate-400">Client deducted TDS before payment</div>
                </div>
              </div>
              {tdsEnabled && (
                <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full flex-shrink-0">
                  -{inr(tdsAmt)}
                </span>
              )}
            </button>

            {/* TDS details */}
            {tdsEnabled && (
              <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3 flex flex-col gap-2.5">

                {/* Mode toggle: % vs Amount */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-indigo-700 mr-1">Enter TDS as:</span>
                  <div className="flex bg-white border border-indigo-200 rounded-lg p-0.5 gap-0.5">
                    <button type="button" onClick={() => handleModeSwitch('percent')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${tdsMode === 'percent' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600'}`}>
                      % Rate
                    </button>
                    <button type="button" onClick={() => handleModeSwitch('amount')}
                      className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${tdsMode === 'amount' ? 'bg-indigo-600 text-white' : 'text-slate-500 hover:text-indigo-600'}`}>
                      ₹ Amount
                    </button>
                  </div>
                </div>

                {/* Percent mode: preset rate buttons + custom % input */}
                {tdsMode === 'percent' && (
                  <>
                    <div className="grid grid-cols-3 gap-1.5">
                      {TDS_RATES.map(r => {
                        const isActive = tdsCustomRate === '' && tdsRate === r.value;
                        return (
                          <button key={r.value} type="button"
                            onClick={() => handleTdsRateChange(r.value)}
                            className={`px-2 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                              isActive
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                            }`}>
                            {r.value}%
                          </button>
                        );
                      })}
                    </div>
                    {/* Custom % input */}
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-indigo-600 font-semibold whitespace-nowrap">Custom %</label>
                      <div className="relative flex-1">
                        <input
                          type="number" min="0" max="100" step="0.01"
                          value={tdsCustomRate}
                          onChange={e => handleCustomRateChange(e.target.value)}
                          placeholder={tdsCustomRate === '' ? String(tdsRate) : ''}
                          className={`w-full px-3 py-1.5 pr-8 border rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-100 outline-none transition-all ${
                            tdsCustomRate !== '' ? 'border-indigo-400 bg-indigo-50' : 'border-slate-200 bg-white'
                          }`}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
                      </div>
                      {tdsCustomRate !== '' && (
                        <button type="button" onClick={() => { setTdsCustomRate(''); handleTdsRateChange(tdsRate); }}
                          className="text-slate-400 hover:text-slate-600 text-sm font-bold flex-shrink-0">✕</button>
                      )}
                    </div>
                    <div className="text-xs text-indigo-500">
                      {tdsCustomRate !== ''
                        ? `Custom rate: ${tdsCustomRate}% → TDS = ${inr(tdsAmt)}`
                        : TDS_RATES.find(r => r.value === tdsRate)?.label}
                    </div>
                  </>
                )}

                {/* Amount mode: direct input */}
                {tdsMode === 'amount' && (
                  <div>
                    <label className="text-xs font-semibold text-indigo-700 mb-1 block">TDS Amount (₹)</label>
                    <input
                      type="number" min="0" max={inv.grandTotal}
                      value={tdsCustomAmount}
                      onChange={e => handleCustomAmountChange(e.target.value)}
                      placeholder="Enter exact TDS amount deducted"
                      className="w-full px-3 py-2 border border-indigo-200 bg-white rounded-lg text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                    {tdsAmt > 0 && inv.grandTotal > 0 && (
                      <div className="text-xs text-indigo-400 mt-1">
                        = {((tdsAmt / inv.grandTotal) * 100).toFixed(2)}% of invoice total
                      </div>
                    )}
                  </div>
                )}

                {/* TDS breakdown */}
                <div className="bg-white rounded-lg px-3 py-2 border border-indigo-100 text-xs">
                  <div className="flex justify-between py-0.5 text-slate-600">
                    <span>Invoice Total</span><span className="font-semibold">{inr(inv.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between py-0.5 text-red-500">
                    <span>TDS {tdsMode === 'percent' ? `@ ${tdsRate}%` : '(entered)'}</span>
                    <span className="font-semibold">- {inr(tdsAmt)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-t border-slate-100 mt-0.5 text-emerald-700 font-bold">
                    <span>Amount to Receive</span><span>{inr(autoAmt)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Amount received */}
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Amount Received *
                {tdsEnabled && <span className="text-indigo-500 font-normal ml-1">(after TDS deduction)</span>}
              </label>
              <input type="number" value={f.paidAmount} onChange={e => setF(p => ({ ...p, paidAmount: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm font-bold focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                placeholder="0.00" />
              {f.paidAmount && (
                <div className={`text-xs mt-1.5 flex items-center gap-1 ${isFull ? 'text-emerald-600' : 'text-amber-600'}`}>
                  <span>{isFull ? '✓' : '⚠'}</span>
                  {isFull
                    ? tdsEnabled
                      ? `Full payment cleared — ₹${(+f.paidAmount).toLocaleString('en-IN')} received + ₹${tdsAmt.toLocaleString('en-IN')} TDS`
                      : 'Full payment — will be marked PAID'
                    : `Balance ₹${bal.toLocaleString('en-IN')} remaining — will be marked PARTIAL`
                  }
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
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Payment Received Date *</label>
              <input type="date" value={f.paymentDate} onChange={e => setF(p => ({ ...p, paymentDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all" />
            </div>
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
function EditModal({ inv, cid, onClose, onDone, isSuperAdmin }: any) {
  const [f, setF] = useState({
    invoiceNumber: inv.invoiceNumber || '',
    status:        inv.status        || 'DRAFT',
    clientName:   inv.clientName   || '',
    clientEmail:  inv.clientEmail  || '',
    clientPhone:  inv.clientPhone  || '',
    clientGst:    inv.clientGst    || '',
    clientAddress:inv.clientAddress|| '',
    invoiceDate:  inv.invoiceDate  ? new Date(inv.invoiceDate).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
    dueDate:      inv.dueDate      ? new Date(inv.dueDate).toISOString().slice(0, 10) : '',
    paymentTerms: inv.paymentTerms || 'Net 30',
    notes:        inv.notes        || '',
    bankDetails:  inv.bankDetails  || { bankName: '', accountNumber: '', ifsc: '', accountName: '', upiId: '' },
    items:        inv.items        || [BLANK()],
  });
  const [saving, setSaving] = useState(false);
  const [numPreview, setNumPreview] = useState<{ nextNumber: string; recent: { invoiceNumber: string; createdAt: string }[] } | null>(null);
  const { toast, ToastContainer } = useToast();

  // Load next-number preview for SUPER_ADMIN
  useEffect(() => {
    if (!isSuperAdmin) return;
    invoiceApi.nextNumber(cid).then((d: any) => setNumPreview(d.data)).catch(() => {});
  }, [isSuperAdmin, cid]);

  const updItem = (i: number, k: string, v: any) => setF(p => ({ ...p, items: p.items.map((it: any, idx: number) => idx === i ? { ...it, [k]: v } : it) }));
  const subtotal   = f.items.reduce((a: number, it: any) => a + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const gstTotal   = f.items.reduce((a: number, it: any) => {
    if (it.gstPercent == null) return a;
    return a + Math.round((it.quantity * it.unitPrice - (it.discount || 0)) * it.gstPercent / 100);
  }, 0);
  const grandTotal = subtotal + gstTotal;
  const gstByRate: Record<number, number> = {};
  f.items.forEach((it: any) => {
    if (it.gstPercent == null) return;
    const taxable = it.quantity * it.unitPrice - (it.discount || 0);
    const tax = Math.round(taxable * it.gstPercent / 100);
    gstByRate[it.gstPercent] = (gstByRate[it.gstPercent] || 0) + tax;
  });

  const save = async () => {
    if (!f.clientName) return toast('Client name required', 'err');
    if (isSuperAdmin && !f.invoiceNumber.trim()) return toast('Invoice number required', 'err');
    setSaving(true);
    try {
      const payload: any = { ...f };
      if (!isSuperAdmin) {
        // Non-admins cannot change invoiceNumber or status directly via this modal
        delete payload.invoiceNumber;
        delete payload.status;
      }
      await invoiceApi.update(cid, inv.invoiceId, payload);
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
            {/* Admin controls — SUPER_ADMIN only */}
            {isSuperAdmin && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex flex-col gap-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">Admin Controls</span>
                  <span className="text-[10px] bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Super Admin Only</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <Input label="Invoice Number" value={f.invoiceNumber} onChange={e => setF(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="INV/2024-0001" />
                    {numPreview && (
                      <div className="mt-1.5 flex flex-col gap-0.5">
                        {numPreview.recent.length > 0 && (
                          <div className="text-[11px] text-slate-500">
                            <span className="font-semibold text-slate-600">Recent: </span>
                            {numPreview.recent.map((r, i) => (
                              <span key={i} className="font-mono text-slate-600">{r.invoiceNumber}{i < numPreview.recent.length - 1 ? ', ' : ''}</span>
                            ))}
                          </div>
                        )}
                        <div className="text-[11px] text-slate-500">
                          <span className="font-semibold text-slate-600">Next auto: </span>
                          <span className="font-mono text-indigo-600 cursor-pointer hover:underline" title="Click to use" onClick={() => setF(p => ({ ...p, invoiceNumber: numPreview.nextNumber }))}>{numPreview.nextNumber}</span>
                          <span className="text-slate-400 ml-1">(click to use)</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <Sel label="Status" value={f.status} onChange={e => setF(p => ({ ...p, status: e.target.value }))}
                    options={[
                      { value: 'DRAFT',     label: 'Draft'     },
                      { value: 'SENT',      label: 'Sent'      },
                      { value: 'PAID',      label: 'Paid'      },
                      { value: 'PARTIAL',   label: 'Partial'   },
                      { value: 'OVERDUE',   label: 'Overdue'   },
                      { value: 'CANCELLED', label: 'Cancelled' },
                    ]} />
                </div>
              </div>
            )}
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Invoice Date" type="date" value={f.invoiceDate} onChange={e => setF(p => ({ ...p, invoiceDate: e.target.value }))} />
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
                      const gst   = it.gstPercent != null ? Math.round(after * it.gstPercent / 100) : 0;
                      return (
                        <tr key={i} className="border-b border-slate-50 last:border-none">
                          <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none" value={it.description} onChange={e => updItem(i,'description',e.target.value)} placeholder="Item"/></td>
                          <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 font-mono focus:border-blue-400 outline-none" value={it.hsnCode||''} onChange={e => updItem(i,'hsnCode',e.target.value)} placeholder="998311"/></td>
                          <td className="px-2 py-1.5"><input type="number" min="1" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:border-blue-400 outline-none" value={it.quantity} onChange={e => updItem(i,'quantity',+e.target.value||1)}/></td>
                          <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.unitPrice} onChange={e => updItem(i,'unitPrice',+e.target.value||0)}/></td>
                          <td className="px-2 py-1.5"><select className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 outline-none" value={it.gstPercent ?? ''} onChange={e => updItem(i,'gstPercent', e.target.value === '' ? null : +e.target.value)}><option value="">No GST</option>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                          <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.discount||0} onChange={e => updItem(i,'discount',+e.target.value||0)}/></td>
                          <td className="px-2 py-1.5 text-right">
                            <div className="text-xs font-bold text-slate-800">{inr(after+gst)}</div>
                            {gst > 0 && <div className="text-xs text-slate-400">+{inr(gst)} GST</div>}
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
                  {Object.entries(gstByRate).filter(([, amt]) => (amt as number) > 0).map(([rate, amt]) => (
                    <div key={rate} className="flex justify-between py-1 text-slate-500 border-b border-slate-100"><span>GST @ {rate}%</span><span>{inr(amt as number)}</span></div>
                  ))}
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

// ─── Chart Components ─────────────────────────────────────────

function SimpleBarChart({ groups, colors, barNames, labels, valueFormatter, chartHeight = 180 }: {
  groups: { vals: number[] }[];
  colors: string[];
  barNames: string[];
  labels: string[];
  valueFormatter: (n: number) => string;
  chartHeight?: number;
}) {
  const maxVal = Math.max(...groups.flatMap(g => g.vals), 1);
  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {barNames.map((name, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ background: colors[i] }} />
            <span className="text-xs text-slate-500">{name}</span>
          </div>
        ))}
      </div>
      {/* Bars */}
      <div className="flex items-end gap-3" style={{ height: chartHeight }}>
        {groups.map((g, gi) => (
          <div key={gi} className="flex-1 flex items-end gap-0.5">
            {g.vals.map((v, vi) => {
              const pct = maxVal > 0 ? Math.max((v / maxVal) * 100, v > 0 ? 1 : 0) : 0;
              return (
                <div key={vi} title={`${barNames[vi]}: ${valueFormatter(v)}`}
                  className="flex-1 rounded-t-sm transition-all duration-500 cursor-default"
                  style={{ height: `${pct}%`, background: colors[vi], minHeight: v > 0 ? 3 : 0 }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* X labels */}
      <div className="flex gap-3 mt-1.5">
        {labels.map((l, i) => (
          <div key={i} className="flex-1 text-center text-xs text-slate-400 truncate" title={l}>{l}</div>
        ))}
      </div>
    </div>
  );
}

function MiniLineChart({ data, valueKey, labelKey, color = '#3199d4', height = 160 }: {
  data: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  height?: number;
}) {
  if (data.length < 2) return (
    <div className="flex items-center justify-center text-slate-300 text-sm" style={{ height }}>Not enough data</div>
  );
  const W = 520, H = height;
  const PL = 52, PR = 16, PT = 12, PB = 32;
  const cW = W - PL - PR, cH = H - PT - PB;
  const vals = data.map(d => d[valueKey] || 0);
  const maxV = Math.max(...vals, 1);
  const pts = data.map((d, i) => ({
    x: PL + (i / (data.length - 1)) * cW,
    y: PT + cH - (d[valueKey] / maxV) * cH,
    label: d[labelKey],
    val: d[valueKey],
  }));
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${pts[pts.length - 1].x.toFixed(1)} ${PT + cH} L${pts[0].x.toFixed(1)} ${PT + cH} Z`;
  const TICKS = 4;
  const shortV = (n: number) => n >= 1e7 ? `${(n/1e7).toFixed(1)}Cr` : n >= 1e5 ? `${(n/1e5).toFixed(1)}L` : n >= 1e3 ? `${(n/1e3).toFixed(0)}K` : `${Math.round(n)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet">
      {Array.from({ length: TICKS + 1 }, (_, i) => {
        const y = PT + cH - (i / TICKS) * cH;
        return (
          <g key={i}>
            <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={i === 0 ? '#e2e8f0' : '#f8fafc'} strokeWidth="1" />
            <text x={PL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{shortV((i / TICKS) * maxV)}</text>
          </g>
        );
      })}
      <line x1={PL} y1={PT} x2={PL} y2={PT + cH} stroke="#e2e8f0" strokeWidth="1" />
      <path d={areaPath} fill={color} fillOpacity="0.08" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="3.5" fill={color} stroke="white" strokeWidth="1.5" />
          {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) && (
            <text x={p.x} y={H - 4} textAnchor="middle" fontSize="8.5" fill="#94a3b8">{p.label}</text>
          )}
        </g>
      ))}
    </svg>
  );
}

function DonutChart({ segs }: { segs: { label: string; value: number; color: string }[] }) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  const SIZE = 108;
  if (total === 0) return <div className="rounded-full bg-slate-100 mx-auto" style={{ width: SIZE, height: SIZE }} />;
  let cum = 0;
  const stops = segs.filter(s => s.value > 0).map(s => {
    const start = (cum / total) * 360;
    cum += s.value;
    const end = (cum / total) * 360;
    return `${s.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  const innerSize = SIZE * 0.58;
  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <div className="rounded-full" style={{ width: SIZE, height: SIZE, background: `conic-gradient(${stops.join(', ')})` }} />
        <div className="absolute rounded-full bg-white flex flex-col items-center justify-center"
          style={{ width: innerSize, height: innerSize, top: (SIZE - innerSize) / 2, left: (SIZE - innerSize) / 2 }}>
          <div className="text-sm font-bold text-slate-700">{total}</div>
          <div className="text-xs text-slate-400">invoices</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {segs.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-xs text-slate-600 flex-1">{s.label}</span>
            <span className="text-xs font-bold text-slate-700">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Analytics View ───────────────────────────────────────────
function AnalyticsView({ allInvoices, companies, cid }: { allInvoices: any[]; companies: any[]; cid: string }) {
  const [fyFilter, setFyFilter] = useState('ALL');

  const shortFmt = (n: number) => n >= 1e7 ? `₹${(n/1e7).toFixed(1)}Cr` : n >= 1e5 ? `₹${(n/1e5).toFixed(1)}L` : n >= 1e3 ? `₹${(n/1e3).toFixed(0)}K` : `₹${Math.round(n)}`;
  const fmtInr  = (n: number) => '₹' + (n||0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
  const getFY   = (s: string) => { const d = new Date(s); const y = d.getFullYear(), m = d.getMonth(); return m >= 3 ? `FY ${y}-${String(y+1).slice(2)}` : `FY ${y-1}-${String(y).slice(2)}`; };

  const activeInvs    = allInvoices.filter(i => i.status !== 'CANCELLED');
  const cancelledInvs = allInvoices.filter(i => i.status === 'CANCELLED');
  const paidInvs      = activeInvs.filter(i => i.status === 'PAID');

  const totalRevenue  = activeInvs.reduce((a, i) => a + (i.grandTotal || 0), 0);
  const collected     = activeInvs.reduce((a, i) => a + (i.paidAmount || 0), 0);
  const totalTds      = activeInvs.reduce((a, i) => a + (i.tdsAmount || 0), 0);
  const totalTax      = activeInvs.reduce((a, i) => a + (i.totalGst || 0), 0);
  const totalSubtotal = activeInvs.reduce((a, i) => a + (i.subtotal || 0), 0);
  const pending       = activeInvs.filter(i => ['SENT','PARTIAL'].includes(i.status))
    .reduce((a, i) => a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0)), 0);

  // FY map (all active)
  const fyMapAll: Record<string, { subtotal: number; tax: number; grand: number; paid: number; count: number }> = {};
  activeInvs.forEach(i => {
    const fy = getFY(i.invoiceDate || i.createdAt);
    if (!fyMapAll[fy]) fyMapAll[fy] = { subtotal: 0, tax: 0, grand: 0, paid: 0, count: 0 };
    fyMapAll[fy].subtotal += i.subtotal || 0;
    fyMapAll[fy].tax      += i.totalGst || 0;
    fyMapAll[fy].grand    += i.grandTotal || 0;
    fyMapAll[fy].count    += 1;
    if (i.status === 'PAID') fyMapAll[fy].paid += i.grandTotal || 0;
  });
  const fyList = Object.keys(fyMapAll).sort();
  const fyChartData = fyList.map(fy => ({ label: fy.replace('FY ', ''), vals: [fyMapAll[fy].subtotal, fyMapAll[fy].tax, fyMapAll[fy].grand] }));
  const fyChartGroups = fyChartData.map(d => ({ vals: d.vals }));

  // Filtered invoices (by FY)
  const filteredInvs = fyFilter === 'ALL' ? activeInvs : activeInvs.filter(i => getFY(i.invoiceDate || i.createdAt) === fyFilter);

  // Monthly data
  const monthMap: Record<string, { grand: number; paid: number; label: string }> = {};
  filteredInvs.forEach(i => {
    const d   = new Date(i.invoiceDate || i.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const lbl = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
    if (!monthMap[key]) monthMap[key] = { grand: 0, paid: 0, label: lbl };
    monthMap[key].grand += i.grandTotal || 0;
    if (i.status === 'PAID') monthMap[key].paid += i.grandTotal || 0;
  });
  const monthData = Object.keys(monthMap).sort().map(k => monthMap[k]);

  // Client data (filtered)
  const clientMapA: Record<string, { grand: number; paid: number; count: number; subtotal: number; tax: number }> = {};
  filteredInvs.forEach(i => {
    const k = i.clientName || 'Unknown';
    if (!clientMapA[k]) clientMapA[k] = { grand: 0, paid: 0, count: 0, subtotal: 0, tax: 0 };
    clientMapA[k].grand    += i.grandTotal || 0;
    clientMapA[k].subtotal += i.subtotal || 0;
    clientMapA[k].tax      += i.totalGst || 0;
    clientMapA[k].count    += 1;
    clientMapA[k].paid     += i.paidAmount || (i.status === 'PAID' ? i.grandTotal : 0) || 0;
  });
  const clientRows    = Object.entries(clientMapA).sort((a, b) => b[1].grand - a[1].grand).slice(0, 10);
  const maxClientGrand = Math.max(...clientRows.map(([, v]) => v.grand), 1);

  // Status counts
  const SC = allInvoices.reduce((a, i) => { a[i.status] = (a[i.status] || 0) + 1; return a; }, {} as Record<string, number>);
  const donutSegs = [
    { label: 'Paid',      value: SC.PAID      || 0, color: '#22c55e' },
    { label: 'Sent',      value: SC.SENT      || 0, color: '#3b82f6' },
    { label: 'Partial',   value: SC.PARTIAL   || 0, color: '#f97316' },
    { label: 'Draft',     value: SC.DRAFT     || 0, color: '#94a3b8' },
    { label: 'Cancelled', value: SC.CANCELLED || 0, color: '#e2e8f0' },
  ];

  // Company-wise TDS (active invoices only)
  const companyTdsMap: Record<string, { name: string; tdsAmount: number; tdsCount: number }> = {};
  activeInvs.filter(i => (i.tdsAmount || 0) > 0).forEach(i => {
    const key  = i._companyId || cid;
    const name = i._companyName || companies.find((c: any) => c.companyId === key)?.name || 'Company';
    if (!companyTdsMap[key]) companyTdsMap[key] = { name, tdsAmount: 0, tdsCount: 0 };
    companyTdsMap[key].tdsAmount += i.tdsAmount || 0;
    companyTdsMap[key].tdsCount  += 1;
  });
  const companyTdsRows = Object.values(companyTdsMap).sort((a, b) => b.tdsAmount - a.tdsAmount);

  // GST rate breakdown (filtered)
  const gstRateMap: Record<string, { taxable: number; tax: number }> = {};
  filteredInvs.forEach(i => {
    (i.items || []).forEach((item: any) => {
      const rate = String(item.gstPercent ?? 0);
      if (!gstRateMap[rate]) gstRateMap[rate] = { taxable: 0, tax: 0 };
      const base = (item.quantity * (item.unitPrice || 0)) - (item.discount || 0);
      gstRateMap[rate].taxable += base;
      gstRateMap[rate].tax     += Math.round(base * (item.gstPercent || 0) / 100);
    });
  });
  const gstRateRows = Object.entries(gstRateMap).sort((a, b) => +a[0] - +b[0]);
  const totalGstTax = gstRateRows.reduce((a, [, v]) => a + v.tax, 0);

  // Download CSV
  const downloadCSV = () => {
    const hdr = ['Invoice #','Date','Due Date','Client','Client GST','Status','Subtotal (₹)','GST (₹)','Grand Total (₹)','Paid Amount (₹)','TDS Amount (₹)','TDS Rate (%)','Balance (₹)','Payment Received Date','Payment Method','Transaction ID'];
    const rows = allInvoices.map(i => {
      const tds = i.tdsAmount || 0;
      const bal = Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - tds);
      return [
        i.invoiceNumber,
        new Date(i.invoiceDate || i.createdAt).toLocaleDateString('en-IN'),
        i.dueDate ? new Date(i.dueDate).toLocaleDateString('en-IN') : '',
        i.clientName || '', i.clientGst || '', i.status,
        i.subtotal || 0, i.totalGst || 0, i.grandTotal || 0,
        i.paidAmount || 0,
        tds,
        i.tdsRate || 0,
        bal,
        i.paidAt ? new Date(i.paidAt).toLocaleDateString('en-IN') : '',
        i.paymentMethod ? i.paymentMethod.replace(/_/g, ' ') : '',
        i.transactionId || '',
      ];
    });
    const csv = [hdr, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = 'data:text/csv;charset=utf-8,\uFEFF' + encodeURIComponent(csv);
    a.download = `invoice-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  };

  // Print HTML report
  const printReport = () => {
    const w = window.open('', '_blank', 'width=960,height=720');
    if (!w) return;
    const SC_COLOR: Record<string, string> = { PAID: '#16a34a', SENT: '#3b82f6', DRAFT: '#94a3b8', PARTIAL: '#f97316', OVERDUE: '#ef4444', CANCELLED: '#94a3b8' };
    const tRows = allInvoices.map(i => {
      const tds = i.tdsAmount || 0;
      const bal = Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - tds);
      return `<tr>
        <td>${i.invoiceNumber}</td>
        <td>${new Date(i.invoiceDate || i.createdAt).toLocaleDateString('en-IN')}</td>
        <td>${i.clientName || ''}</td>
        <td><span style="background:${SC_COLOR[i.status]||'#94a3b8'};color:white;padding:2px 8px;border-radius:4px;font-size:10px">${i.status}</span></td>
        <td style="text-align:right">${fmtInr(i.subtotal||0)}</td>
        <td style="text-align:right;color:#6366f1">${fmtInr(i.totalGst||0)}</td>
        <td style="text-align:right;font-weight:700">${fmtInr(i.grandTotal||0)}</td>
        <td style="text-align:right;color:${(i.paidAmount||0)>0?'#16a34a':'#94a3b8'}">${fmtInr(i.paidAmount||0)}</td>
        <td style="text-align:right;color:#7c3aed">${tds > 0 ? fmtInr(tds) + ' (' + (i.tdsRate||0) + '%)' : '—'}</td>
        <td style="text-align:right;color:${bal>0?'#ef4444':'#16a34a'}">${fmtInr(bal)}</td>
      </tr>`;
    }).join('');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"/><title>Invoice Report</title>
<style>
  *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:32px;color:#1e293b;font-size:13px}
  h1{font-size:22px;font-weight:800;margin:0 0 2px;color:#1f293f}
  .sub{color:#64748b;font-size:12px;margin-bottom:24px}
  .kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:28px}@media(min-width:600px){.kpis{grid-template-columns:repeat(4,1fr)}}
  .kpi{border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}
  .kpi-label{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
  .kpi-val{font-size:20px;font-weight:800}
  table{width:100%;border-collapse:collapse}
  th{background:#f8fafc;padding:8px 12px;text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;border-bottom:2px solid #e2e8f0;white-space:nowrap}
  td{padding:9px 12px;border-bottom:1px solid #f1f5f9;font-size:12px}
  tfoot td{font-weight:700;background:#f0f9ff;border-top:2px solid #3199d4}
  @media print{body{padding:16px}@page{margin:1cm}}
</style></head><body>
<h1>Invoice Report</h1>
<div class="sub">Generated ${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})} &nbsp;·&nbsp; ${activeInvs.length} active invoices${cancelledInvs.length > 0 ? ` (${cancelledInvs.length} cancelled excluded)` : ''}${fyFilter !== 'ALL' ? ' &nbsp;·&nbsp; ' + fyFilter : ''}</div>
<div class="kpis">
  <div class="kpi"><div class="kpi-label">Total Revenue</div><div class="kpi-val" style="color:#3199d4">${fmtInr(totalRevenue)}</div></div>
  <div class="kpi"><div class="kpi-label">Cash Received</div><div class="kpi-val" style="color:#16a34a">${fmtInr(collected)}</div></div>
  <div class="kpi"><div class="kpi-label">TDS Deducted</div><div class="kpi-val" style="color:#7c3aed">${fmtInr(totalTds)}</div></div>
  <div class="kpi"><div class="kpi-label">Total GST</div><div class="kpi-val" style="color:#6366f1">${fmtInr(totalTax)}</div></div>
</div>
<table>
  <thead><tr><th>Invoice #</th><th>Date</th><th>Client</th><th>Status</th><th style="text-align:right">Subtotal</th><th style="text-align:right">GST</th><th style="text-align:right">Grand Total</th><th style="text-align:right">Paid</th><th style="text-align:right">TDS</th><th style="text-align:right">Balance</th></tr></thead>
  <tbody>${tRows}</tbody>
  <tfoot><tr>
    <td colspan="4">TOTAL (${activeInvs.length} active invoices${cancelledInvs.length > 0 ? ` · ${cancelledInvs.length} cancelled excluded` : ''})</td>
    <td style="text-align:right">${fmtInr(totalSubtotal)}</td>
    <td style="text-align:right">${fmtInr(totalTax)}</td>
    <td style="text-align:right">${fmtInr(totalRevenue)}</td>
    <td style="text-align:right">${fmtInr(collected)}</td>
    <td style="text-align:right;color:#7c3aed">${totalTds > 0 ? fmtInr(totalTds) : '—'}</td>
    <td style="text-align:right">${fmtInr(Math.max(0, totalRevenue - collected - totalTds))}</td>
  </tr></tfoot>
</table>
</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 600);
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-5">

      {/* ── Header ── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="text-lg font-bold text-slate-800">Invoice Analytics</div>
          <div className="text-xs text-slate-400 mt-0.5">{activeInvs.length} active · {filteredInvs.length} in period · {paidInvs.length} paid{cancelledInvs.length > 0 ? ` · ${cancelledInvs.length} cancelled (excluded from totals)` : ''}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={fyFilter} onChange={e => setFyFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 bg-white font-medium">
            <option value="ALL">All Financial Years</option>
            {fyList.map(fy => <option key={fy} value={fy}>{fy}</option>)}
          </select>
          <button onClick={downloadCSV}
            className="px-3 py-1.5 text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
            ⬇ Download CSV
          </button>
          <button onClick={printReport}
            className="px-3 py-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg font-semibold hover:bg-indigo-100 transition-colors flex items-center gap-1.5">
            🖨 Print Report
          </button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total Revenue',     val: totalRevenue,  sub: `${activeInvs.length} invoices`,                                                           color: 'text-blue-600',    border: 'border-blue-100'   },
          { label: 'Collected (Cash)',   val: collected,     sub: `${paidInvs.length} paid`,                                                                 color: 'text-emerald-600', border: 'border-emerald-100'},
          { label: 'TDS Deducted',       val: totalTds,      sub: totalTds > 0 ? `${allInvoices.filter(i=>i.tdsAmount>0).length} inv. with TDS` : 'No TDS recorded', color: 'text-purple-600',  border: 'border-purple-100' },
          { label: 'Outstanding',        val: pending,       sub: `${allInvoices.filter(i=>['SENT','PARTIAL'].includes(i.status)).length} unpaid`,           color: 'text-amber-600',   border: 'border-amber-100'  },
          { label: 'Subtotal (Taxable)', val: totalSubtotal, sub: 'Before GST',                                                                              color: 'text-slate-700',   border: 'border-slate-200'  },
          { label: 'Total GST',          val: totalTax,      sub: totalSubtotal > 0 ? `${((totalTax/totalSubtotal)*100).toFixed(1)}% eff. rate` : '—',       color: 'text-indigo-600',  border: 'border-indigo-100' },
        ].map((k, i) => (
          <div key={i} className={`bg-white border ${k.border} rounded-xl px-4 py-3`}>
            <div className="text-xs text-slate-400 font-medium mb-1">{k.label}</div>
            <div className={`text-lg font-bold ${k.color}`}>{shortFmt(k.val)}</div>
            <div className="text-xs text-slate-400 mt-0.5">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── FY Bar Chart + Status Donut ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Card className="col-span-3 p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="font-semibold text-slate-800 text-sm">Revenue by Financial Year</div>
            <div className="text-xs text-slate-400">Apr – Mar</div>
          </div>
          {fyChartGroups.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-slate-300 text-sm">No data</div>
          ) : (
            <SimpleBarChart
              groups={fyChartGroups}
              colors={['#93c5fd', '#a5b4fc', '#1f293f']}
              barNames={['Subtotal', 'GST', 'Grand Total']}
              labels={fyChartData.map(d => d.label)}
              valueFormatter={shortFmt}
              chartHeight={180}
            />
          )}
        </Card>
        <Card className="col-span-2 p-4">
          <div className="font-semibold text-slate-800 text-sm mb-4">Invoice Status</div>
          <DonutChart segs={donutSegs} />
          <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="text-slate-400">Cash Received</div>
            <div className="font-bold text-emerald-600 text-right">{shortFmt(collected)}</div>
            {totalTds > 0 && <>
              <div className="text-slate-400">TDS Deducted</div>
              <div className="font-bold text-purple-600 text-right">{shortFmt(totalTds)}</div>
              <div className="text-slate-400">Total Cleared</div>
              <div className="font-bold text-blue-600 text-right">{shortFmt(collected + totalTds)}</div>
            </>}
            <div className="text-slate-400">Outstanding</div>
            <div className="font-bold text-amber-600 text-right">{shortFmt(pending)}</div>
            <div className="text-slate-400">Collection Rate</div>
            <div className="font-bold text-indigo-600 text-right">{totalRevenue > 0 ? `${(((collected+totalTds)/totalRevenue)*100).toFixed(1)}%` : '—'}</div>
          </div>
        </Card>
      </div>

      {/* ── Monthly Trend ── */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-slate-800 text-sm">Monthly Revenue Trend</div>
          <div className="flex items-center gap-3 text-xs">
            <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-blue-400 inline-block rounded" />Revenue</span>
            <span className="text-slate-400">{fyFilter === 'ALL' ? 'All time' : fyFilter}</span>
          </div>
        </div>
        <MiniLineChart data={monthData} valueKey="grand" labelKey="label" color="#3199d4" height={160} />
      </Card>

      {/* ── Company-wise TDS ── */}
      {totalTds > 0 && (
        <Card className="p-4">
          <div className="font-semibold text-slate-800 text-sm mb-1">Company-wise TDS Summary</div>
          <div className="text-[10px] text-slate-400 mb-4">TDS deducted by clients — cancelled invoices excluded</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100">
                  {['Company', 'Invoices with TDS', 'TDS Amount', '% of Total TDS'].map(h => (
                    <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {companyTdsRows.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 last:border-none">
                    <td className="py-2.5 font-semibold text-slate-700">{row.name}</td>
                    <td className="py-2.5 text-slate-500">{row.tdsCount} invoice{row.tdsCount !== 1 ? 's' : ''}</td>
                    <td className="py-2.5 text-purple-700 font-bold">{fmtInr(row.tdsAmount)}</td>
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-24">
                          <div className="h-1.5 bg-purple-400 rounded-full" style={{ width: `${totalTds > 0 ? (row.tdsAmount / totalTds) * 100 : 0}%` }} />
                        </div>
                        <span className="text-slate-500 whitespace-nowrap">{totalTds > 0 ? `${((row.tdsAmount / totalTds) * 100).toFixed(1)}%` : '—'}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200">
                  <td className="py-2.5 font-bold text-slate-700">Total</td>
                  <td className="py-2.5 font-bold text-slate-800">{activeInvs.filter(i => (i.tdsAmount || 0) > 0).length} invoices</td>
                  <td className="py-2.5 font-bold text-purple-700">{fmtInr(totalTds)}</td>
                  <td className="py-2.5 font-bold text-slate-600">100%</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      )}

      {/* ── Client Chart + GST Breakdown ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <div className="font-semibold text-slate-800 text-sm mb-4">Top Clients by Revenue</div>
          {clientRows.length === 0 ? (
            <div className="text-slate-300 text-sm text-center py-8">No data</div>
          ) : (
            <div className="flex flex-col gap-3">
              {clientRows.map(([name, v], i) => (
                <div key={name}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</div>
                      <span className="text-xs font-semibold text-slate-700 truncate">{name}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <div className="text-xs font-bold text-slate-800">{shortFmt(v.grand)}</div>
                      {v.paid > 0 && <div className="text-xs text-emerald-500">{shortFmt(v.paid)} paid</div>}
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-2 rounded-full flex overflow-hidden">
                      <div className="bg-emerald-400 transition-all duration-500" style={{ width: `${(v.paid / maxClientGrand) * 100}%` }} />
                      <div className="bg-blue-300 transition-all duration-500" style={{ width: `${Math.max(0, (v.grand - v.paid) / maxClientGrand * 100)}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between text-xs text-slate-400 mt-0.5">
                    <span>Sub {shortFmt(v.subtotal)}</span>
                    <span className="text-indigo-400">+GST {shortFmt(v.tax)}</span>
                    <span>{v.count} inv.</span>
                  </div>
                </div>
              ))}
              <div className="flex items-center gap-3 pt-2 border-t border-slate-100 text-xs text-slate-400">
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-emerald-400 rounded-sm inline-block"/>Paid</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 bg-blue-300 rounded-sm inline-block"/>Pending</span>
              </div>
            </div>
          )}
        </Card>
        <Card className="p-4">
          <div className="font-semibold text-slate-800 text-sm mb-4">GST Rate Breakdown</div>
          {gstRateRows.length === 0 ? (
            <div className="text-slate-300 text-sm text-center py-8">No data</div>
          ) : (
            <div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['GST Rate','Taxable Value','Tax Amount','% of Total Tax'].map(h => (
                      <th key={h} className="pb-2 text-left text-xs font-semibold text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gstRateRows.map(([rate, v]) => (
                    <tr key={rate} className="border-b border-slate-50">
                      <td className="py-2.5">
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-bold">{rate}%</span>
                      </td>
                      <td className="py-2.5 text-slate-700 font-medium">{shortFmt(v.taxable)}</td>
                      <td className="py-2.5 text-indigo-600 font-semibold">{shortFmt(v.tax)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full max-w-16">
                            <div className="h-1.5 bg-indigo-400 rounded-full" style={{ width: `${totalGstTax > 0 ? (v.tax/totalGstTax)*100 : 0}%` }} />
                          </div>
                          <span className="text-slate-500">{totalGstTax > 0 ? `${((v.tax/totalGstTax)*100).toFixed(1)}%` : '—'}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 border-t-2 border-slate-200">
                    <td className="py-2.5 font-bold text-slate-700">Total</td>
                    <td className="py-2.5 font-bold text-slate-800">{shortFmt(gstRateRows.reduce((a,[,v])=>a+v.taxable,0))}</td>
                    <td className="py-2.5 font-bold text-indigo-700">{shortFmt(totalGstTax)}</td>
                    <td className="py-2.5 font-bold text-slate-600">100%</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </Card>
      </div>

    </div>
  );
}

// ─── Create invoice form ──────────────────────────────────────
function emptyForm() {
  return {
    clientName: '', clientEmail: '', clientPhone: '', clientGst: '', clientAddress: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    paymentTerms: 'Net 30', notes: '',
    bankDetails: { bankName: '', accountNumber: '', ifsc: '', accountName: '', upiId: '' },
    items: [BLANK()],
  };
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function InvoicesPage() {
  const [isSuperAdmin] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'SUPER_ADMIN'; } catch { return false; }
  });

  const [companies,   setCompanies]   = useState<any[]>([]);
  const [cid,         setCid]         = useState('');
  const [coProfile,   setCoProfile]   = useState<any>({});
  const [allInvoices, setAllInvoices] = useState<any[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [loadingMore,   setLoadingMore]   = useState(false);
  const [hasMore,       setHasMore]       = useState(false);
  const [tab,           setTab]           = useState('ALL');
  const [showCancelled, setShowCancelled] = useState(false);
  const [previewInv,    setPreviewInv]    = useState<any>(null);
  const [paidInv,       setPaidInv]       = useState<any>(null);
  const [editInv,       setEditInv]       = useState<any>(null);
  const [cancelInv,     setCancelInv]     = useState<any>(null);
  const [showCreate,    setShowCreate]    = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [form,          setForm]          = useState(emptyForm());
  const [clients,       setClients]       = useState<any[]>([]);
  const [clientSearch,  setClientSearch]  = useState('');
  const [showClientDrop,setShowClientDrop]= useState(false);
  const [viewMode,      setViewMode]      = useState<'invoices' | 'analytics'>('invoices');
  const [createCo,      setCreateCo]      = useState('');
  // client history
  const [clientFilter,  setClientFilter]  = useState<string | null>(null);
  const [clientHistCid, setClientHistCid] = useState('');
  const [clientInvs,    setClientInvs]    = useState<any[]>([]);
  const [clientLoading, setClientLoading] = useState(false);
  const { toast, ToastContainer }         = useToast();
  const scrollRef    = useRef<HTMLDivElement>(null);
  const pageRef      = useRef(1);
  const hasMoreRef   = useRef(false);
  const loadingMoreRef = useRef(false);
  const PAGE_SIZE    = 15;

  // Load companies (uses /companies/mine — works for all roles)
  const loadCos = useCallback(async () => {
    try {
      const d   = await companyApi.mine();
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos.length > 1) setCid('ALL');
      else if (cos[0]) setCid(cos[0].companyId);
    } catch {}
  }, []);
  useEffect(() => { loadCos(); }, []);

  // When company changes — load profile + invoices + clients
  useEffect(() => {
    if (!cid) return;
    if (cid === 'ALL') {
      // In all-companies mode — clear profile, load invoices from all companies
      setCoProfile({});
      setClients([]);
      loadInvoices();
      return;
    }
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
    pageRef.current = 1;
    try {
      if (cid === 'ALL') {
        // Fetch from all companies in parallel and merge
        const results = await Promise.all(
          companies.map((co: any) =>
            invoiceApi.list(co.companyId, { limit: '500', page: '1' })
              .then((d: any) => (d.invoices || []).map((inv: any) => ({ ...inv, _companyName: co.name, _companyId: co.companyId })))
              .catch(() => [])
          )
        );
        const merged = (results as any[][]).flat().sort((a: any, b: any) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setAllInvoices(merged);
        hasMoreRef.current = false;
        setHasMore(false);
      } else {
        const d = await invoiceApi.list(cid, { limit: String(PAGE_SIZE), page: '1' });
        const fetched = d.invoices || [];
        setAllInvoices(fetched);
        const total = d.pagination?.total || fetched.length;
        const more = total > PAGE_SIZE;
        hasMoreRef.current = more;
        setHasMore(more);
      }
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  };

  const loadMore = async () => {
    if (!cid || loadingMoreRef.current || !hasMoreRef.current) return;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    const nextPage = pageRef.current + 1;
    try {
      const d = await invoiceApi.list(cid, { limit: String(PAGE_SIZE), page: String(nextPage) });
      const fetched = d.invoices || [];
      setAllInvoices(prev => [...prev, ...fetched]);
      pageRef.current = nextPage;
      const total = d.pagination?.total || 0;
      const more = total > nextPage * PAGE_SIZE;
      hasMoreRef.current = more;
      setHasMore(more);
    } catch {}
    finally { loadingMoreRef.current = false; setLoadingMore(false); }
  };

  const openClientHistory = async (name: string, invCompanyId?: string) => {
    const targetCid = invCompanyId || (cid !== 'ALL' ? cid : '');
    if (!targetCid) return;
    setClientFilter(name);
    setClientHistCid(targetCid);
    setClientLoading(true);
    setClientInvs([]);
    try {
      const d = await invoiceApi.list(targetCid, { limit: '200', page: '1', clientName: name });
      // Enrich with _companyId so modals work in ALL mode
      setClientInvs((d.invoices || []).map((inv: any) => ({ ...inv, _companyId: targetCid })));
    } catch {}
    finally { setClientLoading(false); }
  };

  // Infinite scroll — fires loadMore when near bottom
  useEffect(() => {
    if (viewMode !== 'invoices' || clientFilter) return;
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollHeight - el.scrollTop - el.clientHeight < 200) loadMore();
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [viewMode, clientFilter, cid]);

  // Tabs — cancelled always hidden unless toggled on
  const visibleInvoices = showCancelled ? allInvoices : allInvoices.filter(i => i.status !== 'CANCELLED');
  const cancelledCount  = allInvoices.filter(i => i.status === 'CANCELLED').length;

  const TABS = [
    { key: 'ALL',     label: 'All',     fn: () => true },
    { key: 'SENT',    label: 'Unpaid',  fn: (i: any) => i.status === 'SENT' },
    { key: 'PAID',    label: 'Paid',    fn: (i: any) => i.status === 'PAID' },
    { key: 'PARTIAL', label: 'Partial', fn: (i: any) => i.status === 'PARTIAL' },
    { key: 'OVERDUE', label: 'Overdue', fn: (i: any) => i.status === 'OVERDUE' || (i.status === 'SENT' && new Date(i.dueDate) < new Date()) },
    { key: 'DRAFT',   label: 'Draft',   fn: (i: any) => i.status === 'DRAFT' },
    ...(showCancelled ? [{ key: 'CANCELLED', label: 'Cancelled', fn: (i: any) => i.status === 'CANCELLED' }] : []),
  ];
  const activeTab = TABS.find(t => t.key === tab) || TABS[0];
  // if cancelled tab was active but now hidden, fall back to ALL
  if (tab === 'CANCELLED' && !showCancelled) setTab('ALL');
  const invoices  = visibleInvoices.filter(activeTab.fn);

  // Totals — exclude CANCELLED from all financial calculations
  const activeInvs    = allInvoices.filter(i => i.status !== 'CANCELLED');
  const totalSubtotal = activeInvs.reduce((a, i) => a + (i.subtotal   || 0), 0);
  const totalTax      = activeInvs.reduce((a, i) => a + (i.totalGst   || 0), 0);
  const totalRevenue  = activeInvs.reduce((a, i) => a + (i.grandTotal || 0), 0);
  const totalTds      = activeInvs.reduce((a, i) => a + (i.tdsAmount  || 0), 0);

  const collected = activeInvs.reduce((a, i) => a + (i.paidAmount || 0), 0);

  // Pending = DRAFT full amount + SENT/PARTIAL remaining balance (after paid + TDS)
  const pending = activeInvs
    .filter(i => ['DRAFT', 'SENT', 'PARTIAL'].includes(i.status))
    .reduce((a, i) => {
      if (i.status === 'DRAFT') return a + (i.grandTotal || 0);
      return a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0));
    }, 0);

  const overdue = activeInvs
    .filter(i => i.status === 'SENT' && i.dueDate && new Date(i.dueDate) < new Date())
    .reduce((a, i) => a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0)), 0);

  const fmtL = (n: number) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : inr(n);

  // TDS breakdown — company-wise and invoice-wise (active only)
  const companyTdsMap: Record<string, { name: string; tdsAmount: number; count: number }> = {};
  activeInvs.filter(i => (i.tdsAmount || 0) > 0).forEach(i => {
    const key  = i._companyId || (cid !== 'ALL' ? cid : '');
    const name = i._companyName || companies.find((c: any) => c.companyId === key)?.name || 'Company';
    if (!companyTdsMap[key]) companyTdsMap[key] = { name, tdsAmount: 0, count: 0 };
    companyTdsMap[key].tdsAmount += i.tdsAmount || 0;
    companyTdsMap[key].count     += 1;
  });
  const companyTdsRows = Object.values(companyTdsMap).sort((a, b) => b.tdsAmount - a.tdsAmount);
  const tdsInvoices    = activeInvs.filter(i => (i.tdsAmount || 0) > 0)
    .sort((a, b) => (b.tdsAmount || 0) - (a.tdsAmount || 0));

  // Item helpers
  const updItem = (i: number, k: string, v: any) => setForm(f => ({ ...f, items: f.items.map((it: any, idx: number) => idx === i ? { ...it, [k]: v } : it) }));
  const subtotal   = form.items.reduce((a, it: any) => a + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const gstTotal   = form.items.reduce((a: number, it: any) => {
    if (it.gstPercent == null) return a;
    return a + Math.round((it.quantity * it.unitPrice - (it.discount || 0)) * it.gstPercent / 100);
  }, 0);
  const grandTotal = subtotal + gstTotal;
  const formGstByRate: Record<number, number> = {};
  form.items.forEach((it: any) => {
    if (it.gstPercent == null) return;
    const taxable = it.quantity * it.unitPrice - (it.discount || 0);
    const tax = Math.round(taxable * it.gstPercent / 100);
    formGstByRate[it.gstPercent] = (formGstByRate[it.gstPercent] || 0) + tax;
  });

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
    // Set default billing company for the create modal
    setCreateCo(cid !== 'ALL' ? cid : (companies[0]?.companyId || ''));
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
    const targetCid = cid === 'ALL' ? createCo : cid;
    if (!targetCid)                     return toast('Select a billing company', 'err');
    setSaving(true);
    try {
      const bd = form.bankDetails.bankName ? form.bankDetails : null;
      await invoiceApi.create(targetCid, { ...form, bankDetails: bd });
      toast('Invoice created!');
      setShowCreate(false);
      loadInvoices();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Topbar title="Invoices" subtitle={`${activeInvs.length} active invoices · ${fmtL(collected)} collected`}
        actions={<>
          <div className="flex bg-slate-100 p-0.5 rounded-lg gap-0.5">
            <button onClick={() => setViewMode('invoices')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${viewMode === 'invoices' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Invoices
            </button>
            <button onClick={() => setViewMode('analytics')}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-all ${viewMode === 'analytics' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              Analytics
            </button>
          </div>
          <select value={cid} onChange={e => setCid(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 bg-white">
            {companies.length > 1 && <option value="ALL">All Companies ({companies.length})</option>}
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          {viewMode === 'invoices' && <Btn variant="primary" size="sm" onClick={openCreate}>+ New Invoice</Btn>}
        </>}
      />

      {viewMode === 'analytics' ? (
        <AnalyticsView allInvoices={allInvoices} companies={companies} cid={cid} />
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="p-5 flex flex-col gap-4">

          {/* Summary row 1 — status cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Collected',      value: fmtL(collected),            sub: `${activeInvs.filter(i=>i.status==='PAID').length} paid`,                                    color: 'text-emerald-600', border: 'border-emerald-200', icon: '₹'  },
              { label: 'Pending',        value: fmtL(pending),              sub: `Draft + Sent + Partial`,                                                                    color: 'text-blue-600',    border: 'border-blue-200',    icon: '⏳' },
              { label: 'Overdue',        value: fmtL(overdue),              sub: `${activeInvs.filter(i=>i.status==='SENT'&&i.dueDate&&new Date(i.dueDate)<new Date()).length} invoices`, color: 'text-red-600',     border: 'border-red-200',     icon: '!'  },
              { label: 'TDS Deducted',   value: fmtL(totalTds),             sub: `${tdsInvoices.length} invoice${tdsInvoices.length!==1?'s':''}`,                             color: 'text-purple-600',  border: 'border-purple-200',  icon: 'T'  },
              { label: 'Total Invoices', value: String(activeInvs.length),  sub: `excl. ${allInvoices.filter(i=>i.status==='CANCELLED').length} cancelled`,                   color: 'text-slate-700',   border: 'border-slate-200',   icon: '#'  },
            ].map((s, i) => (
              <div key={i} className={`bg-white border ${s.border} rounded-xl px-4 py-3 flex items-center gap-3`}>
                <div className="w-9 h-9 rounded-xl bg-slate-50 flex items-center justify-center text-sm font-bold text-slate-500 flex-shrink-0">{s.icon}</div>
                <div className="min-w-0">
                  <div className="text-xs text-slate-400 font-medium">{s.label}</div>
                  <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                  <div className="text-[10px] text-slate-400 mt-0.5 truncate">{s.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Summary row 2 — revenue breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col gap-1">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Subtotal (Taxable)</div>
              <div className="text-2xl font-bold text-slate-800">{fmtL(totalSubtotal)}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">Before GST</span>
                <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full font-medium">{activeInvs.length} invoices</span>
              </div>
            </div>
            <div className="bg-white border border-indigo-100 rounded-xl px-5 py-4 flex flex-col gap-1">
              <div className="text-xs text-indigo-400 font-semibold uppercase tracking-wider">Total GST</div>
              <div className="text-2xl font-bold text-indigo-600">{fmtL(totalTax)}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-slate-400">Effective rate</span>
                <span className="text-xs bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full font-medium">{totalSubtotal > 0 ? ((totalTax / totalSubtotal) * 100).toFixed(1) : 0}%</span>
              </div>
            </div>
            <div className="rounded-xl px-5 py-4 flex flex-col gap-2 text-white" style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}>
              <div className="text-xs font-semibold uppercase tracking-wider text-blue-200">Total Revenue</div>
              <div className="text-2xl font-bold">{fmtL(totalRevenue)}</div>
              <div className="flex flex-col gap-1 mt-0.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-blue-200">Collected (Cash)</span>
                  <span className="font-semibold text-emerald-300">{fmtL(collected)}</span>
                </div>
                {totalTds > 0 && (
                  <div className="flex justify-between">
                    <span className="text-blue-200">TDS Deducted</span>
                    <span className="font-semibold text-purple-300">{fmtL(totalTds)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-white/20 pt-1 mt-0.5">
                  <span className="text-blue-200">Pending</span>
                  <span className="font-semibold text-amber-300">{fmtL(pending)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* TDS Section — company-wise + invoice-wise */}
          {totalTds > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

              {/* Company-wise TDS */}
              <Card className="p-0">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">Company-wise TDS</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">TDS deducted by clients · cancelled excluded</div>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-50 bg-slate-50">
                      <th className="text-left px-4 py-2 text-slate-400 font-semibold">Company</th>
                      <th className="text-center px-3 py-2 text-slate-400 font-semibold">Invoices</th>
                      <th className="text-right px-4 py-2 text-slate-400 font-semibold">TDS Amount</th>
                      <th className="text-right px-4 py-2 text-slate-400 font-semibold">% Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {companyTdsRows.map((row, i) => (
                      <tr key={i} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50">
                        <td className="px-4 py-2.5 font-semibold text-slate-700">{row.name}</td>
                        <td className="px-3 py-2.5 text-center text-slate-500">{row.count}</td>
                        <td className="px-4 py-2.5 text-right font-bold text-purple-700">{inr(row.tdsAmount)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-12 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-1.5 bg-purple-400 rounded-full" style={{ width: `${totalTds > 0 ? (row.tdsAmount / totalTds) * 100 : 0}%` }} />
                            </div>
                            <span className="text-slate-500 w-10 text-right">{totalTds > 0 ? `${((row.tdsAmount / totalTds) * 100).toFixed(1)}%` : '—'}</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-purple-50 border-t-2 border-purple-100">
                      <td className="px-4 py-2.5 font-bold text-slate-700">Total</td>
                      <td className="px-3 py-2.5 text-center font-bold text-slate-700">{tdsInvoices.length}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-purple-800">{inr(totalTds)}</td>
                      <td className="px-4 py-2.5 text-right font-bold text-slate-600">100%</td>
                    </tr>
                  </tfoot>
                </table>
              </Card>

              {/* Invoice-wise TDS */}
              <Card className="p-0">
                <div className="px-4 py-3 border-b border-slate-100">
                  <div className="text-xs font-bold text-slate-900">Invoice-wise TDS</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">{tdsInvoices.length} invoice{tdsInvoices.length !== 1 ? 's' : ''} with TDS deduction</div>
                </div>
                <div className="overflow-x-auto max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white z-10">
                      <tr className="border-b border-slate-50 bg-slate-50">
                        <th className="text-left px-4 py-2 text-slate-400 font-semibold">Invoice</th>
                        {cid === 'ALL' && <th className="text-left px-3 py-2 text-slate-400 font-semibold">Company</th>}
                        <th className="text-left px-3 py-2 text-slate-400 font-semibold">Client</th>
                        <th className="text-right px-3 py-2 text-slate-400 font-semibold">Invoice Total</th>
                        <th className="text-right px-4 py-2 text-slate-400 font-semibold">TDS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tdsInvoices.map((inv: any) => (
                        <tr key={inv.invoiceId} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50">
                          <td className="px-4 py-2.5">
                            <button onClick={() => setPreviewInv(inv)} className="font-mono font-bold text-indigo-600 hover:underline text-[11px]">{inv.invoiceNumber}</button>
                            <div className="text-[10px] text-slate-400">{inr(inv.grandTotal)}</div>
                          </td>
                          {cid === 'ALL' && (
                            <td className="px-3 py-2.5">
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700">{inv._companyName}</span>
                            </td>
                          )}
                          <td className="px-3 py-2.5 text-slate-600 max-w-[120px] truncate">{inv.clientName}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700 font-medium">{inr(inv.grandTotal)}</td>
                          <td className="px-4 py-2.5 text-right">
                            <div className="font-bold text-purple-700">{inr(inv.tdsAmount)}</div>
                            <div className="text-[10px] text-slate-400">{inv.tdsRate}%</div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

            </div>
          )}

          {/* Tabs + cancelled toggle */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl flex-wrap">
              {TABS.map(t => {
                const count = t.key === 'ALL' ? visibleInvoices.length : visibleInvoices.filter(t.fn).length;
                return (
                  <button key={t.key} onClick={() => setTab(t.key)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 ${tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                    {t.label}
                    {count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${tab === t.key ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-500'}`}>{count}</span>}
                  </button>
                );
              })}
            </div>
            {/* Cancelled toggle */}
            {cancelledCount > 0 && (
              <button onClick={() => { setShowCancelled(p => !p); if (tab === 'CANCELLED') setTab('ALL'); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${showCancelled ? 'bg-slate-200 border-slate-300 text-slate-700' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600'}`}>
                🚫 Cancelled
                <span className="px-1.5 py-0.5 rounded-full bg-slate-300 text-slate-600 text-[10px] font-bold">{cancelledCount}</span>
                <span className="text-[10px] opacity-70">{showCancelled ? 'Hide' : 'Show'}</span>
              </button>
            )}
          </div>

          {/* Table */}
          <Card className="p-0">
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
                      {(cid === 'ALL' ? ['Company', 'Invoice #', 'Bill To', 'Amount', 'Status', 'Due Date', 'Payment', 'Actions'] : ['Invoice #', 'Bill To', 'Amount', 'Status', 'Due Date', 'Payment', 'Actions']).map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map((inv: any) => {
                      const isOverdue = inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < new Date();
                      const displayS  = isOverdue ? 'OVERDUE' : inv.status;
                      const balance   = (inv.grandTotal || 0) - (inv.paidAmount || 0);
                      const invCid    = inv._companyId || cid;
                      const ROW_BG: Record<string,string> = {
                        PAID: 'rgba(22,163,74,0.05)', OVERDUE: 'rgba(220,38,38,0.05)',
                        CANCELLED: 'rgba(148,163,184,0.07)', PARTIAL: 'rgba(217,119,6,0.05)',
                        SENT: 'rgba(37,99,235,0.04)', DRAFT: 'transparent',
                      };
                      return (
                        <tr key={inv.invoiceId} className="border-b border-slate-100 hover:brightness-[0.97] transition-colors group" style={{ background: ROW_BG[displayS] || 'transparent' }}>
                          {/* Company (only in ALL mode) */}
                          {cid === 'ALL' && (
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 whitespace-nowrap">{inv._companyName}</span>
                            </td>
                          )}
                          {/* Invoice # */}
                          <td className="px-4 py-3">
                            <button onClick={() => setPreviewInv(inv)} className="font-mono font-bold text-indigo-600 hover:underline">{inv.invoiceNumber}</button>
                            <div className="text-xs text-slate-400 mt-0.5">{dateStr(inv.invoiceDate || inv.createdAt)}</div>
                          </td>
                          {/* Bill To */}
                          <td className="px-4 py-3" style={{ maxWidth: 180 }}>
                            <button onClick={() => openClientHistory(inv.clientName, invCid)} className="font-semibold text-slate-800 hover:text-indigo-600 truncate block text-left w-full transition-colors" title="View client history">{inv.clientName}</button>
                            {inv.clientGst   && <div className="text-xs text-slate-400 font-mono">GST: {inv.clientGst}</div>}
                            {inv.clientEmail && <div className="text-xs text-indigo-400 truncate">{inv.clientEmail}</div>}
                            {inv.clientPhone && <div className="text-xs text-slate-400">{inv.clientPhone}</div>}
                          </td>
                          {/* Amount */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-900 text-sm">{inr(inv.grandTotal)}</div>
                            {(inv.subtotal > 0 || inv.totalGst > 0) && (
                              <div className="text-xs text-slate-400 mt-0.5 flex gap-2">
                                {inv.subtotal > 0 && <span>Sub {inr(inv.subtotal)}</span>}
                                {inv.totalGst > 0 && <span className="text-indigo-400">+GST {inr(inv.totalGst)}</span>}
                              </div>
                            )}
                            {inv.tdsAmount > 0 && (
                              <div className="text-xs text-purple-500 mt-0.5 font-medium">TDS {inr(inv.tdsAmount)} ({inv.tdsRate}%)</div>
                            )}
                            {inv.status === 'PAID' && <div className="text-xs text-emerald-500 font-medium mt-0.5">✓ Fully Paid</div>}
                            {inv.status === 'PARTIAL' && balance > 0 && <div className="text-xs text-amber-500 mt-0.5">Due {inr(balance)}</div>}
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
                                {inv.paidAt && (
                                  <div className="text-xs text-emerald-600 font-medium flex items-center gap-1 mt-0.5">
                                    <span>Received:</span>
                                    <span>{dateStr(inv.paidAt)}</span>
                                  </div>
                                )}
                                {inv.tdsAmount > 0 && (
                                  <div className="text-xs text-purple-600 font-semibold mt-0.5 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400 inline-block flex-shrink-0" />
                                    TDS: {inr(inv.tdsAmount)}
                                  </div>
                                )}
                              </div>
                            ) : <span className="text-xs text-slate-300">—</span>}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {inv.status !== 'DRAFT' && (
                                <button onClick={() => setPreviewInv(inv)} title="Preview & Download"
                                  className="px-2.5 py-1.5 text-xs bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100 transition-colors whitespace-nowrap">PDF</button>
                              )}

                              {!['PAID','CANCELLED'].includes(inv.status) && (
                                <button onClick={() => setPaidInv(inv)} title="Mark Paid"
                                  className="px-2.5 py-1.5 text-xs bg-emerald-50 text-emerald-600 rounded-lg font-semibold hover:bg-emerald-100 transition-colors whitespace-nowrap">Paid</button>
                              )}

                              {(isSuperAdmin || inv.status !== 'CANCELLED') && (
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

          {/* Load-more indicator */}
          {loadingMore && (
            <div className="flex items-center justify-center gap-2 py-3">
              <svg className="animate-spin w-4 h-4 text-indigo-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
              <span className="text-xs text-slate-400">Loading more invoices…</span>
            </div>
          )}
          {!loadingMore && !hasMore && allInvoices.length > 0 && (
            <div className="text-center text-xs text-slate-300 py-2">— All {allInvoices.length} invoices loaded —</div>
          )}

          {/* Analytics hint */}
          {allInvoices.length > 0 && (
            <div className="flex items-center justify-between bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
              <div className="text-xs text-indigo-700 font-medium">View FY-wise revenue, client breakdown, GST analysis, and download reports</div>
              <button onClick={() => setViewMode('analytics')}
                className="text-xs font-semibold text-indigo-600 bg-white border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-50 transition-colors whitespace-nowrap">
                Open Analytics →
              </button>
            </div>
          )}

        </div>
        </div>
      )}

      {/* ── Client History Panel ── */}
      {clientFilter && (
        <div className="fixed inset-0 z-40 flex" onClick={() => setClientFilter(null)}>
          <div className="ml-auto w-full max-w-2xl h-full bg-white shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm flex-shrink-0">
                  {clientFilter.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div className="font-bold text-slate-900 text-sm">{clientFilter}</div>
                  <div className="text-xs text-slate-400">Invoice History</div>
                </div>
              </div>
              <button onClick={() => setClientFilter(null)} className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm font-bold transition-colors">✕</button>
            </div>

            {clientLoading ? (
              <div className="flex-1 flex items-center justify-center gap-2">
                <svg className="animate-spin w-5 h-5 text-indigo-500" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>
                <span className="text-xs text-slate-400">Loading history…</span>
              </div>
            ) : (
              <>
                {clientInvs.length > 0 && (() => {
                  // Exclude cancelled from all calculations
                  const activeCI   = clientInvs.filter(i => i.status !== 'CANCELLED');
                  const cancelledCI = clientInvs.filter(i => i.status === 'CANCELLED');
                  const total      = activeCI.reduce((a, i) => a + (i.grandTotal || 0), 0);
                  const collected  = activeCI.reduce((a, i) => a + (i.paidAmount  || 0), 0);
                  const tdsTotal   = activeCI.reduce((a, i) => a + (i.tdsAmount   || 0), 0);
                  const sub        = activeCI.reduce((a, i) => a + (i.subtotal    || 0), 0);
                  const gst        = activeCI.reduce((a, i) => a + (i.totalGst    || 0), 0);
                  const pending    = activeCI
                    .filter(i => ['DRAFT','SENT','PARTIAL'].includes(i.status))
                    .reduce((a, i) => {
                      if (i.status === 'DRAFT') return a + (i.grandTotal || 0);
                      return a + Math.max(0, (i.grandTotal || 0) - (i.paidAmount || 0) - (i.tdsAmount || 0));
                    }, 0);

                  // Company-wise TDS
                  const coTdsMap: Record<string, { name: string; tdsAmount: number; count: number }> = {};
                  activeCI.filter(i => (i.tdsAmount || 0) > 0).forEach(i => {
                    const key  = i._companyId || clientHistCid;
                    const name = i._companyName || companies.find((c: any) => c.companyId === key)?.name || 'Company';
                    if (!coTdsMap[key]) coTdsMap[key] = { name, tdsAmount: 0, count: 0 };
                    coTdsMap[key].tdsAmount += i.tdsAmount || 0;
                    coTdsMap[key].count     += 1;
                  });
                  const coTdsRows = Object.values(coTdsMap).sort((a, b) => b.tdsAmount - a.tdsAmount);

                  return (
                    <>
                      {/* Stats cards */}
                      <div className="grid grid-cols-3 gap-2 px-6 py-4 border-b border-slate-50 flex-shrink-0">
                        {[
                          { label: 'Total Revenue', value: inr(total),     color: 'text-slate-800',    note: `${activeCI.length} invoices` },
                          { label: 'Collected',      value: inr(collected), color: 'text-emerald-600',  note: `${activeCI.filter(i=>i.status==='PAID').length} paid` },
                          { label: 'Pending',        value: inr(pending),   color: 'text-amber-600',    note: 'Draft + Sent + Partial' },
                          { label: 'Total GST',      value: inr(gst),       color: 'text-indigo-600',   note: `Sub ${inr(sub)}` },
                          { label: 'TDS Deducted',   value: inr(tdsTotal),  color: 'text-purple-600',   note: `${activeCI.filter(i=>(i.tdsAmount||0)>0).length} invoices` },
                          { label: 'Cancelled',      value: String(cancelledCI.length), color: 'text-slate-400', note: 'excluded from totals' },
                        ].map(s => (
                          <div key={s.label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                            <div className="text-[10px] text-slate-400 mb-0.5">{s.label}</div>
                            <div className={`text-sm font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-[10px] text-slate-400 mt-0.5">{s.note}</div>
                          </div>
                        ))}
                      </div>

                      {/* Company-wise TDS (only when TDS exists) */}
                      {tdsTotal > 0 && (
                        <div className="px-6 py-3 border-b border-slate-50 flex-shrink-0">
                          <div className="text-xs font-bold text-slate-700 mb-2">Company-wise TDS</div>
                          <div className="flex flex-col gap-1.5">
                            {coTdsRows.map((row, i) => (
                              <div key={i} className="flex items-center gap-3 text-xs">
                                <span className="font-medium text-slate-600 flex-1 truncate">{row.name}</span>
                                <span className="text-slate-400">{row.count} inv.</span>
                                <span className="font-bold text-purple-700 w-24 text-right">{inr(row.tdsAmount)}</span>
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                                  <div className="h-1.5 bg-purple-400 rounded-full" style={{ width: `${tdsTotal > 0 ? (row.tdsAmount / tdsTotal) * 100 : 0}%` }} />
                                </div>
                                <span className="text-slate-400 w-10 text-right">{tdsTotal > 0 ? `${((row.tdsAmount / tdsTotal) * 100).toFixed(0)}%` : '—'}</span>
                              </div>
                            ))}
                            <div className="flex items-center gap-3 text-xs border-t border-slate-100 pt-1.5 mt-0.5">
                              <span className="font-bold text-slate-700 flex-1">Total TDS</span>
                              <span className="font-bold text-purple-800 w-24 text-right">{inr(tdsTotal)}</span>
                              <div className="w-16 flex-shrink-0" />
                              <span className="w-10" />
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* Invoice list */}
                <div className="flex-1 overflow-y-auto">
                  {clientInvs.length === 0 ? (
                    <div className="py-16 text-center text-slate-400 text-sm">No invoices found for this client</div>
                  ) : (
                    <table className="w-full text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-50 z-10">
                        <tr className="border-b border-slate-100">
                          {['Invoice #', 'Date', 'Amount', 'TDS', 'Status', 'Due Date', cid === 'ALL' ? 'Company' : '', ''].filter(Boolean).map(h => (
                            <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {clientInvs.map((inv: any) => {
                          const isCancelled = inv.status === 'CANCELLED';
                          const isOverdue   = inv.status === 'SENT' && inv.dueDate && new Date(inv.dueDate) < new Date();
                          const displayS    = isOverdue ? 'OVERDUE' : inv.status;
                          return (
                            <tr key={inv.invoiceId} className={`border-b border-slate-50 transition-colors ${isCancelled ? 'opacity-40 bg-slate-50/60' : 'hover:bg-indigo-50/20'}`}>
                              <td className="px-3 py-2.5">
                                <button onClick={() => { setClientFilter(null); setTimeout(() => setPreviewInv(inv), 50); }}
                                  className={`font-mono font-bold hover:underline text-[11px] ${isCancelled ? 'text-slate-400 line-through' : 'text-indigo-600'}`}>
                                  {inv.invoiceNumber}
                                </button>
                              </td>
                              <td className="px-3 py-2.5 text-slate-500 whitespace-nowrap">{dateStr(inv.invoiceDate || inv.createdAt)}</td>
                              <td className="px-3 py-2.5">
                                <div className={`font-bold ${isCancelled ? 'text-slate-400 line-through' : 'text-slate-900'}`}>{inr(inv.grandTotal)}</div>
                                {inv.totalGst > 0 && !isCancelled && <div className="text-[10px] text-indigo-400">+GST {inr(inv.totalGst)}</div>}
                                {inv.paidAmount > 0 && !isCancelled && <div className="text-[10px] text-emerald-500">Paid {inr(inv.paidAmount)}</div>}
                              </td>
                              <td className="px-3 py-2.5">
                                {(inv.tdsAmount || 0) > 0 && !isCancelled ? (
                                  <div>
                                    <div className="font-semibold text-purple-700">{inr(inv.tdsAmount)}</div>
                                    <div className="text-[10px] text-slate-400">{inv.tdsRate}%</div>
                                  </div>
                                ) : <span className="text-slate-300">—</span>}
                              </td>
                              <td className="px-3 py-2.5"><Badge s={displayS} /></td>
                              <td className="px-3 py-2.5">
                                <div className={`text-xs ${isOverdue ? 'text-red-600 font-bold' : 'text-slate-500'}`}>{dateStr(inv.dueDate)}</div>
                              </td>
                              {cid === 'ALL' && (
                                <td className="px-3 py-2.5">
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 whitespace-nowrap">{inv._companyName}</span>
                                </td>
                              )}
                              <td className="px-3 py-2.5">
                                {!isCancelled && (
                                  <div className="flex gap-1">
                                    {inv.status !== 'DRAFT' && (
                                      <button onClick={() => { setClientFilter(null); setTimeout(() => setPreviewInv(inv), 50); }}
                                        className="px-2 py-1 text-[10px] bg-indigo-50 text-indigo-600 rounded-lg font-semibold hover:bg-indigo-100">PDF</button>
                                    )}
                                    {!['PAID','CANCELLED'].includes(inv.status) && (
                                      <button onClick={() => { setClientFilter(null); setTimeout(() => setPaidInv(inv), 50); }}
                                        className="px-2 py-1 text-[10px] bg-emerald-50 text-emerald-600 rounded-lg font-semibold hover:bg-emerald-100">Paid</button>
                                    )}
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      {/* Footer totals — active only */}
                      {clientInvs.filter(i => i.status !== 'CANCELLED').length > 0 && (() => {
                        const activeCI = clientInvs.filter(i => i.status !== 'CANCELLED');
                        const footTotal = activeCI.reduce((a, i) => a + (i.grandTotal || 0), 0);
                        const footTds   = activeCI.reduce((a, i) => a + (i.tdsAmount  || 0), 0);
                        const footPaid  = activeCI.reduce((a, i) => a + (i.paidAmount || 0), 0);
                        return (
                          <tfoot>
                            <tr className="bg-slate-50 border-t-2 border-slate-200 font-semibold text-xs">
                              <td className="px-3 py-2.5 text-slate-600">Total ({activeCI.length})</td>
                              <td className="px-3 py-2.5 text-slate-400">excl. cancelled</td>
                              <td className="px-3 py-2.5 font-bold text-slate-800">{inr(footTotal)}</td>
                              <td className="px-3 py-2.5 font-bold text-purple-700">{footTds > 0 ? inr(footTds) : '—'}</td>
                              <td colSpan={cid === 'ALL' ? 4 : 3} className="px-3 py-2.5 text-emerald-700">{inr(footPaid)} paid</td>
                            </tr>
                          </tfoot>
                        );
                      })()}
                    </table>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {previewInv && <PdfModal    inv={previewInv} cid={previewInv._companyId || cid} onClose={() => setPreviewInv(null)} />}
      {paidInv    && <PaidModal   inv={paidInv}    cid={paidInv._companyId    || cid} onClose={() => setPaidInv(null)}   onDone={loadInvoices} />}
      {editInv    && <EditModal   inv={editInv}    cid={editInv._companyId    || cid} onClose={() => setEditInv(null)}   onDone={loadInvoices} isSuperAdmin={isSuperAdmin} />}
      {cancelInv  && <CancelModal inv={cancelInv}  cid={cancelInv._companyId  || cid} onClose={() => setCancelInv(null)} onDone={loadInvoices} />}

      {/* ── Create Invoice ── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Invoice" size="xl"
        footer={<><Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create Invoice</Btn></>}>
        <div className="flex flex-col gap-4">

          {/* Billing Company selector (ALL mode) or profile preview (single mode) */}
          {cid === 'ALL' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-slate-600">Billing Company *</label>
              <select value={createCo} onChange={e => setCreateCo(e.target.value)}
                className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-indigo-400 bg-white">
                <option value="">— Select company to invoice from —</option>
                {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </select>
            </div>
          ) : coProfile?.name && (
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Invoice Date" type="date" value={form.invoiceDate} onChange={e => setForm(f => ({ ...f, invoiceDate: e.target.value }))} />
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
                    const gst   = it.gstPercent != null ? Math.round(after * it.gstPercent / 100) : 0;
                    return (
                      <tr key={i} className="border-b border-slate-50 last:border-none">
                        <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-blue-400 outline-none" value={it.description} onChange={e => updItem(i,'description',e.target.value)} placeholder="Item description"/></td>
                        <td className="px-2 py-1.5"><input className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 font-mono focus:border-blue-400 outline-none" value={it.hsnCode||''} onChange={e => updItem(i,'hsnCode',e.target.value)} placeholder="998311"/></td>
                        <td className="px-2 py-1.5"><input type="number" min="1" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-center focus:border-blue-400 outline-none" value={it.quantity} onChange={e => updItem(i,'quantity',+e.target.value||1)}/></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.unitPrice} onChange={e => updItem(i,'unitPrice',+e.target.value||0)}/></td>
                        <td className="px-2 py-1.5"><select className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 outline-none" value={it.gstPercent ?? ''} onChange={e => updItem(i,'gstPercent', e.target.value === '' ? null : +e.target.value)}><option value="">No GST</option>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                        <td className="px-2 py-1.5"><input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 text-right focus:border-blue-400 outline-none" value={it.discount||0} onChange={e => updItem(i,'discount',+e.target.value||0)}/></td>
                        <td className="px-2 py-1.5 text-right">
                          <div className="text-xs font-bold text-slate-800">{inr(after+gst)}</div>
                          {gst > 0 && <div className="text-xs text-slate-400">GST {inr(gst)}</div>}
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
                {Object.entries(formGstByRate).filter(([, amt]) => (amt as number) > 0).map(([rate, amt]) => (
                  <div key={rate} className="flex justify-between py-1.5 border-b border-slate-100 text-slate-500"><span>GST @ {rate}%</span><span className="font-medium">{inr(amt as number)}</span></div>
                ))}
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
