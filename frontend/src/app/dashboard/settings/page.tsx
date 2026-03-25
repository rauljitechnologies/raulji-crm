'use client';
import { useEffect, useState } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, useToast } from '@/components/ui';

export default function SettingsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [settings,  setSettings]  = useState<any>({});
  const [apiKey,    setApiKey]    = useState('');
  const [saving,    setSaving]    = useState(false);
  const [tab,       setTab]       = useState<'general'|'api'|'integrations'>('general');
  const { toast, ToastContainer } = useToast();

  const [form, setForm] = useState({ currency:'INR', timezone:'Asia/Kolkata', gstRate:'18', invoicePrefix:'INV', quotationPrefix:'QT' });

  const loadCos = async () => { try { const d=await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const load = async () => { if(!companyId) return; try { const d=await companyApi.getSettings(companyId); setSettings(d.settings||{}); setApiKey(d.apiKey||''); setForm(f=>({...f,...d.settings})); } catch {} };
  useEffect(() => { load(); }, [companyId]);

  const save = async () => { setSaving(true); try { await companyApi.updateSettings(companyId, {...form, gstRate:+form.gstRate}); toast('Settings saved!'); } catch(e:any){toast(e.message,'err');} finally{setSaving(false);} };

  const regenKey = async () => { if(!confirm('Regenerate API key? Old key stops working immediately.')) return; try { const d=await companyApi.regenerateKey(companyId); setApiKey(d.apiKey); toast('New API key generated!'); } catch(e:any){toast(e.message,'err');} };

  const INTEGRATIONS = [
    { name:'WhatsApp Business', icon:'💬', desc:'Meta Cloud API for messaging', color:'bg-green-50', connected:false },
    { name:'Google Analytics',  icon:'📊', desc:'Sessions, conversions, traffic', color:'bg-blue-50',  connected:false },
    { name:'Razorpay',          icon:'💳', desc:'Payment links on invoices',    color:'bg-indigo-50',connected:false },
    { name:'SendGrid',          icon:'📧', desc:'Transactional email delivery', color:'bg-cyan-50',  connected:false },
    { name:'Facebook Lead Ads', icon:'📘', desc:'Auto-import from campaigns',   color:'bg-blue-50',  connected:false },
    { name:'Google Search Console',icon:'🔍',desc:'Keyword rankings & clicks',  color:'bg-orange-50',connected:false },
  ];

  return (
    <>
      <Topbar title="Settings" subtitle="Configure your workspace"
        actions={
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
          {(['general','api','integrations'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all capitalize ${tab===t?'bg-white text-slate-900 shadow-sm':'text-slate-500 hover:text-slate-700'}`}>{t}</button>
          ))}
        </div>

        {/* General */}
        {tab==='general' && (
          <div className="grid grid-cols-[1.5fr_1fr] gap-4 items-start">
            <Card>
              <div className="text-xs font-bold text-slate-900 mb-4">Company Settings</div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Sel label="Currency" value={form.currency} onChange={e=>setForm(f=>({...f,currency:e.target.value}))}
                    options={[{value:'INR',label:'INR — ₹ Rupee'},{value:'USD',label:'USD — $'},{value:'EUR',label:'EUR — €'}]} />
                  <Sel label="Timezone" value={form.timezone} onChange={e=>setForm(f=>({...f,timezone:e.target.value}))}
                    options={[{value:'Asia/Kolkata',label:'Asia/Kolkata (IST)'},{value:'UTC',label:'UTC'},{value:'America/New_York',label:'America/New_York'}]} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Sel label="GST Rate" value={form.gstRate} onChange={e=>setForm(f=>({...f,gstRate:e.target.value}))}
                    options={[0,5,12,18,28].map(r=>({value:String(r),label:`${r}%`}))} />
                  <Input label="Invoice Prefix"   value={form.invoicePrefix}   onChange={e=>setForm(f=>({...f,invoicePrefix:e.target.value}))}   placeholder="INV" />
                  <Input label="Quotation Prefix" value={form.quotationPrefix} onChange={e=>setForm(f=>({...f,quotationPrefix:e.target.value}))} placeholder="QT" />
                </div>
                <Btn variant="primary" size="sm" loading={saving} onClick={save} className="self-start">Save Settings</Btn>
              </div>
            </Card>
            <Card>
              <div className="text-xs font-bold text-slate-900 mb-3">Current Plan</div>
              <div className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl p-4 text-white mb-3">
                <div className="text-xs opacity-80 mb-1">Active Plan</div>
                <div className="text-xl font-bold">{companies.find(c=>c.companyId===companyId)?.plan||'STARTER'}</div>
              </div>
              <Btn variant="primary" size="sm" className="w-full">Upgrade Plan</Btn>
            </Card>
          </div>
        )}

        {/* API */}
        {tab==='api' && (
          <div className="grid grid-cols-2 gap-4 items-start">
            <Card>
              <div className="text-xs font-bold text-slate-900 mb-3">API Key</div>
              <div className="bg-slate-900 rounded-xl p-4 flex items-center gap-3 mb-3">
                <code className="text-green-400 text-xs font-mono flex-1 truncate">{apiKey || 'rcrm_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}</code>
                <button onClick={()=>{navigator.clipboard.writeText(apiKey); toast('Copied!');}} className="text-slate-400 hover:text-white transition-colors flex-shrink-0 text-sm">⧉</button>
              </div>
              <div className="text-xs text-slate-500 mb-4">Use as <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700">X-API-Key</code> header in all public API requests.</div>
              <Btn variant="danger" size="sm" onClick={regenKey}>Regenerate Key</Btn>
            </Card>
            <Card>
              <div className="text-xs font-bold text-slate-900 mb-3">Push a lead from any website</div>
              <div className="bg-slate-900 rounded-lg p-3 mb-2">
                <code className="text-green-400 text-xs font-mono whitespace-pre">{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api/v1'}/public/leads \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Rahul","phone":"+91987..."}'`}</code>
              </div>
              <button onClick={()=>{navigator.clipboard.writeText(`curl -X POST ${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api/v1'}/public/leads -H "X-API-Key: ${apiKey}" -H "Content-Type: application/json" -d '{"name":"Name","phone":"+91..."}'`); toast('Copied!');}} className="text-xs text-indigo-600 hover:underline">Copy curl command</button>
            </Card>
          </div>
        )}

        {/* Integrations */}
        {tab==='integrations' && (
          <div className="grid grid-cols-3 gap-4">
            {INTEGRATIONS.map((int,i)=>(
              <Card key={i} className="flex flex-col gap-3">
                <div className={`w-12 h-12 rounded-xl ${int.color} flex items-center justify-center text-2xl`}>{int.icon}</div>
                <div>
                  <div className="text-sm font-bold text-slate-800">{int.name}</div>
                  <div className="text-xs text-slate-400 mt-0.5">{int.desc}</div>
                </div>
                <div className="flex items-center justify-between mt-auto">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${int.connected?'bg-green-50 text-green-700':'bg-slate-100 text-slate-500'}`}>{int.connected?'● Connected':'○ Not connected'}</span>
                  <Btn variant={int.connected?'secondary':'primary'} size="sm">{int.connected?'Configure':'Connect'}</Btn>
                </div>
              </Card>
            ))}
          </div>
        )}

      </div>
      <ToastContainer />
    </>
  );
}
