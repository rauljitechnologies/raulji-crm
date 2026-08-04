'use client';
import { useEffect, useState, useRef } from 'react';
import { invoiceApi, userApi } from '@/lib/api';
import { Btn, Input, Sel, useToast, Avatar, UIIcons } from '@/components/ui';

/* ══════════════════════════════════════════════════════════════
   Invoices — shared helpers, status badge, modals and charts.
   All business logic is unchanged; presentation runs on the
   design-token system (light + dark).
   ══════════════════════════════════════════════════════════════ */

export const API     = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export const tok     = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '');
export const inr     = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
export const BLANK   = () => ({ description: '', hsnCode: '', quantity: 1, unitPrice: 0, gstPercent: 18, discount: 0 });
export const dateStr = (d?: string) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ─── Status badge (semantic tokens, dark-mode aware) ──────────
const STATUS_TOKENS: Record<string, { bg: string; fg: string; strike?: boolean }> = {
  DRAFT:     { bg: 'var(--surface-2)',    fg: 'var(--text-2)' },
  SENT:      { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  PAID:      { bg: 'var(--success-soft)', fg: 'var(--success-ink)' },
  PARTIAL:   { bg: 'var(--warning-soft)', fg: 'var(--warning-ink)' },
  OVERDUE:   { bg: 'var(--danger-soft)',  fg: 'var(--danger-ink)' },
  CANCELLED: { bg: 'var(--surface-2)',    fg: 'var(--text-3)', strike: true },
};
export function StatusBadge({ s }: { s: string }) {
  const c = STATUS_TOKENS[s] || STATUS_TOKENS.DRAFT;
  return (
    <span style={{
      background: c.bg, color: c.fg,
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2.5px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600,
      letterSpacing: '0.01em', whiteSpace: 'nowrap', textTransform: 'capitalize',
      boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.08)',
      textDecoration: c.strike ? 'line-through' : 'none',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg, flexShrink: 0 }} />
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Shared modal shell ───────────────────────────────────────
export function Sheet({ onClose, maxWidth, children, height }: { onClose: () => void; maxWidth: number; children: React.ReactNode; height?: string }) {
  return (
    <div className="lux-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(11,17,32,0.5)', backdropFilter: 'blur(6px)' }} onClick={onClose}>
      <div className="lux-modal-panel w-full flex flex-col overflow-hidden"
        style={{ maxWidth, height, maxHeight: '93vh', background: 'var(--surface)', borderRadius: 20, border: '1px solid var(--border)', boxShadow: 'var(--shadow-xl)' }}
        onClick={e => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function SheetClose({ onClose }: { onClose: () => void }) {
  return (
    <button onClick={onClose} aria-label="Close" className="flex items-center justify-center transition-all hover:bg-[var(--surface-2)]"
      style={{ width: 30, height: 30, borderRadius: 10, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
      {UIIcons.x(14)}
    </button>
  );
}

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'block' };
const sectionLbl: React.CSSProperties = { fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 };

// ─── PDF Preview + Download modal ────────────────────────────
export function PdfModal({ inv, cid, onClose }: { inv: any; cid: string; onClose: () => void }) {
  const isDraft = inv.status === 'DRAFT';
  const [loading,       setLoading]       = useState(false);
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [iframeSrc,     setIframeSrc]     = useState('');
  const [iframeLoading, setIframeLoading] = useState(true);
  const blobUrlRef = useRef('');
  const viewUrl = `${API}/companies/${cid}/invoices/${inv.invoiceId}/view`;

  // Partially-paid invoices can be downloaded as the original (full amount)
  // or as the balance-due version (shows Amount Paid + Balance Due).
  // Applies to any invoice carrying an outstanding balance, drafts included.
  const paidAmt    = inv.paidAmount || 0;
  const balanceDue = (inv.grandTotal || 0) - paidAmt;
  const hasBalance = paidAmt > 0 && balanceDue > 0;

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

  const download = async (original = false) => {
    setMenuOpen(false);
    setLoading(true);
    const qs  = original ? '?original=1' : '';
    try {
      const r    = await fetch(`${API}/companies/${cid}/invoices/${inv.invoiceId}/pdf${qs}`, { headers: { Authorization: `Bearer ${tok()}` } });
      const blob = await r.blob();
      if (blob.type === 'application/pdf') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${inv.invoiceNumber}${original ? '_ORIGINAL' : ''}.pdf`;
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
        const r = await fetch(viewUrl + qs, { headers: { Authorization: `Bearer ${tok()}` } });
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
    <Sheet onClose={onClose} maxWidth={860} height="93vh">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 flex-shrink-0 gap-3" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center font-bold text-sm flex-shrink-0"
            style={{ width: 36, height: 36, borderRadius: 12, background: 'var(--grad-brand)', color: '#fff' }}>₹</div>
          <div className="min-w-0">
            <div className="font-bold truncate" style={{ fontSize: 13.5, color: 'var(--text)' }}>{inv.invoiceNumber}</div>
            <div className="truncate" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{inv.clientName} · {inr(inv.grandTotal)}</div>
          </div>
          <StatusBadge s={inv.status} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Btn variant="secondary" size="sm" onClick={print}>Print</Btn>
          {hasBalance ? (
            <div style={{ position: 'relative' }}>
              <Btn variant="primary" size="sm" loading={loading} onClick={() => setMenuOpen(o => !o)}>
                Download PDF ▾
              </Btn>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div className="z-50" style={{
                    position: 'absolute', top: 'calc(100% + 6px)', right: 0, minWidth: 240,
                    background: 'var(--surface)', border: '1px solid var(--border)',
                    borderRadius: 12, boxShadow: 'var(--shadow-xl)', overflow: 'hidden', padding: 4,
                  }}>
                    <button onClick={() => download(true)} className="w-full text-left transition-colors hover:bg-[var(--surface-2)]"
                      style={{ padding: '9px 11px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Original Invoice</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Full amount · {inr(inv.grandTotal)}</div>
                    </button>
                    <button onClick={() => download(false)} className="w-full text-left transition-colors hover:bg-[var(--surface-2)]"
                      style={{ padding: '9px 11px', borderRadius: 8, background: 'none', border: 'none', cursor: 'pointer' }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text)' }}>Invoice with Balance Due</div>
                      <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>Balance {inr(balanceDue)} remaining</div>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <Btn variant="primary" size="sm" loading={loading} onClick={() => download(false)}>Download PDF</Btn>
          )}
          <SheetClose onClose={onClose} />
        </div>
      </div>

      {/* Draft banner */}
      {isDraft && (
        <div className="flex items-center gap-2 px-5 py-2 flex-shrink-0" style={{ background: 'var(--warning-soft)', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--warning-ink)' }}>Draft —</span>
          <span style={{ fontSize: 12.5, color: 'var(--warning-ink)', opacity: 0.85 }}>This is a preview of your draft invoice. Send or mark as paid to finalise.</span>
        </div>
      )}

      {/* Preview */}
      <div className="flex-1 overflow-hidden relative" style={{ background: 'var(--surface-3)' }}>
        {iframeLoading && (
          <div className="absolute inset-0 flex items-center justify-center z-10" style={{ background: 'var(--surface-2)' }}>
            <svg className="animate-spin w-6 h-6" style={{ color: 'var(--primary)' }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>
        )}
        {iframeSrc
          ? <iframe src={iframeSrc} className="w-full h-full border-none" title="Invoice Preview" onLoad={() => setIframeLoading(false)} style={{ background: '#fff' }} />
          : !iframeLoading && <div className="flex items-center justify-center h-full text-sm" style={{ color: 'var(--text-3)' }}>Unable to load preview</div>
        }
      </div>
    </Sheet>
  );
}

// ─── TDS rates ───────────────────────────────────────────────
export const TDS_RATES = [
  { label: '1% — Sec 194C (Small Contractor)',       value: 1   },
  { label: '2% — Sec 194C (Contractor/Sub-Contract)',value: 2   },
  { label: '5% — Sec 194J (Professional Services)',  value: 5   },
  { label: '10% — Sec 194J (Technical/Royalty)',     value: 10  },
  { label: '7.5% — Sec 194A (Interest)',             value: 7.5 },
  { label: '20% — Sec 194J (No PAN)',                value: 20  },
];

// ─── Mark Paid modal ─────────────────────────────────────────
export function PaidModal({ inv, cid, onClose, onDone }: any) {
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
      <Sheet onClose={onClose} maxWidth={448}>
        <div className="px-6 py-5 flex items-center gap-3 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center justify-center flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 13, background: 'var(--grad-green)', color: '#fff' }}>
            {UIIcons.check(18)}
          </div>
          <div>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Mark as Paid</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{inv.invoiceNumber} · Invoice Total {inr(inv.grandTotal)}</div>
          </div>
        </div>
        <div className="px-6 py-4 flex flex-col gap-3 overflow-y-auto">

          {/* TDS toggle */}
          <button
            type="button"
            onClick={() => handleTdsToggle(!tdsEnabled)}
            className="w-full flex items-center justify-between px-4 py-3 transition-all"
            style={{
              borderRadius: 14, cursor: 'pointer',
              border: `2px solid ${tdsEnabled ? 'var(--secondary)' : 'var(--border-strong)'}`,
              background: tdsEnabled ? 'var(--primary-soft)' : 'var(--surface-2)',
            }}>
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center transition-all"
                style={{ width: 20, height: 20, borderRadius: 7, border: `2px solid ${tdsEnabled ? 'var(--secondary)' : 'var(--border-strong)'}`, background: tdsEnabled ? 'var(--secondary)' : 'transparent' }}>
                {tdsEnabled && <svg viewBox="0 0 12 12" className="w-3 h-3"><path d="M1.5 6l3 3 6-6" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </div>
              <div className="text-left">
                <div style={{ fontSize: 13, fontWeight: 600, color: tdsEnabled ? 'var(--secondary)' : 'var(--text-2)' }}>TDS Deducted by Client</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Client deducted TDS before payment</div>
              </div>
            </div>
            {tdsEnabled && (
              <span className="flex-shrink-0" style={{ fontSize: 11, fontWeight: 700, color: 'var(--secondary)', background: 'var(--surface)', padding: '2px 8px', borderRadius: 9999, border: '1px solid var(--border)' }}>
                -{inr(tdsAmt)}
              </span>
            )}
          </button>

          {/* TDS details */}
          {tdsEnabled && (
            <div className="px-4 py-3 flex flex-col gap-2.5" style={{ background: 'var(--primary-soft)', border: '1px solid var(--primary-ring)', borderRadius: 14 }}>

              {/* Mode toggle: % vs Amount */}
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--secondary)', marginRight: 4 }}>Enter TDS as:</span>
                <div className="flex p-0.5 gap-0.5" style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 10 }}>
                  <button type="button" onClick={() => handleModeSwitch('percent')}
                    className="px-3 py-1 transition-all"
                    style={{ fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: tdsMode === 'percent' ? 'var(--grad-brand)' : 'transparent', color: tdsMode === 'percent' ? '#fff' : 'var(--text-2)' }}>
                    % Rate
                  </button>
                  <button type="button" onClick={() => handleModeSwitch('amount')}
                    className="px-3 py-1 transition-all"
                    style={{ fontSize: 11, fontWeight: 700, borderRadius: 8, cursor: 'pointer', border: 'none', background: tdsMode === 'amount' ? 'var(--grad-brand)' : 'transparent', color: tdsMode === 'amount' ? '#fff' : 'var(--text-2)' }}>
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
                          className="px-2 py-1.5 transition-all"
                          style={{
                            fontSize: 11, fontWeight: 700, borderRadius: 9, cursor: 'pointer',
                            background: isActive ? 'var(--grad-brand)' : 'var(--surface)',
                            color: isActive ? '#fff' : 'var(--text-2)',
                            border: `1px solid ${isActive ? 'transparent' : 'var(--border-strong)'}`,
                          }}>
                          {r.value}%
                        </button>
                      );
                    })}
                  </div>
                  {/* Custom % input */}
                  <div className="flex items-center gap-2">
                    <label style={{ fontSize: 11.5, color: 'var(--secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>Custom %</label>
                    <div className="relative flex-1">
                      <input
                        type="number" min="0" max="100" step="0.01"
                        value={tdsCustomRate}
                        onChange={e => handleCustomRateChange(e.target.value)}
                        placeholder={tdsCustomRate === '' ? String(tdsRate) : ''}
                        className="fld fld-xs"
                        style={{ paddingRight: 28, fontWeight: 700, ...(tdsCustomRate !== '' ? { borderColor: 'var(--secondary)' } : {}) }}
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2" style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 700 }}>%</span>
                    </div>
                    {tdsCustomRate !== '' && (
                      <button type="button" onClick={() => { setTdsCustomRate(''); handleTdsRateChange(tdsRate); }}
                        className="flex-shrink-0" style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕</button>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--secondary)' }}>
                    {tdsCustomRate !== ''
                      ? `Custom rate: ${tdsCustomRate}% → TDS = ${inr(tdsAmt)}`
                      : TDS_RATES.find(r => r.value === tdsRate)?.label}
                  </div>
                </>
              )}

              {/* Amount mode: direct input */}
              {tdsMode === 'amount' && (
                <div>
                  <label style={{ ...lbl, color: 'var(--secondary)' }}>TDS Amount (₹)</label>
                  <input
                    type="number" min="0" max={inv.grandTotal}
                    value={tdsCustomAmount}
                    onChange={e => handleCustomAmountChange(e.target.value)}
                    placeholder="Enter exact TDS amount deducted"
                    className="fld" style={{ fontWeight: 700 }}
                  />
                  {tdsAmt > 0 && inv.grandTotal > 0 && (
                    <div style={{ fontSize: 11, color: 'var(--secondary)', opacity: 0.8, marginTop: 4 }}>
                      = {((tdsAmt / inv.grandTotal) * 100).toFixed(2)}% of invoice total
                    </div>
                  )}
                </div>
              )}

              {/* TDS breakdown */}
              <div className="px-3 py-2" style={{ background: 'var(--surface)', borderRadius: 10, border: '1px solid var(--border)', fontSize: 11.5 }}>
                <div className="flex justify-between py-0.5" style={{ color: 'var(--text-2)' }}>
                  <span>Invoice Total</span><span style={{ fontWeight: 600 }}>{inr(inv.grandTotal)}</span>
                </div>
                <div className="flex justify-between py-0.5" style={{ color: 'var(--danger-ink)' }}>
                  <span>TDS {tdsMode === 'percent' ? `@ ${tdsRate}%` : '(entered)'}</span>
                  <span style={{ fontWeight: 600 }}>- {inr(tdsAmt)}</span>
                </div>
                <div className="flex justify-between py-1 mt-0.5" style={{ borderTop: '1px solid var(--border)', color: 'var(--success-ink)', fontWeight: 700 }}>
                  <span>Amount to Receive</span><span>{inr(autoAmt)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Amount received */}
          <div>
            <label style={lbl}>
              Amount Received *
              {tdsEnabled && <span style={{ color: 'var(--secondary)', fontWeight: 500, marginLeft: 4 }}>(after TDS deduction)</span>}
            </label>
            <input type="number" value={f.paidAmount} onChange={e => setF(p => ({ ...p, paidAmount: e.target.value }))}
              className="fld" style={{ fontWeight: 700 }} placeholder="0.00" />
            {f.paidAmount && (
              <div className="flex items-center gap-1 mt-1.5" style={{ fontSize: 11.5, color: isFull ? 'var(--success-ink)' : 'var(--warning-ink)' }}>
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
            <label style={lbl}>Payment Method</label>
            <select value={f.paymentMethod} onChange={e => setF(p => ({ ...p, paymentMethod: e.target.value }))} className="fld">
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
            <label style={lbl}>Payment Received Date *</label>
            <input type="date" value={f.paymentDate} onChange={e => setF(p => ({ ...p, paymentDate: e.target.value }))} className="fld" />
          </div>
          <div>
            <label style={lbl}>Notes (optional)</label>
            <textarea rows={2} value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
              className="fld" style={{ resize: 'none', fontSize: 12 }} placeholder="Any payment notes..." />
          </div>
        </div>
        <div className="px-6 py-4 flex gap-2 justify-end flex-shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={save} style={{ background: 'var(--grad-green)' }}>Confirm Payment</Btn>
        </div>
      </Sheet>
      <ToastContainer />
    </>
  );
}

// ─── Edit Invoice modal ───────────────────────────────────────
export function EditModal({ inv, cid, onClose, onDone, isSuperAdmin }: any) {
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
      <Sheet onClose={onClose} maxWidth={768}>
        <div className="px-6 py-4 flex items-center justify-between flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)' }}>Edit Invoice — {inv.invoiceNumber}</div>
          <SheetClose onClose={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">
          {/* Admin controls — SUPER_ADMIN only */}
          {isSuperAdmin && (
            <div className="px-4 py-3 flex flex-col gap-3" style={{ borderRadius: 14, border: '1px solid var(--warning)', background: 'var(--warning-soft)' }}>
              <div className="flex items-center gap-2 mb-1">
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--warning-ink)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Admin Controls</span>
                <span style={{ fontSize: 10, background: 'var(--warning)', color: '#fff', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>Super Admin Only</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Input label="Invoice Number" value={f.invoiceNumber} onChange={e => setF(p => ({ ...p, invoiceNumber: e.target.value }))} placeholder="INV/2024-0001" />
                  {numPreview && (
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {numPreview.recent.length > 0 && (
                        <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                          <span style={{ fontWeight: 600 }}>Recent: </span>
                          {numPreview.recent.map((r, i) => (
                            <span key={i} className="font-mono">{r.invoiceNumber}{i < numPreview.recent.length - 1 ? ', ' : ''}</span>
                          ))}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                        <span style={{ fontWeight: 600 }}>Next auto: </span>
                        <span className="font-mono cursor-pointer hover:underline" style={{ color: 'var(--primary)' }} title="Click to use" onClick={() => setF(p => ({ ...p, invoiceNumber: numPreview.nextNumber }))}>{numPreview.nextNumber}</span>
                        <span style={{ color: 'var(--text-3)', marginLeft: 4 }}>(click to use)</span>
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
            <div style={sectionLbl}>Client Details</div>
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
              <div style={{ ...sectionLbl, marginBottom: 0 }}>Line Items</div>
              <button onClick={() => setF(p => ({ ...p, items: [...p.items, BLANK()] }))}
                style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer' }} className="hover:underline">+ Add Item</button>
            </div>
            <LineItemsTable items={f.items} updItem={updItem} removeItem={(i: number) => setF(p => ({ ...p, items: p.items.filter((_: any, idx: number) => idx !== i) }))} />
            <TotalsBlock subtotal={subtotal} gstByRate={gstByRate} grandTotal={grandTotal} />
          </div>
          {/* Notes */}
          <div>
            <label style={lbl}>Notes</label>
            <textarea rows={2} value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
              className="fld" style={{ resize: 'none', fontSize: 12 }} placeholder="Payment notes..." />
          </div>
        </div>
        <div className="px-6 py-4 flex gap-2 justify-end flex-shrink-0" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={save}>Save Changes</Btn>
        </div>
      </Sheet>
      <ToastContainer />
    </>
  );
}

// ─── Shared line-items table + totals (create & edit) ─────────
export function LineItemsTable({ items, updItem, removeItem }: { items: any[]; updItem: (i: number, k: string, v: any) => void; removeItem: (i: number) => void }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
      <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
        <colgroup><col width="27%"/><col width="10%"/><col width="7%"/><col width="12%"/><col width="9%"/><col width="10%"/><col width="15%"/><col width="28px"/></colgroup>
        <thead><tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
          {['Description','HSN/SAC','Qty','Rate (₹)','GST%','Disc.','Total',''].map(h => (
            <th key={h} style={{ textAlign: 'left', padding: '8px', fontSize: 11, fontWeight: 600, color: 'var(--text-3)' }}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {items.map((it: any, i: number) => {
            const after = it.quantity * it.unitPrice - (it.discount || 0);
            const gst   = it.gstPercent != null ? Math.round(after * it.gstPercent / 100) : 0;
            return (
              <tr key={i} style={{ borderBottom: i < items.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <td className="px-2 py-1.5"><input className="fld fld-xs" value={it.description} onChange={e => updItem(i,'description',e.target.value)} placeholder="Item description"/></td>
                <td className="px-2 py-1.5"><input className="fld fld-xs font-mono" value={it.hsnCode||''} onChange={e => updItem(i,'hsnCode',e.target.value)} placeholder="998311"/></td>
                <td className="px-2 py-1.5"><input type="number" min="1" className="fld fld-xs text-center" value={it.quantity} onChange={e => updItem(i,'quantity',+e.target.value||1)}/></td>
                <td className="px-2 py-1.5"><input type="number" min="0" className="fld fld-xs text-right" value={it.unitPrice} onChange={e => updItem(i,'unitPrice',+e.target.value||0)}/></td>
                <td className="px-2 py-1.5"><select className="fld fld-xs" value={it.gstPercent ?? ''} onChange={e => updItem(i,'gstPercent', e.target.value === '' ? null : +e.target.value)}><option value="">No GST</option>{[0,5,12,18,28].map(r=><option key={r} value={r}>{r}%</option>)}</select></td>
                <td className="px-2 py-1.5"><input type="number" min="0" className="fld fld-xs text-right" value={it.discount||0} onChange={e => updItem(i,'discount',+e.target.value||0)}/></td>
                <td className="px-2 py-1.5 text-right">
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{inr(after+gst)}</div>
                  {gst > 0 && <div style={{ fontSize: 10.5, color: 'var(--text-3)' }}>+{inr(gst)} GST</div>}
                </td>
                <td className="px-2 py-1.5 text-center">
                  {items.length > 1 && (
                    <button onClick={() => removeItem(i)}
                      className="flex items-center justify-center"
                      style={{ width: 20, height: 20, borderRadius: 7, background: 'var(--danger-soft)', color: 'var(--danger-ink)', border: 'none', cursor: 'pointer', fontSize: 12 }}>×</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TotalsBlock({ subtotal, gstByRate, grandTotal }: { subtotal: number; gstByRate: Record<number, number>; grandTotal: number }) {
  return (
    <div className="flex justify-end mt-2">
      <div style={{ width: 224, fontSize: 12 }}>
        <div className="flex justify-between py-1.5" style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}><span>Subtotal</span><span style={{ fontWeight: 500 }}>{inr(subtotal)}</span></div>
        {Object.entries(gstByRate).filter(([, amt]) => (amt as number) > 0).map(([rate, amt]) => (
          <div key={rate} className="flex justify-between py-1.5" style={{ color: 'var(--text-2)', borderBottom: '1px solid var(--border)' }}><span>GST @ {rate}%</span><span style={{ fontWeight: 500 }}>{inr(amt as number)}</span></div>
        ))}
        <div className="flex justify-between py-2.5 px-3 mt-1.5" style={{ borderRadius: 12, color: '#fff', fontWeight: 700, fontSize: 13, background: 'var(--grad-brand)' }}><span>Grand Total</span><span>{inr(grandTotal)}</span></div>
      </div>
    </div>
  );
}

// ─── Cancel confirm ───────────────────────────────────────────
export function CancelModal({ inv, cid, onClose, onDone }: any) {
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const go = async () => {
    setSaving(true);
    try { await invoiceApi.update(cid, inv.invoiceId, { status: 'CANCELLED' }); toast('Cancelled.'); setTimeout(() => { onDone(); onClose(); }, 600); }
    catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  };
  return (
    <>
      <Sheet onClose={onClose} maxWidth={384}>
        <div className="px-6 pt-6 pb-4 text-center">
          <div className="flex items-center justify-center mx-auto mb-3" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--danger-soft)', color: 'var(--danger-ink)', fontSize: 26, fontWeight: 800 }}>!</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Cancel Invoice?</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6 }}><strong>{inv.invoiceNumber}</strong> · {inv.clientName}<br/>{inr(inv.grandTotal)} will be cancelled. This cannot be undone.</div>
        </div>
        <div className="px-6 pb-6 flex gap-2">
          <Btn variant="secondary" onClick={onClose} className="flex-1 justify-center">Keep</Btn>
          <Btn variant="danger"    loading={saving} onClick={go} className="flex-1 justify-center">Yes, Cancel</Btn>
        </div>
      </Sheet>
      <ToastContainer />
    </>
  );
}

// ─── Assign Invoice modal (SUPER_ADMIN) — multi-user ──────────
export function AssignModal({ inv, cid, onClose, onDone }: any) {
  const [users,   setUsers]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [sel,     setSel]     = useState<string[]>(Array.isArray(inv.assignedUserIds) ? inv.assignedUserIds : []);
  const { toast, ToastContainer } = useToast();

  useEffect(() => {
    userApi.list(cid)
      .then((d: any) => setUsers(d.users || []))
      .catch((e: any) => toast(e.message, 'err'))
      .finally(() => setLoading(false));
  }, [cid]);

  const toggle = (uid: string) =>
    setSel(prev => prev.includes(uid) ? prev.filter(x => x !== uid) : [...prev, uid]);

  const go = async () => {
    setSaving(true);
    try {
      await invoiceApi.assign(cid, inv.invoiceId, sel);
      toast(sel.length ? `Assigned to ${sel.length} user(s).` : 'Invoice unassigned.');
      setTimeout(() => { onDone(); onClose(); }, 500);
    } catch (e: any) { toast(e.message, 'err'); setSaving(false); }
  };

  return (
    <>
      <Sheet onClose={onClose} maxWidth={384} height="auto">
        <div className="px-6 pt-6 pb-2 flex-shrink-0">
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Assign Invoice</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)' }}><strong>{inv.invoiceNumber}</strong> · {inv.clientName}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 4 }}>{sel.length} user(s) selected</div>
        </div>
        <div className="px-6 py-3 flex-1 overflow-y-auto" style={{ maxHeight: '48vh' }}>
          {loading ? (
            <div className="py-3 text-center" style={{ fontSize: 12, color: 'var(--text-3)' }}>Loading users…</div>
          ) : users.length === 0 ? (
            <div className="py-3 text-center" style={{ fontSize: 12, color: 'var(--text-3)' }}>No users in this company.</div>
          ) : (
            <div className="flex flex-col gap-1.5">
              {users.map((u: any) => {
                const checked = sel.includes(u.userId);
                return (
                  <label key={u.userId}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors"
                    style={{
                      borderRadius: 11,
                      border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`,
                      background: checked ? 'var(--primary-soft)' : 'transparent',
                    }}>
                    <input type="checkbox" checked={checked} onChange={() => toggle(u.userId)} style={{ accentColor: 'var(--primary)' }} />
                    <Avatar name={u.name} size={26} />
                    <div className="min-w-0">
                      <div className="truncate" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{u.name}</div>
                      <div className="truncate" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{u.email} · {u.role.replace(/_/g, ' ')}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
        <div className="px-6 pt-1 pb-3 flex-shrink-0">
          <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Selected users will see this invoice in their account and can edit it. Uncheck all to unassign.</p>
        </div>
        <div className="px-6 pb-6 flex gap-2 flex-shrink-0">
          <Btn variant="secondary" onClick={onClose} className="flex-1 justify-center">Cancel</Btn>
          <Btn variant="primary" loading={saving} disabled={loading} onClick={go} className="flex-1 justify-center">Save</Btn>
        </div>
      </Sheet>
      <ToastContainer />
    </>
  );
}

// ─── Chart Components (token-driven) ─────────────────────────

export function SimpleBarChart({ groups, colors, barNames, labels, valueFormatter, chartHeight = 180 }: {
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
            <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i] }} />
            <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{name}</span>
          </div>
        ))}
      </div>
      {/* Bars */}
      <div className="flex items-end gap-4" style={{ height: chartHeight }}>
        {groups.map((g, gi) => (
          <div key={gi} className="flex-1 flex items-end justify-center gap-0.5">
            {g.vals.map((v, vi) => {
              const pct = maxVal > 0 ? Math.max((v / maxVal) * 100, v > 0 ? 1 : 0) : 0;
              return (
                <div key={vi} title={`${barNames[vi]}: ${valueFormatter(v)}`}
                  className="flex-1 transition-all duration-500 cursor-default"
                  style={{ height: `${pct}%`, background: colors[vi], minHeight: v > 0 ? 3 : 0, maxWidth: 24, borderRadius: '4px 4px 0 0' }}
                />
              );
            })}
          </div>
        ))}
      </div>
      {/* Baseline */}
      <div style={{ height: 1, background: 'var(--chart-axis)', marginTop: 0 }} />
      {/* X labels */}
      <div className="flex gap-4 mt-1.5">
        {labels.map((l, i) => (
          <div key={i} className="flex-1 text-center truncate" style={{ fontSize: 10.5, color: 'var(--text-3)' }} title={l}>{l}</div>
        ))}
      </div>
    </div>
  );
}

