'use client';
import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { companyApi, leadApi, geoApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, ScoreBar, Input, Sel, Modal, useToast } from '@/components/ui';
import { SERVICE_OPTIONS, SERVICE_COLOR } from '@/lib/services';

const STATUSES = [{value:'',label:'All Status'},{value:'NEW',label:'New'},{value:'CONTACTED',label:'Contacted'},{value:'QUALIFIED',label:'Qualified'},{value:'PROPOSAL_SENT',label:'Proposal'},{value:'NEGOTIATION',label:'Negotiation'},{value:'WON',label:'Won'},{value:'LOST',label:'Lost'}];
const SOURCES  = [{value:'',label:'All Sources'},{value:'FACEBOOK',label:'Facebook'},{value:'GOOGLE',label:'Google'},{value:'WHATSAPP',label:'WhatsApp'},{value:'REFERRAL',label:'Referral'},{value:'ORGANIC',label:'Organic'},{value:'WEBSITE_FORM',label:'Website Form'},{value:'MANUAL',label:'Manual'}];

const BLANK_FORM = { name:'',email:'',phone:'',city:'',state:'',country:'India',service:'',source:'MANUAL',status:'NEW',priority:'MEDIUM',dealValue:'',message:'',notes:'' };

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
  const { toast, ToastContainer } = useToast();

  const loadCompanies = async () => {
    try { const d = await companyApi.mine(); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {}
  };
  const loadCountries = async () => {
    try { const d = await geoApi.countries(); setCountries(d.countries||[]); } catch {}
  };
  useEffect(() => { loadCompanies(); loadCountries(); }, []);

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

  const pages = Math.ceil(total / 25);
  const hasFilters = status||source||search||serviceFilter||countryFilter;

  return (
    <>
      <Topbar title="Leads" subtitle={`${total} total leads`}
        actions={<>
          <select value={companyId} onChange={e => { setCompanyId(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Lead</Btn>
        </>}
      />
      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Filters */}
        <div className="flex gap-2 flex-wrap items-center">
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, email..." className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-full sm:w-48 outline-none focus:border-indigo-500" />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {SOURCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={serviceFilter} onChange={e => { setServiceFilter(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            <option value="">All Services</option>
            {SERVICE_OPTIONS.slice(1).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={countryFilter} onChange={e => { setCountryFilter(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            <option value="">All Countries</option>
            {countries.map((c:any) => <option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
          </select>
          {hasFilters && <button onClick={() => { setStatus(''); setSource(''); setSearch(''); setServiceFilter(''); setCountryFilter(''); setPage(1); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>}
        </div>

        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ tableLayout:'fixed', minWidth:960 }}>
              <colgroup><col width="180"/><col width="90"/><col width="130"/><col width="100"/><col width="80"/><col width="160"/><col width="70"/><col width="100"/><col width="90"/></colgroup>
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {['Name / Location','Phone','Service','Source','Status','Message','Score','Assigned','Created'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">Loading...</td></tr>
                : leads.length === 0 ? <tr><td colSpan={9} className="text-center py-12 text-slate-400">No leads found.</td></tr>
                : leads.map((l:any) => (
                  <tr key={l.leadId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{l.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
                        <div>
                          <Link href={`/dashboard/leads/${l.leadId}`} className="font-semibold text-slate-800 hover:text-indigo-600 truncate block transition-colors">{l.name}</Link>
                          {(l.city || l.country) && <div className="text-slate-400 truncate" style={{fontSize:10}}>{[l.city, l.country].filter(Boolean).join(', ')}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-slate-500">{l.phone}</td>
                    <td className="px-3 py-2.5">
                      {l.service ? <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${SERVICE_COLOR[l.service]||'bg-slate-100 text-slate-500'}`}>{l.service}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-slate-500 capitalize">{l.source?.toLowerCase()}</td>
                    <td className="px-3 py-2.5"><Badge status={l.status?.toLowerCase()} label={l.status} /></td>
                    <td className="px-3 py-2.5 text-slate-500">
                      {l.message ? <span className="truncate block max-w-[148px]" title={l.message}>{l.message}</span> : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-2.5"><ScoreBar score={l.aiScore} /></td>
                    <td className="px-3 py-2.5 text-slate-500">{l.assignedTo?.name?.split(' ')[0]||'—'}</td>
                    <td className="px-3 py-2.5 text-slate-400">{new Date(l.createdAt).toLocaleDateString('en-IN')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <span className="text-xs text-slate-400">{leads.length} of {total}</span>
              <div className="flex gap-1">
                {Array.from({length: Math.min(pages,8)},(_,i)=>i+1).map(p => (
                  <button key={p} onClick={() => setPage(p)} className={`w-7 h-7 rounded text-xs font-medium transition-colors ${page===p?'bg-indigo-600 text-white':'text-slate-500 hover:bg-slate-100'}`}>{p}</button>
                ))}
              </div>
            </div>
          )}
        </Card>
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
              <div className="text-xs font-medium text-slate-600 mb-1">Service Interest</div>
              <select value={form.service} onChange={(e:any)=>setForm((f:any)=>({...f,service:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                {SERVICE_OPTIONS.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">Country</div>
              <select value={form.country} onChange={(e:any)=>setForm((f:any)=>({...f,country:e.target.value,state:''}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                <option value="">Select Country</option>
                {countries.map((c:any)=><option key={c.code} value={c.name}>{c.flag} {c.name}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs font-medium text-slate-600 mb-1">State / Province</div>
              {states.length > 0 ? (
                <select value={form.state} onChange={(e:any)=>setForm((f:any)=>({...f,state:e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
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
            <label className="text-xs font-medium text-slate-600">Message</label>
            <textarea rows={2} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" value={form.message} onChange={(e:any)=>setForm((f:any)=>({...f,message:e.target.value}))} placeholder="Lead's message or inquiry..." />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea rows={2} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" value={form.notes} onChange={(e:any)=>setForm((f:any)=>({...f,notes:e.target.value}))} placeholder="Any notes..." />
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
