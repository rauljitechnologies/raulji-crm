'use client';
import { useEffect, useState } from 'react';
import { companyApi, automationApi, templateApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Modal, useToast } from '@/components/ui';
import { RAULJI_SERVICES } from '@/lib/services';

const TRIGGER_LABELS: Record<string,string> = {
  LEAD_CREATED:     'Lead Created',
  STATUS_CHANGED:   'Status Changed',
  FOLLOW_UP_DUE:    'Follow-up Due',
  VALIDATION_FAILED:'Validation Failed',
};
const TRIGGER_COLORS: Record<string,string> = {
  LEAD_CREATED:     'bg-emerald-100 text-emerald-700',
  STATUS_CHANGED:   'bg-blue-100 text-blue-700',
  FOLLOW_UP_DUE:    'bg-amber-100 text-amber-700',
  VALIDATION_FAILED:'bg-red-100 text-red-600',
};
const JOB_STATUS_COLORS: Record<string,string> = {
  PENDING:'bg-amber-100 text-amber-700', SENT:'bg-emerald-100 text-emerald-700',
  FAILED:'bg-red-100 text-red-600', CANCELLED:'bg-slate-100 text-slate-500'
};
const STATUS_OPTIONS = ['NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','NEGOTIATION','WON','LOST'];

const BLANK_RULE = { name:'', trigger:'LEAD_CREATED', triggerValue:'', channel:'WHATSAPP', templateId:'', delayMinutes:0, conditions:{ service:'', country:'' } };

