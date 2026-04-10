'use client';
import { useEffect, useState } from 'react';
import { companyApi, commApi, templateApi, leadApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Modal, useToast } from '@/components/ui';

const MATCH_TYPES = [{ value:'CONTAINS', label:'Contains' },{ value:'EXACT', label:'Exact Match' },{ value:'STARTS_WITH', label:'Starts With' }];
const STATUS_COLOR: Record<string,string> = { SENT:'text-blue-500', DELIVERED:'text-indigo-500', READ:'text-emerald-500', FAILED:'text-red-400', PENDING:'text-amber-500' };

export default function WhatsAppPage() {
  const [companyId,    setCompanyId]    = useState('');
  const [companies,    setCompanies]    = useState<any[]>([]);
  const [tab,          setTab]          = useState<'send'|'autoReply'|'log'>('send');
  const [templates,    setTemplates]    = useState<any[]>([]);
  const [autoRules,    setAutoRules]    = useState<any[]>([]);
  const [commLog,      setCommLog]      = useState<any[]>([]);
  const [logLoading,   setLogLoading]   = useState(false);
  const [loading,      setLoading]      = useState(false);

  // Send message state
  const [leadSearch,   setLeadSearch]   = useState('');
  const [searchResults,setSearchResults]= useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [sendChannel,  setSendChannel]  = useState('WHATSAPP');
  const [templateId,   setTemplateId]   = useState('');
  const [msgBody,      setMsgBody]      = useState('');
  const [preview,      setPreview]      = useState('');
  const [sending,      setSending]      = useState(false);

  // Auto-reply state
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [ruleForm,     setRuleForm]     = useState({ keyword:'', matchType:'CONTAINS', replyBody:'', priority:0 });
  const [editRuleId,   setEditRuleId]   = useState('');
  const [ruleSaving,   setRuleSaving]   = useState(false);

  const { toast, ToastContainer } = useToast();

  const loadCos = async () => {
    try { const d = await companyApi.mine(); const cos = d.companies||[]; setCompanies(cos); if (cos[0]) setCompanyId(cos[0].companyId); } catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [td, ard] = await Promise.all([templateApi.list(companyId), commApi.getAutoReplyRules(companyId)]);
      setTemplates(td.templates || []);
      setAutoRules(ard.rules || []);
    } catch(e:any){ toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [companyId]);
  useEffect(() => { if (tab === 'log' && companyId) loadLog(); }, [tab, companyId]);

  const loadLog = async () => {
    if (!companyId) return;
    setLogLoading(true);
    try {
      // Get recent leads and load their latest communications
      const ld = await leadApi.list(companyId, { limit:'30', sortBy:'lastActivityAt' });
      const recentLeads = (ld.leads || []).slice(0, 10);
      const results: any[] = [];
      await Promise.all(recentLeads.map(async (lead: any) => {
        try {
          const td = await (await import('@/lib/api')).commApi.getTimeline(companyId, lead.leadId);
          (td.items || []).slice(0, 5).forEach((item: any) => {
            results.push({ ...item, leadName: lead.name, leadPhone: lead.phone });
          });
        } catch {}
      }));
      results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setCommLog(results.slice(0, 50));
    } catch(e:any){ toast(e.message,'err'); }
    finally { setLogLoading(false); }
  };

  const searchLeads = async (q: string) => {
    if (!q || q.length < 2) { setSearchResults([]); return; }
    try {
      const d = await leadApi.list(companyId, { search: q, limit: '8' });
      setSearchResults(d.leads || []);
    } catch {}
  };
  useEffect(() => { const t = setTimeout(()=>searchLeads(leadSearch), 300); return ()=>clearTimeout(t); }, [leadSearch, companyId]);

  // Load template preview when template selected
  useEffect(() => {
    if (!templateId || !companyId) { setPreview(''); return; }
    templateApi.preview(companyId, templateId, selectedLead).then(d => {
      setPreview(d.rendered || '');
      setMsgBody(d.rendered || '');
    }).catch(() => {});
  }, [templateId, selectedLead]);

  const sendMessage = async () => {
    if (!selectedLead) return toast('Select a lead first','err');
    if (!msgBody.trim()) return toast('Enter a message','err');
    setSending(true);
    try {
      await commApi.sendManual(companyId, selectedLead.leadId, { channel: sendChannel, body: msgBody, templateId: templateId || undefined });
      toast('Message sent!');
      setMsgBody(''); setTemplateId(''); setPreview(''); setSelectedLead(null); setLeadSearch('');
    } catch(e:any){ toast(e.message,'err'); }
    finally { setSending(false); }
  };

  const saveRule = async () => {
    if (!ruleForm.keyword || !ruleForm.replyBody) return toast('Keyword and reply required','err');
    setRuleSaving(true);
    try {
      if (editRuleId) await commApi.updateAutoReplyRule(companyId, editRuleId, ruleForm);
      else            await commApi.createAutoReplyRule(companyId, ruleForm);
      toast(editRuleId ? 'Rule updated!' : 'Rule created!');
      setShowRuleForm(false); setEditRuleId(''); setRuleForm({ keyword:'', matchType:'CONTAINS', replyBody:'', priority:0 });
      load();
    } catch(e:any){ toast(e.message,'err'); }
    finally { setRuleSaving(false); }
  };

  const deleteRule = async (id: string) => {
    try { await commApi.deleteAutoReplyRule(companyId, id); toast('Deleted.'); load(); }
    catch(e:any){ toast(e.message,'err'); }
  };

  return (
    <>
      <Topbar title="WhatsApp Hub" subtitle="Send messages, manage auto-replies and view message log"
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">
        {/* Tabs */}
        <div className="flex gap-1 border-b border-slate-200">
          {[{k:'send',l:'💬 Send Message'},{k:'autoReply',l:'🤖 Auto-Reply'},{k:'log',l:'📋 Message Log'}].map(t=>(
            <button key={t.k} onClick={()=>setTab(t.k as any)}
              className={`text-xs font-semibold px-4 py-2 border-b-2 transition-colors ${tab===t.k?'border-indigo-500 text-indigo-700':'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {t.l}
            </button>
          ))}
        </div>

        {/* Send Message Tab */}
        {tab === 'send' && (
          <div className="grid grid-cols-[1fr_1.2fr] gap-4 items-start">
            <Card>
              <div className="text-xs font-bold text-slate-800 mb-3">Send to Lead</div>

              {/* Lead search */}
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1">Search Lead</div>
                <input value={leadSearch} onChange={e=>setLeadSearch(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500"
                  placeholder="Type name, phone or email..." />
                {searchResults.length > 0 && (
                  <div className="mt-1 border border-slate-200 rounded-lg overflow-hidden shadow-sm">
                    {searchResults.map((l:any) => (
                      <button key={l.leadId} onClick={()=>{ setSelectedLead(l); setLeadSearch(l.name); setSearchResults([]); }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-indigo-50 border-b border-slate-50 last:border-none text-left">
                        <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-[10px] flex-shrink-0">{l.name[0]}</div>
                        <div>
                          <div className="font-semibold text-slate-800">{l.name}</div>
                          <div className="text-slate-400 text-[10px]">{l.phone} {l.country ? `· ${l.country}` : ''}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {selectedLead && (
                <div className="bg-emerald-50 rounded-lg px-3 py-2 flex items-center gap-2 mb-3 text-xs">
                  <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-[10px]">{selectedLead.name[0]}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-emerald-800">{selectedLead.name}</div>
                    <div className="text-emerald-600 text-[10px]">{selectedLead.phone}</div>
                  </div>
                  <button onClick={()=>{ setSelectedLead(null); setLeadSearch(''); }} className="text-emerald-400 hover:text-emerald-600">✕</button>
                </div>
              )}

              {/* Channel */}
              <div className="flex gap-2 mb-3">
                {['WHATSAPP','EMAIL','SMS'].map(ch=>(
                  <button key={ch} onClick={()=>setSendChannel(ch)}
                    className={`text-[10px] px-3 py-1.5 rounded-lg border font-medium transition-colors ${sendChannel===ch?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-500'}`}>
                    {ch==='WHATSAPP'?'💬':ch==='EMAIL'?'📧':'📱'} {ch}
                  </button>
                ))}
              </div>

              {/* Template selector */}
              <div className="mb-3">
                <div className="text-xs font-semibold text-slate-700 mb-1">Template (optional)</div>
                <select value={templateId} onChange={e=>{ setTemplateId(e.target.value); if (!e.target.value) { setPreview(''); setMsgBody(''); } }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
                  <option value="">Write custom message</option>
                  {templates.map((t:any)=><option key={t.templateId} value={t.templateId}>{t.name}</option>)}
                </select>
              </div>

              {/* Message body */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-slate-700 mb-1">Message *</div>
                <textarea value={msgBody} onChange={e=>setMsgBody(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" rows={5}
                  placeholder="Hi {{name}}, this is Raulji Technologies..." />
                <div className="text-[10px] text-slate-400 mt-0.5">Variables: {'{{name}} {{service}} {{city}} {{country}}'}</div>
              </div>

              <Btn variant="primary" onClick={sendMessage} loading={sending} className="w-full">
                Send via {sendChannel}
              </Btn>
            </Card>

            {/* Preview */}
            <Card className="bg-slate-900 text-white">
              <div className="text-xs font-bold mb-3 text-slate-300">📱 Message Preview</div>
              {msgBody ? (
                <div className="bg-emerald-600 rounded-2xl rounded-tl-none px-4 py-3 text-sm leading-relaxed max-w-[280px] whitespace-pre-wrap">{msgBody}</div>
              ) : (
                <div className="text-slate-500 text-xs italic">Type your message to see preview</div>
              )}
              {selectedLead && (
                <div className="mt-4 border-t border-white/10 pt-3 text-[10px] text-slate-400">
                  <div>To: {selectedLead.name}</div>
                  <div>📞 {selectedLead.phone}</div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Auto-Reply Rules Tab */}
        {tab === 'autoReply' && (
          <div className="flex flex-col gap-3">
            <div className="flex justify-end">
              <Btn variant="primary" size="sm" onClick={()=>{ setEditRuleId(''); setRuleForm({keyword:'',matchType:'CONTAINS',replyBody:'',priority:0}); setShowRuleForm(true); }}>+ Add Rule</Btn>
            </div>

            {loading ? <div className="py-10 text-center text-slate-400 text-xs">Loading...</div>
            : autoRules.length === 0 ? (
              <Card className="py-12 text-center">
                <div className="text-4xl mb-3">🤖</div>
                <div className="text-sm font-semibold text-slate-700">No auto-reply rules</div>
                <div className="text-xs text-slate-400 mt-1 mb-4">Automatically reply when clients send matching keywords</div>
                <Btn variant="primary" size="sm" onClick={()=>setShowRuleForm(true)}>Add First Rule</Btn>
              </Card>
            ) : autoRules.map((r:any) => (
              <Card key={r.replyRuleId} className="flex items-start gap-4 p-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded">{r.matchType}</span>
                    <span className="text-sm font-semibold text-slate-800">"{r.keyword}"</span>
                    {r.priority > 0 && <span className="text-[10px] text-slate-400">Priority: {r.priority}</span>}
                  </div>
                  <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2 mt-1 whitespace-pre-wrap">{r.replyBody}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${r.isActive?'bg-emerald-100 text-emerald-700':'bg-slate-100 text-slate-500'}`}>{r.isActive?'Active':'Off'}</span>
                  <button onClick={()=>{ setEditRuleId(r.replyRuleId); setRuleForm({ keyword:r.keyword, matchType:r.matchType, replyBody:r.replyBody, priority:r.priority }); setShowRuleForm(true); }}
                    className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50">Edit</button>
                  <button onClick={()=>deleteRule(r.replyRuleId)} className="text-[10px] text-red-400 hover:text-red-600 font-semibold px-2 py-1 rounded hover:bg-red-50">Delete</button>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Log Tab */}
        {tab === 'log' && (
          <Card className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900">Recent Messages</div>
              <button onClick={loadLog} className="text-[10px] text-indigo-500 hover:text-indigo-700 font-semibold px-2 py-1 rounded hover:bg-indigo-50">Refresh</button>
            </div>
            {logLoading ? (
              <div className="py-10 text-center text-slate-400 text-xs">Loading...</div>
            ) : commLog.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-xs">
                <div className="text-2xl mb-2">📋</div>
                No messages yet. Send messages to leads to see history here.
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {commLog.map((item: any) => (
                  <div key={item.commId} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/50">
                    <div className="text-base flex-shrink-0 mt-0.5">
                      {item.channel==='WHATSAPP'?'💬':item.channel==='EMAIL'?'📧':item.channel==='CALL'?'📞':'📝'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-xs font-semibold text-slate-800 truncate">{item.leadName || 'Unknown'}</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${item.direction==='OUTBOUND'?'bg-blue-50 text-blue-600':'bg-emerald-50 text-emerald-600'}`}>
                          {item.direction==='OUTBOUND'?'↗ Sent':'↙ Received'}
                        </span>
                        <span className={`text-[10px] font-bold ml-auto ${STATUS_COLOR[item.status]||'text-slate-400'}`}>{item.status}</span>
                      </div>
                      <div className="text-xs text-slate-600 truncate">{item.body}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.leadPhone} · {new Date(item.createdAt).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}
      </div>

      {/* Auto-Reply Rule Modal */}
      <Modal open={showRuleForm} onClose={()=>setShowRuleForm(false)} title={editRuleId ? 'Edit Auto-Reply Rule' : 'New Auto-Reply Rule'}
        footer={<><Btn variant="secondary" onClick={()=>setShowRuleForm(false)}>Cancel</Btn><Btn variant="primary" loading={ruleSaving} onClick={saveRule}>{editRuleId?'Save':'Create'}</Btn></>}>
        <div className="flex flex-col gap-3">
          <Input label="Keyword *" value={ruleForm.keyword} onChange={(e:any)=>setRuleForm(f=>({...f,keyword:e.target.value}))} placeholder="price, website, SEO..." />
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Match Type</div>
            <select value={ruleForm.matchType} onChange={(e:any)=>setRuleForm(f=>({...f,matchType:e.target.value}))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500">
              {MATCH_TYPES.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Reply Message *</div>
            <textarea value={ruleForm.replyBody} onChange={(e:any)=>setRuleForm(f=>({...f,replyBody:e.target.value}))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none" rows={4}
              placeholder="Hi {{name}}, thanks for reaching out! Our {{service}} pricing starts from ₹5,000. I'll call you shortly." />
            <div className="text-[10px] text-slate-400 mt-0.5">Variables: {'{{name}} {{service}} {{city}} {{company}}'}</div>
          </div>
          <div>
            <div className="text-xs font-semibold text-slate-700 mb-1">Priority (lower = higher priority)</div>
            <input type="number" min={0} value={ruleForm.priority} onChange={(e:any)=>setRuleForm(f=>({...f,priority:+e.target.value}))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500" />
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
