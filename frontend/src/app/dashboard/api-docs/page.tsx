'use client';
import { useEffect, useState, useCallback } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Btn, useToast } from '@/components/ui';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

// ── Code block with copy ───────────────────────────────────────
function CodeBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group rounded-xl overflow-hidden border border-slate-700 bg-[#0f1117]">
      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
        <span className="text-xs text-slate-400 font-mono font-medium">{lang}</span>
        <button onClick={copy}
          className="text-xs text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 font-medium">
          {copied ? '✓ Copied' : '⧉ Copy'}
        </button>
      </div>
      <pre className="p-4 text-xs text-slate-200 overflow-x-auto leading-relaxed font-mono whitespace-pre">{code}</pre>
    </div>
  );
}

// ── Method badge ───────────────────────────────────────────────
function Method({ m }: { m: string }) {
  const c: Record<string, string> = {
    GET:    'bg-emerald-900 text-emerald-300 border-emerald-700',
    POST:   'bg-blue-900 text-blue-300 border-blue-700',
    PUT:    'bg-amber-900 text-amber-300 border-amber-700',
    DELETE: 'bg-red-900 text-red-300 border-red-700',
  };
  return (
    <span className={`inline-flex px-2 py-0.5 rounded text-xs font-bold font-mono border ${c[m] || 'bg-slate-800 text-slate-300 border-slate-600'}`}>{m}</span>
  );
}

// ── Section header ─────────────────────────────────────────────
function SectionHead({ id, title, desc }: { id: string; title: string; desc?: string }) {
  return (
    <div id={id} className="pt-2 pb-3 border-b-2 border-slate-100 mb-4">
      <h2 className="text-base font-bold text-slate-800">{title}</h2>
      {desc && <p className="text-xs text-slate-500 mt-1">{desc}</p>}
    </div>
  );
}

