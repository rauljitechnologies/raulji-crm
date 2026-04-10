'use client';
import { useEffect, useState } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, useToast } from '@/components/ui';

export default function SettingsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [cid,       setCid]       = useState('');
  const [coData,    setCoData]    = useState<any>({});
  const [saving,    setSaving]    = useState(false);
  const [tab,       setTab]       = useState<'profile'|'billing'|'general'|'api'|'integrations'>('profile');
  const { toast, ToastContainer } = useToast();

  const [profile, setProfile] = useState({
    name:'', logo:'', phone:'', email:'', website:'', gst:'', udyamNumber:'',
    address: { line1:'', city:'', state:'', pincode:'', country:'India' }
  });
  const [bank, setBank] = useState({
    bankName:'', accountNumber:'', ifsc:'', accountName:'', upiId:'', paymentTerms:'Net 30'
  });
  const [general, setGeneral] = useState({ currency:'INR', timezone:'Asia/Kolkata', gstRate:'18', invoicePrefix:'INV', quotationPrefix:'QT' });
  const [integrations, setIntegrations] = useState({
    gaTrackingId: '',     // GA4 Measurement ID  e.g. G-XXXXXXXXXX
    gaPropertyId: '',     // GA4 Property ID     e.g. 123456789
    gscSiteUrl:   '',     // Search Console URL  e.g. https://example.com
    fbPixelId:    '',     // Facebook Pixel ID
    razorpayKeyId:'',     // Razorpay Key ID
  });

  const loadCos = async () => {
    try { const d=await companyApi.mine(); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCid(cos[0].companyId); } catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!cid) return;
    try {
      const d    = await companyApi.getSettings(cid);
      setCoData(d);
      const a    = d.address || {};
      const bd   = d.bankDetails || {};
      const s    = d.settings || {};
      setProfile({ name:d.name||'', logo:d.logo||'', phone:d.phone||'', email:d.email||'', website:d.website||'', gst:d.gst||'', udyamNumber:s.udyamNumber||'', address:{line1:a.line1||'',city:a.city||'',state:a.state||'',pincode:a.pincode||'',country:a.country||'India'} });
      setBank({ bankName:bd.bankName||'', accountNumber:bd.accountNumber||'', ifsc:bd.ifsc||'', accountName:bd.accountName||'', upiId:bd.upiId||'', paymentTerms:bd.paymentTerms||'Net 30' });
      setGeneral({ currency:s.currency||'INR', timezone:s.timezone||'Asia/Kolkata', gstRate:String(s.gstRate||18), invoicePrefix:s.invoicePrefix||'INV', quotationPrefix:s.quotationPrefix||'QT' });
      setIntegrations({
        gaTrackingId:  s.gaTrackingId  || '',
        gaPropertyId:  s.gaPropertyId  || '',
        gscSiteUrl:    s.gscSiteUrl    || '',
        fbPixelId:     s.fbPixelId     || '',
        razorpayKeyId: s.razorpayKeyId || '',
      });
    } catch {}
  };
  useEffect(() => { load(); }, [cid]);

  const saveProfile = async () => {
    setSaving(true);
    try {
      await companyApi.update(cid, { name: profile.name });
      await companyApi.updateSettings(cid, { phone:profile.phone, email:profile.email, website:profile.website, gst:profile.gst, logo:profile.logo, address:profile.address, udyamNumber:profile.udyamNumber });
      setCoData((d:any) => ({ ...d, logo: profile.logo, name: profile.name }));
      toast('Company profile saved!');
    } catch(e:any){ toast(e.message,'err'); } finally { setSaving(false); }
  };

  const saveBilling = async () => {
    setSaving(true);
    try { await companyApi.updateSettings(cid, { bankDetails: bank }); toast('Billing details saved — will appear on all invoices!'); }
    catch(e:any){ toast(e.message,'err'); } finally { setSaving(false); }
  };

  const saveGeneral = async () => {
    setSaving(true);
    try { await companyApi.updateSettings(cid, { ...general, gstRate: +general.gstRate }); toast('Settings saved!'); }
    catch(e:any){ toast(e.message,'err'); } finally { setSaving(false); }
  };

  const saveIntegrations = async () => {
    setSaving(true);
    try { await companyApi.updateSettings(cid, { ...integrations }); toast('Integration settings saved!'); }
    catch(e:any){ toast(e.message,'err'); } finally { setSaving(false); }
  };

  const regenKey = async () => {
    if (!confirm('Regenerate API key? Old key stops working immediately.')) return;
    try { const d=await companyApi.regenerateKey(cid); setCoData((c:any)=>({...c,apiKey:d.apiKey})); toast('New API key generated!'); }
    catch(e:any){ toast(e.message,'err'); }
  };

  const TABS = [
    { key:'profile',      label:'Company Profile',  icon:'🏢', desc:'Name, logo, contact, address, GST' },
    { key:'billing',      label:'Billing Details',  icon:'🏦', desc:'Bank account — auto-fills every invoice' },
    { key:'general',      label:'Settings',         icon:'⚙',  desc:'Currency, GST rate, prefixes' },
    { key:'api',          label:'API & Keys',        icon:'🔑', desc:'API key, public integrations' },
    { key:'integrations', label:'Integrations',     icon:'🔌', desc:'WhatsApp, Razorpay, Analytics' },
  ] as const;

  return (
    <>
      <Topbar title="Settings" subtitle="Configure your company workspace"
        actions={
          <select value={cid} onChange={e => setCid(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        }
      />
      <div className="flex-1 overflow-y-auto p-5 flex gap-5 items-start">
        {/* Sidebar */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-1.5">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className="text-left px-4 py-3 rounded-xl transition-all"
              style={{
                background: tab===t.key ? '#3199d4' : '#ffffff',
                border: `1px solid ${tab===t.key ? '#3199d4' : '#e2eaf2'}`,
                boxShadow: tab===t.key ? '0 4px 12px rgba(49,153,212,0.25)' : 'none',
              }}>
              <div className="flex items-center gap-2 mb-0.5">
                <span>{t.icon}</span>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: tab===t.key ? '#ffffff' : '#192b3f' }}>{t.label}</span>
              </div>
              <div style={{ fontSize: 11, color: tab===t.key ? 'rgba(255,255,255,0.75)' : '#7a9baf' }}>{t.desc}</div>
            </button>
          ))}
          <div className="mt-3 rounded-xl p-4 text-white" style={{ background: 'linear-gradient(135deg, #192b3f 0%, #2d5c7b 100%)' }}>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 2 }}>Current Plan</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{coData?.plan || 'STARTER'}</div>
            <button className="mt-3 w-full text-xs font-semibold py-1.5 rounded-lg transition-colors" style={{ background: 'rgba(49,153,212,0.3)', color: '#ffffff' }}>Upgrade Plan</button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">

          {/* ── PROFILE ── */}
          {tab === 'profile' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center text-xl">🏢</div>
                <div>
                  <div className="font-bold text-slate-900">Company Profile</div>
                  <div className="text-xs text-slate-400">Appears on all quotations and invoices as the sender / "From" section</div>
                </div>
              </div>
              <div className="flex flex-col gap-4">
                {/* Logo preview + URL */}
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Company Logo</div>
                  <div className="flex items-center gap-4">
                    <div className="flex-shrink-0">
                      {profile.logo
                        ? <img src={profile.logo} alt="logo" className="h-14 w-14 rounded-xl object-contain border border-slate-200 bg-white p-1"
                            onError={(e: any) => { e.target.style.display='none'; }}/>
                        : <div className="h-14 w-14 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-xl">
                            {profile.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()||'?'}
                          </div>
                      }
                    </div>
                    <div className="flex-1">
                      <Input label="Logo URL (paste image link)" value={profile.logo} onChange={e=>setProfile(p=>({...p,logo:e.target.value}))} placeholder="https://yoursite.com/logo.png" />
                      <div className="text-xs text-slate-400 mt-1">Paste a public image URL. This logo appears on all invoice and quotation PDFs.</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Basic Info</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Company Name *" value={profile.name}    onChange={e=>setProfile(p=>({...p,name:e.target.value}))}    placeholder="Raulji Technologies Pvt Ltd" />
                    <Input label="GSTIN"          value={profile.gst}     onChange={e=>setProfile(p=>({...p,gst:e.target.value}))}     placeholder="24AAPL0000A1Z5" />
                    <Input label="Phone"          value={profile.phone}   onChange={e=>setProfile(p=>({...p,phone:e.target.value}))}   placeholder="+91 98765 43210" />
                    <Input label="Email"          value={profile.email}   onChange={e=>setProfile(p=>({...p,email:e.target.value}))}   placeholder="billing@raulji.com" />
                    <Input label="Website"        value={profile.website} onChange={e=>setProfile(p=>({...p,website:e.target.value}))} placeholder="https://rauljitechnologies.com" className="col-span-2" />
                    <div className="col-span-2">
                      <Input label="Udyam Registration Number (if applicable)" value={profile.udyamNumber} onChange={e=>setProfile(p=>({...p,udyamNumber:e.target.value.toUpperCase()}))} placeholder="UDYAM-GJ-00-0000000" />
                      <div className="text-xs text-slate-400 mt-1">MSME / Udyam Aadhar registration number — printed on invoices when filled.</div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Registered Address</div>
                  <div className="grid grid-cols-2 gap-3">
                    <Input label="Address Line 1" value={profile.address.line1}   onChange={e=>setProfile(p=>({...p,address:{...p.address,line1:e.target.value}}))}   placeholder="12 Tech Park, Ring Road" className="col-span-2" />
                    <Input label="City"           value={profile.address.city}    onChange={e=>setProfile(p=>({...p,address:{...p.address,city:e.target.value}}))}    placeholder="Vadodara" />
                    <Input label="State"          value={profile.address.state}   onChange={e=>setProfile(p=>({...p,address:{...p.address,state:e.target.value}}))}   placeholder="Gujarat" />
                    <Input label="Pincode"        value={profile.address.pincode} onChange={e=>setProfile(p=>({...p,address:{...p.address,pincode:e.target.value}}))} placeholder="390001" />
                    <Input label="Country"        value={profile.address.country} onChange={e=>setProfile(p=>({...p,address:{...p.address,country:e.target.value}}))} placeholder="India" />
                  </div>
                </div>
                <div className="flex justify-end pt-2">
                  <Btn variant="primary" loading={saving} onClick={saveProfile}>Save Company Profile</Btn>
                </div>
              </div>
            </Card>
          )}

          {/* ── BILLING ── */}
          {tab === 'billing' && (
            <Card>
              <div className="flex items-center gap-3 mb-5 pb-4 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-xl">🏦</div>
                <div>
                  <div className="font-bold text-slate-900">Bank &amp; Payment Details</div>
                  <div className="text-xs text-slate-400">Save once — automatically shown on every invoice PDF. No need to enter each time.</div>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3.5 mb-4 flex items-start gap-2.5">
                <span className="text-blue-500 text-base mt-0.5 flex-shrink-0">ℹ</span>
                <div className="text-xs text-blue-700 leading-relaxed">These bank details appear at the bottom of every invoice PDF so clients can pay directly. They also auto-fill the bank details section when you create a new invoice.
                  {profile.udyamNumber && <span className="block mt-1 text-green-700 font-semibold">Udyam: {profile.udyamNumber} — will print on invoices.</span>}
                  {!profile.udyamNumber && <span className="block mt-1 text-slate-500">To add your Udyam Registration number, go to <strong>Company Profile</strong> tab.</span>}
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Bank Name"           value={bank.bankName}       onChange={e=>setBank(b=>({...b,bankName:e.target.value}))}       placeholder="HDFC Bank" />
                  <Input label="Account Holder Name" value={bank.accountName}    onChange={e=>setBank(b=>({...b,accountName:e.target.value}))}    placeholder="Raulji Technologies Pvt Ltd" />
                  <Input label="Account Number"      value={bank.accountNumber}  onChange={e=>setBank(b=>({...b,accountNumber:e.target.value}))}  placeholder="50100123456789" />
                  <Input label="IFSC Code"           value={bank.ifsc}           onChange={e=>setBank(b=>({...b,ifsc:e.target.value}))}           placeholder="HDFC0001234" />
                  <Input label="UPI ID (optional)"   value={bank.upiId}          onChange={e=>setBank(b=>({...b,upiId:e.target.value}))}          placeholder="raulji@hdfc" />
                  <Sel   label="Default Payment Terms" value={bank.paymentTerms} onChange={e=>setBank(b=>({...b,paymentTerms:e.target.value}))}
                    options={[{value:'Net 30',label:'Net 30 Days'},{value:'Net 15',label:'Net 15 Days'},{value:'Net 7',label:'Net 7 Days'},{value:'Due on Receipt',label:'Due on Receipt'},{value:'50% Advance',label:'50% Advance'}]} />
                </div>
                {/* Preview */}
                {bank.bankName && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mt-2">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview — as it appears on invoice PDF</div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs">
                      <div className="font-bold text-slate-700 mb-2 text-sm">Payment Details</div>
                      <div className="grid grid-cols-2 gap-y-1.5 gap-x-4 text-slate-600">
                        <div><span className="text-slate-400">Bank: </span><strong>{bank.bankName}</strong></div>
                        <div><span className="text-slate-400">Name: </span><strong>{bank.accountName}</strong></div>
                        <div><span className="text-slate-400">A/C: </span><span className="font-mono font-bold">{bank.accountNumber}</span></div>
                        <div><span className="text-slate-400">IFSC: </span><span className="font-mono font-bold">{bank.ifsc}</span></div>
                        {bank.upiId && <div className="col-span-2"><span className="text-slate-400">UPI: </span><span className="text-indigo-600 font-bold">{bank.upiId}</span></div>}
                      </div>
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-2">
                  <Btn variant="primary" loading={saving} onClick={saveBilling}>Save Billing Details</Btn>
                </div>
              </div>
            </Card>
          )}

          {/* ── GENERAL ── */}
          {tab === 'general' && (
            <Card>
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-xl">⚙</div>
                <div><div className="font-bold text-slate-900">General Settings</div><div className="text-xs text-slate-400">Currency, GST rate, document prefixes</div></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Sel label="Currency"   value={general.currency}   onChange={e=>setGeneral(g=>({...g,currency:e.target.value}))}
                  options={[{value:'INR',label:'INR — ₹ Rupee'},{value:'USD',label:'USD — $ Dollar'},{value:'EUR',label:'EUR — € Euro'}]} />
                <Sel label="Default GST Rate" value={general.gstRate} onChange={e=>setGeneral(g=>({...g,gstRate:e.target.value}))}
                  options={[0,5,12,18,28].map(r=>({value:String(r),label:`${r}%`}))} />
                <Sel label="Timezone"   value={general.timezone}   onChange={e=>setGeneral(g=>({...g,timezone:e.target.value}))}
                  options={[{value:'Asia/Kolkata',label:'Asia/Kolkata (IST)'},{value:'UTC',label:'UTC'},{value:'America/New_York',label:'America/NY'}]} />
                <Input label="Invoice Prefix"   value={general.invoicePrefix}   onChange={e=>setGeneral(g=>({...g,invoicePrefix:e.target.value}))}   placeholder="INV" />
                <Input label="Quotation Prefix" value={general.quotationPrefix} onChange={e=>setGeneral(g=>({...g,quotationPrefix:e.target.value}))} placeholder="QT" />
              </div>
              <div className="flex justify-end mt-4"><Btn variant="primary" size="sm" loading={saving} onClick={saveGeneral}>Save Settings</Btn></div>
            </Card>
          )}

          {/* ── API ── */}
          {tab === 'api' && (
            <div className="flex flex-col gap-4">
              <Card>
                <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-xl">🔑</div>
                  <div><div className="font-bold text-slate-900">API Key</div><div className="text-xs text-slate-400">Use to push leads from any website or form</div></div>
                </div>
                <div className="bg-slate-900 rounded-xl p-4 flex items-center gap-3 mb-3">
                  <code className="text-green-400 text-xs font-mono flex-1 truncate">{coData?.apiKey || 'rcrm_live_xxxxxx_xxxxxxxxxxxxxxxx'}</code>
                  <button onClick={() => { navigator.clipboard.writeText(coData?.apiKey||''); toast('Copied!'); }} className="text-slate-400 hover:text-white text-sm transition-colors flex-shrink-0">Copy</button>
                </div>
                <div className="text-xs text-slate-500 mb-4">Use as <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">X-API-Key</code> header in API requests.</div>
                <Btn variant="danger" size="sm" onClick={regenKey}>Regenerate Key</Btn>
              </Card>
              <Card>
                <div className="font-bold text-slate-900 text-sm mb-3">Push leads from any website</div>
                <div className="bg-slate-900 rounded-xl p-4">
                  <code className="text-green-400 text-xs font-mono whitespace-pre-wrap">{`curl -X POST ${process.env.NEXT_PUBLIC_API_URL||'http://localhost:4000/api/v1'}/public/leads \\
  -H "X-API-Key: ${coData?.apiKey||'YOUR_KEY'}" \\
  -H "Content-Type: application/json" \\
  -d '{"name":"Rahul","phone":"+91987..."}'`}</code>
                </div>
              </Card>
            </div>
          )}

          {/* ── INTEGRATIONS ── */}
          {tab === 'integrations' && (
            <div className="flex flex-col gap-4">

              {/* ── Google Analytics GA4 ── */}
              <Card>
                <div className="flex items-start gap-4 pb-4 mb-4" style={{ borderBottom: '1px solid #f0f5fa' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#e8f4fd' }}>
                    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none">
                      <path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z" fill="#F57C00"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#192b3f' }}>Google Analytics 4</span>
                      {integrations.gaTrackingId
                        ? <span style={{ fontSize: 11, fontWeight: 600, background: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: 9999 }}>● Connected</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, background: '#f0f5fa', color: '#7a9baf', padding: '2px 8px', borderRadius: 9999 }}>Not connected</span>
                      }
                    </div>
                    <p style={{ fontSize: 12.5, color: '#7a9baf' }}>Track website visitors, conversions, and traffic sources per company domain.</p>
                  </div>
                </div>

                <div style={{ background: '#f8fbfd', border: '1px solid #e2eaf2', borderRadius: 10, padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#3199d4', marginBottom: 6 }}>Setup Instructions</div>
                  <ol style={{ fontSize: 12, color: '#64748b', paddingLeft: 16, lineHeight: 1.8, margin: 0 }}>
                    <li>Go to <strong>analytics.google.com</strong> → Admin → Create Property</li>
                    <li>Copy your <strong>Measurement ID</strong> (format: <code style={{ background: '#e2eaf2', padding: '1px 5px', borderRadius: 4 }}>G-XXXXXXXXXX</code>)</li>
                    <li>Copy your <strong>Property ID</strong> (numeric, e.g. <code style={{ background: '#e2eaf2', padding: '1px 5px', borderRadius: 4 }}>123456789</code>)</li>
                    <li>Paste both below and click Save — tracking activates immediately in this CRM</li>
                  </ol>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <Input
                      label="GA4 Measurement ID *"
                      value={integrations.gaTrackingId}
                      onChange={e => setIntegrations(i => ({ ...i, gaTrackingId: e.target.value }))}
                      placeholder="G-XXXXXXXXXX"
                    />
                    <p style={{ fontSize: 11, color: '#7a9baf', marginTop: 4 }}>Found in GA4 Admin → Data Streams</p>
                  </div>
                  <div>
                    <Input
                      label="GA4 Property ID (for API reports)"
                      value={integrations.gaPropertyId}
                      onChange={e => setIntegrations(i => ({ ...i, gaPropertyId: e.target.value }))}
                      placeholder="123456789"
                    />
                    <p style={{ fontSize: 11, color: '#7a9baf', marginTop: 4 }}>Found in GA4 Admin → Property Settings</p>
                  </div>
                </div>

                {/* Live preview of tracking script */}
                {integrations.gaTrackingId && (
                  <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 16px', marginBottom: 16, overflowX: 'auto' }}>
                    <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Generated Tracking Snippet</div>
                    <code style={{ fontSize: 11.5, color: '#7dd3fc', fontFamily: 'monospace', whiteSpace: 'pre' }}>
{`<!-- Google Analytics 4 — Auto-injected by Raulji CRM -->
<script async src="https://www.googletagmanager.com/gtag/js?id=${integrations.gaTrackingId}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${integrations.gaTrackingId}');
</script>`}
                    </code>
                  </div>
                )}
              </Card>

              {/* ── Google Search Console ── */}
              <Card>
                <div className="flex items-start gap-4 pb-4 mb-4" style={{ borderBottom: '1px solid #f0f5fa' }}>
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: '#fff3e0' }}>
                    <svg viewBox="0 0 24 24" className="w-6 h-6">
                      <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" fill="#E65100"/>
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span style={{ fontSize: 14, fontWeight: 700, color: '#192b3f' }}>Google Search Console</span>
                      {integrations.gscSiteUrl
                        ? <span style={{ fontSize: 11, fontWeight: 600, background: '#d1fae5', color: '#047857', padding: '2px 8px', borderRadius: 9999 }}>● Connected</span>
                        : <span style={{ fontSize: 11, fontWeight: 600, background: '#f0f5fa', color: '#7a9baf', padding: '2px 8px', borderRadius: 9999 }}>Not connected</span>
                      }
                    </div>
                    <p style={{ fontSize: 12.5, color: '#7a9baf' }}>Track SEO rankings, organic clicks, impressions, and keyword performance.</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="col-span-2">
                    <Input
                      label="Search Console Site URL"
                      value={integrations.gscSiteUrl}
                      onChange={e => setIntegrations(i => ({ ...i, gscSiteUrl: e.target.value }))}
                      placeholder="https://rauljitechnologies.com"
                    />
                    <p style={{ fontSize: 11, color: '#7a9baf', marginTop: 4 }}>Must match exactly the property URL in Search Console (including https://)</p>
                  </div>
                </div>
                <div style={{ background: '#f8fbfd', border: '1px solid #e2eaf2', borderRadius: 10, padding: '12px 14px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#3199d4', marginBottom: 4 }}>How to verify ownership</div>
                  <p style={{ fontSize: 12, color: '#64748b', margin: 0, lineHeight: 1.7 }}>
                    Go to <strong>search.google.com/search-console</strong> → Add Property → enter your domain → verify via HTML tag or Google Analytics. Once verified, your SEO data flows into the Analytics page.
                  </p>
                </div>
              </Card>

              {/* ── Facebook Pixel + Razorpay row ── */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Card>
                  <div className="flex items-center gap-3 mb-4" style={{ borderBottom: '1px solid #f0f5fa', paddingBottom: 14 }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#ebf0fb' }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#192b3f' }}>Facebook Pixel</div>
                      <p style={{ fontSize: 12, color: '#7a9baf', margin: 0 }}>Track ad conversions & retargeting</p>
                    </div>
                  </div>
                  <Input
                    label="Pixel ID"
                    value={integrations.fbPixelId}
                    onChange={e => setIntegrations(i => ({ ...i, fbPixelId: e.target.value }))}
                    placeholder="1234567890123456"
                  />
                </Card>

                <Card>
                  <div className="flex items-center gap-3 mb-4" style={{ borderBottom: '1px solid #f0f5fa', paddingBottom: 14 }}>
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#f0eafb' }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="#528FF0"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm.48 18.32l-3.36-5.36h-.04v5.36H6.96V5.68h2.12v5.08h.04l3.24-5.08H14.8l-3.56 5.28 3.72 7.36h-2.48z"/></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: '#192b3f' }}>Razorpay</div>
                      <p style={{ fontSize: 12, color: '#7a9baf', margin: 0 }}>Payment links on invoices</p>
                    </div>
                  </div>
                  <Input
                    label="Razorpay Key ID"
                    value={integrations.razorpayKeyId}
                    onChange={e => setIntegrations(i => ({ ...i, razorpayKeyId: e.target.value }))}
                    placeholder="rzp_live_XXXXXXXXXX"
                  />
                </Card>
              </div>

              <div className="flex justify-end">
                <Btn variant="primary" loading={saving} onClick={saveIntegrations}>Save All Integrations</Btn>
              </div>
            </div>
          )}

        </div>
      </div>
      <ToastContainer />
    </>
  );
}
