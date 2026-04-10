'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { companyApi, clientApi, gstApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Modal, useToast } from '@/components/ui';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ─── GST Input with live validation + lookup ─────────────────
function GstInput({ value, onChange, onFill }: {
  value: string; onChange: (v: string) => void; onFill: (d: any) => void;
}) {
  const [status,  setStatus]  = useState<'idle'|'valid'|'invalid'|'loading'>('idle');
  const [message, setMessage] = useState('');
  const debounce = useRef<any>(null);

  const check = useCallback((g: string) => {
    const v = g.toUpperCase().replace(/\s/g, '');
    if (!v) { setStatus('idle'); setMessage(''); return; }
    if (v.length < 15) { setStatus('invalid'); setMessage(`${v.length}/15 characters`); return; }
    if (!GSTIN_RE.test(v)) { setStatus('invalid'); setMessage('Invalid GSTIN format'); return; }
    setStatus('valid');
    setMessage('Valid format — click Fetch to auto-fill details');
  }, []);

  const handleChange = (raw: string) => {
    const v = raw.toUpperCase().replace(/\s/g, '');
    onChange(v);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => check(v), 300);
  };

  const fetchDetails = async () => {
    if (status !== 'valid') return;
    setStatus('loading');
    try {
      const d = await gstApi.lookup(value);
      if (d.legalName || d.tradeName) {
        onFill(d);
        setMessage(`Fetched: ${d.tradeName || d.legalName} — ${d.state || ''}`);
      } else {
        setMessage(`Valid GSTIN — ${d.state}. Manual entry required for name/address.`);
      }
    } catch { setMessage('Lookup failed. GSTIN format is valid.'); }
    finally { setStatus('valid'); }
  };

  const color = status === 'valid' ? '#16a34a' : status === 'invalid' ? '#dc2626' : status === 'loading' ? '#3199d4' : '#94a3b8';
  const icon  = status === 'valid' ? '✓' : status === 'invalid' ? '✗' : status === 'loading' ? '…' : '';

  return (
    <div>
      <label className="text-xs font-semibold text-slate-600 mb-1 block">GST Number (GSTIN)</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full px-3.5 py-2.5 border rounded-xl text-sm font-mono outline-none transition-all pr-8"
            style={{ borderColor: status === 'valid' ? '#16a34a' : status === 'invalid' ? '#dc2626' : '#e2e8f0', background: '#fff' }}
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder="27AAAA0000A1Z5"
            maxLength={15}
          />
          {icon && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold" style={{ color }}>{icon}</span>}
        </div>
        {status === 'valid' && (
          <button onClick={fetchDetails}
            className="px-3 py-2 text-xs font-semibold rounded-xl text-white flex-shrink-0 transition-colors"
            style={{ background: '#3199d4' }}>
            Fetch Details
          </button>
        )}
      </div>
      {message && <p className="text-xs mt-1" style={{ color }}>{message}</p>}
    </div>
  );
}

// ─── Client form (create / edit) ─────────────────────────────
const EMPTY = () => ({
  name: '', email: '', phone: '', address: '', city: '', state: '', pincode: '', gst: '', pan: '', notes: ''
});

