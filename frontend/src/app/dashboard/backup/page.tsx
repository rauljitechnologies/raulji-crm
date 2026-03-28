'use client';
import { useState, useEffect, useCallback } from 'react';
import { Topbar, Btn, Badge, useToast, Empty } from '@/components/ui';
import { backupApi } from '@/lib/api';

// ── Types ────────────────────────────────────────────────────────────────────
interface BackupLog {
  id: string;
  stamp: string;
  label: string;
  status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';
  trigger: 'SCHEDULED' | 'MANUAL';
  dbFile: string | null;
  codeFile: string | null;
  dbSizeBytes: number | null;
  codeSizeBytes: number | null;
  driveFolder: string | null;
  error: string | null;
  completedAt: string | null;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtSize(bytes: number | null) {
  if (!bytes) return '—';
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata',
  });
}

function duration(start: string, end: string | null) {
  if (!end) return '—';
  const s = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const STATUS_MAP: Record<string, { bg: string; color: string; dot: string }> = {
  SUCCESS: { bg: '#d1fae5', color: '#047857', dot: '#10b981' },
  PARTIAL: { bg: '#fffbeb', color: '#b45309', dot: '#f59e0b' },
  FAILED:  { bg: '#fef2f2', color: '#dc2626', dot: '#ef4444' },
  RUNNING: { bg: '#e8f5fd', color: '#1a72a3', dot: '#3199d4' },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS_MAP[status] || STATUS_MAP.RUNNING;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:5, background:s.bg, color:s.color, padding:'3px 10px', borderRadius:9999, fontSize:11, fontWeight:700 }}>
      <span style={{ width:6, height:6, borderRadius:'50%', background:s.dot, display:'inline-block' }}/>
      {status}
    </span>
  );
}

function TriggerBadge({ trigger }: { trigger: string }) {
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, background: trigger === 'MANUAL' ? '#f5f3ff' : '#f0f5fa', color: trigger === 'MANUAL' ? '#7c3aed' : '#64748b', padding:'3px 9px', borderRadius:9999, fontSize:11, fontWeight:600 }}>
      {trigger === 'MANUAL' ? '⚡ Manual' : '⏰ Scheduled'}
    </span>
  );
}

