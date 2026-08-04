'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { companyApi, leadApi, geoApi } from '@/lib/api';
import { Topbar, Btn, Badge, ScoreBar, Input, Sel, Modal, useToast, Avatar, Skeleton, UIIcons } from '@/components/ui';
import { NavIcon } from '@/components/layout/nav';
import { SERVICE_OPTIONS, SERVICE_COLOR } from '@/lib/services';

const STATUSES = [{value:'',label:'All Status'},{value:'NEW',label:'New'},{value:'CONTACTED',label:'Contacted'},{value:'QUALIFIED',label:'Qualified'},{value:'PROPOSAL_SENT',label:'Proposal'},{value:'NEGOTIATION',label:'Negotiation'},{value:'WON',label:'Won'},{value:'LOST',label:'Lost'}];
const SOURCES  = [{value:'',label:'All Sources'},{value:'FACEBOOK',label:'Facebook'},{value:'GOOGLE',label:'Google'},{value:'WHATSAPP',label:'WhatsApp'},{value:'REFERRAL',label:'Referral'},{value:'ORGANIC',label:'Organic'},{value:'WEBSITE_FORM',label:'Website Form'},{value:'MANUAL',label:'Manual'}];

const BLANK_FORM = { name:'',email:'',phone:'',city:'',state:'',country:'India',service:'',source:'MANUAL',status:'NEW',priority:'MEDIUM',dealValue:'',message:'',notes:'' };

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'block' };

// Read one key out of a lead's customFields. That column is free-form JSON posted
// by whatever website form created the lead, so nothing about its shape is guaranteed.
const cf = (lead: any, key: string): string => {
  const c = lead?.customFields;
  if (!c || typeof c !== 'object' || Array.isArray(c)) return '';
  const v = c[key];
  return v === null || v === undefined || typeof v === 'object' ? '' : String(v);
};