function ClientModal({ client, cid, onClose, onDone }: { client?: any; cid: string; onClose: () => void; onDone: () => void }) {
  const isEdit = !!client;
  const [f, setF] = useState(isEdit ? {
    name: client.name||'', email: client.email||'', phone: client.phone||'',
    address: client.address||'', city: client.city||'', state: client.state||'',
    pincode: client.pincode||'', gst: client.gst||'', pan: client.pan||'', notes: client.notes||''
  } : EMPTY());
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  const set = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));

  const onGstFill = (d: any) => {
    setF(p => ({
      ...p,
      name:    p.name || d.tradeName || d.legalName || p.name,
      address: p.address || d.address || p.address,
      city:    p.city    || d.city    || p.city,
      state:   p.state   || d.state   || p.state,
      pincode: p.pincode || d.pincode || p.pincode,
    }));
    toast('GST details fetched! Review & confirm.', 'ok');
  };

  const save = async () => {
    if (!f.name.trim()) return toast('Client name is required', 'err');
    setSaving(true);
    try {
      if (isEdit) {
        await clientApi.update(cid, client.clientId, f);
        toast('Client updated!');
      } else {
        await clientApi.create(cid, f);
        toast('Client added!');
      }
      setTimeout(() => { onDone(); onClose(); }, 600);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-lg max-h-[95vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}>
                {isEdit ? f.name.slice(0,2).toUpperCase() : '🏛'}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-sm">{isEdit ? 'Edit Client' : 'Add New Client'}</div>
                <div className="text-xs text-slate-400">{isEdit ? client.name : 'Add client for billing'}</div>
              </div>
            </div>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 text-sm">✕</button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-4">

            {/* GST first — drives auto-fill */}
            <GstInput value={f.gst} onChange={v => set('gst', v)} onFill={onGstFill} />

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Input label="Business / Client Name *" value={f.name} onChange={e => set('name', e.target.value)} placeholder="Acme Technologies Pvt Ltd" />
              </div>
              <Input label="Email" type="email" value={f.email} onChange={e => set('email', e.target.value)} placeholder="billing@acme.com" />
              <Input label="Phone" value={f.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 98765 43210" />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Billing Address</label>
              <input className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-all"
                value={f.address} onChange={e => set('address', e.target.value)} placeholder="Street / Building / Area" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Input label="City"    value={f.city}    onChange={e => set('city',    e.target.value)} placeholder="Mumbai" />
              <Input label="State"   value={f.state}   onChange={e => set('state',   e.target.value)} placeholder="Maharashtra" />
              <Input label="Pincode" value={f.pincode} onChange={e => set('pincode', e.target.value)} placeholder="400001" />
            </div>

            <Input label="PAN Number" value={f.pan} onChange={e => set('pan', e.target.value.toUpperCase())} placeholder="AAACT1234C" />

            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
              <textarea rows={2} value={f.notes} onChange={e => set('notes', e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs resize-none outline-none focus:border-blue-400 transition-all"
                placeholder="Any notes about this client..." />
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-100 flex gap-2 justify-end flex-shrink-0">
            <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={save}
              className="!text-white" style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)', border: 'none' }}>
              {isEdit ? 'Save Changes' : 'Add Client'}
            </Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ─── Delete confirm ───────────────────────────────────────────
function DeleteModal({ client, cid, onClose, onDone }: any) {
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const go = async () => {
    setSaving(true);
    try { await clientApi.remove(cid, client.clientId); toast('Client deleted.'); setTimeout(() => { onDone(); onClose(); }, 600); }
    catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  };
  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
          <div className="px-6 pt-6 pb-4 text-center">
            <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center text-2xl mx-auto mb-3">🗑</div>
            <div className="font-bold text-slate-900 mb-1">Delete Client?</div>
            <div className="text-xs text-slate-500 leading-relaxed"><strong>{client.name}</strong> will be removed.<br/>Existing invoices will not be affected.</div>
          </div>
          <div className="px-6 pb-6 flex gap-2">
            <Btn variant="secondary" onClick={onClose} className="flex-1">Cancel</Btn>
            <Btn variant="danger" loading={saving} onClick={go} className="flex-1">Delete</Btn>
          </div>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────
export default function ClientsPage() {
  const [isSuperAdmin] = useState<boolean>(() => {
    try { return JSON.parse(localStorage.getItem('user') || '{}').role === 'SUPER_ADMIN'; } catch { return false; }
  });

  const [companies,  setCompanies]  = useState<any[]>([]);
  const [cid,        setCid]        = useState('');
  const [clients,    setClients]    = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [search,     setSearch]     = useState('');
  const [addOpen,    setAddOpen]    = useState(false);
  const [editClient, setEditClient] = useState<any>(null);
  const [delClient,  setDelClient]  = useState<any>(null);
  const { toast, ToastContainer }   = useToast();

  const loadCos = useCallback(async () => {
    try {
      const d = await companyApi.mine();
      const cos = d.companies || [];
      setCompanies(cos);
      if (isSuperAdmin && cos.length > 1) setCid('ALL');
      else if (cos[0]) setCid(cos[0].companyId);
    } catch {}
  }, [isSuperAdmin]);

  useEffect(() => { loadCos(); }, []);

  const loadClients = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    try {
      if (cid === 'ALL') {
        const results = await Promise.all(
          companies.map((co: any) =>
            clientApi.list(co.companyId, { limit: '500' })
              .then((d: any) => (d.clients || []).map((cl: any) => ({ ...cl, _companyName: co.name, _companyId: co.companyId })))
              .catch(() => [])
          )
        );
        const merged = (results as any[][]).flat().sort((a: any, b: any) => a.name.localeCompare(b.name));
        setClients(merged);
      } else {
        const d = await clientApi.list(cid, { limit: '500' });
        setClients(d.clients || []);
      }
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  }, [cid, companies]);

  useEffect(() => { loadClients(); }, [cid]);

  const filtered = clients.filter(c =>
    !search || [c.name, c.email, c.phone, c.gst, c.city].some(v => (v||'').toLowerCase().includes(search.toLowerCase()))
  );

  const initials = (name: string) => name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

  return (
    <>
      <Topbar
        title="Clients"
        subtitle={`${clients.length} client${clients.length !== 1 ? 's' : ''}${cid === 'ALL' ? ' across all companies' : ''}`}
        actions={<>
          <select value={cid} onChange={e => setCid(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none bg-white">
            {isSuperAdmin && companies.length > 1 && <option value="ALL">All Companies</option>}
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          {cid !== 'ALL' && (
            <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}
              style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)', border: 'none' }}>
              + Add Client
            </Btn>
          )}
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* All-companies summary — SUPER_ADMIN only */}
        {cid === 'ALL' && !loading && clients.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {companies.map((co: any) => {
              const count = clients.filter((cl: any) => cl._companyId === co.companyId).length;
              return (
                <button key={co.companyId} onClick={() => setCid(co.companyId)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-sky-100 bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition-colors">
                  🏢 {co.name}
                  <span className="bg-sky-200 text-sky-800 rounded-full px-1.5 py-0.5 text-[10px] font-bold">{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Search */}
        <div className="flex gap-3 items-center">
          <div className="relative flex-1 max-w-sm">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
            <input
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400 transition-all bg-white"
              placeholder="Search clients by name, email, GST, phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {search && <button onClick={() => setSearch('')} className="text-xs text-slate-400 hover:text-slate-600">Clear</button>}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-2">
            <svg className="animate-spin w-6 h-6" style={{ color: '#3199d4' }} viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
            <span className="text-xs text-slate-400">Loading clients...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 flex flex-col items-center gap-3">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl" style={{ background: '#e8f4fb' }}>🏛</div>
            <div className="text-sm font-semibold text-slate-700">{search ? 'No clients found' : 'No clients yet'}</div>
            <div className="text-xs text-slate-400">{search ? 'Try a different search term' : 'Add your first client to start creating invoices'}</div>
            {!search && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}
              style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)', border: 'none' }}>
              + Add First Client
            </Btn>}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map((c: any) => (
              <div key={`${c._companyId || cid}-${c.clientId}`} className="bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-5 flex flex-col gap-3">
                {/* Company badge — ALL mode only */}
                {cid === 'ALL' && c._companyName && (
                  <div className="flex items-center gap-1.5 -mb-1">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sky-50 text-sky-700 border border-sky-100 truncate max-w-full">
                      🏢 {c._companyName}
                    </span>
                  </div>
                )}

                {/* Top */}
                <div className="flex items-start gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}>
                    {initials(c.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 text-sm truncate">{c.name}</div>
                    {c.gst && <div className="text-xs text-slate-400 font-mono mt-0.5">GST: {c.gst}</div>}
                    {!c.gst && c.pan && <div className="text-xs text-slate-400 font-mono mt-0.5">PAN: {c.pan}</div>}
                  </div>
                </div>

                {/* Details */}
                <div className="flex flex-col gap-1 text-xs text-slate-500">
                  {c.email && (
                    <div className="flex items-center gap-1.5">
                      <span>✉</span><span className="truncate" style={{ color: '#3199d4' }}>{c.email}</span>
                    </div>
                  )}
                  {c.phone && (
                    <div className="flex items-center gap-1.5">
                      <span>📞</span><span>{c.phone}</span>
                    </div>
                  )}
                  {(c.city || c.state) && (
                    <div className="flex items-center gap-1.5">
                      <span>📍</span><span>{[c.city, c.state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {c.address && !(c.city || c.state) && (
                    <div className="flex items-center gap-1.5 truncate">
                      <span>📍</span><span className="truncate">{c.address}</span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-1 border-t border-slate-50 mt-1">
                  <button onClick={() => setEditClient(c)}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
                    Edit
                  </button>
                  <a href={`/dashboard/invoices`}
                    className="flex-1 text-xs font-semibold py-1.5 rounded-lg text-white text-center transition-colors"
                    style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}>
                    Invoice →
                  </a>
                  <button onClick={() => setDelClient(c)}
                    className="w-8 h-7 rounded-lg bg-red-50 text-red-400 hover:bg-red-100 text-xs flex items-center justify-center transition-colors flex-shrink-0">
                    🗑
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {addOpen    && <ClientModal cid={cid} onClose={() => setAddOpen(false)} onDone={loadClients} />}
      {editClient && <ClientModal client={editClient} cid={editClient._companyId || cid} onClose={() => setEditClient(null)} onDone={loadClients} />}
      {delClient  && <DeleteModal client={delClient} cid={delClient._companyId || cid} onClose={() => setDelClient(null)} onDone={loadClients} />}

      <ToastContainer />
    </>
  );
}
