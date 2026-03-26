'use client';
import { useEffect, useState } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, useToast } from '@/components/ui';

export default function SettingsPage() {
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [companyId,  setCompanyId]  = useState('');
  const [coData,     setCoData]     = useState<any>({});
  const [saving,     setSaving]     = useState(false);
  const [tab,        setTab]        = useState<'profile'|'billing'|'api'|'integrations'>('profile');
  const { toast, ToastContainer }   = useToast();

  // Profile fields
  const [profile, setProfile] = useState({
    name:'', phone:'', email:'', website:'', gst:'',
    address:{ line1:'', city:'', state:'', pincode:'', country:'India' }
  });

  // Billing / bank details
  const [bank, setBank] = useState({
    bankName:'', accountNumber:'', ifsc:'', accountName:'', upiId:'', paymentTerms:'Net 30'
  });

  // General settings
  const [general, setGeneral] = useState({ currency:'INR', timezone:'Asia/Kolkata', gstRate:'18', invoicePrefix:'INV', quotationPrefix:'QT' });

  const loadCos = async () => {
    try { const d=await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); }
    catch {}
  };
  useEffect(()=>{ loadCos(); },[]);

  const load = async () => {
    if(!companyId) return;
    try {
      const d = await companyApi.getSettings(companyId);
      setCoData(d);
      const addr = d.address || {};
      setProfile({ name:d.name||'', phone:d.phone||'', email:d.email||'', website:d.website||'', gst:d.gst||'', address:{ line1:addr.line1||'', city:addr.city||'', state:addr.state||'', pincode:addr.pincode||'', country:addr.country||'India' } });
      const bd = d.bankDetails || {};
      setBank({ bankName:bd.bankName||'', accountNumber:bd.accountNumber||'', ifsc:bd.ifsc||'', accountName:bd.accountName||'', upiId:bd.upiId||'', paymentTerms:bd.paymentTerms||'Net 30' });
      const s = d.settings || {};
      setGeneral({ currency:s.currency||'INR', timezone:s.timezone||'Asia/Kolkata', gstRate:String(s.gstRate||18), invoicePrefix:s.invoicePrefix||'INV', quotationPrefix:s.quotationPrefix||'QT' });
    } catch {}
  };
  useEffect(()=>{ load(); },[companyId]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await companyApi.updateSettings(companyId, {
        phone:   profile.phone,
        email:   profile.email,
        website: profile.website,
        gst:     profile.gst,
        address: profile.address,
      });
      // Also update name
      await companyApi.update(companyId, { name: profile.name });
      toast('Company profile saved!');
    } catch(e:any){ toast(e.message,'err'); } finally{ setSaving(false); }
  };

  const saveBilling = async () => {
    setSaving(true);
    try {
      await companyApi.updateSettings(companyId, { bankDetails: bank });
      toast('Billing details saved! These will appear on all invoices & quotations.');
    } catch(e:any){ toast(e.message,'err'); } finally{ setSaving(false); }
  };

  const saveGeneral = async () => {
    setSaving(true);
    try {
      await companyApi.updateSettings(companyId, { ...general, gstRate: +general.gstRate });
      toast('Settings saved!');
    } catch(e:any){ toast(e.message,'err'); } finally{ setSaving(false); }
  };

  const regenKey = async () => {
    if(!confirm('Regenerate API key? Old key stops working immediately.')) return;
    try { const d=await companyApi.regenerateKey(companyId); setCoData((c:any)=>({...c,apiKey:d.apiKey})); toast('New key generated!'); }
    catch(e:any){ toast(e.message,'err'); }
  };

  const TABS: { key: typeof tab; label: string; desc: string }[] = [
    { key:'profile',      label:'Company Profile', desc:'Name, contact, address, GST' },
    { key:'billing',      label:'Billing Details', desc:'Bank account, UPI — shown on every invoice' },
    { key:'api',          label:'API & Keys',      desc:'API key, public integrations' },
    { key:'integrations', label:'Integrations',    desc:'WhatsApp, GSC, Razorpay, etc.' },
  ];

  return (
    <>
      <Topbar title="Settings" subtitle="Configure your company workspace"
        actions={
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 flex gap-5">

        {/* Left — Tab menu */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-1">
          {TABS.map(t=>(
            <button key={t.key} onClick={()=>setTab(t.key)}
              className={`text-left px-4 py-3 rounded-xl transition-all ${tab===t.key?'bg-indigo-600 text-white shadow-md':'bg-white border border-slate-200 text-slate-700 hover:border-indigo-300'}`}>
              <div className={`text-xs font-bold ${tab===t.key?'text-white':'text-slate-900'}`}>{t.label}</div>
              <div className={`text-xs mt-0.5 ${tab===t.key?'text-indigo-200':'text-slate-400'}`}>{t.desc}</div>
            </button>
          ))}

          {/* Plan card */}
          <div className="mt-4 bg-gradient-to-br from-indigo-600 to-violet-600 rounded-xl p-4 text-white">
            <div className="text-xs opacity-80 mb-1">Current Plan</div>
            <div className="text-xl font-bold">{coData?.plan || 'STARTER'}</div>
            <button className="mt-3 w-full text-xs bg-white/20 hover:bg-white/30 text-white font-semibold py-1.5 rounded-lg transition-colors">
              Upgrade
            </button>
          </div>
        </div>

        {/* Right — Content */}
        <div className="flex-1 min-w-0">

          {/* ── COMPANY PROFILE ── */}
          {tab==='profile' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl">🏢</div>
                <div>
                  <div className="font-bold text-slate-900">Company Profile</div>
                  <div className="text-xs text-slate-400">This info appears on your quotations and invoices as the sender</div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {/* Logo preview */}
                {coData?.logo && (
                  <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <img src={coData.logo} alt="logo" className="h-12 object-contain rounded-lg" />
                    <div className="text-xs text-slate-500">Company logo — shown on PDF header</div>
                  </div>
                )}

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Basic Info</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Company Name *" value={profile.name}    onChange={e=>setProfile(p=>({...p,name:e.target.value}))}    placeholder="Raulji Technologies Pvt Ltd" />
                    <Input label="GST Number"     value={profile.gst}     onChange={e=>setProfile(p=>({...p,gst:e.target.value}))}     placeholder="24AAPL0000A1Z5" />
                    <Input label="Phone"          value={profile.phone}   onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}   placeholder="+91 98765 43210" />
                    <Input label="Email"          value={profile.email}   onChange={e=>setProfile(p=>({...p,email:e.target.value}))}   placeholder="billing@raulji.com" />
                    <Input label="Website"        value={profile.website} onChange={e=>setProfile(p=>({...p,website:e.target.value}))} placeholder="https://rauljitechnologies.com" className="col-span-2" />
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Registered Address</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Address Line 1" value={profile.address.line1}   onChange={e=>setProfile(p=>({...p,address:{...p.address,line1:e.target.value}}))}   placeholder="12, Tech Park, Ring Road" className="col-span-2" />
                    <Input label="City"           value={profile.address.city}    onChange={e=>setProfile(p=>({...p,address:{...p.address,city:e.target.value}}))}    placeholder="Vadodara" />
                    <Input label="State"          value={profile.address.state}   onChange={e=>setProfile(p=>({...p,address:{...p.address,state:e.target.value}}))}   placeholder="Gujarat" />
                    <Input label="Pincode"        value={profile.address.pincode} onChange={e=>setProfile(p=>({...p,address:{...p.address,pincode:e.target.value}}))} placeholder="390001" />
                    <Input label="Country"        value={profile.address.country} onChange={e=>setProfile(p=>({...p,address:{...p.address,country:e.target.value}}))} placeholder="India" />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Btn variant="primary" size="md" loading={saving} onClick={saveProfile}>Save Company Profile</Btn>
                </div>
              </div>
            </Card>
          )}

          {/* ── BILLING DETAILS ── */}
          {tab==='billing' && (
            <div className="flex flex-col gap-4">
              <Card>
                <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">🏦</div>
                  <div>
                    <div className="font-bold text-slate-900">Bank & Payment Details</div>
                    <div className="text-xs text-slate-400">Saved once here — automatically shown on every invoice PDF. No need to re-enter each time.</div>
                  </div>
                </div>

                {/* Info banner */}
                <div className="flex items-start gap-2.5 bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-4">
                  <span className="text-blue-500 text-lg flex-shrink-0 mt-0.5">ℹ</span>
                  <div className="text-xs text-blue-700 leading-relaxed">
                    <strong>Set these details once</strong> and they will appear on the bottom of every invoice PDF you generate — bank name, account number, IFSC, and UPI ID. Your clients can use this to make payment directly.
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Bank Account</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Bank Name"              value={bank.bankName}       onChange={e=>setBank(b=>({...b,bankName:e.target.value}))}       placeholder="HDFC Bank" />
                    <Input label="Account Holder Name"    value={bank.accountName}    onChange={e=>setBank(b=>({...b,accountName:e.target.value}))}    placeholder="Raulji Technologies Pvt Ltd" />
                    <Input label="Account Number"         value={bank.accountNumber}  onChange={e=>setBank(b=>({...b,accountNumber:e.target.value}))}  placeholder="50100123456789" />
                    <Input label="IFSC Code"              value={bank.ifsc}           onChange={e=>setBank(b=>({...b,ifsc:e.target.value}))}           placeholder="HDFC0001234" />
                  </div>

                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mt-2">UPI & Payment Terms</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="UPI ID (optional)"      value={bank.upiId}          onChange={e=>setBank(b=>({...b,upiId:e.target.value}))}          placeholder="raulji@hdfc" />
                    <Sel   label="Default Payment Terms"  value={bank.paymentTerms}   onChange={e=>setBank(b=>({...b,paymentTerms:e.target.value}))}
                      options={[{value:'Net 30',label:'Net 30 Days'},{value:'Net 15',label:'Net 15 Days'},{value:'Net 7',label:'Net 7 Days'},{value:'Due on Receipt',label:'Due on Receipt'},{value:'50% Advance',label:'50% Advance'}]} />
                  </div>

                  {/* Preview */}
                  {bank.bankName && (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-3">Preview — as shown on invoice PDF</div>
                      <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs">
                        <div className="font-bold text-slate-700 mb-2">Bank Details</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-600">
                          <div><span className="text-slate-400">Bank:</span> {bank.bankName}</div>
                          <div><span className="text-slate-400">Name:</span> {bank.accountName}</div>
                          <div><span className="text-slate-400">A/C:</span> {bank.accountNumber}</div>
                          <div><span className="text-slate-400">IFSC:</span> {bank.ifsc}</div>
                          {bank.upiId && <div className="col-span-2"><span className="text-slate-400">UPI:</span> {bank.upiId}</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <Btn variant="primary" size="md" loading={saving} onClick={saveBilling}>Save Billing Details</Btn>
                  </div>
                </div>
              </Card>

              {/* General settings */}
              <Card>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">⚙</div>
                  <div>
                    <div className="font-bold text-slate-900">Invoice & Quotation Settings</div>
                    <div className="text-xs text-slate-400">Currency, GST rate, numbering prefixes</div>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Sel label="Currency" value={general.currency} onChange={e=>setGeneral(g=>({...g,currency:e.target.value}))}
                    options={[{value:'INR',label:'INR — ₹ Rupee'},{value:'USD',label:'USD — $ Dollar'},{value:'EUR',label:'EUR — € Euro'}]} />
                  <Sel label="Default GST Rate" value={general.gstRate} onChange={e=>setGeneral(g=>({...g,gstRate:e.target.value}))}
                    options={[0,5,12,18,28].map(r=>({value:String(r),label:`${r}%`}))} />
                  <Sel label="Timezone" value={general.timezone} onChange={e=>setGeneral(g=>({...g,timezone:e.target.value}))}
                    options={[{value:'Asia/Kolkata',label:'Asia/Kolkata (IST)'},{value:'UTC',label:'UTC'},{value:'America/New_York',label:'America/NY'}]} />
                  <Input label="Invoice Prefix"   value={general.invoicePrefix}   onChange={e=>setGeneral(g=>({...g,invoicePrefix:e.target.value}))}   placeholder="INV" />
                  <Input label="Quotation Prefix" value={general.quotationPrefix} onChange={e=>setGeneral(g=>({...g,quotationPrefix:e.target.value}))} placeholder="QT" />
                </div>
                <div className="flex justify-end mt-4">
                  <Btn variant="primary" size="sm" loading={saving} onClick={saveGeneral}>Save Settings</Btn>
                </div>
              </Card>
            </div>
          )}

          {/* ── API & KEYS ── */}
          {tab==='api' && (
            <div className="flex flex-col gap-4">
              <Card>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">🔑</div>
                  <div><div className="font-bold text-slate-900">API Key</div><div className="text-xs text-slate-400">Use this to push leads from any external website or form</div></div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 flex items-center gap-3 mb-3">
                  <code className="text-green-400 text-xs font-mono flex-1 truncate">{coData?.apiKey || 'rcrm_live_xxxxxx_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}</code>
                  <button onClick={()=>{navigator.clipboard.writeText(coData?.apiKey||'');toast('Copied!');}} className="text-slate-400 hover:text-white transition-colors text-sm flex-shrink-0">Copy</button>
                </div>
                <div className="text-xs text-slate-500 mb-4">Use as <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-700 font-mono">X-API-Key</code> header in all public API requests.</div>
                <Btn variant="danger" size="sm" onClick={regenKey}>Regenerate Key</Btn>
              </Card>

              <Card>
                <div className="font-bold text-slate-900 mb-3 text-sm">Quick Example — Push a lead</div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-green-400 text-xs font-mono whitespace-pre">{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api/v1'}/public/leads \\
  -H "X-API-Key: ${coData?.apiKey||'YOUR_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Rahul Sharma","phone":"+919876543210","source":"website_form"}'`}</code>
                </div>
                <button onClick={()=>{navigator.clipboard.writeText(`curl -X POST ${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api/v1'}/public/leads -H "X-API-Key: ${coData?.apiKey||'YOUR_KEY'}" -H "Content-Type: application/json" -d '{"name":"Name","phone":"+91..."}'`);toast('Copied!');}} className="text-xs text-indigo-600 hover:underline mt-2 block">Copy command</button>
              </Card>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {tab==='integrations' && (
            <div className="grid grid-cols-2 gap-4">
              {[
                { name:'WhatsApp Business', icon:'💬', desc:'Meta Cloud API for automated messages',    color:'bg-green-50',  connected:false },
                { name:'Razorpay',          icon:'💳', desc:'Payment links on invoices',               color:'bg-indigo-50', connected:false },
                { name:'Google Analytics',  icon:'📊', desc:'Sessions, conversions, traffic sources',  color:'bg-blue-50',   connected:false },
                { name:'Google Search Console',icon:'🔍',desc:'Keyword rankings, clicks, impressions', color:'bg-orange-50', connected:false },
                { name:'SendGrid',          icon:'📧', desc:'Transactional email delivery',            color:'bg-cyan-50',   connected:false },
                { name:'Facebook Lead Ads', icon:'📘', desc:'Auto-import leads from campaigns',        color:'bg-blue-50',   connected:false },
              ].map((int,i)=>(
                <Card key={i} className="flex flex-col gap-3">
                  <div className={`w-12 h-12 rounded-xl ${int.color} flex items-center justify-center text-2xl`}>{int.icon}</div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{int.name}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{int.desc}</div>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${int.connected?'bg-green-50 text-green-700':'bg-slate-100 text-slate-500'}`}>
                      {int.connected?'Connected':'Not connected'}
                    </span>
                    <Btn variant={int.connected?'secondary':'primary'} size="sm">{int.connected?'Configure':'Connect'}</Btn>
                  </div>
                </Card>
              ))}
            </div>
          )}

        </div>
      </div>

      <ToastContainer />
    </>
  );
}