export default function LeadsPage() {
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [companyId,  setCompanyId]  = useState('');
  const [leads,      setLeads]      = useState<any[]>([]);
  const [total,      setTotal]      = useState(0);
  const [page,       setPage]       = useState(1);
  const [loading,    setLoading]    = useState(false);
  const [showAdd,    setShowAdd]    = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('');
  const [source,     setSource]     = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [countryFilter, setCountryFilter] = useState('');
  const [form, setForm] = useState<any>({ ...BLANK_FORM });
  const [countries,  setCountries]  = useState<any[]>([]);
  const [states,     setStates]     = useState<string[]>([]);
  const [role,       setRole]       = useState('');
  const [deleteLead, setDeleteLead] = useState<any>(null);
  const [deleting,   setDeleting]   = useState(false);
  const { toast, ToastContainer } = useToast();

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const loadCompanies = async () => {
    try { const d = await companyApi.mine(); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {}
  };
  const loadCountries = async () => {
    try { const d = await geoApi.countries(); setCountries(d.countries||[]); } catch {}
  };
  useEffect(() => {
    loadCompanies(); loadCountries();
    try { const u = JSON.parse(localStorage.getItem('user') || '{}'); setRole(u.role || ''); } catch {}
  }, []);

  const loadStates = async (countryCode: string) => {
    if (!countryCode) { setStates([]); return; }
    try { const d = await geoApi.states(countryCode); setStates(d.states||[]); }
    catch { setStates([]); }
  };

  const loadLeads = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params: any = { page: String(page), limit:'25' };
      if (status)        params.status  = status;
      if (source)        params.source  = source;
      if (search)        params.search  = search;
      if (serviceFilter) params.service = serviceFilter;
      if (countryFilter) params.country = countryFilter;
      const d = await leadApi.list(companyId, params);
      setLeads(d.leads||[]); setTotal(d.pagination?.total||0);
    } catch (e: any) { toast(e.message,'err'); }
    finally { setLoading(false); }
  }, [companyId, page, status, source, search, serviceFilter, countryFilter]);
  useEffect(() => { loadLeads(); }, [loadLeads]);

  // Load states when country changes in form
  useEffect(() => {
    if (form.country) {
      const c = countries.find((c:any) => c.name === form.country);
      if (c) loadStates(c.code);
    }
  }, [form.country]);

  const create = async () => {
    if (!form.name||!form.phone) return toast('Name and phone required','err');
    setSaving(true);
    try {
      await leadApi.create(companyId, { ...form, dealValue: form.dealValue ? +form.dealValue : undefined });
      toast('Lead created!');
      setShowAdd(false);
      setForm({ ...BLANK_FORM });
      loadLeads();
    } catch (e: any) { toast(e.message,'err'); } finally { setSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteLead) return;
    setDeleting(true);
    try {
      await leadApi.delete(companyId, deleteLead.leadId);
      toast('Lead deleted.');
      setDeleteLead(null);
      loadLeads();
    } catch (e: any) { toast(e.message,'err'); } finally { setDeleting(false); }
  };

  const pages = Math.ceil(total / 25);
  const hasFilters = status||source||search||serviceFilter||countryFilter;

  return (
    <>
      <Topbar title="Leads" subtitle={`${total.toLocaleString('en-IN')} total leads`}
        actions={<>
          <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPage(1); }} className="fld fld-xs" style={{ width: 'auto', fontWeight: 600, maxWidth: 200 }}>
            {companies.map((c:any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>{UIIcons.plus(13)} Add Lead</Btn>
        </>}
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto p-4 md:p-6 flex flex-col gap-4" style={{ maxWidth: 1440 }}>

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-full sm:w-56">
            <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>{UIIcons.search(13)}</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, email…" className="fld fld-xs" style={{ paddingLeft: 30 }} />
          </div>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="fld fld-xs" style={{ width: 'auto' }}>
            {STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className="fld fld-xs" style={{ width: 'auto' }}>
            {SOURCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={serviceFilter} onChange={e => { setServiceFilter(e.target.value); setPage(1); }} className="fld fld-xs" style={{ width: 'auto', maxWidth: 180 }}>
            <option value="">All Services</option>
            {SERVICE_OPTIONS.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }} className="fld fld-xs" style={{ width: 'auto', maxWidth: 170 }}>
            <option value="">All Countries</option>
            {countries.map((c:any) => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
          </select>
          {hasFilters && (
            <button onClick={() => { setStatus(''); setSource(''); setSearch(''); setServiceFilter(''); setCountryFilter(''); setPage(1); }}
              className="act-btn" style={{ background: 'var(--surface-2)', color: 'var(--text-2)' }}>
              {UIIcons.x(11)} Clear filters
            </button>
          )}
        </div>

        <div className="lux-card p-0 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
          <div className="table-scroll">
            <table className="w-full text-xs border-collapse" style={{ tableLayout:'fixed', minWidth:960 }}>
              <colgroup><col width="190"/><col width="95"/><col width="130"/><col width="90"/><col width="95"/><col width="160"/><col width="70"/><col width="90"/><col width="85"/>{isSuperAdmin && <col width="60"/>}</colgroup>
              <thead><tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                {['Name / Location','Phone','Service','Source','Status','Message','Score','Assigned','Created', ...(isSuperAdmin ? [''] : [])].map((h, i) => (
                  <th key={h || `col-${i}`} className="tbl-th" style={{ padding: '10px 12px' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? (
                  [0,1,2,3,4,5].map(i => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px' }}><div className="flex items-center gap-2"><Skeleton w={26} h={26} r={9} /><Skeleton w={110} h={12} /></div></td>
                      <td style={{ padding: '12px' }}><Skeleton w={70} h={12} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={90} h={14} r={9999} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={56} h={12} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={64} h={16} r={9999} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={120} h={12} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={36} h={12} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={54} h={12} /></td>
                      <td style={{ padding: '12px' }}><Skeleton w={54} h={12} /></td>
                      {isSuperAdmin && <td style={{ padding: '12px' }}><Skeleton w={24} h={24} r={8} /></td>}
                    </tr>
                  ))
                ) : leads.length === 0 ? (
                  <tr><td colSpan={isSuperAdmin ? 10 : 9}>
                    <div className="py-14 text-center flex flex-col items-center gap-3">
                      <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 17, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                        <NavIcon name="leads" size={22} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>{hasFilters ? 'No leads match these filters' : 'No leads yet'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{hasFilters ? 'Try adjusting or clearing the filters.' : 'Add your first lead or connect a website form via the API.'}</div>
                      </div>
                      {!hasFilters && <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>{UIIcons.plus(13)} Add Lead</Btn>}
                    </div>
                  </td></tr>
                ) : leads.map((l:any) => (
                  <tr key={l.leadId}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ padding: '10px 12px' }}>
                      <div className="flex items-center gap-2">
                        <Avatar name={l.name} size={26} />
                        <div className="min-w-0">
                          <Link href={`/dashboard/leads/${l.leadId}`} className="truncate block transition-colors hover:underline"
                            style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12.5 }}>{l.name}</Link>
                          {(() => {
                            // Website forms post a business name in customFields — show it
                            // in preference to location, it identifies the lead far better.
                            const sub = [cf(l, 'company'), [l.city, l.country].filter(Boolean).join(', ')]
                              .filter(Boolean).join(' · ');
                            return sub ? <div className="truncate" style={{ fontSize: 10, color: 'var(--text-3)' }} title={sub}>{sub}</div> : null;
                          })()}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{l.phone}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {l.service ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SERVICE_COLOR[l.service]||'bg-slate-100 text-slate-500'}`}>{l.service}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                      <div className="truncate capitalize">{l.source?.toLowerCase().replace(/_/g,' ')}</div>
                      {cf(l, 'form_title') && (
                        <div className="truncate" style={{ fontSize: 10, color: 'var(--text-3)' }} title={cf(l, 'form_title')}>
                          {cf(l, 'form_title')}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '10px 12px' }}><Badge status={l.status?.toLowerCase()} label={l.status} /></td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)' }}>
                      {l.message ? <span className="truncate block max-w-[148px]" title={l.message}>{l.message}</span> : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}><ScoreBar score={l.aiScore} /></td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-2)', whiteSpace: 'nowrap' }}>{l.assignedTo?.name?.split(' ')[0]||'—'}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{new Date(l.createdAt).toLocaleDateString('en-IN')}</td>
                    {isSuperAdmin && (
                      <td style={{ padding: '10px 12px' }}>
                        <button onClick={() => setDeleteLead(l)} title="Delete lead"
                          className="flex items-center justify-center transition-colors"
                          style={{ width: 28, height: 28, borderRadius: 8, background: 'transparent', color: 'var(--text-3)', cursor: 'pointer' }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--danger-soft)'; e.currentTarget.style.color = 'var(--danger-ink)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}>
                          {UIIcons.trash(14)}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
              <span style={{ fontSize: 11.5, color: 'var(--text-2)' }}>Showing {leads.length} of {total.toLocaleString('en-IN')}</span>
              <div className="flex gap-1">
                {Array.from({length: Math.min(pages,8)},(_,i)=>i+1).map(p => (
                  <button key={p} onClick={() => setPage(p)}
                    className="transition-all"
                    style={{
                      width: 28, height: 28, borderRadius: 9, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: page===p ? 'var(--grad-brand)' : 'transparent',
                      color: page===p ? '#fff' : 'var(--text-2)',
                      border: page===p ? '1px solid transparent' : '1px solid var(--border)',
                    }}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add New Lead" size="lg"
        footer={<><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create Lead</Btn></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Full name *" value={form.name}  onChange={(e:any)=>setForm((f:any)=>({...f,name:e.target.value}))}  placeholder="Rahul Sharma" />
            <Input label="Phone *"     value={form.phone} onChange={(e:any)=>setForm((f:any)=>({...f,phone:e.target.value}))} placeholder="+91 98765 43210" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email"       value={form.email} onChange={(e:any)=>setForm((f:any)=>({...f,email:e.target.value}))} placeholder="rahul@example.com" />
            <div>
              <label style={lbl}>Service Interest</label>
              <select value={form.service} onChange={(e:any)=>setForm((f:any)=>({...f,service:e.target.value}))} className="fld">
                {SERVICE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label style={lbl}>Country</label>
              <select value={form.country} onChange={(e:any)=>setForm((f:any)=>({...f,country:e.target.value,state:''}))} className="fld">
                <option value="">Select Country</option>
                {countries.map((c:any)=><option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>State / Province</label>
              {states.length > 0 ? (
                <select value={form.state} onChange={(e:any)=>setForm((f:any)=>({...f,state:e.target.value}))} className="fld">
                  <option value="">Select State</option>
                  {states.map(s=><option key={s} value={s}>{s}</option>)}
                </select>
              ) : (
                <Input value={form.state} onChange={(e:any)=>setForm((f:any)=>({...f,state:e.target.value}))} placeholder="State / Province" />
              )}
            </div>
            <Input label="City" value={form.city} onChange={(e:any)=>setForm((f:any)=>({...f,city:e.target.value}))} placeholder="City" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Sel label="Source"   value={form.source}   onChange={(e:any)=>setForm((f:any)=>({...f,source:e.target.value}))}   options={SOURCES.slice(1)} />
            <Sel label="Status"   value={form.status}   onChange={(e:any)=>setForm((f:any)=>({...f,status:e.target.value}))}   options={STATUSES.slice(1)} />
            <Sel label="Priority" value={form.priority} onChange={(e:any)=>setForm((f:any)=>({...f,priority:e.target.value}))} options={[{value:'LOW',label:'Low'},{value:'MEDIUM',label:'Medium'},{value:'HIGH',label:'High'},{value:'URGENT',label:'Urgent'}]} />
          </div>
          <Input label="Deal Value (₹)" type="number" value={form.dealValue} onChange={(e:any)=>setForm((f:any)=>({...f,dealValue:e.target.value}))} placeholder="50000" />
          <div className="flex flex-col gap-1">
            <label style={{ ...lbl, marginBottom: 0 }}>Message</label>
            <textarea rows={2} className="fld" style={{ resize: 'none', fontSize: 12 }} value={form.message} onChange={(e:any)=>setForm((f:any)=>({...f,message:e.target.value}))} placeholder="Lead's message or inquiry..." />
          </div>
          <div className="flex flex-col gap-1">
            <label style={{ ...lbl, marginBottom: 0 }}>Notes</label>
            <textarea rows={2} className="fld" style={{ resize: 'none', fontSize: 12 }} value={form.notes} onChange={(e:any)=>setForm((f:any)=>({...f,notes:e.target.value}))} placeholder="Any notes..." />
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ─────────────────────────────── */}
      <Modal open={!!deleteLead} onClose={() => setDeleteLead(null)} title="Delete Lead" size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteLead(null)}>Cancel</Btn>
            <Btn variant="danger" loading={deleting} onClick={confirmDelete}>Yes, Delete</Btn>
          </>
        }>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderRadius: 12, background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger-ink)' }}>This action cannot be undone</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                The lead and its activity history will be removed from your pipeline.
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{deleteLead?.name}</strong>?
          </p>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
