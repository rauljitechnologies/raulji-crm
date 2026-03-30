'use client';
import { useEffect, useState, useRef } from 'react';
import { companyApi, quotationApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, Input, Sel, Modal, useToast } from '@/components/ui';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('accessToken') || '';
}

// ── PDF Preview Modal ─────────────────────────────────────────────────────────
function PdfPreviewModal({ open, onClose, url }: { open: boolean; onClose: () => void; url: string }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 flex-shrink-0">
          <div className="text-sm font-bold text-slate-900">Document Preview</div>
          <div className="flex items-center gap-2">
            <a href={url.replace('/view', '/pdf')} target="_blank"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-lg transition-colors">
              ⬇ Download PDF
            </a>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200 text-sm">✕</button>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <iframe src={url} className="w-full h-full border-none" title="Document Preview" />
        </div>
      </div>
    </div>
  );
}

// ── Status badge colours ──────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  DRAFT:     'bg-slate-100 text-slate-500',
  SENT:      'bg-blue-50 text-blue-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  REJECTED:  'bg-red-50 text-red-600',
  EXPIRED:   'bg-amber-50 text-amber-700',
  CONVERTED: 'bg-violet-50 text-violet-700',
};

// ── Line item row ─────────────────────────────────────────────────────────────
function ItemRow({ item, idx, onChange, onRemove, canRemove }: any) {
  const afterDisc  = item.quantity * item.unitPrice - (item.discount || 0);
  const gstAmount  = Math.round(afterDisc * item.gstPercent / 100);
  const lineTotal  = afterDisc + gstAmount;
  return (
    <tr className="border-b border-slate-50 last:border-none">
      <td className="px-2 py-1.5">
        <input className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
          value={item.description} onChange={e => onChange(idx, 'description', e.target.value)} placeholder="Item description" />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" min="1" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-center focus:border-indigo-400"
          value={item.quantity} onChange={e => onChange(idx, 'quantity', +e.target.value || 1)} />
      </td>
      <td className="px-2 py-1.5">
        <input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-right focus:border-indigo-400"
          value={item.unitPrice} onChange={e => onChange(idx, 'unitPrice', +e.target.value || 0)} />
      </td>
      <td className="px-2 py-1.5">
        <select className="w-full text-xs border border-slate-200 rounded-lg px-1 py-1.5 focus:border-indigo-400"
          value={item.gstPercent} onChange={e => onChange(idx, 'gstPercent', +e.target.value)}>
          {[0,5,12,18,28].map(r => <option key={r} value={r}>{r}%</option>)}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input type="number" min="0" className="w-full text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-right focus:border-indigo-400"
          value={item.discount || 0} onChange={e => onChange(idx, 'discount', +e.target.value || 0)} />
      </td>
      <td className="px-2 py-1.5 text-right">
        <span className="text-xs font-bold text-slate-800">₹{lineTotal.toLocaleString('en-IN')}</span>
        <div className="text-xs text-slate-400">GST ₹{gstAmount.toLocaleString('en-IN')}</div>
      </td>
      <td className="px-2 py-1.5 text-center">
        {canRemove && (
          <button onClick={() => onRemove(idx)} className="w-6 h-6 rounded-full bg-red-50 text-red-400 hover:bg-red-100 hover:text-red-600 flex items-center justify-center text-sm transition-colors">×</button>
        )}
      </td>
    </tr>
  );
}

