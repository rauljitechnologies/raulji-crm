'use client';
import { useEffect, useState } from 'react';
import { companyApi, templateApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Modal, useToast } from '@/components/ui';

const CATEGORIES = ['WELCOME','FOLLOWUP','PROPOSAL','CLOSING','REMINDER','CUSTOM'];
const CHANNELS   = ['WHATSAPP','EMAIL','SMS'];
const KNOWN_VARS = ['name','service','city','state','country','phone','email','status','company','source','priority'];

const CAT_BADGE: Record<string,string> = {
  WELCOME:'bg-emerald-100 text-emerald-700', FOLLOWUP:'bg-blue-100 text-blue-700',
  PROPOSAL:'bg-indigo-100 text-indigo-700', CLOSING:'bg-purple-100 text-purple-700',
  REMINDER:'bg-amber-100 text-amber-700', CUSTOM:'bg-slate-100 text-slate-600'
};
const CH_ICON: Record<string,string> = { WHATSAPP:'💬', EMAIL:'📧', SMS:'📱' };

const BLANK = { name:'', category:'CUSTOM', channel:'WHATSAPP', subject:'', body:'', isActive:true };

export default function TemplatesPage() {
  const [companyId,  setCompanyId]  = useState('');
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [templates,  setTemplates]  = useState<any[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState(false);
  const [editTpl,    setEditTpl]    = useState<any>(null);
  const [form,       setForm]       = useState<any>({ ...BLANK });
  const [preview,    setPreview]    = useState('');
  const [detectedVars, setDetectedVars] = useState<string[]>([]);
  const [filterCh,   setFilterCh]   = useState('');
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => {
    try { const d = await companyApi.mine(); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try { const d = await templateApi.list(companyId, filterCh ? { channel: filterCh } : {}); setTemplates(d.templates || []); }
    catch(e:any){ toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [companyId, filterCh]);

  const detectVars = (body: string) => {
    const matches = [...body.matchAll(/\{\{(\w+)\}\}/g)];
    setDetectedVars([...new Set(matches.map(m=>m[1]))]);
  };

  const updateBody = (val: string) => {
    setForm((f:any) => ({ ...f, body: val }));
    detectVars(val);
    // Live preview with sample data
    const sample: Record<string,string> = { name:'Rahul Sharma', service:'Website Development', city:'Ahmedabad', state:'Gujarat', country:'India', phone:'9876543210', email:'rahul@example.com', company:'Raulji Technologies', status:'NEW', source:'MANUAL', priority:'HIGH' };
    setPreview(val.replace(/\{\{(\w+)\}\}/g, (_,k) => sample[k] || `{{${k}}}`));
  };

  const openCreate = () => { setEditTpl(null); setForm({ ...BLANK }); setPreview(''); setDetectedVars([]); setShowForm(true); };
  const openEdit   = (t: any) => { setEditTpl(t); setForm({ name:t.name, category:t.category, channel:t.channel, subject:t.subject||'', body:t.body, isActive:t.isActive }); detectVars(t.body); setPreview(t.body); setShowForm(true); };

  const save = async () => {
    if (!form.name || !form.body) return toast('Name and body required','err');
    setSaving(true);
    try {
      if (editTpl) await templateApi.update(companyId, editTpl.templateId, form);
      else         await templateApi.create(companyId, form);
      toast(editTpl ? 'Template updated!' : 'Template created!');
      setShowForm(false);
      load();
    } catch(e:any){ toast(e.message,'err'); }
    finally { setSaving(false); }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return;
    try { await templateApi.remove(companyId, id); toast('Deleted.'); load(); }
    catch(e:any){ toast(e.message,'err'); }
  };

  const filtered = templates;

  return (
    <>
      <Topbar title="Message Templates" subtitle="Create reusable WhatsApp & email templates with variables"
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={openCreate}>+ New Template</Btn>
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Channel filter */}
        <div className="flex gap-2">
          {['','WHATSAPP','EMAIL','SMS'].map(ch=>(
            <button key={ch} onClick={()=>setFilterCh(ch)}
              className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${filterCh===ch?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-500 hover:border-slate-300'}`}>
              {ch ? `${CH_ICON[ch]} ${ch}` : 'All Channels'}
            </button>
          ))}
          <span className="ml-auto text-xs text-slate-400 self-center">{filtered.length} templates</span>
        </div>

        {/* Variables reference */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-start gap-3">
          <div className="text-xs font-bold text-slate-600 flex-shrink-0 mt-0.5">Variables:</div>
          <div className="flex flex-wrap gap-1.5">
            {KNOWN_VARS.map(v=>(
              <span key={v} className="text-[10px] font-mono bg-white border border-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>
            ))}
          </div>
        </div>

        {loading ? <div className="py-10 text-center text-slate-400 text-xs">Loading...</div>
        : filtered.length === 0 ? (
          <Card className="py-12 text-center">
            <div className="text-4xl mb-3">📝</div>
            <div className="text-sm font-semibold text-slate-700">No templates yet</div>
            <div className="text-xs text-slate-400 mt-1 mb-4">Create reusable message templates for WhatsApp automation</div>
            <Btn variant="primary" size="sm" onClick={openCreate}>Create First Template</Btn>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filtered.map((t:any) => (
              <Card key={t.templateId} className="p-0 flex flex-col">
                <div className="px-4 pt-4 pb-3 flex items-start justify-between gap-2 border-b border-slate-100">
                  <div>
                    <div className="text-sm font-semibold text-slate-800">{t.name}</div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${CAT_BADGE[t.category]||'bg-slate-100 text-slate-500'}`}>{t.category}</span>
                      <span className="text-[10px] text-slate-500">{CH_ICON[t.channel]} {t.channel}</span>
                      {t.variables?.length > 0 && <span className="text-[10px] text-slate-400">{t.variables.length} vars</span>}
                    </div>
                  </div>
                  <div className={`w-2 h-2 rounded-full mt-1 flex-shrink-0 ${t.isActive?'bg-emerald-400':'bg-slate-300'}`} />
                </div>
                {t.subject && (
                  <div className="px-4 py-2 text-[10px] text-slate-500 border-b border-slate-50">
                    <span className="font-semibold text-slate-600">Subject:</span> {t.subject}
                  </div>
                )}
                <div className="px-4 py-3 flex-1">
                  <div className="text-xs text-slate-600 leading-relaxed line-clamp-3">{t.body}</div>
                </div>
                {t.variables?.length > 0 && (
                  <div className="px-4 pb-3 flex flex-wrap gap-1">
                    {t.variables.map((v:string)=>(
                      <span key={v} className="text-[10px] font-mono bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">{`{{${v}}}`}</span>
                    ))}
                  </div>
                )}
                <div className="px-4 pb-3 flex gap-2">
                  <button onClick={()=>openEdit(t)} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50">Edit</button>
                  <button onClick={()=>remove(t.templateId, t.name)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50">Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <Modal open={showForm} onClose={()=>setShowForm(false)} title={editTpl ? 'Edit Template' : 'New Template'}
        footer={<><Btn variant="secondary" onClick={()=>setShowForm(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={save}>{editTpl?'Save':'Create'}</Btn></>}>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-3">
            <Input label="Template Name *" value={form.name} onChange={(e:any)=>setForm((f:any)=>({...f,name:e.target.value}))} placeholder="Welcome Message" />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">Category</div>
                <select value={form.category} onChange={(e:any)=>setForm((f:any)=>({...f,category:e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 mb-1">Channel</div>
                <select value={form.channel} onChange={(e:any)=>setForm((f:any)=>({...f,channel:e.target.value}))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                  {CHANNELS.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            {form.channel === 'EMAIL' && (
              <Input label="Email Subject" value={form.subject} onChange={(e:any)=>setForm((f:any)=>({...f,subject:e.target.value}))} placeholder="Exciting news for you!" />
            )}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-1">Message Body *</div>
              <textarea value={form.body} onChange={e=>updateBody(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" rows={8}
                placeholder={`Hi {{name}},\n\nThank you for reaching out to {{company}} regarding {{service}}.\n\nWe will contact you shortly at {{phone}}.\n\nBest regards,\nRaulji Technologies`} />
            </div>
            {detectedVars.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {detectedVars.map(v=>(
                  <span key={v} className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${KNOWN_VARS.includes(v)?'bg-indigo-50 text-indigo-600':'bg-red-50 text-red-500'}`}>{`{{${v}}}`}</span>
                ))}
              </div>
            )}
          </div>
          {/* Preview */}
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Live Preview</div>
            <div className="bg-slate-900 rounded-xl p-4 h-[calc(100%-24px)]">
              {preview ? (
                <div className="bg-emerald-600 rounded-2xl rounded-tl-none px-4 py-3 text-xs text-white leading-relaxed whitespace-pre-wrap">{preview}</div>
              ) : (
                <div className="text-slate-500 text-xs italic mt-2">Type your message to see preview with sample data</div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
