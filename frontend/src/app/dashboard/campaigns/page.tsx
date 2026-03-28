'use client';
import { useEffect, useState } from 'react';
import { companyApi, campaignApi, templateApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Modal, useToast } from '@/components/ui';
import { RAULJI_SERVICES } from '@/lib/services';

const STATUS_BADGE: Record<string,string> = {
  DRAFT:'bg-slate-100 text-slate-600', RUNNING:'bg-blue-100 text-blue-700',
  COMPLETED:'bg-emerald-100 text-emerald-700', CANCELLED:'bg-red-50 text-red-600'
};
const CHANNEL_ICON: Record<string,string> = { WHATSAPP:'💬', EMAIL:'📧', BOTH:'💬📧' };

const LEAD_STATUSES = ['NEW','CONTACTED','QUALIFIED','PROPOSAL_SENT','NEGOTIATION','WON','LOST'];
const LEAD_SOURCES  = ['MANUAL','WEBSITE_FORM','REFERRAL','SOCIAL_MEDIA','COLD_CALL','EMAIL','OTHER'];

const BLANK = { name:'', description:'', channel:'WHATSAPP', templateId:'', subject:'', body:'', filters:{ country:[], status:[], service:[], source:[] } };

export default function CampaignsPage() {
  const [companyId, setCompanyId] = useState('');
  const [companies, setCompanies] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showCreate,setShowCreate]= useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form,      setForm]      = useState<any>({ ...BLANK });
  const [detail,    setDetail]    = useState<any>(null);
  const [audience,  setAudience]  = useState<any>(null);
  const [previewing,setPreviewing]= useState(false);
  const [launching, setLaunching] = useState(false);
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => {
    try { const d = await companyApi.list({ limit:'20' }); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [cd, td] = await Promise.all([campaignApi.list(companyId), templateApi.list(companyId)]);
      setCampaigns(cd.campaigns || []);
      setTemplates(td.templates || []);
    } catch(e:any){ toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [companyId]);

  const save = async () => {
    if (!form.name) return toast('Campaign name required','err');
    setSaving(true);
    try {
      await campaignApi.create(companyId, {
        ...form,
        filters: { country: form.filters.country, status: form.filters.status, service: form.filters.service, source: form.filters.source }
      });
      toast('Campaign created!');
      setShowCreate(false);
      setForm({ ...BLANK });
      load();
    } catch(e:any){ toast(e.message,'err'); }
    finally { setSaving(false); }
  };

  const previewAudience = async (campaignId: string) => {
    setPreviewing(true);
    try { const d = await campaignApi.previewAudience(companyId, campaignId); setAudience(d); }
    catch(e:any){ toast(e.message,'err'); }
    finally { setPreviewing(false); }
  };

  const launch = async (campaignId: string) => {
    if (!confirm('Launch this campaign? Messages will be sent to all matching leads.')) return;
    setLaunching(true);
    try { await campaignApi.launch(companyId, campaignId); toast('Campaign launched!'); load(); }
    catch(e:any){ toast(e.message,'err'); }
    finally { setLaunching(false); }
  };

  const cancel = async (campaignId: string) => {
    try { await campaignApi.cancel(companyId, campaignId); toast('Cancelled.'); load(); }
    catch(e:any){ toast(e.message,'err'); }
  };

  const toggleFilter = (key: string, val: string) => {
    setForm((f: any) => {
      const arr: string[] = f.filters[key] || [];
      return { ...f, filters: { ...f.filters, [key]: arr.includes(val) ? arr.filter((x:string)=>x!==val) : [...arr, val] } };
    });
  };

  return (
    <>
      <Topbar title="Campaigns" subtitle="Send bulk WhatsApp & email campaigns to leads"
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={()=>setShowCreate(true)}>+ New Campaign</Btn>
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label:'Total Campaigns', value: campaigns.length, color:'text-slate-800' },
            { label:'Running',  value: campaigns.filter(c=>c.status==='RUNNING').length,   color:'text-blue-600' },
            { label:'Completed',value: campaigns.filter(c=>c.status==='COMPLETED').length, color:'text-emerald-600' },
            { label:'Total Sent',value: campaigns.reduce((a,c)=>a+(c.sentCount||0),0),    color:'text-indigo-600' },
          ].map(s=>(
            <Card key={s.label} className="text-center py-4">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-slate-500 mt-1">{s.label}</div>
            </Card>
          ))}
        </div>

        {/* Campaigns list */}
        <Card className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 text-xs font-bold text-slate-900">All Campaigns</div>
          {loading ? <div className="py-10 text-center text-slate-400 text-xs">Loading...</div>
          : campaigns.length === 0 ? <div className="py-10 text-center text-slate-400 text-xs">No campaigns yet. Create one to get started.</div>
          : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">Campaign</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Channel</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Status</th>
                    <th className="text-center px-3 py-2.5 text-slate-500 font-semibold">Leads</th>
                    <th className="text-center px-3 py-2.5 text-slate-500 font-semibold">Sent</th>
                    <th className="text-center px-3 py-2.5 text-slate-500 font-semibold">Failed</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c:any) => (
                    <tr key={c.campaignId} className="border-b border-slate-50 last:border-none hover:bg-slate-50/50">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-800">{c.name}</div>
                        {c.description && <div className="text-slate-400 text-[10px] mt-0.5">{c.description}</div>}
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-base">{CHANNEL_ICON[c.channel] || '💬'}</span>
                        <span className="ml-1 text-slate-600">{c.channel}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_BADGE[c.status]||'bg-slate-100 text-slate-500'}`}>{c.status}</span>
                      </td>
                      <td className="px-3 py-3 text-center text-slate-700 font-medium">{c.totalLeads || '—'}</td>
                      <td className="px-3 py-3 text-center text-emerald-600 font-medium">{c.sentCount || 0}</td>
                      <td className="px-3 py-3 text-center text-red-400 font-medium">{c.failedCount || 0}</td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button onClick={()=>setDetail(c)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50">View</button>
                          {c.status === 'DRAFT' && (
                            <>
                              <button onClick={()=>previewAudience(c.campaignId)} disabled={previewing} className="text-[10px] text-slate-500 hover:text-slate-700 font-semibold px-2 py-1 rounded hover:bg-slate-100">Preview</button>
                              <button onClick={()=>launch(c.campaignId)} disabled={launching} className="text-[10px] text-emerald-600 hover:text-emerald-800 font-semibold px-2 py-1 rounded hover:bg-emerald-50">Launch</button>
                            </>
                          )}
                          {c.status === 'RUNNING' && (
                            <button onClick={()=>cancel(c.campaignId)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50">Cancel</button>
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

      {/* Create Campaign Modal */}
      <Modal open={showCreate} onClose={()=>{ setShowCreate(false); setForm({ ...BLANK }); }} title="New Campaign"
        footer={<><Btn variant="secondary" onClick={()=>setShowCreate(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={save}>Create Campaign</Btn></>}>
        <div className="flex flex-col gap-4">
          <Input label="Campaign Name *" value={form.name} onChange={(e:any)=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="Summer SEO Outreach" />
          <Input label="Description" value={form.description} onChange={(e:any)=>setForm((f:any)=>({...f,description:e.target.value}))} placeholder="Optional" />

          {/* Channel */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-2">Channel</div>
            <div className="flex gap-2">
              {['WHATSAPP','EMAIL','BOTH'].map(ch=>(
                <button key={ch} onClick={()=>setForm((f:any)=>({...f,channel:ch}))}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${form.channel===ch?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-600 hover:border-slate-300'}`}>
                  {CHANNEL_ICON[ch]} {ch}
                </button>
              ))}
            </div>
          </div>

          {/* Template */}
          {(form.channel === 'WHATSAPP' || form.channel === 'BOTH') && (
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">WhatsApp Template</div>
              <select value={form.templateId} onChange={(e:any)=>setForm((f:any)=>({...f,templateId:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                <option value="">Select template (or write custom body below)</option>
                {templates.filter(t=>t.channel==='WHATSAPP'||t.channel==='SMS').map((t:any)=>(
                  <option key={t.templateId} value={t.templateId}>{t.name}</option>
                ))}
              </select>
            </div>
          )}
          {(form.channel === 'EMAIL' || form.channel === 'BOTH') && (
            <Input label="Email Subject" value={form.subject} onChange={(e:any)=>setForm((f:any)=>({...f,subject:e.target.value}))} placeholder="Exciting offer for you!" />
          )}
          {!form.templateId && (
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Message Body</div>
              <textarea value={form.body} onChange={(e:any)=>setForm((f:any)=>({...f,body:e.target.value}))}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" rows={4}
                placeholder="Hi {{name}}, we have a special offer for {{service}}..." />
              <div className="text-[10px] text-slate-400 mt-1">Variables: {'{{name}} {{service}} {{city}} {{country}} {{company}}'}</div>
            </div>
          )}

          {/* Filters */}
          <div className="border border-slate-200 rounded-xl p-3 flex flex-col gap-3">
            <div className="text-xs font-bold text-slate-700">Target Audience Filters</div>
            <div className="text-[10px] text-slate-400">Leave all empty to target all leads</div>

            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Lead Status</div>
              <div className="flex flex-wrap gap-1.5">
                {LEAD_STATUSES.map(s=>(
                  <button key={s} onClick={()=>toggleFilter('status',s)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${(form.filters.status||[]).includes(s)?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {s.replace(/_/g,' ')}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Service Interest</div>
              <div className="flex flex-wrap gap-1.5">
                {RAULJI_SERVICES.slice(0,8).map(s=>(
                  <button key={s.value} onClick={()=>toggleFilter('service',s.value)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${(form.filters.service||[]).includes(s.value)?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Source</div>
              <div className="flex flex-wrap gap-1.5">
                {LEAD_SOURCES.map(s=>(
                  <button key={s} onClick={()=>toggleFilter('source',s)}
                    className={`text-[10px] px-2 py-1 rounded-full border transition-colors ${(form.filters.source||[]).includes(s)?'border-indigo-400 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>

      {/* Audience Preview Modal */}
      {audience && (
        <Modal open={!!audience} onClose={()=>setAudience(null)} title="Audience Preview"
          footer={<Btn variant="primary" onClick={()=>setAudience(null)}>Close</Btn>}>
          <div className="flex flex-col gap-3">
            <div className="bg-indigo-50 rounded-xl p-4 text-center">
              <div className="text-3xl font-bold text-indigo-700">{audience.count}</div>
              <div className="text-xs text-indigo-500 mt-1">leads match your filters</div>
            </div>
            {audience.sample?.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-slate-600 mb-2">Sample leads:</div>
                {audience.sample.map((l:any,i:number)=>(
                  <div key={i} className="flex items-center gap-2 py-1.5 border-b border-slate-50 text-xs">
                    <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">{l.name[0]}</div>
                    <div className="flex-1">{l.name}</div>
                    <div className="text-slate-400">{l.country || l.city || '—'}</div>
                    <div className="text-slate-400">{l.service || '—'}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Campaign Detail Modal */}
      {detail && (
        <Modal open={!!detail} onClose={()=>setDetail(null)} title={detail.name}
          footer={<Btn variant="secondary" onClick={()=>setDetail(null)}>Close</Btn>}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-3 gap-2">
              {[['Total',detail.totalLeads],['Sent',detail.sentCount],['Failed',detail.failedCount]].map(([k,v])=>(
                <div key={k} className="bg-slate-50 rounded-lg p-3 text-center">
                  <div className="text-lg font-bold text-slate-800">{v||0}</div>
                  <div className="text-[10px] text-slate-500">{k}</div>
                </div>
              ))}
            </div>
            <div className="text-xs text-slate-600">
              <div><span className="font-semibold">Status:</span> {detail.status}</div>
              <div><span className="font-semibold">Channel:</span> {detail.channel}</div>
              {detail.startedAt && <div><span className="font-semibold">Started:</span> {new Date(detail.startedAt).toLocaleString()}</div>}
              {detail.completedAt && <div><span className="font-semibold">Completed:</span> {new Date(detail.completedAt).toLocaleString()}</div>}
            </div>
          </div>
        </Modal>
      )}

      <ToastContainer />
    </>
  );
}