const BLANK_ITEM = () => ({ description: '', quantity: 1, unitPrice: 0, gstPercent: 18, discount: 0 });

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QuotationsPage() {
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [companyId,  setCompanyId]  = useState('');
  const [quotations, setQuotations] = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [previewUrl, setPreviewUrl] = useState('');
  const [showPreview,setShowPreview]= useState(false);
  const { toast, ToastContainer }   = useToast();

  const [form, setForm] = useState({
    clientName: '', clientEmail: '', clientPhone: '',
    clientAddress: '', clientGst: '',
    validUntil: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    notes: '', termsConditions: 'Payment due within the validity period. All prices are inclusive of applicable taxes.',
    items: [BLANK_ITEM()]
  });

  const loadCos = async () => {
    try { const d = await companyApi.list({ limit: '20' }); const cos = d.companies || []; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); }
    catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try { const d = await quotationApi.list(companyId, { limit: '50' }); setQuotations(d.quotations || []); }
    catch (e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [companyId]);

  // Auto-fill default terms from company settings
  useEffect(() => {
    if (!companyId) return;
    companyApi.getSettings(companyId).then((d:any) => {
      const s = d.settings || {};
      if (s.defaultPaymentTerms) setForm((f:any) => ({...f, termsConditions: s.defaultPaymentTerms || f.termsConditions}));
    }).catch(() => {});
  }, [companyId]);

  // Totals
  const subtotal   = form.items.reduce((a, it) => a + it.quantity * it.unitPrice - (it.discount || 0), 0);
  const gstTotal   = form.items.reduce((a, it) => a + Math.round((it.quantity * it.unitPrice - (it.discount || 0)) * it.gstPercent / 100), 0);
  const grandTotal = subtotal + gstTotal;

  const updateItem  = (i: number, key: string, val: any) => setForm(f => ({ ...f, items: f.items.map((it, idx) => idx === i ? { ...it, [key]: val } : it) }));
  const addItem     = () => setForm(f => ({ ...f, items: [...f.items, BLANK_ITEM()] }));
  const removeItem  = (i: number) => setForm(f => ({ ...f, items: f.items.filter((_, idx) => idx !== i) }));

  const create = async () => {
    if (!form.clientName)         return toast('Client name required', 'err');
    if (!form.items[0].description) return toast('Add at least one item with description', 'err');
    setSaving(true);
    try {
      await quotationApi.create(companyId, form);
      toast('Quotation created!');
      setShowCreate(false);
      setForm({ clientName:'', clientEmail:'', clientPhone:'', clientAddress:'', clientGst:'', validUntil: new Date(Date.now()+30*86400000).toISOString().slice(0,10), notes:'', termsConditions:'Payment due within the validity period. All prices are inclusive of applicable taxes.', items:[BLANK_ITEM()] });
      load();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const openPreview = (qt: any) => {
    const token = getToken();
    const url   = `${API}/companies/${companyId}/quotations/${qt.quotationId}/view`;
    // Open in new tab with auth header workaround via iframe
    setPreviewUrl(url + `?token=${token}`);
    setShowPreview(true);
  };

  const downloadPdf = (qt: any) => {
    const token = getToken();
    const url   = `${API}/companies/${companyId}/quotations/${qt.quotationId}/pdf`;
    // Create temp link with auth
    const a   = document.createElement('a');
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const objUrl = URL.createObjectURL(blob);
        a.href     = objUrl;
        a.download = `${qt.quotationNumber}.pdf`;
        a.click();
        URL.revokeObjectURL(objUrl);
        toast('PDF downloaded!');
      })
      .catch(() => {
        // Fallback: open view in new tab for browser print
        window.open(url.replace('/pdf', '/view'), '_blank');
        toast('Opening in browser — use Ctrl+P to print/save as PDF', 'ok');
      });
  };

  const send = async (qt: any, channel: string) => {
    try { await quotationApi.send(companyId, qt.quotationId, { channel }); toast(`Sent via ${channel}!`); load(); }
    catch (e: any) { toast(e.message, 'err'); }
  };

  const convert = async (qt: any) => {
    try { await quotationApi.convert(companyId, qt.quotationId); toast('Converted to invoice!'); load(); }
    catch (e: any) { toast(e.message, 'err'); }
  };

  // Summary stats
  const totalValue    = quotations.reduce((a, q) => a + (q.grandTotal || 0), 0);
  const sentCount     = quotations.filter(q => q.status === 'SENT').length;
  const acceptedCount = quotations.filter(q => q.status === 'ACCEPTED').length;
  const draftCount    = quotations.filter(q => q.status === 'DRAFT').length;

  return (
    <>
      <Topbar title="Quotations" subtitle={`${quotations.length} quotations · ₹${(totalValue/100000).toFixed(1)}L total value`}
        actions={<>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ New Quotation</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Quotations', value: quotations.length,   color: 'text-slate-900' },
            { label: 'Draft',            value: draftCount,          color: 'text-slate-500' },
            { label: 'Sent',             value: sentCount,           color: 'text-blue-600'  },
            { label: 'Accepted',         value: acceptedCount,       color: 'text-green-600' },
          ].map((s, i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-xl px-4 py-3">
              <div className="text-xs text-slate-400 font-medium mb-1">{s.label}</div>
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Table */}
        <Card className="p-0 overflow-hidden">
          {loading ? (
            <div className="py-12 text-center text-slate-400">Loading quotations...</div>
          ) : quotations.length === 0 ? (
            <div className="py-16 text-center">
              <div className="text-4xl mb-3">📄</div>
              <div className="text-sm font-semibold text-slate-700 mb-1">No quotations yet</div>
              <div className="text-xs text-slate-400 mb-4">Create your first professional quotation with GST calculation</div>
              <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>+ Create Quotation</Btn>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Quotation #', 'Client', 'Items', 'Subtotal', 'GST', 'Grand Total', 'Status', 'Valid Until', 'Actions'].map(h => (
                      <th key={h} className="text-left px-3 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quotations.map((qt: any) => (
                    <tr key={qt.quotationId} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                      <td className="px-3 py-3">
                        <div className="font-mono font-bold text-indigo-600">{qt.quotationNumber}</div>
                        <div className="text-xs text-slate-400 mt-0.5">{new Date(qt.createdAt).toLocaleDateString('en-IN')}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-semibold text-slate-800">{qt.clientName}</div>
                        {qt.clientEmail && <div className="text-xs text-slate-400 truncate max-w-32">{qt.clientEmail}</div>}
                        {qt.clientGst   && <div className="text-xs text-slate-400">GST: {qt.clientGst}</div>}
                      </td>
                      <td className="px-3 py-3 text-slate-500">{qt.items?.length || 0} item{qt.items?.length !== 1 ? 's' : ''}</td>
                      <td className="px-3 py-3 text-slate-700">₹{(qt.subtotal || 0).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3 text-slate-500">₹{(qt.totalGst || 0).toLocaleString('en-IN')}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">₹{(qt.grandTotal || 0).toLocaleString('en-IN')}</div>
                        {qt.totalDiscount > 0 && <div className="text-xs text-red-400">-₹{qt.totalDiscount.toLocaleString('en-IN')} disc.</div>}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLOR[qt.status] || 'bg-slate-100 text-slate-500'}`}>{qt.status}</span>
                      </td>
                      <td className="px-3 py-3 text-slate-500 whitespace-nowrap">
                        {qt.validUntil ? new Date(qt.validUntil).toLocaleDateString('en-IN') : '—'}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1 flex-wrap">
                          <button onClick={() => openPreview(qt)}
                            className="text-xs bg-indigo-50 text-indigo-600 px-2 py-1 rounded-md font-medium hover:bg-indigo-100 transition-colors whitespace-nowrap">
                            👁 Preview
                          </button>
                          <button onClick={() => downloadPdf(qt)}
                            className="text-xs bg-slate-50 text-slate-600 px-2 py-1 rounded-md font-medium hover:bg-slate-100 transition-colors whitespace-nowrap">
                            ⬇ PDF
                          </button>
                          {qt.status === 'DRAFT' && (
                            <button onClick={() => send(qt, 'email')}
                              className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-md font-medium hover:bg-blue-100 transition-colors">
                              📧 Send
                            </button>
                          )}
                          {qt.status === 'SENT' && (
                            <button onClick={() => send(qt, 'whatsapp')}
                              className="text-xs bg-green-50 text-green-600 px-2 py-1 rounded-md font-medium hover:bg-green-100 transition-colors">
                              💬 WA
                            </button>
                          )}
                          {qt.status === 'ACCEPTED' && (
                            <button onClick={() => convert(qt)}
                              className="text-xs bg-violet-50 text-violet-600 px-2 py-1 rounded-md font-medium hover:bg-violet-100 transition-colors whitespace-nowrap">
                              → Invoice
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* PDF Preview */}
      <PdfPreviewModal open={showPreview} onClose={() => setShowPreview(false)} url={previewUrl} />

      {/* Create Quotation Modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create New Quotation" size="lg"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={create}>Create Quotation</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          {/* Client details */}
          <div>
            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Client Details</div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Client Name *"   value={form.clientName}    onChange={e => setForm(f => ({ ...f, clientName:    e.target.value }))} placeholder="Rahul Sharma" />
              <Input label="Client Email"    value={form.clientEmail}   onChange={e => setForm(f => ({ ...f, clientEmail:   e.target.value }))} placeholder="rahul@example.com" />
              <Input label="Phone"           value={form.clientPhone}   onChange={e => setForm(f => ({ ...f, clientPhone:   e.target.value }))} placeholder="+91 98765 43210" />
              <Input label="GSTIN"           value={form.clientGst}     onChange={e => setForm(f => ({ ...f, clientGst:     e.target.value }))} placeholder="27AAAA0000A1Z5" />
            </div>
            <div className="mt-3">
              <Input label="Billing Address" value={form.clientAddress} onChange={e => setForm(f => ({ ...f, clientAddress: e.target.value }))} placeholder="123 Business Park, Mumbai, Maharashtra 400001" />
            </div>
          </div>

          {/* Validity */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Valid Until" type="date" value={form.validUntil} onChange={e => setForm(f => ({ ...f, validUntil: e.target.value }))} />
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Currency</label>
              <select className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-indigo-500" defaultValue="INR">
                <option value="INR">INR — ₹ Indian Rupee</option>
                <option value="USD">USD — $ US Dollar</option>
              </select>
            </div>
          </div>

          {/* Line items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-bold text-slate-700 uppercase tracking-wide">Line Items</div>
              <button onClick={addItem} className="text-xs text-indigo-600 hover:underline font-medium flex items-center gap-1">+ Add Item</button>
            </div>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-xs" style={{ tableLayout: 'fixed' }}>
                <colgroup>
                  <col width="36%" /><col width="8%" /><col width="14%" />
                  <col width="10%" /><col width="12%" /><col width="16%" /><col width="28px" />
                </colgroup>
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    {['Description', 'Qty', 'Rate (₹)', 'GST%', 'Discount', 'Total', ''].map(h => (
                      <th key={h} className="text-left px-2 py-2 text-xs font-semibold text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((item, i) => (
                    <ItemRow key={i} item={item} idx={i} onChange={updateItem} onRemove={removeItem} canRemove={form.items.length > 1} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals box */}
            <div className="flex justify-end mt-3">
              <div className="w-64">
                <div className="flex justify-between text-xs text-slate-500 py-1.5 border-b border-slate-100">
                  <span>Subtotal</span>
                  <span className="font-medium text-slate-700">₹{subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500 py-1.5 border-b border-slate-100">
                  <span>GST</span>
                  <span className="font-medium text-slate-700">₹{gstTotal.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-indigo-600 py-2 mt-1 bg-indigo-50 rounded-lg px-3">
                  <span>Grand Total</span>
                  <span>₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes & Terms */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Notes (optional)</label>
              <textarea rows={3} className="border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:border-indigo-500 outline-none"
                value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Delivery timeline, special instructions..." />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-600">Terms & Conditions</label>
              <textarea rows={3} className="border border-slate-200 rounded-lg px-3 py-2 text-xs resize-none focus:border-indigo-500 outline-none"
                value={form.termsConditions} onChange={e => setForm(f => ({ ...f, termsConditions: e.target.value }))}
                placeholder="Payment terms, warranty..." />
            </div>
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
