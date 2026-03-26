'use client';
import { useEffect, useState } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Card, Btn, Badge, Input, Sel, Modal, useToast } from '@/components/ui';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showAdd,   setShowAdd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', gst: '', industry: 'technology', plan: 'STARTER' });
  const { toast, ToastContainer } = useToast();

  const load = async () => { try { const d = await companyApi.list({ limit: '50' }); setCompanies(d.companies || []); } catch (e: any) { toast(e.message, 'err'); } finally { setLoading(false); } };
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return toast('Company name required', 'err');
    setSaving(true);
    try { await companyApi.create(form); toast('Company created!'); setShowAdd(false); setForm({ name: '', domain: '', gst: '', industry: 'technology', plan: 'STARTER' }); load(); }
    catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  };

  const COLORS = ['bg-indigo-50 text-indigo-700','bg-green-50 text-green-700','bg-orange-50 text-orange-700','bg-violet-50 text-violet-700'];

  return (
    <>
      <Topbar title="Companies" subtitle={`${companies.length} companies`} actions={<Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ New Company</Btn>} />
      <div className="flex-1 overflow-y-auto p-5">
        {loading ? <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div> : (
          <div className="grid grid-cols-2 gap-4">
            {companies.map((co: any, i: number) => {
              const initials = co.name.split(' ').map((n: string) => n[0]).join('').slice(0,2).toUpperCase();
              return (
                <Card key={co.companyId} className="hover:border-indigo-300 transition-colors">
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${COLORS[i%4]}`}>{initials}</div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-slate-900 text-sm truncate">{co.name}</div>
                      <div className="text-xs text-slate-400 truncate">{co.domain || 'No domain'}</div>
                    </div>
                    <Badge status={co.status?.toLowerCase()} label={co.status} />
                  </div>
                  <div className="flex gap-1 flex-wrap mb-3">
                    {[`${co._count?.leads||0} leads`,`${co._count?.users||0} users`,co.plan,co.industry||''].filter(Boolean).map(t => (
                      <span key={t} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                  {co.gst && <div className="text-xs text-slate-400 mb-3">GST: {co.gst}</div>}
                  <div className="flex gap-2">
                    <Btn variant="secondary" size="sm">View Leads</Btn>
                    <Btn variant="secondary" size="sm">Edit</Btn>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Company"
        footer={<><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create</Btn></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company name *" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Acme Corp" />
            <Input label="Website" value={form.domain} onChange={e => setForm(f=>({...f,domain:e.target.value}))} placeholder="acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="GST" value={form.gst} onChange={e => setForm(f=>({...f,gst:e.target.value}))} placeholder="27AAAA0000A1Z5" />
            <Sel label="Industry" value={form.industry} onChange={e => setForm(f=>({...f,industry:e.target.value}))}
              options={[{value:'technology',label:'Technology'},{value:'real_estate',label:'Real Estate'},{value:'retail',label:'Retail'},{value:'healthcare',label:'Healthcare'},{value:'consulting',label:'Consulting'},{value:'digital_marketing',label:'Digital Marketing'}]} />
          </div>
          <Sel label="Plan" value={form.plan} onChange={e => setForm(f=>({...f,plan:e.target.value}))}
            options={[{value:'STARTER',label:'Starter — ₹999/mo'},{value:'GROWTH',label:'Growth — ₹2,499/mo'},{value:'ENTERPRISE',label:'Enterprise — ₹4,999/mo'}]} />
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