export function MiniLineChart({ data, valueKey, labelKey, color = 'var(--chart-1)', height = 160 }: {
  data: Record<string, any>[];
  valueKey: string;
  labelKey: string;
  color?: string;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (data.length < 2) return (
    <div className="flex items-center justify-center text-sm" style={{ height, color: 'var(--text-3)' }}>Not enough data</div>
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

  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * W;
    let best = 0, bd = Infinity;
    pts.forEach((p, i) => { const d = Math.abs(p.x - mx); if (d < bd) { bd = d; best = i; } });
    setHover(best);
  };

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="xMidYMid meet"
        onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const y = PT + cH - (i / TICKS) * cH;
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={W - PR} y2={y} stroke={i === 0 ? 'var(--chart-axis)' : 'var(--chart-grid)'} strokeWidth="1" />
              <text x={PL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="var(--text-3)" style={{ fontVariantNumeric: 'tabular-nums' }}>{shortV((i / TICKS) * maxV)}</text>
            </g>
          );
        })}
        <path d={areaPath} fill={color} fillOpacity="0.1" />
        <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <g key={i}>
            {(hover === i || data.length <= 14) && <circle cx={p.x} cy={p.y} r={hover === i ? 4.5 : 3.5} fill={color} stroke="var(--surface)" strokeWidth="2" />}
            {(data.length <= 12 || i % Math.ceil(data.length / 12) === 0 || i === data.length - 1) && (
              <text x={p.x} y={H - 4} textAnchor="middle" fontSize="8.5" fill="var(--text-3)">{p.label}</text>
            )}
          </g>
        ))}
        {hover != null && <line x1={pts[hover].x} x2={pts[hover].x} y1={PT} y2={PT + cH} stroke="var(--chart-axis)" strokeWidth="1" />}
      </svg>
      {hover != null && (
        <div className="absolute pointer-events-none px-3 py-1.5"
          style={{
            left: `${(pts[hover].x / W) * 100}%`, top: 0,
            transform: pts[hover].x > W * 0.72 ? 'translateX(-108%)' : 'translateX(10px)',
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, boxShadow: 'var(--shadow-lg)', whiteSpace: 'nowrap',
          }}>
          <div style={{ fontSize: 10.5, color: 'var(--text-2)', fontWeight: 600 }}>{pts[hover].label}</div>
          <div className="flex items-center gap-1.5" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
            {inr(pts[hover].val)}
          </div>
        </div>
      )}
    </div>
  );
}

