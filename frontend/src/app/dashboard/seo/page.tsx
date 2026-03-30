'use client';
import { useState, useEffect, useRef } from 'react';
import { Topbar, Card, Btn, Input, Modal, useToast, Empty } from '@/components/ui';
import { seoApi, companyApi } from '@/lib/api';

const SEV_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626', label: 'Critical' },
  warning:  { bg: '#fffbeb', color: '#b45309', label: 'Warning' },
  info:     { bg: '#f0f9ff', color: '#0369a1', label: 'Info' },
  passed:   { bg: '#f0fdf4', color: '#15803d', label: 'Passed' },
};

const CAT_COLORS: Record<string, string> = {
  Technical: '#6366f1', 'On-Page': '#3199d4', Social: '#10b981', CRO: '#f59e0b',
};

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444';
  const label = score >= 70 ? 'Good' : score >= 40 ? 'Needs Work' : 'Poor';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ width: 110, height: 110, borderRadius: '50%', background: `conic-gradient(${color} ${score * 3.6}deg, #e2eaf2 0deg)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 82, height: 82, borderRadius: '50%', background: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: 10, color: '#7a9baf', fontWeight: 600 }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize: 12, fontWeight: 700, color }}>{label}</span>
    </div>
  );
}

function IssueRow({ issue }: { issue: any }) {
  const [open, setOpen] = useState(false);
  const sev = SEV_STYLE[issue.passed ? 'passed' : issue.severity] || SEV_STYLE.info;
  return (
    <div style={{ border: '1px solid #e2eaf2', borderRadius: 8, overflow: 'hidden', marginBottom: 6 }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: '#ffffff', cursor: 'pointer', border: 'none', textAlign: 'left' }}
      >
        <span style={{ width: 72, flexShrink: 0, padding: '2px 8px', borderRadius: 9999, fontSize: 10.5, fontWeight: 700, background: sev.bg, color: sev.color, textAlign: 'center' }}>{sev.label}</span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#192b3f' }}>{issue.title}</span>
        <span style={{ flexShrink: 0, fontSize: 10.5, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: '#f0f5fa', color: CAT_COLORS[issue.category] || '#64748b' }}>{issue.category}</span>
        <span style={{ color: '#7a9baf', fontSize: 12, marginLeft: 4 }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div style={{ padding: '0 14px 14px', background: '#fafcff', borderTop: '1px solid #f0f5fa' }}>
          <p style={{ fontSize: 12.5, color: '#4a6a85', marginTop: 10, marginBottom: 8, lineHeight: 1.6 }}>{issue.description}</p>
          {!issue.passed && (
            <div style={{ background: '#fff', border: '1px solid #e2eaf2', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#3199d4', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>How to fix</div>
              <pre style={{ fontSize: 12, color: '#192b3f', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{issue.fix}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SeoPage() {
  const { toast, ToastContainer } = useToast();
  const [tab, setTab] = useState<'overview'|'keywords'|'urlcheck'|'history'>('overview');
  const [companies, setCompanies] = useState<any[]>([]);
  const [cid, setCid] = useState('');
  const [audit, setAudit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const pollRef = useRef<any>(null);

  const [keywords, setKeywords] = useState<any[]>([]);
  const [kwForm, setKwForm] = useState({ keyword: '', targetUrl: '', targetCountry: 'IN', notes: '' });
  const [showAddKw, setShowAddKw] = useState(false);
  const [savingKw, setSavingKw] = useState(false);

  const [urlInput, setUrlInput] = useState('');
  const [urlResults, setUrlResults] = useState<any[]>([]);
  const [checkingUrls, setCheckingUrls] = useState(false);

  const [audits, setAudits] = useState<any[]>([]);

  const [filterSev, setFilterSev] = useState<string>('all');

  const loadCompanies = async () => {
    try {
      const d = await companyApi.list({ limit: '50' });
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos.length > 0) {
        let u: any = {};
        try { u = JSON.parse(localStorage.getItem('user') || '{}'); } catch {}
        const id = u.companyId || cos[0].companyId;
        setCid(id);
      }
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const loadLatest = async (companyId: string) => {
    if (!companyId) return;
    try {
      const d = await seoApi.getLatest(companyId);
      setAudit(d);
      if (d?.status === 'RUNNING') startPolling(companyId);
      else stopPolling();
    } catch { setAudit(null); }
    finally { setLoading(false); }
  };

  const loadKeywords = async (companyId: string) => {
    try { const d = await seoApi.getKeywords(companyId); setKeywords(d.keywords || []); }
    catch {}
  };

  const loadHistory = async (companyId: string) => {
    try { const d = await seoApi.getAudits(companyId, { limit: '30' }); setAudits(d.audits || []); }
    catch {}
  };

  const startPolling = (companyId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const d = await seoApi.getLatest(companyId);
        setAudit(d);
        if (d?.status !== 'RUNNING') { stopPolling(); setRunning(false); }
      } catch {}
    }, 3000);
  };

  const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };

  useEffect(() => { loadCompanies(); return () => stopPolling(); }, []);

  useEffect(() => {
    if (!cid) return;
    setLoading(true);
    loadLatest(cid);
    loadKeywords(cid);
    loadHistory(cid);
  }, [cid]);

  const runAuditNow = async () => {
    if (!cid) return;
    setRunning(true);
    try {
      await seoApi.triggerAudit(cid);
      toast('Audit started!');
      setAudit(prev => ({ ...prev, status: 'RUNNING' }));
      startPolling(cid);
    } catch (e: any) { toast(e.message, 'err'); setRunning(false); }
  };

  const addKeyword = async () => {
    if (!kwForm.keyword) return toast('Keyword required', 'err');
    setSavingKw(true);
    try {
      await seoApi.addKeyword(cid, kwForm);
      toast('Keyword added!');
      setShowAddKw(false);
      setKwForm({ keyword: '', targetUrl: '', targetCountry: 'IN', notes: '' });
      loadKeywords(cid);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSavingKw(false); }
  };

  const removeKeyword = async (kid: string) => {
    try { await seoApi.removeKeyword(cid, kid); loadKeywords(cid); toast('Removed.'); }
    catch (e: any) { toast(e.message, 'err'); }
  };

  const checkUrls = async () => {
    const urls = urlInput.split('\n').map(u => u.trim()).filter(Boolean);
    if (urls.length === 0) return toast('Enter at least one URL', 'err');
    if (urls.length > 20) return toast('Max 20 URLs at a time', 'err');
    setCheckingUrls(true);
    try {
      const d = await seoApi.checkUrls(cid, urls);
      setUrlResults(d.results || []);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setCheckingUrls(false); }
  };

  const issues: any[] = Array.isArray(audit?.issues) ? audit.issues : [];
  const filteredIssues = filterSev === 'all' ? issues
    : filterSev === 'passed' ? issues.filter(i => i.passed)
    : issues.filter(i => !i.passed && i.severity === filterSev);

  const summary = audit?.summary || {};
  const isRunning = audit?.status === 'RUNNING';

  const fmt = (d: string) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  const COUNTRY_OPTS = [
    { value: 'IN', label: '🇮🇳 India' }, { value: 'US', label: '🇺🇸 USA' }, { value: 'GB', label: '🇬🇧 UK' },
    { value: 'AE', label: '🇦🇪 UAE' }, { value: 'AU', label: '🇦🇺 Australia' }, { value: 'CA', label: '🇨🇦 Canada' },
    { value: 'SG', label: '🇸🇬 Singapore' }, { value: 'DE', label: '🇩🇪 Germany' }, { value: 'FR', label: '🇫🇷 France' },
  ];

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar
        title="SEO Audit"
        subtitle="Automated daily analysis — runs every night at 12:00 AM"
        actions={
          <div className="flex items-center gap-2">
            {companies.length > 1 && (
              <select value={cid} onChange={e => setCid(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12.5, border: '1px solid #d4e1ec', borderRadius: 8, background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </select>
            )}
            <Btn variant="primary" size="sm" loading={running || isRunning} onClick={runAuditNow}>
              {isRunning ? 'Auditing…' : '▶ Run Audit Now'}
            </Btn>
          </div>
        }
      />
      <ToastContainer />

      {/* Tabs */}
      <div className="flex gap-1 px-6 pt-3" style={{ borderBottom: '1px solid #e2eaf2', background: '#fff' }}>
        {(['overview', 'keywords', 'urlcheck', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className="px-4 py-2 text-xs font-semibold transition-all capitalize"
            style={{ borderBottom: tab === t ? '2px solid #3199d4' : '2px solid transparent', color: tab === t ? '#3199d4' : '#7a9baf' }}>
            {t === 'urlcheck' ? 'URL Checker' : t === 'overview' ? 'Overview' : t === 'keywords' ? 'Keywords' : 'History'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-5">

        {/* ── Overview Tab ─────────────────────────────────────────── */}
        {tab === 'overview' && (
          loading ? <div className="flex items-center justify-center py-20 text-slate-400">Loading...</div>
          : isRunning ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div style={{ width: 48, height: 48, border: '4px solid #e2eaf2', borderTop: '4px solid #3199d4', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <p style={{ fontSize: 14, color: '#4a6a85', fontWeight: 600 }}>Auditing your website… this takes 10–20 seconds</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : !audit || audit.status === 'FAILED' ? (
            <Empty icon="🔍" title="No audit yet" desc={audit?.status === 'FAILED' ? 'Last audit failed. Try running manually.' : 'Click "Run Audit Now" to analyse your website.'}
              action={<Btn variant="primary" size="sm" onClick={runAuditNow}>Run Audit Now</Btn>} />
          ) : (
            <div className="flex flex-col gap-5 max-w-4xl">
              {/* Score + Summary */}
              <Card>
                <div className="flex items-center gap-8 flex-wrap">
                  <ScoreGauge score={audit.score || 0} />
                  <div className="flex-1">
                    <div style={{ fontSize: 12, color: '#7a9baf', marginBottom: 8 }}>Last audit: {fmt(audit.createdAt)} · {audit.domain}</div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: 'Critical', val: summary.critical || 0, color: '#dc2626', bg: '#fef2f2' },
                        { label: 'Warnings', val: summary.warning || 0, color: '#b45309', bg: '#fffbeb' },
                        { label: 'Info', val: summary.info || 0, color: '#0369a1', bg: '#f0f9ff' },
                        { label: 'Passed', val: summary.passed || 0, color: '#15803d', bg: '#f0fdf4' },
                      ].map(s => (
                        <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                          <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                          <div style={{ fontSize: 11, fontWeight: 600, color: s.color }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1" style={{ minWidth: 140 }}>
                    {[
                      { label: 'Response', val: `${summary.responseTime || 0}ms` },
                      { label: 'Words', val: summary.wordCount || 0 },
                      { label: 'Images', val: `${summary.imagesTotal || 0} (${summary.imagesMissingAlt || 0} no alt)` },
                      { label: 'Links', val: `${summary.internalLinks || 0} int / ${summary.externalLinks || 0} ext` },
                    ].map(s => (
                      <div key={s.label} className="flex justify-between gap-4">
                        <span style={{ fontSize: 11.5, color: '#7a9baf', fontWeight: 600 }}>{s.label}</span>
                        <span style={{ fontSize: 11.5, color: '#192b3f', fontWeight: 700 }}>{s.val}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Issues filter + list */}
              <div>
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>Issues</span>
                  <div className="flex gap-1 ml-2 flex-wrap">
                    {['all', 'critical', 'warning', 'info', 'passed'].map(s => (
                      <button key={s} onClick={() => setFilterSev(s)}
                        style={{ padding: '3px 10px', borderRadius: 9999, border: '1px solid', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                          background: filterSev === s ? (SEV_STYLE[s]?.bg || '#e8f5fd') : '#fff',
                          color: filterSev === s ? (SEV_STYLE[s]?.color || '#1a72a3') : '#7a9baf',
                          borderColor: filterSev === s ? (SEV_STYLE[s]?.color || '#3199d4') : '#d4e1ec',
                        }}>
                        {s === 'all' ? 'All' : SEV_STYLE[s]?.label || s}
                      </button>
                    ))}
                  </div>
                </div>
                {filteredIssues.length === 0
                  ? <div style={{ textAlign: 'center', padding: '32px', color: '#7a9baf', fontSize: 13 }}>No issues in this category</div>
                  : filteredIssues.map((issue: any) => <IssueRow key={issue.id} issue={issue} />)
                }
              </div>
            </div>
          )
        )}

        {/* ── Keywords Tab ─────────────────────────────────────────── */}
        {tab === 'keywords' && (
          <div className="flex flex-col gap-4 max-w-2xl">
            <div className="flex items-center justify-between">
              <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>Tracked Keywords ({keywords.length})</div>
              <Btn variant="primary" size="sm" onClick={() => setShowAddKw(true)}>+ Add Keyword</Btn>
            </div>
            {keywords.length === 0
              ? <Empty icon="🔑" title="No keywords tracked" desc="Add keywords to check if they appear on your website during audits." action={<Btn variant="primary" size="sm" onClick={() => setShowAddKw(true)}>Add First Keyword</Btn>} />
              : (
                <div className="flex flex-col gap-2">
                  {keywords.map((kw: any) => (
                    <Card key={kw.keywordId}>
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#192b3f' }}>{kw.keyword}</div>
                          <div style={{ fontSize: 11.5, color: '#7a9baf', marginTop: 2 }}>
                            {kw.targetCountry && <span style={{ marginRight: 8 }}>🌍 {kw.targetCountry}</span>}
                            {kw.targetUrl && <span>🔗 {kw.targetUrl}</span>}
                            {kw.notes && <span style={{ marginLeft: 8, fontStyle: 'italic' }}>{kw.notes}</span>}
                          </div>
                        </div>
                        <Btn variant="danger" size="sm" onClick={() => removeKeyword(kw.keywordId)}>Remove</Btn>
                      </div>
                    </Card>
                  ))}
                </div>
              )
            }

            <Modal open={showAddKw} onClose={() => setShowAddKw(false)} title="Add Keyword"
              footer={<><Btn variant="secondary" size="sm" onClick={() => setShowAddKw(false)}>Cancel</Btn><Btn variant="primary" size="sm" loading={savingKw} onClick={addKeyword}>Add</Btn></>}>
              <div className="flex flex-col gap-3">
                <Input label="Keyword *" placeholder="e.g. CRM software India" value={kwForm.keyword} onChange={e => setKwForm(f => ({ ...f, keyword: e.target.value }))} />
                <Input label="Target URL (optional)" placeholder="https://yourdomain.com/crm" value={kwForm.targetUrl} onChange={e => setKwForm(f => ({ ...f, targetUrl: e.target.value }))} />
                <div className="flex flex-col gap-1">
                  <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Target Country</label>
                  <select value={kwForm.targetCountry} onChange={e => setKwForm(f => ({ ...f, targetCountry: e.target.value }))}
                    style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #d4e1ec', borderRadius: 8, background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                    {COUNTRY_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <Input label="Notes (optional)" placeholder="Monthly target, competitor keywords…" value={kwForm.notes} onChange={e => setKwForm(f => ({ ...f, notes: e.target.value }))} />
              </div>
            </Modal>
          </div>
        )}

        {/* ── URL Checker Tab ──────────────────────────────────────── */}
        {tab === 'urlcheck' && (
          <div className="flex flex-col gap-4 max-w-3xl">
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f', marginBottom: 8 }}>Check URLs for broken links / redirect issues</div>
              <p style={{ fontSize: 12, color: '#7a9baf', marginBottom: 12 }}>Paste up to 20 URLs (one per line). We will check HTTP status, redirects, and response time.</p>
              <textarea
                value={urlInput}
                onChange={e => setUrlInput(e.target.value)}
                rows={6}
                placeholder={"https://yourdomain.com/\nhttps://yourdomain.com/about\nhttps://yourdomain.com/contact"}
                style={{ width: '100%', padding: '10px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'monospace', resize: 'vertical', marginBottom: 10 }}
              />
              <Btn variant="primary" size="sm" loading={checkingUrls} onClick={checkUrls}>Check URLs</Btn>
            </Card>

            {urlResults.length > 0 && (
              <Card>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#192b3f', marginBottom: 10 }}>Results ({urlResults.length} URLs)</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2eaf2' }}>
                        {['URL', 'Status', 'Time', 'Result'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 10px', fontSize: 11, fontWeight: 700, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {urlResults.map((r: any, i: number) => {
                        const statusColor = r.status >= 200 && r.status < 300 ? '#15803d' : r.status >= 300 && r.status < 400 ? '#b45309' : '#dc2626';
                        const statusBg = r.status >= 200 && r.status < 300 ? '#f0fdf4' : r.status >= 300 && r.status < 400 ? '#fffbeb' : '#fef2f2';
                        return (
                          <tr key={i} style={{ borderBottom: '1px solid #f0f5fa' }}>
                            <td style={{ padding: '8px 10px', color: '#192b3f', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.url}>{r.url}</td>
                            <td style={{ padding: '8px 10px' }}>
                              <span style={{ background: statusBg, color: statusColor, padding: '2px 8px', borderRadius: 9999, fontWeight: 700 }}>
                                {r.status || 'ERR'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 10px', color: r.responseTime > 2000 ? '#b45309' : '#15803d', fontWeight: 600 }}>{r.responseTime}ms</td>
                            <td style={{ padding: '8px 10px' }}>
                              {r.ok ? <span style={{ color: '#15803d', fontWeight: 700 }}>✓ OK{r.redirected ? ' (redirected)' : ''}</span>
                                     : <span style={{ color: '#dc2626', fontWeight: 700 }}>✗ {r.error || 'Failed'}</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* ── History Tab ──────────────────────────────────────────── */}
        {tab === 'history' && (
          <div className="max-w-3xl">
            {audits.length === 0
              ? <Empty icon="📋" title="No audit history" desc="Run your first audit to see history here." />
              : (
                <Card>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid #e2eaf2' }}>
                        {['Date', 'Domain', 'Score', 'Issues', 'Triggered By', 'Status'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {audits.map((a: any) => {
                        const sc = a.summary || {};
                        const scoreColor = (a.score || 0) >= 70 ? '#15803d' : (a.score || 0) >= 40 ? '#b45309' : '#dc2626';
                        return (
                          <tr key={a.auditId} style={{ borderBottom: '1px solid #f0f5fa' }}>
                            <td style={{ padding: '9px 12px', color: '#192b3f', whiteSpace: 'nowrap' }}>{fmt(a.createdAt)}</td>
                            <td style={{ padding: '9px 12px', color: '#4a6a85', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.domain}</td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontWeight: 800, fontSize: 15, color: scoreColor }}>{a.score ?? '—'}</span>
                            </td>
                            <td style={{ padding: '9px 12px', color: '#7a9baf', fontSize: 12 }}>
                              {sc.critical > 0 && <span style={{ color: '#dc2626', fontWeight: 700, marginRight: 6 }}>{sc.critical}C</span>}
                              {sc.warning > 0 && <span style={{ color: '#b45309', fontWeight: 700, marginRight: 6 }}>{sc.warning}W</span>}
                              {sc.info > 0 && <span style={{ color: '#0369a1', fontWeight: 700 }}>{sc.info}I</span>}
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontSize: 11, background: a.triggeredBy === 'SCHEDULED' ? '#f0f5fa' : '#e8f5fd', color: a.triggeredBy === 'SCHEDULED' ? '#64748b' : '#1a72a3', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>
                                {a.triggeredBy === 'SCHEDULED' ? '⏰ Auto' : '▶ Manual'}
                              </span>
                            </td>
                            <td style={{ padding: '9px 12px' }}>
                              <span style={{ fontSize: 11, background: a.status === 'DONE' ? '#f0fdf4' : a.status === 'FAILED' ? '#fef2f2' : '#fffbeb', color: a.status === 'DONE' ? '#15803d' : a.status === 'FAILED' ? '#dc2626' : '#b45309', padding: '2px 8px', borderRadius: 9999, fontWeight: 600 }}>
                                {a.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Card>
              )
            }
          </div>
        )}

      </div>
    </div>
  );
}
