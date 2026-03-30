'use client';
import { useEffect, useState, useRef } from 'react';
import { companyApi, analyticsApi, leadApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, useToast } from '@/components/ui';

export default function AiPage() {
  const [companies,  setCompanies]  = useState<any[]>([]);
  const [companyId,  setCompanyId]  = useState('');
  const [hotLeads,   setHotLeads]   = useState<any[]>([]);
  const [coldLeads,  setColdLeads]  = useState<any[]>([]);
  const [chat,       setChat]       = useState<{role:string;content:string}[]>([]);
  const [chatInput,  setChatInput]  = useState('');
  const [chatLoading,setChatLoading]= useState(false);
  const [emailLeadId,setEmailLeadId]= useState('');
  const [emailType,  setEmailType]  = useState('follow_up');
  const [emailResult,setEmailResult]= useState<{subject:string;body:string}|null>(null);
  const [genLoading, setGenLoading] = useState(false);
  const { toast, ToastContainer } = useToast();
  const chatEnd = useRef<HTMLDivElement>(null);

  const loadCos = async () => { try { const d=await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const loadInsights = async () => {
    if (!companyId) return;
    try {
      const d = await leadApi.list(companyId, { limit:'5', sortBy:'aiScore', sortOrder:'desc' });
      setHotLeads(d.leads?.filter((l:any) => l.aiScore >= 70 && !['WON','LOST'].includes(l.status)) || []);
      const cold = await leadApi.list(companyId, { limit:'5', status:'CONTACTED' });
      setColdLeads(cold.leads?.slice(0,4) || []);
    } catch {}
  };
  useEffect(() => { loadInsights(); }, [companyId]);
  useEffect(() => { chatEnd.current?.scrollIntoView({behavior:'smooth'}); }, [chat]);

  const sendChat = async () => {
    if (!chatInput.trim()) return;
    const msg = chatInput.trim();
    setChatInput('');
    setChat(c => [...c, {role:'user',content:msg}]);
    setChatLoading(true);
    try {
      // Use the API for a simple stats-based response since OpenAI is optional
      const overview = await analyticsApi.overview(companyId);
      const s = overview.summary || {};
      const reply = `Based on your CRM data: you have ${s.totalLeads||0} leads, ${s.wonDeals||0} won deals, ₹${((s.totalRevenue||0)/100000).toFixed(1)}L revenue collected, and a ${s.conversionRate||0}% conversion rate.\n\nFor AI-powered responses, connect your OpenAI API key in Settings → Integrations.`;
      setChat(c => [...c, {role:'assistant',content:reply}]);
    } catch (e:any) {
      setChat(c => [...c, {role:'assistant',content:`Sorry, I couldn't fetch that data. Error: ${e.message}`}]);
    }
    setChatLoading(false);
  };

  const generateEmail = () => {
    if (!emailLeadId) return toast('Enter a Lead ID','err');
    setGenLoading(true);
    setTimeout(() => {
      setEmailResult({
        subject: `Following up on your inquiry — ${emailType.replace('_',' ')}`,
        body: `Hi,\n\nThank you for your interest. I wanted to follow up regarding our previous conversation.\n\nAs discussed, we'd love to help you achieve your goals. Could we schedule a quick 15-minute call this week?\n\nLooking forward to hearing from you.\n\nBest regards,\nRaulji CRM Team\n\n(Connect OpenAI API key in Settings for AI-generated emails)`
      });
      setGenLoading(false);
    }, 800);
  };

  return (
    <>
      <Topbar title="AI Insights" subtitle="Smart CRM intelligence"
        actions={
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        }
      />

      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4 items-start">

        {/* Left column */}
        <div className="flex flex-col gap-4">

          {/* Hot leads */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">🔥</span>
              <div className="text-xs font-bold text-slate-900">High-Score Leads</div>
              <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-semibold ml-auto">Ready to close</span>
            </div>
            {hotLeads.length===0 ? <div className="text-xs text-slate-400 py-3 text-center">No high-score leads yet</div>
            : hotLeads.map((l:any)=>(
              <div key={l.leadId} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-none">
                <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{l.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{l.name}</div>
                  <div className="text-xs text-slate-400">{l.status}</div>
                </div>
                <div className="text-sm font-bold" style={{color:'#22c55e'}}>{l.aiScore}</div>
              </div>
            ))}
          </Card>

          {/* Follow-up needed */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">⚠️</span>
              <div className="text-xs font-bold text-slate-900">Need Follow-up</div>
            </div>
            {coldLeads.length===0 ? <div className="text-xs text-slate-400 py-3 text-center">All leads followed up!</div>
            : coldLeads.map((l:any)=>(
              <div key={l.leadId} className="flex items-center gap-2 py-2 border-b border-slate-50 last:border-none">
                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{l.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-slate-800 truncate">{l.name}</div>
                  <div className="text-xs text-slate-400">{l.source?.toLowerCase()} · {l.status}</div>
                </div>
              </div>
            ))}
          </Card>

          {/* Email generator */}
          <Card>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-base">✉️</span>
              <div className="text-xs font-bold text-slate-900">Email Generator</div>
            </div>
            <div className="flex flex-col gap-2">
              <Input label="Lead ID" value={emailLeadId} onChange={e=>setEmailLeadId(e.target.value)} placeholder="Paste lead ID" />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-slate-600">Email Type</label>
                <select value={emailType} onChange={e=>setEmailType(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:border-indigo-500">
                  <option value="follow_up">Follow-up</option>
                  <option value="proposal">Proposal</option>
                  <option value="re_engagement">Re-engagement</option>
                  <option value="thank_you">Thank You</option>
                  <option value="payment_reminder">Payment Reminder</option>
                </select>
              </div>
              <Btn variant="primary" size="sm" loading={genLoading} onClick={generateEmail} className="self-start">✨ Generate</Btn>
              {emailResult && (
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 mt-1">
                  <div className="text-xs text-slate-400 font-semibold mb-1">SUBJECT</div>
                  <div className="text-xs font-bold text-slate-800 mb-2">{emailResult.subject}</div>
                  <div className="text-xs text-slate-400 font-semibold mb-1">BODY</div>
                  <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{emailResult.body}</div>
                  <button onClick={()=>{navigator.clipboard.writeText(`${emailResult.subject}\n\n${emailResult.body}`); toast('Copied!');}} className="text-xs text-indigo-600 hover:underline mt-2">Copy email</button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Right column — Chat */}
        <Card className="flex flex-col" style={{height:'calc(100vh - 120px)'}}>
          <div className="text-xs font-bold text-slate-900 mb-1">CRM AI Chat</div>
          <div className="text-xs text-slate-400 mb-3">Ask about your leads, pipeline and revenue</div>

          <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-3">
            {chat.length===0 && (
              <div className="text-center py-8">
                <div className="text-3xl mb-2">🤖</div>
                <div className="text-xs font-medium text-slate-600 mb-1">Ask anything about your CRM!</div>
                <div className="text-xs text-slate-400 mb-4">Data is pulled live from your database</div>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['How many leads do I have?','What\'s my conversion rate?','Show revenue summary','Which source performs best?'].map(q=>(
                    <button key={q} onClick={()=>setChatInput(q)} className="text-xs bg-indigo-50 text-indigo-600 px-3 py-1.5 rounded-full border border-indigo-200 hover:bg-indigo-100 transition-colors">{q}</button>
                  ))}
                </div>
              </div>
            )}
            {chat.map((msg,i)=>(
              <div key={i} className={`flex ${msg.role==='user'?'justify-end':'justify-start'}`}>
                <div className={`max-w-xs px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed ${msg.role==='user'?'bg-indigo-600 text-white rounded-br-sm':'bg-slate-100 text-slate-800 rounded-bl-sm'}`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 px-3.5 py-2.5 rounded-2xl rounded-bl-sm flex gap-1 items-center">
                  {[0,1,2].map(i=><div key={i} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{animationDelay:`${i*0.15}s`}} />)}
                </div>
              </div>
            )}
            <div ref={chatEnd} />
          </div>

          <div className="flex gap-2 pt-3 border-t border-slate-100">
            <input className="flex-1 border border-slate-200 rounded-xl px-3.5 py-2 text-xs focus:border-indigo-500 transition-colors"
              placeholder="Ask about your leads, pipeline, revenue..."
              value={chatInput} onChange={e=>setChatInput(e.target.value)}
              onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendChat();}}}
            />
            <button onClick={sendChat} disabled={!chatInput.trim()||chatLoading}
              className="w-9 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40 flex-shrink-0">
              →
            </button>
          </div>
        </Card>
      </div>
      <ToastContainer />
    </>
  );
}