export function DonutChart({ segs }: { segs: { label: string; value: number; color: string }[] }) {
  const total = segs.reduce((a, s) => a + s.value, 0);
  const SIZE = 108;
  if (total === 0) return <div className="rounded-full mx-auto" style={{ width: SIZE, height: SIZE, background: 'var(--surface-2)' }} />;
  let cum = 0;
  const stops = segs.filter(s => s.value > 0).map(s => {
    const start = (cum / total) * 360;
    cum += s.value;
    const end = (cum / total) * 360;
    return `${s.color} ${start.toFixed(1)}deg ${end.toFixed(1)}deg`;
  });
  const innerSize = SIZE * 0.62;
  return (
    <div className="flex items-center gap-5">
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <div className="rounded-full" style={{ width: SIZE, height: SIZE, background: `conic-gradient(${stops.join(', ')})` }} />
        <div className="absolute rounded-full flex flex-col items-center justify-center"
          style={{ width: innerSize, height: innerSize, top: (SIZE - innerSize) / 2, left: (SIZE - innerSize) / 2, background: 'var(--surface)' }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{total}</div>
          <div style={{ fontSize: 10, color: 'var(--text-3)' }}>invoices</div>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 flex-1">
        {segs.filter(s => s.value > 0).map(s => (
          <div key={s.label} className="flex items-center gap-2">
            <div className="flex-shrink-0" style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
            <span className="flex-1" style={{ fontSize: 11.5, color: 'var(--text-2)' }}>{s.label}</span>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
