'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { leadApi } from '@/lib/api';
import { Card, Btn, useToast } from '@/components/ui';
import { SERVICE_COLOR } from '@/lib/services';

function getCompanyId() {
  if (typeof window === 'undefined') return '';
  try { return JSON.parse(localStorage.getItem('user')||'{}')?.companyId || ''; } catch { return ''; }
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const router = useRouter();
  const companyId = getCompanyId();

  const [lead,    setLead]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { toast, ToastContainer } = useToast();

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const ld = await leadApi.get(companyId, leadId);
      setLead(ld);
    } catch(e:any){ toast(e.message,'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [leadId]);

  const STATUS_BADGE: Record<string,string> = {
    NEW:'bg-slate-100 text-slate-600', CONTACTED:'bg-blue-100 text-blue-700', QUALIFIED:'bg-indigo-100 text-indigo-700',
    PROPOSAL_SENT:'bg-purple-100 text-purple-700', NEGOTIATION:'bg-amber-100 text-amber-700', WON:'bg-emerald-100 text-emerald-700', LOST:'bg-red-100 text-red-500'
  };

  // customFields is free-form JSON from whatever website form posted the lead,
  // so keys are unknown ahead of time — render whatever arrived.
  const prettyKey = (k: string) =>
    k.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const isUrl = (v: string) => /^https?:\/\//i.test(v);

  const customEntries: [string, any][] =
    lead?.customFields && typeof lead.customFields === 'object' && !Array.isArray(lead.customFields)
      ? Object.entries(lead.customFields).filter(([, v]) => v !== null && v !== undefined && v !== '')
      : [];

  const fmtWhen = (d: string) => {
    try { return new Date(d).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return d; }
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

        <div className="p-5 max-w-2xl">
          {/* Lead Info */}
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

          {/* Data captured by the website form that submitted this lead */}
          {customEntries.length > 0 && (
            <Card className="mt-4">
              <div className="text-xs font-bold text-slate-800 mb-3">Form Submission Data</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {customEntries.map(([k, v]) => {
                  const val = typeof v === 'object' ? JSON.stringify(v) : String(v);
                  return (
                    <div key={k} className="min-w-0">
                      <div className="text-slate-400 text-[10px] uppercase tracking-wider">{prettyKey(k)}</div>
                      {isUrl(val) ? (
                        <a href={val} target="_blank" rel="noopener noreferrer"
                          className="text-indigo-600 font-medium mt-0.5 block truncate hover:underline" title={val}>
                          {val}
                        </a>
                      ) : (
                        <div className="text-slate-700 font-medium mt-0.5 break-words" title={val}>{val}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Repeat enquiries from the public API land here as NOTE activities */}
          {Array.isArray(lead.activities) && lead.activities.length > 0 && (
            <Card className="mt-4">
              <div className="text-xs font-bold text-slate-800 mb-3">
                Activity <span className="text-slate-400 font-medium">({lead.activities.length})</span>
              </div>
              <div className="flex flex-col">
                {lead.activities.map((a: any, i: number) => (
                  <div key={a.activityId || i} className="flex gap-3 text-xs">
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 mt-1.5" />
                      {i < lead.activities.length - 1 && <div className="w-px flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className="pb-3 min-w-0">
                      <div className="text-slate-700">{a.description}</div>
                      <div className="text-slate-400 text-[10px] mt-0.5">
                        {a.type}{a.createdAt ? ` · ${fmtWhen(a.createdAt)}` : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
      <ToastContainer />
    </>
  );
}