// ── Download helper (uses token in header via fetch → blob) ───────────────────
function downloadFile(id: string, type: 'db' | 'code', stamp: string) {
  const token = localStorage.getItem('accessToken');
  const url   = backupApi.downloadUrl(id, type);
  fetch(url, { headers: { Authorization: `Bearer ${token}` } })
    .then(r => {
      if (!r.ok) throw new Error('File not available');
      return r.blob();
    })
    .then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = type === 'db' ? `database_${stamp}.sql` : `code_${stamp}.zip`;
      a.click();
      URL.revokeObjectURL(a.href);
    })
    .catch(e => alert(e.message));
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function BackupPage() {
  const [logs, setLogs]         = useState<BackupLog[]>([]);
  const [total, setTotal]       = useState(0);
  const [page, setPage]         = useState(1);
  const [pages, setPages]       = useState(1);
  const [loading, setLoading]   = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { toast, ToastContainer } = useToast();

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const data = await backupApi.list({ page: p, limit: 15 });
      setLogs(data.logs);
      setTotal(data.total);
      setPage(p);
      setPages(data.pages || 1);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(1); }, [load]);

  // Auto-refresh while any backup is RUNNING
  useEffect(() => {
    const hasRunning = logs.some(l => l.status === 'RUNNING');
    if (!hasRunning) return;
    const t = setInterval(() => load(page), 3000);
    return () => clearInterval(t);
  }, [logs, page, load]);

  async function trigger() {
    setTriggering(true);
    try {
      await backupApi.trigger();
      toast('Backup started — refreshing in a moment…', 'ok');
      setTimeout(() => load(1), 2500);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setTriggering(false);
    }
  }

  async function del(id: string) {
    if (!confirm('Delete this backup log and local files?')) return;
    setDeletingId(id);
    try {
      await backupApi.delete(id);
      toast('Backup deleted.', 'ok');
      load(page);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setDeletingId(null);
    }
  }

  // ── KPI strip ────────────────────────────────────────────────────────────
  const success = logs.filter(l => l.status === 'SUCCESS').length;
  const failed  = logs.filter(l => l.status === 'FAILED').length;
  const partial = logs.filter(l => l.status === 'PARTIAL').length;
  const lastOk  = logs.find(l => l.status === 'SUCCESS' || l.status === 'PARTIAL');

  return (
    <div className="flex flex-col h-full" style={{ background: '#f0f5fa' }}>
      <ToastContainer />
      <Topbar
        title="Backup Manager"
        subtitle="Automated daily backups at 05:00 AM IST — Database + Code → Google Drive"
        actions={
          <Btn variant="primary" loading={triggering} onClick={trigger}>
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
              <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd"/>
            </svg>
            Run Backup Now
          </Btn>
        }
      />

      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total Backups',  value: total,   color: '#3199d4', icon: '🗂' },
            { label: 'Successful',     value: success, color: '#10b981', icon: '✅' },
            { label: 'Partial (local)', value: partial, color: '#f59e0b', icon: '⚠️' },
            { label: 'Failed',         value: failed,  color: '#ef4444', icon: '❌' },
          ].map(k => (
            <div key={k.label} className="rounded-xl p-4" style={{ background:'#fff', border:'1px solid #e2eaf2', boxShadow:'0 1px 3px rgba(25,43,63,.05)' }}>
              <div style={{ fontSize:11.5, fontWeight:600, color:'#7a9baf', textTransform:'uppercase', letterSpacing:'0.04em' }}>{k.icon} {k.label}</div>
              <div style={{ fontSize:28, fontWeight:800, color: k.color, lineHeight:1.1, marginTop:6 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Last successful backup banner */}
        {lastOk && (
          <div className="rounded-xl px-5 py-3 flex items-center gap-3" style={{ background:'#ecfdf5', border:'1px solid #a7f3d0' }}>
            <span style={{ fontSize:18 }}>✅</span>
            <div>
              <div style={{ fontSize:13, fontWeight:700, color:'#047857' }}>Last successful backup: {lastOk.label}</div>
              <div style={{ fontSize:11.5, color:'#059669' }}>
                DB: {fmtSize(lastOk.dbSizeBytes)} &nbsp;·&nbsp; Code: {fmtSize(lastOk.codeSizeBytes)}
                {lastOk.driveFolder && <>&nbsp;·&nbsp; <span style={{ fontWeight:600 }}>Uploaded to Google Drive ✓</span></>}
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ background:'#fff', border:'1px solid #e2eaf2', boxShadow:'0 1px 3px rgba(25,43,63,.05)' }}>
          <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom:'1px solid #f0f5fa' }}>
            <div style={{ fontSize:13, fontWeight:700, color:'#192b3f' }}>Backup History</div>
            <div style={{ fontSize:12, color:'#7a9baf' }}>{total} total &nbsp;·&nbsp; Files kept for 30 days</div>
          </div>

          {loading ? (
            <div style={{ padding:48, textAlign:'center', color:'#7a9baf', fontSize:13 }}>Loading…</div>
          ) : logs.length === 0 ? (
            <Empty icon="🗄️" title="No backups yet" desc="Click 'Run Backup Now' to create your first backup." />
          ) : (
            <div className="overflow-x-auto">
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12.5 }}>
                <thead>
                  <tr style={{ background:'#f8fafc' }}>
                    {['Date & Time','Status','Trigger','DB Size','Code Size','Duration','Drive','Downloads',''].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontWeight:600, color:'#7a9baf', fontSize:11, textTransform:'uppercase', letterSpacing:'0.04em', borderBottom:'1px solid #e2eaf2', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log.id} style={{ borderBottom: i < logs.length-1 ? '1px solid #f0f5fa' : 'none', transition:'background .12s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={e => (e.currentTarget.style.background = '')}>

                      {/* Date */}
                      <td style={{ padding:'12px 14px', color:'#192b3f', fontWeight:600 }}>
                        <div>{log.label}</div>
                        <div style={{ fontSize:11, color:'#9ab0c0', marginTop:2 }}>{log.stamp}</div>
                      </td>

                      {/* Status */}
                      <td style={{ padding:'12px 14px' }}>
                        <StatusBadge status={log.status} />
                        {log.error && (
                          <div style={{ fontSize:10.5, color:'#ef4444', marginTop:4, maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={log.error}>
                            {log.error}
                          </div>
                        )}
                      </td>

                      {/* Trigger */}
                      <td style={{ padding:'12px 14px' }}>
                        <TriggerBadge trigger={log.trigger} />
                      </td>

                      {/* DB Size */}
                      <td style={{ padding:'12px 14px', color:'#192b3f' }}>
                        {log.status === 'RUNNING' ? (
                          <span style={{ color:'#3199d4', fontSize:11 }}>running…</span>
                        ) : fmtSize(log.dbSizeBytes)}
                      </td>

                      {/* Code Size */}
                      <td style={{ padding:'12px 14px', color:'#192b3f' }}>
                        {log.status === 'RUNNING' ? '—' : fmtSize(log.codeSizeBytes)}
                      </td>

                      {/* Duration */}
                      <td style={{ padding:'12px 14px', color:'#7a9baf' }}>
                        {duration(log.createdAt, log.completedAt)}
                      </td>

                      {/* Drive link */}
                      <td style={{ padding:'12px 14px' }}>
                        {log.driveFolder ? (
                          <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11.5, color:'#10b981', fontWeight:600 }}>
                            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width:12, height:12 }}>
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                            Uploaded
                          </span>
                        ) : log.status === 'PARTIAL' ? (
                          <span style={{ fontSize:11.5, color:'#f59e0b', fontWeight:600 }}>Local only</span>
                        ) : (
                          <span style={{ color:'#c0d0dd', fontSize:11.5 }}>—</span>
                        )}
                      </td>

                      {/* Downloads */}
                      <td style={{ padding:'12px 14px' }}>
                        <div className="flex gap-2">
                          <button
                            disabled={!log.dbFile}
                            onClick={() => downloadFile(log.id, 'db', log.stamp)}
                            className="inline-flex items-center gap-1 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                            style={{ padding:'4px 10px', fontSize:11, fontWeight:600, background:'#e8f5fd', color:'#1a72a3', border:'none', cursor: log.dbFile ? 'pointer' : 'default' }}
                            title={log.dbFile ? 'Download SQL database dump' : 'File expired or not available'}>
                            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width:11, height:11 }}>
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                            </svg>
                            DB (.sql)
                          </button>
                          <button
                            disabled={!log.codeFile}
                            onClick={() => downloadFile(log.id, 'code', log.stamp)}
                            className="inline-flex items-center gap-1 rounded-lg transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-80"
                            style={{ padding:'4px 10px', fontSize:11, fontWeight:600, background:'#f5f3ff', color:'#7c3aed', border:'none', cursor: log.codeFile ? 'pointer' : 'default' }}
                            title={log.codeFile ? 'Download code ZIP archive' : 'File expired or not available'}>
                            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width:11, height:11 }}>
                              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd"/>
                            </svg>
                            Code (.zip)
                          </button>
                        </div>
                      </td>

                      {/* Delete */}
                      <td style={{ padding:'12px 14px' }}>
                        <button
                          onClick={() => del(log.id)}
                          disabled={deletingId === log.id || log.status === 'RUNNING'}
                          className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-red-50 disabled:opacity-40"
                          style={{ color:'#ef4444', border:'none', background:'transparent', cursor:'pointer' }}
                          title="Delete this backup">
                          <svg viewBox="0 0 20 20" fill="currentColor" style={{ width:14, height:14 }}>
                            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3" style={{ borderTop:'1px solid #f0f5fa' }}>
              <div style={{ fontSize:12, color:'#7a9baf' }}>Page {page} of {pages}</div>
              <div className="flex gap-2">
                <Btn size="sm" variant="secondary" disabled={page <= 1} onClick={() => load(page - 1)}>← Prev</Btn>
                <Btn size="sm" variant="secondary" disabled={page >= pages} onClick={() => load(page + 1)}>Next →</Btn>
              </div>
            </div>
          )}
        </div>

        {/* Info box */}
        <div className="rounded-xl p-5" style={{ background:'#fff', border:'1px solid #e2eaf2' }}>
          <div style={{ fontSize:13, fontWeight:700, color:'#192b3f', marginBottom:12 }}>Backup Information</div>
          <div className="grid grid-cols-3 gap-6">
            <div>
              <div style={{ fontSize:11.5, fontWeight:600, color:'#7a9baf', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>Schedule</div>
              <div style={{ fontSize:12.5, color:'#192b3f' }}>Daily at <strong>5:00 AM IST</strong></div>
              <div style={{ fontSize:11.5, color:'#7a9baf', marginTop:3 }}>Runs automatically every day</div>
            </div>
            <div>
              <div style={{ fontSize:11.5, fontWeight:600, color:'#7a9baf', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>What's Backed Up</div>
              <div style={{ fontSize:12.5, color:'#192b3f' }}>PostgreSQL DB + Full codebase</div>
              <div style={{ fontSize:11.5, color:'#7a9baf', marginTop:3 }}>Includes all uploaded images & files</div>
            </div>
            <div>
              <div style={{ fontSize:11.5, fontWeight:600, color:'#7a9baf', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.04em' }}>Retention</div>
              <div style={{ fontSize:12.5, color:'#192b3f' }}>30 days local &nbsp;·&nbsp; Permanent on Drive</div>
              <div style={{ fontSize:11.5, color:'#7a9baf', marginTop:3 }}>Old local files auto-purged after 30 days</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
