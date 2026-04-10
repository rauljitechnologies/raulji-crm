'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadApi, commApi, templateApi } from '@/lib/api';
import { Card, Btn, useToast } from '@/components/ui';
import { SERVICE_COLOR } from '@/lib/services';

const CH_ICON: Record<string,string> = { WHATSAPP:'💬', EMAIL:'📧', CALL:'📞', NOTE:'📝', SMS:'📱' };
const CH_COLOR: Record<string,string> = { WHATSAPP:'border-l-emerald-400 bg-emerald-50/40', EMAIL:'border-l-blue-400 bg-blue-50/40', CALL:'border-l-orange-400 bg-orange-50/40', NOTE:'border-l-slate-300 bg-slate-50/40', SMS:'border-l-purple-400 bg-purple-50/40' };
const STATUS_COLOR: Record<string,string> = { SENT:'text-blue-500', DELIVERED:'text-indigo-500', READ:'text-emerald-500', FAILED:'text-red-400', PENDING:'text-amber-500' };
const DIR_LABEL: Record<string,string> = { OUTBOUND:'↗ Sent', INBOUND:'↙ Received' };

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff/60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m/60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h/24);
  return `${d}d ago`;
}

function getCompanyId() {
  if (typeof window === 'undefined') return '';
  try { return JSON.parse(localStorage.getItem('user')||'{}')?.companyId || ''; } catch { return ''; }
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router = useRouter();
  const companyId = getCompanyId();

  const [lead,      setLead]      = useState<any>(null);
  const [timeline,  setTimeline]  = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [channel,   setChannel]   = useState('WHATSAPP');
  const [templateId,setTemplateId]= useState('');
  const [msgBody,   setMsgBody]   = useState('');
  const [sending,   setSending]   = useState(false);
  const { toast, ToastContainer } = useToast();

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [ld, td, tpld] = await Promise.all([
        leadApi.get(companyId, leadId),
        commApi.getTimeline(companyId, leadId),
        templateApi.list(companyId)
      ]);
      setLead(ld);
      setTimeline(td.items || []);
      setTemplates(tpld.templates || []);
    } catch(e:any){ toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [leadId]);

  // Load template preview
  useEffect(() => {
    if (!templateId || !companyId || !lead) { setMsgBody(''); return; }
    templateApi.preview(companyId, templateId, lead).then(d => setMsgBody(d.rendered || '')).catch(() => {});
  }, [templateId, lead]);

  const send = async () => {
    if (!msgBody.trim()) return toast('Enter a message','err');
    setSending(true);
    try {
      await commApi.sendManual(companyId, leadId, { channel, body: msgBody, templateId: templateId||undefined });
      toast('Sent!');
      setMsgBody(''); setTemplateId('');
      load();
    } catch(e:any){ toast(e.message,'err'); }
    finally { setSending(false); }
  };

  const STATUS_BADGE: Record<string,string> = {
    NEW:'bg-slate-100 text-slate-600', CONTACTED:'bg-blue-100 text-blue-700', QUALIFIED:'bg-indigo-100 text-indigo-700',
    PROPOSAL_SENT:'bg-purple-100 text-purple-700', NEGOTIATION:'bg-amber-100 text-amber-700', WON:'bg-emerald-100 text-emerald-700', LOST:'bg-red-100 text-red-500'
  };

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading lead...</div>
    </div>
  );

  if (!lead) return (
    <div className="flex-1 flex items-center justify-center flex-col gap-3">
      <div className="text-slate-400 text-sm">Lead not found</div>
      <Btn variant="secondary" onClick={()=>router.back()}>Go Back</Btn>
    </div>
  );

  return (
    <>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
          <button onClick={()=>router.back()} className="text-slate-400 hover:text-slate-600 text-sm">← Back</button>
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold flex-shrink-0">{lead.name?.[0]}</div>
          <div className="flex-1">
            <div className="text-base font-bold text-slate-900">{lead.name}</div>
            <div className="text-xs text-slate-500">{lead.phone} {lead.email ? `· ${lead.email}` : ''}</div>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${STATUS_BADGE[lead.status]||'bg-slate-100 text-slate-500'}`}>{lead.status}</span>
        </div>

        <div className="p-5 grid grid-cols-[1fr_1.4fr] gap-4 items-start">
          {/* Lead Info */}
          <div className="flex flex-col gap-3">
            <Card>
              <div className="text-xs font-bold text-slate-800 mb-3">Lead Information</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {[
                  ['Source',   lead.source],
                  ['Priority', lead.priority],
                  ['City',     lead.city],
                  ['State',    lead.state],
                  ['Country',  lead.country],
                  ['Deal Value', lead.dealValue ? `₹${lead.dealValue.toLocaleString()}` : null],
                ].filter(([,v])=>v).map(([k,v])=>(
                  <div key={k}>
                    <div className="text-slate-400 text-[10px] uppercase tracking-wider">{k}</div>
                    <div className="text-slate-700 font-medium mt-0.5">{v}</div>
                  </div>
                ))}
              </div>
              {lead.service && (
                <div className="mt-3">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Service Interest</div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${SERVICE_COLOR[lead.service]||'bg-slate-100 text-slate-600'}`}>{lead.service}</span>
                </div>
              )}
              {lead.message && (
                <div className="mt-3">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Message</div>
                  <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{lead.message}</div>
                </div>
              )}
              {lead.notes && (
                <div className="mt-3">
                  <div className="text-slate-400 text-[10px] uppercase tracking-wider mb-1">Notes</div>
                  <div className="text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{lead.notes}</div>
                </div>
              )}
            </Card>

            {/* Compose */}
            <Card>
              <div className="text-xs font-bold text-slate-800 mb-3">Send Message</div>
              {/* Channel tabs */}
              <div className="flex gap-1 mb-3">
                {['WHATSAPP','EMAIL','CALL','NOTE'].map(ch=>(
                  <button key={ch} onClick={()=>setChannel(ch)}
                    className={`text-[10px] px-2.5 py-1.5 rounded-lg border font-medium transition-colors ${channel===ch?'border-indigo-500 bg-indigo-50 text-indigo-700':'border-slate-200 text-slate-500'}`}>
                    {CH_ICON[ch]} {ch}
                  </button>
                ))}
              </div>
              {/* Template */}
              <select value={templateId} onChange={e=>{ setTemplateId(e.target.value); if(!e.target.value) setMsgBody(''); }}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 mb-2">
                <option value="">Custom message</option>
                {templates.map((t:any)=><option key={t.templateId} value={t.templateId}>{t.name}</option>)}
              </select>
              <textarea value={msgBody} onChange={e=>setMsgBody(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-xs outline-none focus:border-indigo-500 resize-none mb-3" rows={4}
                placeholder={`Send a ${channel.toLowerCase()} to ${lead.name}...`} />
              <Btn variant="primary" onClick={send} loading={sending} className="w-full">
                {CH_ICON[channel]} Send {channel}
              </Btn>
            </Card>
          </div>

          {/* Timeline */}
          <Card className="p-0">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="text-xs font-bold text-slate-900">Communication History</div>
              <div className="text-xs text-slate-400">{timeline.length} messages</div>
            </div>

            {timeline.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                <div className="text-2xl mb-2">💬</div>
                No messages yet. Send the first message!
              </div>
            ) : (
              <div className="divide-y divide-slate-50 max-h-[600px] overflow-y-auto">
                {timeline.map((item:any) => (
                  <div key={item.commId} className={`flex gap-3 px-4 py-3 border-l-2 ${CH_COLOR[item.channel]||'border-l-slate-200'}`}>
                    <div className="text-base flex-shrink-0 mt-0.5">{CH_ICON[item.channel]||'💬'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold text-slate-500">{DIR_LABEL[item.direction]||item.direction}</span>
                        {item.status && <span className={`text-[10px] font-bold ${STATUS_COLOR[item.status]||'text-slate-400'}`}>{item.status}</span>}
                        {item.template && <span className="text-[10px] text-slate-400 bg-white border border-slate-100 px-1.5 py-0.5 rounded">{item.template.name}</span>}
                        <span className="text-[10px] text-slate-300 ml-auto">{timeAgo(item.createdAt)}</span>
                      </div>
                      {item.subject && <div className="text-xs font-semibold text-slate-700 mb-0.5">{item.subject}</div>}
                      <div className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{item.body}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
