'use client';
import { useEffect, useState } from 'react';
import { companyApi, leadApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, ScoreBar, Input, Sel, Modal, useToast } from '@/components/ui';

const STATUSES = [{value:'',label:'All Status'},{value:'NEW',label:'New'},{value:'CONTACTED',label:'Contacted'},{value:'QUALIFIED',label:'Qualified'},{value:'PROPOSAL',label:'Proposal'},{value:'NEGOTIATION',label:'Negotiation'},{value:'WON',label:'Won'},{value:'LOST',label:'Lost'}];
const SOURCES  = [{value:'',label:'All Sources'},{value:'FACEBOOK',label:'Facebook'},{value:'GOOGLE',label:'Google'},{value:'WHATSAPP',label:'WhatsApp'},{value:'REFERRAL',label:'Referral'},{value:'ORGANIC',label:'Organic'},{value:'WEBSITE_FORM',label:'Website Form'},{value:'MANUAL',label:'Manual'}];

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
  const [form, setForm] = useState({ name:'',email:'',phone:'',city:'',source:'FACEBOOK',status:'NEW',priority:'MEDIUM',dealValue:'',notes:'' });
  const { toast, ToastContainer } = useToast();

  const loadCompanies = async () => { try { const d = await companyApi.list({ limit:'20' }); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCompanies(); }, []);

  const loadLeads = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const d = await leadApi.list(companyId, { page: String(page), limit:'25', ...(status&&{status}), ...(source&&{source}), ...(search&&{search}) });
      setLeads(d.leads||[]); setTotal(d.pagination?.total||0);
    } catch (e: any) { toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadLeads(); }, [companyId, page, status, source, search]);

  const create = async () => {
    if (!form.name||!form.phone) return toast('Name and phone required','err');
    setSaving(true);
    try { await leadApi.create(companyId, {...form, dealValue:form.dealValue?+form.dealValue:undefined}); toast('Lead created!'); setShowAdd(false); setForm({name:'',email:'',phone:'',city:'',source:'FACEBOOK',status:'NEW',priority:'MEDIUM',dealValue:'',notes:''}); loadLeads(); }
    catch (e: any) { toast(e.message,'err'); } finally { setSaving(false); }
  };

  const pages = Math.ceil(total / 25);

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
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, phone, email..." className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs w-52 outline-none focus:border-indigo-500" />
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {STATUSES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <select value={source} onChange={e => { setSource(e.target.value); setPage(1); }} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {SOURCES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {(status||source||search) && <button onClick={() => { setStatus(''); setSource(''); setSearch(''); setPage(1); }} className="text-xs text-slate-400 hover:text-slate-600 underline">Clear</button>}
        </div>

        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse" style={{ tableLayout:'fixed' }}>
              <colgroup><col width="160"/><col width="110"/><col width="100"/><col width="90"/><col width="80"/><col width="60"/><col width="80"/><col width="90"/></colgroup>
              <thead><tr className="bg-slate-50 border-b border-slate-100">
                {['Name','Email','Phone','Source','Status','Score','Assigned','Created'].map(h => (
                  <th key={h} className="text-left px-3 py-2.5 text-xs font-semibold text-slate-400 uppercase tracking-wide">{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {loading ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">Loading...</td></tr>
                : leads.length === 0 ? <tr><td colSpan={8} className="text-center py-12 text-slate-400">No leads found.</td></tr>
                : leads.map((l:any) => (
                  <tr key={l.leadId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{l.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
                        <div><div className="font-semibold text-slate-800 truncate">{l.name}</div>{l.city&&<div className="text-slate-400" style={{fontSize:10}}>{l.city}</div>}</div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-indigo-600 truncate">{l.email||'—'}</td>
                    <td className="px-3 py-2.5 text-slate-500">{l.phone}</td>
                    <td className="px-3 py-2.5 text-slate-500 capitalize">{l.source?.toLowerCase()}</td>
                    <td className="px-3 py-2.5"><Badge status={l.status?.toLowerCase()} label={l.status} /></td>
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
            <Input label="Full name *"  value={form.name}  onChange={e=>setForm(f=>({...f,name:e.target.value}))}  placeholder="Rahul Sharma" />
            <Input label="Phone *"      value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="+91 98765 43210" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email"        value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="rahul@example.com" />
            <Input label="City"         value={form.city}  onChange={e=>setForm(f=>({...f,city:e.target.value}))}  placeholder="Mumbai" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Sel label="Source"   value={form.source}   onChange={e=>setForm(f=>({...f,source:e.target.value}))}   options={SOURCES.slice(1)} />
            <Sel label="Status"   value={form.status}   onChange={e=>setForm(f=>({...f,status:e.target.value}))}   options={STATUSES.slice(1)} />
            <Sel label="Priority" value={form.priority} onChange={e=>setForm(f=>({...f,priority:e.target.value}))} options={[{value:'LOW',label:'Low'},{value:'MEDIUM',label:'Medium'},{value:'HIGH',label:'High'},{value:'URGENT',label:'Urgent'}]} />
          </div>
          <Input label="Deal Value (₹)" type="number" value={form.dealValue} onChange={e=>setForm(f=>({...f,dealValue:e.target.value}))} placeholder="50000" />
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-slate-600">Notes</label>
            <textarea rows={2} className="border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Any notes..." />
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
