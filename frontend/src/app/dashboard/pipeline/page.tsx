'use client';
import { useEffect, useState } from 'react';
import { companyApi, dealApi } from '@/lib/api';
import { Topbar, Btn, Modal, Input, Sel, useToast } from '@/components/ui';

const STAGES = [
  { key:'NEW_LEAD',    label:'New Lead',    color:'#6366f1' },
  { key:'CONTACTED',  label:'Contacted',   color:'#60a5fa' },
  { key:'PROPOSAL',   label:'Proposal',    color:'#34d399' },
  { key:'NEGOTIATION',label:'Negotiation', color:'#f97316' },
  { key:'WON',        label:'Won',         color:'#10b981' },
  { key:'LOST',       label:'Lost',        color:'#ef4444' },
];

export default function PipelinePage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [deals,     setDeals]     = useState<any[]>([]);
  const [dragging,  setDragging]  = useState<any>(null);
  const [showAdd,   setShowAdd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ name:'',value:'',stage:'NEW_LEAD',probability:'0' });
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => { try { const d = await companyApi.list({limit:'20'}); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const loadDeals = async () => { if (!companyId) return; try { const d = await dealApi.list(companyId, {limit:'100'}); setDeals(d.deals||[]); } catch {} };
  useEffect(() => { loadDeals(); }, [companyId]);

  const handleDrop = async (stage: string) => {
    if (!dragging || dragging.stage === stage) { setDragging(null); return; }
    try { await dealApi.updateStage(companyId, dragging.dealId, stage); setDeals(ds => ds.map(d => d.dealId === dragging.dealId ? {...d, stage} : d)); toast('Stage updated!'); }
    catch (e:any) { toast(e.message,'err'); }
    setDragging(null);
  };

  const createDeal = async () => {
    if (!form.name) return toast('Deal name required','err');
    setSaving(true);
    try { await dealApi.create(companyId, {...form, value:+form.value, probability:+form.probability}); toast('Deal created!'); setShowAdd(false); setForm({name:'',value:'',stage:'NEW_LEAD',probability:'0'}); loadDeals(); }
    catch (e:any) { toast(e.message,'err'); } finally { setSaving(false); }
  };

  const byStage = (stage: string) => deals.filter(d => d.stage === stage);
  const stageVal = (stage: string) => byStage(stage).reduce((a,d) => a+(d.value||0), 0);

  return (
    <>
      <Topbar title="Pipeline" subtitle="Drag deals to update stage"
        actions={<>
          <select value={companyId} onChange={e => setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>+ Add Deal</Btn>
        </>}
      />

      <div className="flex-1 overflow-x-auto p-5">
        <div className="flex gap-3 min-w-max h-full">
          {STAGES.map(stage => (
            <div key={stage.key} className="w-52 flex flex-col gap-2 flex-shrink-0"
              onDragOver={e => e.preventDefault()}
              onDrop={() => handleDrop(stage.key)}>

              {/* Header */}
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: stage.color }} />
                  <span className="text-xs font-bold text-slate-700">{stage.label}</span>
                </div>
                <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">{byStage(stage.key).length}</span>
              </div>
              <div className="text-xs text-slate-400 px-1">₹{(stageVal(stage.key)/100000).toFixed(1)}L</div>

              {/* Drop zone */}
              <div className="flex-1 bg-slate-100 rounded-xl p-2 flex flex-col gap-2 min-h-96">
                {byStage(stage.key).length === 0
                  ? <div className="text-center text-slate-300 text-xs py-8">Drop here</div>
                  : byStage(stage.key).map((deal:any) => (
                    <div key={deal.dealId} draggable onDragStart={() => setDragging(deal)}
                      className="bg-white border border-slate-200 rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-indigo-300 transition-colors select-none">
                      <div className="text-xs font-bold text-slate-800 mb-1 truncate">{deal.name}</div>
                      {deal.lead && <div className="text-xs text-slate-400 mb-2 truncate">{deal.lead.name}</div>}
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-600">₹{(deal.value||0).toLocaleString('en-IN')}</span>
                        {deal.probability > 0 && <span className="text-xs text-slate-400">{deal.probability}%</span>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Deal"
        footer={<><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={createDeal}>Create</Btn></>}>
        <div className="flex flex-col gap-3">
          <Input label="Deal name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Raulji CRM Setup" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Value (₹)" type="number" value={form.value} onChange={e=>setForm(f=>({...f,value:e.target.value}))} placeholder="50000" />
            <Input label="Probability (%)" type="number" value={form.probability} onChange={e=>setForm(f=>({...f,probability:e.target.value}))} placeholder="50" />
          </div>
          <Sel label="Stage" value={form.stage} onChange={e=>setForm(f=>({...f,stage:e.target.value}))} options={STAGES.map(s=>({value:s.key,label:s.label}))} />
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