export default function AutomationPage() {
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [rules,     setRules]     = useState<any[]>([]);
  const [jobs,      setJobs]      = useState<any[]>([]);
  const [jobTotal,  setJobTotal]  = useState(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tab,       setTab]       = useState<'rules'|'jobs'>('rules');
  const [loading,   setLoading]   = useState(false);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [editRule,  setEditRule]  = useState<any>(null);
  const [form,      setForm]      = useState<any>({ ...BLANK_RULE });
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => {
    try { const d = await companyApi.list({ limit:'20' }); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [rd, td, jd] = await Promise.all([
        automationApi.listRules(companyId),
        templateApi.list(companyId),
        automationApi.listJobs(companyId, { limit:'30' })
      ]);
      setRules(rd.rules || []);
      setTemplates(td.templates || []);
      setJobs(jd.jobs || []);
      setJobTotal(jd.total || 0);
    } catch(e:any){ toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [companyId]);

  const openCreate = () => { setEditRule(null); setForm({ ...BLANK_RULE }); setShowForm(true); };
  const openEdit   = (r: any) => {
    setEditRule(r);
    setForm({ name: r.name, trigger: r.trigger, triggerValue: r.triggerValue||'', channel: r.channel, templateId: r.templateId, delayMinutes: r.delayMinutes, conditions: r.conditions || { service:'', country:'' } });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.name || !form.templateId) return toast('Name and template required','err');
    setSaving(true);
    try {
      const payload = {
        ...form,
        conditions: (form.conditions.service || form.conditions.country) ? { ...(form.conditions.service ? { service: form.conditions.service } : {}), ...(form.conditions.country ? { country: form.conditions.country } : {}) } : null,
        triggerValue: form.triggerValue || null,
        delayMinutes: +form.delayMinutes
      };
      if (editRule) await automationApi.updateRule(companyId, editRule.ruleId, payload);
      else          await automationApi.createRule(companyId, payload);
      toast(editRule ? 'Rule updated!' : 'Rule created!');
      setShowForm(false);
      load();
    } catch(e:any){ toast(e.message,'err'); }
    finally { setSaving(false); }
  };

  const toggle = async (r: any) => {
    try { await automationApi.toggleRule(companyId, r.ruleId, !r.isActive); toast(r.isActive ? 'Rule paused.' : 'Rule activated.'); load(); }
    catch(e:any){ toast(e.message,'err'); }
  };

  const deleteRule = async (r: any) => {
    if (!confirm(`Delete rule "${r.name}"?`)) return;
    try { await automationApi.deleteRule(companyId, r.ruleId); toast('Deleted.'); load(); }
    catch(e:any){ toast(e.message,'err'); }
  };

  const retryJob = async (jobId: string) => {
    try { await automationApi.retryJob(companyId, jobId); toast('Queued for retry.'); load(); }
    catch(e:any){ toast(e.message,'err'); }
  };

  return (
    <>
      <Topbar title="Automation Rules" subtitle="Auto-send WhatsApp/email messages based on lead events"
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={openCreate}>+ New Rule</Btn>
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200 pb-0">
          {[{k:'rules',l:`Rules (${rules.length})`},{k:'jobs',l:`Job Log (${jobTotal})`}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k as any)}
              className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors ${tab===t.k?'border-indigo-500 text-indigo-700':'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.l}
            </button>
          ))}
        </div>

        {tab === 'rules' && (
          <div className="flex flex-col gap-3">
            {loading ? <div className="py-10 text-center text-slate-400 text-xs">Loading...</div>
            : rules.length === 0 ? (
              <Card className="py-12 text-center">
                <div className="text-4xl mb-3">⚡</div>
                <div className="text-sm font-semibold text-slate-700">No automation rules yet</div>
                <div className="text-xs text-slate-400 mt-1 mb-4">Auto-send messages when leads are created, status changes, and more</div>
                <Btn variant="primary" size="sm" onClick={openCreate}>Create First Rule</Btn>
              </Card>
            ) : rules.map((r:any) => (
              <Card key={r.ruleId} className="p-0">
                <div className="flex items-center gap-3 p-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="text-sm font-semibold text-slate-800">{r.name}</div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TRIGGER_COLORS[r.trigger]||'bg-slate-100 text-slate-500'}`}>{TRIGGER_LABELS[r.trigger]||r.trigger}</span>
                      {r.triggerValue && <span className="text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full">→ {r.triggerValue}</span>}
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-50 text-slate-600">💬 {r.channel}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400">
                      <span>Template: <span className="text-slate-600 font-medium">{r.template?.name || '—'}</span></span>
                      {r.delayMinutes > 0 && <span>Delay: <span className="text-slate-600">{r.delayMinutes >= 60 ? `${Math.floor(r.delayMinutes/60)}h` : `${r.delayMinutes}m`}</span></span>}
                      {r.conditions && <span>Conditions: {Object.entries(r.conditions).map(([k,v])=>`${k}=${v}`).join(', ')}</span>}
                      <span>Runs: <span className="text-indigo-600 font-semibold">{r.executionCount}</span></span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* Toggle */}
                    <button onClick={()=>toggle(r)}
                      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${r.isActive?'bg-emerald-400':'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${r.isActive?'translate-x-4':'translate-x-0.5'}`} />
                    </button>
                    <button onClick={()=>openEdit(r)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50">Edit</button>
                    <button onClick={()=>deleteRule(r)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50">Delete</button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        {tab === 'jobs' && (
          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Rule</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Scheduled</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Executed</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Status</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Error</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr><td colSpan={6} className="py-10 text-center text-slate-400">No jobs yet.</td></tr>
                  ) : jobs.map((j:any)=>(
                    <tr key={j.jobId} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-medium text-slate-700">{j.rule?.name || j.ruleId.slice(0,8)}</td>
                      <td className="px-3 py-3 text-slate-500">{new Date(j.scheduledAt).toLocaleString()}</td>
                      <td className="px-3 py-3 text-slate-500">{j.executedAt ? new Date(j.executedAt).toLocaleString() : '—'}</td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${JOB_STATUS_COLORS[j.status]||'bg-slate-100 text-slate-500'}`}>{j.status}</span>
                      </td>
                      <td className="px-3 py-3 text-red-400 text-[10px] max-w-xs truncate">{j.error || '—'}</td>
                      <td className="px-4 py-3 text-right">
                        {j.status === 'FAILED' && (
                          <button onClick={()=>retryJob(j.jobId)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50">Retry</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* Create/Edit Rule Modal */}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editRule ? 'Edit Rule' : 'New Automation Rule'}
        footer={<><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={save}>{editRule?'Save Changes':'Create Rule'}</Btn></>}>
        <div className="flex flex-col gap-3">
          <Input label="Rule Name *" value={form.name} onChange={(e:any)=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="Welcome new lead" />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Trigger *</div>
              <select value={form.trigger} onChange={(e:any)=>setForm((f:any)=>({...f,trigger:e.target.value,triggerValue:''}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                {Object.entries(TRIGGER_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Channel</div>
              <select value={form.channel} onChange={(e:any)=>setForm((f:any)=>({...f,channel:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
              </select>
            </div>
          </div>

          {form.trigger === 'STATUS_CHANGED' && (
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Trigger when status changes TO:</div>
              <select value={form.triggerValue} onChange={(e:any)=>setForm((f:any)=>({...f,triggerValue:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                <option value="">Any status change</option>
                {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Message Template *</div>
            <select value={form.templateId} onChange={(e:any)=>setForm((f:any)=>({...f,templateId:e.target.value}))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
              <option value="">Select a template</option>
              {templates.filter(t=>t.channel===form.channel||t.channel==='WHATSAPP').map((t:any)=>(
                <option key={t.templateId} value={t.templateId}>{t.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Send Delay (minutes after trigger)</div>
            <input type="number" min={0} value={form.delayMinutes} onChange={(e:any)=>setForm((f:any)=>({...f,delayMinutes:+e.target.value}))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
            <div className="text-[10px] text-slate-400 mt-0.5">0 = send immediately. 60 = 1 hour delay.</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Only if Service</div>
              <select value={form.conditions.service} onChange={(e:any)=>setForm((f:any)=>({...f,conditions:{...f.conditions,service:e.target.value}}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                <option value="">Any service</option>
                {RAULJI_SERVICES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Only if Country</div>
              <input value={form.conditions.country} onChange={(e:any)=>setForm((f:any)=>({...f,conditions:{...f.conditions,country:e.target.value}}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" placeholder="India (leave blank for all)" />
            </div>
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
