'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { companyApi, clientApi, gstApi } from '@/lib/api';
import { Topbar, Btn, Input, Modal, useToast, Avatar, Skeleton, UIIcons } from '@/components/ui';
import { NavIcon } from '@/components/layout/nav';

const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;

// ─── Small line icons (1.8px stroke, matches NavIcon system) ──
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
const Ic = {
  mail:  (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" {...S}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m4 7 8 6 8-6"/></svg>,
  phone: (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" {...S}><path d="M4 5c0 8 7 15 15 15a2 2 0 0 0 2-2v-2.3a1 1 0 0 0-.8-1l-3.3-.7a1 1 0 0 0-1 .3l-1 1.2a12 12 0 0 1-5.6-5.6l1.2-1a1 1 0 0 0 .3-1L9.3 4.8a1 1 0 0 0-1-.8H6a2 2 0 0 0-2 2Z"/></svg>,
  pin:   (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" {...S}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.6"/></svg>,
  edit:  (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" {...S}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>,
  doc:   (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" {...S}><path d="M6 2.8h8.2L19 7.6V19a2.2 2.2 0 0 1-2.2 2.2H6A2.2 2.2 0 0 1 3.8 19V5A2.2 2.2 0 0 1 6 2.8Z"/><path d="M14 3v5h5"/></svg>,
  card:  (s = 14) => <svg width={s} height={s} viewBox="0 0 24 24" {...S}><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 10h18"/></svg>,
};

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'block' };

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

  const tone = status === 'valid' ? 'var(--success-ink)' : status === 'invalid' ? 'var(--danger-ink)' : status === 'loading' ? 'var(--primary)' : 'var(--text-3)';
  const bord = status === 'valid' ? 'var(--success)' : status === 'invalid' ? 'var(--danger)' : 'var(--border-strong)';
  const icon = status === 'valid' ? '✓' : status === 'invalid' ? '✗' : status === 'loading' ? '…' : '';

  return (
    <div>
      <label style={lbl}>GST Number (GSTIN)</label>
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            className="w-full transition-all"
            style={{ padding: '8px 34px 8px 12px', fontSize: 13, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.03em', borderRadius: 10, border: `1px solid ${bord}`, background: 'var(--surface)', color: 'var(--text)' }}
            value={value}
            onChange={e => handleChange(e.target.value)}
            placeholder="27AAAA0000A1Z5"
            maxLength={15}
          />
          {icon && <span className="absolute right-3 top-1/2 -translate-y-1/2 font-bold" style={{ color: tone, fontSize: 13 }}>{icon}</span>}
        </div>
        {status === 'valid' && (
          <Btn variant="primary" size="sm" onClick={fetchDetails} style={{ flexShrink: 0 }}>Fetch Details</Btn>
        )}
      </div>
      {message && <p className="mt-1.5" style={{ fontSize: 11.5, color: tone }}>{message}</p>}
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
      if (isEdit) { await clientApi.update(cid, client.clientId, f); toast('Client updated!'); }
      else        { await clientApi.create(cid, f); toast('Client added!'); }
      setTimeout(() => { onDone(); onClose(); }, 500);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  return (
    <>
      <Modal open onClose={onClose} title={isEdit ? 'Edit Client' : 'Add New Client'} size="md"
        footer={<>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={save}>{isEdit ? 'Save Changes' : 'Add Client'}</Btn>
        </>}>
        <div className="flex flex-col gap-4">
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
            <label style={lbl}>Billing Address</label>
            <input className="w-full fld" value={f.address} onChange={e => set('address', e.target.value)} placeholder="Street / Building / Area" />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input label="City"    value={f.city}    onChange={e => set('city',    e.target.value)} placeholder="Mumbai" />
            <Input label="State"   value={f.state}   onChange={e => set('state',   e.target.value)} placeholder="Maharashtra" />
            <Input label="Pincode" value={f.pincode} onChange={e => set('pincode', e.target.value)} placeholder="400001" />
          </div>

          <Input label="PAN Number" value={f.pan} onChange={e => set('pan', e.target.value.toUpperCase())} placeholder="AAACT1234C" />

          <div>
            <label style={lbl}>Notes</label>
            <textarea rows={2} value={f.notes} onChange={e => set('notes', e.target.value)}
              className="w-full fld" style={{ resize: 'none' }}
              placeholder="Any notes about this client..." />
          </div>
        </div>
      </Modal>
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
    try { await clientApi.remove(cid, client.clientId); toast('Client deleted.'); setTimeout(() => { onDone(); onClose(); }, 500); }
    catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  };
  return (
    <>
      <Modal open onClose={onClose} title="Delete Client" size="sm"
        footer={<>
          <Btn variant="secondary" onClick={onClose}>Cancel</Btn>
          <Btn variant="danger" loading={saving} onClick={go}>Yes, Delete</Btn>
        </>}>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderRadius: 12, background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger-ink)' }}>This action cannot be undone</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>Existing invoices for this client will not be affected.</div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{client.name}</strong>?
          </p>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}

// ─── Stat tile ────────────────────────────────────────────────
function Stat({ label, value, icon, grad }: { label: string; value: string | number; icon: React.ReactNode; grad: string }) {
  return (
    <div className="lux-card p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
      <div className="flex items-center justify-center text-white flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: grad }}>{icon}</div>
      <div className="min-w-0">
        <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--text)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{value}</div>
        <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{label}</div>
      </div>
    </div>
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

  const now = new Date();
  const stats = {
    total:    clients.length,
    withGst:  clients.filter(c => c.gst).length,
    withMail: clients.filter(c => c.email).length,
    thisMonth: clients.filter(c => { const d = new Date(c.createdAt); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length,
  };

  return (
    <>
      <Topbar
        title="Clients"
        subtitle={`${clients.length.toLocaleString('en-IN')} client${clients.length !== 1 ? 's' : ''}${cid === 'ALL' ? ' across all companies' : ''}`}
        actions={<>
          <select value={cid} onChange={e => setCid(e.target.value)} className="fld fld-xs" style={{ width: 'auto', fontWeight: 600, maxWidth: 200 }}>
            {isSuperAdmin && companies.length > 1 && <option value="ALL">All Companies</option>}
            {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          {cid !== 'ALL' && (
            <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>{UIIcons.plus(13)} Add Client</Btn>
          )}
        </>}
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto p-4 md:p-6 flex flex-col gap-4" style={{ maxWidth: 1440 }}>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Stat label="Total Clients"   value={stats.total.toLocaleString('en-IN')} grad="var(--grad-brand)"  icon={<NavIcon name="clients" size={19} />} />
            <Stat label="GST Registered"  value={stats.withGst}   grad="var(--grad-teal)"   icon={Ic.doc(18)} />
            <Stat label="With Email"      value={stats.withMail}  grad="var(--grad-violet)" icon={Ic.mail(18)} />
            <Stat label={cid === 'ALL' ? 'Companies' : 'Added This Month'} value={cid === 'ALL' ? companies.length : stats.thisMonth} grad="var(--grad-amber)" icon={cid === 'ALL' ? <NavIcon name="companies" size={18} /> : UIIcons.plus(17)} />
          </div>

          {/* All-companies quick filter pills — SUPER_ADMIN only */}
          {cid === 'ALL' && !loading && clients.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {companies.map((co: any) => {
                const count = clients.filter((cl: any) => cl._companyId === co.companyId).length;
                return (
                  <button key={co.companyId} onClick={() => setCid(co.companyId)}
                    className="inline-flex items-center gap-1.5 transition-colors"
                    style={{ padding: '5px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 11.5, fontWeight: 600 }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}>
                    <span style={{ color: 'var(--text-3)' }}><NavIcon name="companies" size={13} /></span>
                    {co.name}
                    <span style={{ background: 'var(--primary-soft)', color: 'var(--primary)', borderRadius: 9999, padding: '1px 7px', fontSize: 10.5, fontWeight: 700 }}>{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Search */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative w-full sm:w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>{UIIcons.search(13)}</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email, GST, phone…" className="fld fld-xs" style={{ paddingLeft: 30 }} />
            </div>
            {search && (
              <button onClick={() => setSearch('')} className="act-btn" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                {UIIcons.x(11)} Clear
              </button>
            )}
          </div>

          {/* Grid */}
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0,1,2,3,4,5].map(i => (
                <div key={i} className="lux-card p-5 flex flex-col gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
                  <div className="flex items-center gap-3"><Skeleton w={44} h={44} r={13} /><div className="flex flex-col gap-2"><Skeleton w={130} h={13} /><Skeleton w={90} h={10} /></div></div>
                  <Skeleton w="80%" h={11} /><Skeleton w="60%" h={11} />
                  <div className="flex gap-2 pt-1"><Skeleton w="100%" h={28} r={9} /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="lux-card py-16 text-center flex flex-col items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 17, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <NavIcon name="clients" size={22} />
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{search ? 'No clients match your search' : 'No clients yet'}</div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{search ? 'Try a different search term.' : 'Add your first client to start creating invoices.'}</div>
              </div>
              {!search && cid !== 'ALL' && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>{UIIcons.plus(13)} Add First Client</Btn>}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((c: any) => (
                <div key={`${c._companyId || cid}-${c.clientId}`}
                  className="lux-card p-5 flex flex-col gap-3.5"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>

                  {/* Company badge — ALL mode only */}
                  {cid === 'ALL' && c._companyName && (
                    <span className="inline-flex items-center gap-1.5 self-start" style={{ padding: '2px 8px', borderRadius: 9999, background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 10.5, fontWeight: 600, maxWidth: '100%' }}>
                      <span style={{ color: 'var(--text-3)' }}><NavIcon name="companies" size={11} /></span>
                      <span className="truncate">{c._companyName}</span>
                    </span>
                  )}

                  {/* Top */}
                  <div className="flex items-start gap-3">
                    <Avatar name={c.name} size={44} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontWeight: 700, color: 'var(--text)', fontSize: 14 }}>{c.name}</div>
                      {c.gst
                        ? <div className="truncate flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace' }}>{Ic.doc(11)} {c.gst}</div>
                        : c.pan
                        ? <div className="truncate flex items-center gap-1 mt-0.5" style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'ui-monospace, monospace' }}>{Ic.card(11)} {c.pan}</div>
                        : <div className="mt-0.5" style={{ fontSize: 11, color: 'var(--text-3)' }}>No GST / PAN on file</div>}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex flex-col gap-1.5" style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    {c.email && (
                      <a href={`mailto:${c.email}`} className="flex items-center gap-2 min-w-0 transition-colors hover:underline" style={{ color: 'var(--primary)' }}>
                        <span style={{ color: 'var(--text-3)' }}>{Ic.mail(13)}</span><span className="truncate">{c.email}</span>
                      </a>
                    )}
                    {c.phone && (
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ color: 'var(--text-3)' }}>{Ic.phone(13)}</span><span className="truncate">{c.phone}</span>
                      </div>
                    )}
                    {(c.city || c.state || c.address) && (
                      <div className="flex items-center gap-2 min-w-0">
                        <span style={{ color: 'var(--text-3)' }}>{Ic.pin(13)}</span>
                        <span className="truncate">{[c.city, c.state].filter(Boolean).join(', ') || c.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-3 mt-auto" style={{ borderTop: '1px solid var(--border)' }}>
                    <button onClick={() => setEditClient(c)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 transition-colors"
                      style={{ padding: '7px 10px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600 }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}>
                      {Ic.edit(13)} Edit
                    </button>
                    <Link href="/dashboard/invoices"
                      className="flex-1 inline-flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90"
                      style={{ padding: '7px 10px', borderRadius: 9, background: 'var(--grad-brand)', color: '#fff', fontSize: 12, fontWeight: 600 }}>
                      {Ic.doc(13)} Invoice
                    </Link>
                    <button onClick={() => setDelClient(c)} title="Delete client"
                      className="flex items-center justify-center transition-colors flex-shrink-0"
                      style={{ width: 34, borderRadius: 9, background: 'transparent', color: 'var(--text-3)', border: '1px solid var(--border-strong)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger-ink)'; e.currentTarget.style.borderColor = 'var(--danger)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; e.currentTarget.style.borderColor = 'var(--border-strong)'; }}>
                      {UIIcons.trash(14)}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {addOpen    && <ClientModal cid={cid} onClose={() => setAddOpen(false)} onDone={loadClients} />}
      {editClient && <ClientModal client={editClient} cid={editClient._companyId || cid} onClose={() => setEditClient(null)} onDone={loadClients} />}
      {delClient  && <DeleteModal client={delClient} cid={delClient._companyId || cid} onClose={() => setDelClient(null)} onDone={loadClients} />}

      <ToastContainer />
    </>
  );
}