// ── Endpoint row ───────────────────────────────────────────────
function Endpoint({ method, path, desc, auth, params }: {
  method: string; path: string; desc: string; auth: 'api-key' | 'bearer' | 'none';
  params?: { name: string; type: string; required: boolean; desc: string }[];
}) {
  const [open, setOpen] = useState(false);
  const authBadge = {
    'api-key': <span className="px-2 py-0.5 rounded-full text-xs bg-amber-50 text-amber-700 border border-amber-200 font-medium">X-API-Key</span>,
    'bearer':  <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 font-medium">Bearer Token</span>,
    'none':    <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 font-medium">No Auth</span>,
  }[auth];

  return (
    <div className="border border-slate-200 rounded-xl mb-2 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors text-left">
        <Method m={method} />
        <code className="text-xs font-mono text-slate-700 flex-1 truncate">{path}</code>
        <span className="text-xs text-slate-400 hidden sm:block flex-shrink-0">{desc}</span>
        {authBadge}
        <span className="text-slate-400 text-sm flex-shrink-0">{open ? '▾' : '▸'}</span>
      </button>
      {open && params && params.length > 0 && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Parameters</div>
          <table className="w-full text-xs">
            <thead><tr className="text-slate-400"><th className="text-left pb-1">Name</th><th className="text-left pb-1">Type</th><th className="text-left pb-1">Required</th><th className="text-left pb-1">Description</th></tr></thead>
            <tbody>
              {params.map(p => (
                <tr key={p.name} className="border-t border-slate-200">
                  <td className="py-1.5 pr-3 font-mono font-semibold text-slate-700">{p.name}</td>
                  <td className="py-1.5 pr-3 text-indigo-600">{p.type}</td>
                  <td className="py-1.5 pr-3">{p.required ? <span className="text-red-500 font-semibold">Yes</span> : <span className="text-slate-400">No</span>}</td>
                  <td className="py-1.5 text-slate-500">{p.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────
export default function ApiDocsPage() {
  const [companies,   setCompanies]   = useState<any[]>([]);
  const [cid,         setCid]         = useState('');
  const [apiKey,      setApiKey]      = useState('');
  const [showKey,     setShowKey]     = useState(false);
  const [regen,       setRegen]       = useState(false);
  const [activeTab,   setActiveTab]   = useState<'overview'|'leads'|'auth'|'all'>('overview');
  const { toast, ToastContainer }     = useToast();

  const loadCos = useCallback(async () => {
    try {
      const d = await companyApi.list({ limit: '20' });
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos[0]) { setCid(cos[0].companyId); setApiKey(cos[0].apiKey || ''); }
    } catch {}
  }, []);

  useEffect(() => { loadCos(); }, [loadCos]);

  const onCidChange = (id: string) => {
    setCid(id);
    const co = companies.find((c: any) => c.companyId === id);
    setApiKey(co?.apiKey || '');
    setShowKey(false);
  };

  const regenerateKey = async () => {
    if (!cid) return;
    if (!confirm('Regenerate API key? Any existing integrations using the old key will break immediately.')) return;
    setRegen(true);
    try {
      const d = await companyApi.regenerateKey(cid);
      setApiKey(d.apiKey);
      toast('API key regenerated! Update all integrations.', 'ok');
      setShowKey(true);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setRegen(false); }
  };

  const copyKey = () => {
    navigator.clipboard.writeText(apiKey);
    toast('API key copied!');
  };

  const maskedKey = apiKey ? apiKey.slice(0, 12) + '•'.repeat(Math.max(0, apiKey.length - 16)) + apiKey.slice(-4) : '—';

  // Dynamic code examples using actual API key & base URL
  const curlExample = `curl -X POST "${BASE_URL}/public/leads" \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: ${apiKey || 'YOUR_API_KEY'}" \\
  -d '{
    "name": "Rahul Sharma",
    "phone": "9876543210",
    "email": "rahul@example.com",
    "city": "Mumbai",
    "source": "WEBSITE_FORM",
    "notes": "Interested in premium plan",
    "customFields": {
      "product": "Enterprise",
      "budget": "5L"
    }
  }'`;

  const jsExample = `// Paste this in your website's contact form JS
async function submitLead(formData) {
  const res = await fetch("${BASE_URL}/public/leads", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": "${apiKey || 'YOUR_API_KEY'}"
    },
    body: JSON.stringify({
      name:         formData.name,          // required
      phone:        formData.phone,         // required
      email:        formData.email,         // optional
      city:         formData.city,          // optional
      source:       "WEBSITE_FORM",         // optional, default: WEBSITE_FORM
      notes:        formData.message,       // optional
      customFields: {                       // optional — any extra data
        service:  formData.service,
        budget:   formData.budget,
      }
    })
  });

  const data = await res.json();
  if (data.success) {
    console.log("Lead created:", data.data.leadId);
    return true;
  }
  throw new Error(data.error?.message);
}`;

  const htmlExample = `<!-- Contact form on your website -->
<form id="contactForm">
  <input type="text"  id="name"    placeholder="Your Name"    required />
  <input type="tel"   id="phone"   placeholder="Phone Number" required />
  <input type="email" id="email"   placeholder="Email"        />
  <input type="text"  id="city"    placeholder="City"         />
  <textarea           id="message" placeholder="Message"      ></textarea>
  <button type="submit">Send Enquiry</button>
</form>

<script>
document.getElementById('contactForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('button');
  btn.textContent = 'Sending...';
  btn.disabled = true;

  try {
    const res = await fetch("${BASE_URL}/public/leads", {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': '${apiKey || 'YOUR_API_KEY'}'
      },
      body: JSON.stringify({
        name:   document.getElementById('name').value,
        phone:  document.getElementById('phone').value,
        email:  document.getElementById('email').value,
        city:   document.getElementById('city').value,
        source: 'WEBSITE_FORM',
        notes:  document.getElementById('message').value,
      })
    });

    const data = await res.json();
    if (data.success) {
      btn.textContent = '✓ Submitted!';
      e.target.reset();
      // Optionally redirect: window.location.href = '/thank-you';
    } else {
      throw new Error(data.error?.message);
    }
  } catch (err) {
    btn.textContent = 'Error — Try Again';
    btn.disabled = false;
    alert('Submission failed: ' + err.message);
  }
});
</script>`;

  const phpExample = `<?php
// PHP — Contact form handler (e.g. contact.php)
$data = [
    'name'   => $_POST['name'],    // required
    'phone'  => $_POST['phone'],   // required
    'email'  => $_POST['email'] ?? '',
    'city'   => $_POST['city']  ?? '',
    'source' => 'WEBSITE_FORM',
    'notes'  => $_POST['message'] ?? '',
];

$ch = curl_init("${BASE_URL}/public/leads");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Content-Type: application/json',
    'X-API-Key: ${apiKey || 'YOUR_API_KEY'}',
]);

$response = json_decode(curl_exec($ch), true);
curl_close($ch);

if ($response['success']) {
    $leadId = $response['data']['leadId'];
    header('Location: /thank-you.html');
} else {
    echo 'Error: ' . $response['error']['message'];
}
?>`;

  const pythonExample = `import requests

def submit_lead(name, phone, email=None, city=None, notes=None):
    response = requests.post(
        "${BASE_URL}/public/leads",
        headers={
            "Content-Type": "application/json",
            "X-API-Key": "${apiKey || 'YOUR_API_KEY'}"
        },
        json={
            "name":   name,    # required
            "phone":  phone,   # required
            "email":  email,
            "city":   city,
            "source": "WEBSITE_FORM",
            "notes":  notes,
        }
    )
    data = response.json()
    if data["success"]:
        return data["data"]["leadId"]
    raise Exception(data["error"]["message"])

# Usage
lead_id = submit_lead(
    name="Rahul Sharma",
    phone="9876543210",
    email="rahul@example.com",
    city="Mumbai",
    notes="Interested in premium plan"
)
print(f"Lead created: {lead_id}")`;

  const responseExample = `// ✅ Success (HTTP 201)
{
  "success": true,
  "data": {
    "leadId": "clx1234abcdef",
    "message": "Lead received."
  }
}

// ❌ Error — missing required fields (HTTP 400)
{
  "success": false,
  "error": {
    "message": "Name and phone required."
  }
}

// ❌ Error — invalid API key (HTTP 401)
{
  "success": false,
  "error": {
    "code": "AUTH_004",
    "message": "Invalid API key."
  }
}`;

  const bearerExample = `// Step 1 — Login to get access token
const loginRes = await fetch("${BASE_URL}/auth/login", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: "admin@example.com", password: "yourpassword" })
});
const { data } = await loginRes.json();
const accessToken = data.accessToken;

// Step 2 — Use token in all authenticated requests
const leadsRes = await fetch("${BASE_URL}/companies/{companyId}/leads", {
  headers: { "Authorization": \`Bearer \${accessToken}\` }
});
const leads = await leadsRes.json();`;

  const TABS = [
    { id: 'overview', label: 'Overview' },
    { id: 'leads',    label: 'Lead Push API' },
    { id: 'auth',     label: 'Authentication' },
    { id: 'all',      label: 'All Endpoints' },
  ] as const;

  return (
    <>
      <Topbar title="API & Webhooks" subtitle="Integrate your website and external tools with Raulji CRM"
        actions={<>
          {companies.length > 1 && (
            <select value={cid} onChange={e => onCidChange(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 bg-white">
              {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          )}
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6 flex flex-col gap-6">

          {/* ── API Key Card ── */}
          <div className="bg-gradient-to-r from-[#1f293f] to-[#3199d4] rounded-2xl p-6 text-white">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold uppercase tracking-widest text-blue-200 mb-2">Your Company API Key</div>
                <div className="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-3 font-mono">
                  <span className="text-sm flex-1 truncate text-blue-100 select-all">
                    {showKey ? apiKey : maskedKey}
                  </span>
                  <button onClick={() => setShowKey(s => !s)} className="text-blue-300 hover:text-white text-xs flex-shrink-0 transition-colors">
                    {showKey ? '🙈 Hide' : '👁 Show'}
                  </button>
                  <button onClick={copyKey} className="text-blue-300 hover:text-white text-xs flex-shrink-0 transition-colors">
                    ⧉ Copy
                  </button>
                </div>
                <div className="text-xs text-blue-300 mt-2">
                  Send this key in the <code className="bg-black/20 px-1 py-0.5 rounded">X-API-Key</code> header for public/webhook requests.
                </div>
              </div>
              <div className="flex flex-col gap-2 flex-shrink-0">
                <Btn variant="secondary" size="sm" loading={regen} onClick={regenerateKey}
                  className="!bg-white/10 !border-white/20 !text-white hover:!bg-white/20">
                  ↺ Regenerate Key
                </Btn>
                <div className="text-xs text-blue-300 text-right">⚠ Breaks existing integrations</div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-3 gap-4 text-center">
              <div><div className="text-lg font-bold">{BASE_URL.replace('http://','').replace('https://','').split('/')[0]}</div><div className="text-xs text-blue-300">API Host</div></div>
              <div><div className="text-lg font-bold">/api/v1</div><div className="text-xs text-blue-300">Base Path</div></div>
              <div><div className="text-lg font-bold">JSON</div><div className="text-xs text-blue-300">Response Format</div></div>
            </div>
          </div>

          {/* ── Tabs ── */}
          <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
            {TABS.map(t => (
              <button key={t.id} onClick={() => setActiveTab(t.id)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${activeTab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-3 gap-4">
                {[
                  { icon: '🌐', title: 'Website Contact Forms', desc: 'Push enquiries from any website form directly into CRM as leads in real-time', color: 'border-blue-200 bg-blue-50' },
                  { icon: '🔐', title: 'Secure API Key Auth', desc: 'Each company has a unique API key. No user login needed for lead submission', color: 'border-emerald-200 bg-emerald-50' },
                  { icon: '⚡', title: 'Instant Lead Tracking', desc: 'Leads appear immediately in your dashboard with source, status, and activity trail', color: 'border-amber-200 bg-amber-50' },
                ].map((c, i) => (
                  <div key={i} className={`border ${c.color} rounded-xl p-4`}>
                    <div className="text-2xl mb-2">{c.icon}</div>
                    <div className="text-sm font-bold text-slate-800 mb-1">{c.title}</div>
                    <div className="text-xs text-slate-600 leading-relaxed">{c.desc}</div>
                  </div>
                ))}
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <SectionHead id="quickstart" title="Quick Start — 3 Steps" />
                <div className="flex flex-col gap-4">
                  {[
                    { step: '1', title: 'Copy your API Key', desc: 'Copy the API key shown at the top of this page. Keep it secret — treat it like a password.' },
                    { step: '2', title: 'Add the code to your website', desc: 'Paste the HTML + JavaScript snippet (see "Lead Push API" tab) into your contact form page.' },
                    { step: '3', title: 'Test and go live', desc: 'Submit a test form. The lead appears instantly in Dashboard → Leads with source "WEBSITE_FORM".' },
                  ].map(s => (
                    <div key={s.step} className="flex gap-4">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0" style={{ background: 'linear-gradient(135deg,#3199d4,#1f293f)' }}>{s.step}</div>
                      <div>
                        <div className="text-sm font-semibold text-slate-800 mb-0.5">{s.title}</div>
                        <div className="text-xs text-slate-500 leading-relaxed">{s.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <SectionHead id="sources" title="Lead Source Values" desc="Pass one of these values in the 'source' field to categorize where the lead came from." />
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { val: 'WEBSITE_FORM',   desc: 'Default — any web contact form' },
                    { val: 'LANDING_PAGE',   desc: 'Campaign / ad landing page' },
                    { val: 'WHATSAPP',       desc: 'WhatsApp click-to-chat' },
                    { val: 'INSTAGRAM',      desc: 'Instagram DM / lead ad' },
                    { val: 'FACEBOOK',       desc: 'Facebook lead form / ad' },
                    { val: 'GOOGLE_ADS',     desc: 'Google search / display ad' },
                    { val: 'REFERRAL',       desc: 'Referred by existing client' },
                    { val: 'COLD_CALL',      desc: 'Outbound sales call' },
                    { val: 'MANUAL',         desc: 'Manually entered by team' },
                  ].map(s => (
                    <div key={s.val} className="flex gap-2 bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                      <code className="text-xs font-mono font-bold text-indigo-600 flex-shrink-0">{s.val}</code>
                      <span className="text-xs text-slate-500">{s.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
                <span className="text-xl flex-shrink-0">⚠️</span>
                <div>
                  <div className="text-sm font-bold text-amber-800 mb-1">Security Notice</div>
                  <div className="text-xs text-amber-700 leading-relaxed">
                    The <strong>X-API-Key</strong> in front-end JavaScript is visible in the browser. This is intentional for lead submission — it only allows <em>creating leads</em>, not reading or modifying CRM data. If compromised, regenerate the key immediately from this page.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── LEAD PUSH API TAB ── */}
          {activeTab === 'leads' && (
            <div className="flex flex-col gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <SectionHead id="public-lead" title="POST /public/leads — Submit a Lead" desc="No user login required. Authenticate with your API key only." />
                <div className="flex items-center gap-3 mb-4 bg-slate-50 rounded-xl px-4 py-3 border border-slate-200 font-mono text-sm flex-wrap">
                  <Method m="POST" />
                  <span className="text-slate-700">{BASE_URL}/public/leads</span>
                  <span className="ml-auto text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full font-sans font-semibold">X-API-Key required</span>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Request Body (JSON)</div>
                    <table className="w-full text-xs border-collapse">
                      <thead><tr className="bg-slate-50 border border-slate-200"><th className="px-3 py-2 text-left text-slate-400">Field</th><th className="px-3 py-2 text-left text-slate-400">Type</th><th className="px-3 py-2 text-left text-slate-400">Req?</th><th className="px-3 py-2 text-left text-slate-400">Notes</th></tr></thead>
                      <tbody className="border border-slate-200">
                        {[
                          { f: 'name',         t: 'string',  r: true,  n: 'Full name of the person' },
                          { f: 'phone',        t: 'string',  r: true,  n: 'Mobile / phone number' },
                          { f: 'email',        t: 'string',  r: false, n: 'Email address' },
                          { f: 'city',         t: 'string',  r: false, n: 'City / location' },
                          { f: 'source',       t: 'string',  r: false, n: 'Default: WEBSITE_FORM' },
                          { f: 'notes',        t: 'string',  r: false, n: 'Message / comments' },
                          { f: 'customFields', t: 'object',  r: false, n: 'Any extra key-value data' },
                        ].map(row => (
                          <tr key={row.f} className="border-t border-slate-100">
                            <td className="px-3 py-1.5 font-mono font-semibold text-slate-700">{row.f}</td>
                            <td className="px-3 py-1.5 text-indigo-600">{row.t}</td>
                            <td className="px-3 py-1.5">{row.r ? <span className="text-red-500 font-bold">Yes</span> : <span className="text-slate-400">No</span>}</td>
                            <td className="px-3 py-1.5 text-slate-500">{row.n}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Response</div>
                    <CodeBlock code={responseExample} lang="json" />
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <div className="text-sm font-bold text-slate-800 mb-4">Code Examples</div>
                <div className="flex gap-2 mb-4 flex-wrap" id="code-tabs">
                  {[
                    { id: 'html',   label: 'HTML Form' },
                    { id: 'js',     label: 'JavaScript' },
                    { id: 'curl',   label: 'cURL' },
                    { id: 'php',    label: 'PHP' },
                    { id: 'python', label: 'Python' },
                  ].map(lang => (
                    <button key={lang.id} id={`tab-${lang.id}`} onClick={() => {
                      document.querySelectorAll('[id^="code-"]').forEach(el => (el as HTMLElement).style.display = 'none');
                      document.querySelectorAll('[id^="tab-"]').forEach(el => el.classList.remove('bg-indigo-600','text-white'));
                      const t = document.getElementById(`tab-${lang.id}`);
                      if (t) t.classList.add('bg-indigo-600','text-white');
                      const c = document.getElementById(`code-${lang.id}`);
                      if (c) (c as HTMLElement).style.display = 'block';
                    }} className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                      {lang.label}
                    </button>
                  ))}
                </div>
                <div id="code-html">   <CodeBlock code={htmlExample}   lang="html" /></div>
                <div id="code-js"    style={{ display: 'none' }}><CodeBlock code={jsExample}     lang="javascript" /></div>
                <div id="code-curl"  style={{ display: 'none' }}><CodeBlock code={curlExample}   lang="bash" /></div>
                <div id="code-php"   style={{ display: 'none' }}><CodeBlock code={phpExample}    lang="php" /></div>
                <div id="code-python" style={{ display: 'none' }}><CodeBlock code={pythonExample} lang="python" /></div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <SectionHead id="test" title="Test Your Integration" desc="Use this form to send a test lead to your CRM right now." />
                <TestLeadForm apiKey={apiKey} baseUrl={BASE_URL} />
              </div>
            </div>
          )}

          {/* ── AUTH TAB ── */}
          {activeTab === 'auth' && (
            <div className="flex flex-col gap-5">
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <SectionHead id="auth-methods" title="Authentication Methods" />
                <div className="grid grid-cols-2 gap-4 mb-5">
                  <div className="border border-amber-200 bg-amber-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🔑</span>
                      <div className="text-sm font-bold text-amber-800">API Key Auth</div>
                      <span className="ml-auto text-xs bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full font-semibold">Public Endpoints</span>
                    </div>
                    <div className="text-xs text-amber-700 leading-relaxed mb-3">Used for public endpoints like lead submission from websites. No user login required.</div>
                    <CodeBlock code={`// Header required:\nX-API-Key: ${apiKey || 'rcrm_live_xxxx...'}`} lang="http" />
                  </div>
                  <div className="border border-indigo-200 bg-indigo-50 rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-base">🛡</span>
                      <div className="text-sm font-bold text-indigo-800">Bearer Token Auth</div>
                      <span className="ml-auto text-xs bg-indigo-200 text-indigo-800 px-2 py-0.5 rounded-full font-semibold">All Private Endpoints</span>
                    </div>
                    <div className="text-xs text-indigo-700 leading-relaxed mb-3">Used for all private API endpoints. Login first, then include the JWT access token.</div>
                    <CodeBlock code={`// Header required:\nAuthorization: Bearer <accessToken>`} lang="http" />
                  </div>
                </div>
                <SectionHead id="bearer-flow" title="Bearer Token Flow" />
                <CodeBlock code={bearerExample} lang="javascript" />
              </div>
              <div className="bg-white border border-slate-200 rounded-xl p-5">
                <SectionHead id="roles" title="User Roles & Permissions" />
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border border-slate-200">
                      {['Role','Leads','Deals','Invoices','Users','Settings','Companies'].map(h => (
                        <th key={h} className="px-4 py-2.5 text-left font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="border border-slate-200">
                    {[
                      { role: 'SUPER_ADMIN', l:'Full',   d:'Full',   i:'Full',   u:'Full',   s:'Full',   c:'Full' },
                      { role: 'ADMIN',       l:'Full',   d:'Full',   i:'Full',   u:'Invite',  s:'Full',   c:'View' },
                      { role: 'SALES_MANAGER',l:'Full',  d:'Full',   i:'View',   u:'View',   s:'View',   c:'View' },
                      { role: 'SALES_REP',   l:'Own',    d:'Own',    i:'View',   u:'—',      s:'—',      c:'View' },
                      { role: 'VIEWER',      l:'View',   d:'View',   i:'View',   u:'—',      s:'—',      c:'View' },
                    ].map(row => (
                      <tr key={row.role} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="px-4 py-2.5 font-mono font-bold text-indigo-600 text-xs">{row.role}</td>
                        {[row.l, row.d, row.i, row.u, row.s, row.c].map((v, i) => (
                          <td key={i} className={`px-4 py-2.5 text-xs font-medium ${v === 'Full' ? 'text-emerald-600' : v === '—' ? 'text-slate-300' : 'text-amber-600'}`}>{v}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── ALL ENDPOINTS TAB ── */}
          {activeTab === 'all' && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-5">
              <div className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-4 py-2.5">
                Base URL: <code className="font-mono font-semibold text-indigo-600">{BASE_URL}</code>
                &nbsp;·&nbsp; All responses: <code className="font-mono text-slate-600">{"{ success, data | error }"}</code>
              </div>

              <div>
                <SectionHead id="ep-public" title="Public Endpoints" desc="No authentication required beyond API key." />
                <Endpoint method="POST" path="/public/leads" desc="Submit lead from website" auth="api-key"
                  params={[
                    { name:'name',         type:'string', required:true,  desc:'Full name' },
                    { name:'phone',        type:'string', required:true,  desc:'Phone number' },
                    { name:'email',        type:'string', required:false, desc:'Email address' },
                    { name:'city',         type:'string', required:false, desc:'City' },
                    { name:'source',       type:'string', required:false, desc:'Lead source (default: WEBSITE_FORM)' },
                    { name:'notes',        type:'string', required:false, desc:'Message / notes' },
                    { name:'customFields', type:'object', required:false, desc:'Any extra data as key-value pairs' },
                  ]}
                />
              </div>

              <div>
                <SectionHead id="ep-auth" title="Auth" />
                {[
                  { method:'POST', path:'/auth/login',           desc:'Login → get tokens',          params:[{name:'email',type:'string',required:true,desc:'User email'},{name:'password',type:'string',required:true,desc:'Password'}] },
                  { method:'POST', path:'/auth/register',        desc:'Register new user',            params:[] },
                  { method:'POST', path:'/auth/refresh',         desc:'Refresh access token',         params:[{name:'refreshToken',type:'string',required:true,desc:'Refresh token from login'}] },
                  { method:'POST', path:'/auth/logout',          desc:'Logout / revoke token',        params:[] },
                  { method:'GET',  path:'/auth/me',              desc:'Get current user profile',     params:[] },
                  { method:'POST', path:'/auth/forgot-password', desc:'Send password reset email',    params:[] },
                  { method:'POST', path:'/auth/reset-password',  desc:'Reset password with token',    params:[] },
                ].map(e => <Endpoint key={e.path} {...e as any} auth="none" />)}
              </div>

              <div>
                <SectionHead id="ep-leads" title="Leads" />
                {[
                  { method:'GET',    path:'/companies/{companyId}/leads',                     desc:'List all leads (filterable)' },
                  { method:'POST',   path:'/companies/{companyId}/leads',                     desc:'Create a lead manually' },
                  { method:'GET',    path:'/companies/{companyId}/leads/{leadId}',             desc:'Get single lead' },
                  { method:'PUT',    path:'/companies/{companyId}/leads/{leadId}',             desc:'Update lead' },
                  { method:'DELETE', path:'/companies/{companyId}/leads/{leadId}',             desc:'Delete lead' },
                  { method:'POST',   path:'/companies/{companyId}/leads/{leadId}/activities',  desc:'Add activity/note' },
                  { method:'POST',   path:'/companies/{companyId}/leads/{leadId}/convert',     desc:'Convert to deal' },
                  { method:'GET',    path:'/companies/{companyId}/leads/export',               desc:'Export leads as CSV' },
                  { method:'POST',   path:'/companies/{companyId}/leads/import',               desc:'Import leads from CSV' },
                ].map(e => <Endpoint key={e.path} method={e.method} path={e.path} desc={e.desc} auth="bearer" />)}
              </div>

              <div>
                <SectionHead id="ep-invoices" title="Invoices" />
                {[
                  { method:'GET',  path:'/companies/{companyId}/invoices',                 desc:'List invoices' },
                  { method:'POST', path:'/companies/{companyId}/invoices',                 desc:'Create invoice' },
                  { method:'GET',  path:'/companies/{companyId}/invoices/{id}',            desc:'Get invoice' },
                  { method:'PUT',  path:'/companies/{companyId}/invoices/{id}',            desc:'Update invoice' },
                  { method:'PUT',  path:'/companies/{companyId}/invoices/{id}/mark-paid',  desc:'Mark as paid' },
                  { method:'GET',  path:'/companies/{companyId}/invoices/{id}/pdf',        desc:'Download PDF' },
                  { method:'GET',  path:'/companies/{companyId}/invoices/{id}/view',       desc:'View invoice in browser' },
                ].map(e => <Endpoint key={e.path} method={e.method} path={e.path} desc={e.desc} auth="bearer" />)}
              </div>

              <div>
                <SectionHead id="ep-more" title="Quotations, Deals, Clients" />
                {[
                  { method:'GET',  path:'/companies/{companyId}/quotations',     desc:'List quotations' },
                  { method:'POST', path:'/companies/{companyId}/quotations',     desc:'Create quotation' },
                  { method:'POST', path:'/companies/{companyId}/quotations/{id}/convert', desc:'Convert to invoice' },
                  { method:'GET',  path:'/companies/{companyId}/deals',          desc:'List deals' },
                  { method:'POST', path:'/companies/{companyId}/deals',          desc:'Create deal' },
                  { method:'GET',  path:'/companies/{companyId}/clients',        desc:'List clients' },
                  { method:'POST', path:'/companies/{companyId}/clients',        desc:'Create client' },
                  { method:'GET',  path:'/companies/{companyId}/analytics/overview', desc:'Dashboard overview stats' },
                  { method:'GET',  path:'/companies/{companyId}/analytics/revenue',  desc:'Revenue analytics' },
                  { method:'GET',  path:'/gst/validate/{gstin}',                 desc:'Validate GSTIN format' },
                ].map(e => <Endpoint key={e.path} method={e.method} path={e.path} desc={e.desc} auth="bearer" />)}
              </div>
            </div>
          )}

        </div>
      </div>

      <ToastContainer />
    </>
  );
}

// ── Live test form ─────────────────────────────────────────────
function TestLeadForm({ apiKey, baseUrl }: { apiKey: string; baseUrl: string }) {
  const [f, setF]       = useState({ name: '', phone: '', email: '', city: '', notes: '', source: 'WEBSITE_FORM' });
  const [status, setStatus] = useState<'idle'|'loading'|'ok'|'err'>('idle');
  const [result, setResult] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey) { setStatus('err'); setResult('No API key found. Select a company above.'); return; }
    setStatus('loading');
    try {
      const res = await fetch(`${baseUrl}/public/leads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-Key': apiKey },
        body: JSON.stringify(f),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('ok');
        setResult(`✓ Lead created! ID: ${data.data.leadId}\nCheck Dashboard → Leads to see it.`);
        setF({ name: '', phone: '', email: '', city: '', notes: '', source: 'WEBSITE_FORM' });
      } else {
        setStatus('err');
        setResult(data.error?.message || 'Unknown error');
      }
    } catch (err: any) {
      setStatus('err');
      setResult(err.message);
    }
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-3">
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Name *</label>
        <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))} required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" placeholder="Test User" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Phone *</label>
        <input value={f.phone} onChange={e => setF(p => ({ ...p, phone: e.target.value }))} required
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" placeholder="9876543210" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Email</label>
        <input value={f.email} onChange={e => setF(p => ({ ...p, email: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" placeholder="test@example.com" />
      </div>
      <div>
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Source</label>
        <select value={f.source} onChange={e => setF(p => ({ ...p, source: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
          {['WEBSITE_FORM','LANDING_PAGE','WHATSAPP','INSTAGRAM','FACEBOOK','GOOGLE_ADS','REFERRAL','MANUAL'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
        <input value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" placeholder="Test message from API docs" />
      </div>
      <div className="col-span-2 flex items-center gap-3">
        <Btn variant="primary" loading={status === 'loading'} type="submit">
          ▶ Send Test Lead
        </Btn>
        {status === 'ok'  && <div className="text-xs text-emerald-600 font-medium bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex-1 whitespace-pre-line">{result}</div>}
        {status === 'err' && <div className="text-xs text-red-600 font-medium bg-red-50 border border-red-200 rounded-lg px-3 py-1.5 flex-1">{result}</div>}
      </div>
    </form>
  );
}
