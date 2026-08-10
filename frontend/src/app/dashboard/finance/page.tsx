'use client';
import { useEffect, useState, useCallback } from 'react';
import { companyApi, financeApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast, Empty } from '@/components/ui';

// ─── Helpers ──────────────────────────────────────────────────
const inr = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const dateStr = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const INV_TYPES = ['OWNER_FUNDS', 'EQUITY', 'LOAN', 'OTHER'];
const TYPE_LABEL: Record<string, string> = { OWNER_FUNDS: 'Owner Funds', EQUITY: 'Equity', LOAN: 'Loan', OTHER: 'Other' };
const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const YEARS = ['2023', '2024', '2025', '2026', '2027'];

const fmtK = (v: number) => v >= 10000000 ? (v / 10000000).toFixed(1) + 'Cr' : v >= 100000 ? (v / 100000).toFixed(1) + 'L' : v >= 1000 ? Math.round(v / 1000) + 'k' : String(Math.round(v));

// ─── Animated count-up (easeOutCubic) ─────────────────────────
function useCountUp(target: number, duration = 900) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setVal(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

// ─── Animated summary stat card ───────────────────────────────
function StatCard({ label, value, color, hint }: { label: string; value: number; color: string; hint?: string }) {
  const v = useCountUp(value);
  return (
    <Card>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4, letterSpacing: '-0.02em' }}>{inr(v)}</div>
      {hint && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 2 }}>{hint}</div>}
    </Card>
  );
}

// ─── Animated monthly grouped bar chart ───────────────────────
const SERIES = [
  { key: 'earnings',   label: 'Earnings',   color: '#059669' },
  { key: 'expenses',   label: 'Expenses',   color: '#dc2626' },
  { key: 'investment', label: 'Investment', color: '#3199d4' },
];
function GroupedBarChart({ months }: { months: any[] }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(id); }, [months]);
  const max = Math.max(1, ...months.flatMap(m => [m.earnings, m.expenses, m.investment]));
  const H = 170;
  return (
    <div>
      <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
        {SERIES.map(s => (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#4a6a85', fontWeight: 600 }}>
            <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} /> {s.label}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: H + 22 }}>
        {months.map((m, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, height: '100%', justifyContent: 'flex-end' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: H, width: '100%', justifyContent: 'center' }}>
              {SERIES.map((s, j) => {
                const val = m[s.key] || 0;
                return (
                  <div key={s.key} title={`${s.label}: ${inr(val)}`}
                    style={{
                      width: 7, height: mounted ? (val / max) * H : 0, minHeight: val > 0 ? 2 : 0,
                      background: s.color, borderRadius: '3px 3px 0 0',
                      transition: `height 0.7s cubic-bezier(.22,1,.36,1) ${i * 35 + j * 60}ms`,
                    }} />
                );
              })}
            </div>
            <div style={{ fontSize: 10, color: '#7a9baf', fontWeight: 600 }}>{MONTHS[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Investment form modal ────────────────────────────────────
const BLANK_INV = () => ({ date: new Date().toISOString().slice(0, 10), amount: '', source: '', type: 'OWNER_FUNDS', notes: '' });

function InvestmentModal({ cid, editing, onClose, onDone }: any) {
  const [form, setForm] = useState<any>(editing
    ? { date: new Date(editing.date).toISOString().slice(0, 10), amount: String(editing.amount), source: editing.source, type: editing.type, notes: editing.notes || '' }
    : BLANK_INV());
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  const save = async () => {
    if (!form.source.trim() || !form.amount) { toast('Source and amount are required.', 'err'); return; }
    setSaving(true);
    try {
      if (editing) await financeApi.updateInv(cid, editing.investmentId, form);
      else await financeApi.createInv(cid, form);
      toast(editing ? 'Investment updated.' : 'Investment added.');
      setTimeout(() => { onDone(); onClose(); }, 350);
    } catch (e: any) { toast(e.message, 'err'); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} title={editing ? 'Edit Investment' : 'Add Investment'}
      footer={<>
        <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" loading={saving} onClick={save}>{editing ? 'Save' : 'Add'}</Btn>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div><Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
        <div><Input label="Amount (₹)" type="number" value={form.amount} placeholder="500000" onChange={e => setForm({ ...form, amount: e.target.value })} /></div>
        <div className="col-span-2"><Input label="Source (investor / owner)" value={form.source} placeholder="e.g. Owner capital, Angel investor" onChange={e => setForm({ ...form, source: e.target.value })} /></div>
        <div><Sel label="Type" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} options={INV_TYPES.map(t => ({ value: t, label: TYPE_LABEL[t] }))} /></div>
        <div className="col-span-2"><Input label="Notes" value={form.notes} placeholder="Optional" onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
      </div>
      <ToastContainer />
    </Modal>
  );
}

// ─── Tax / GST / TDS breakdown ────────────────────────────────
function Line({ label, value, color, strong, sign, sub }: { label: string; value: number; color?: string; strong?: boolean; sign?: string; sub?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '9px 0', borderTop: strong ? '1px solid #e2eaf2' : '1px dashed #eef3f8' }}>
      <div>
        <span style={{ fontSize: strong ? 13 : 12.5, fontWeight: strong ? 800 : 600, color: strong ? '#192b3f' : '#4a6a85' }}>{sign ? sign + ' ' : ''}{label}</span>
        {sub && <div style={{ fontSize: 10.5, color: '#94a3b8', marginTop: 1 }}>{sub}</div>}
      </div>
      <span style={{ fontSize: strong ? 15 : 13, fontWeight: strong ? 800 : 700, color: color || '#192b3f', whiteSpace: 'nowrap' }}>{inr(value)}</span>
    </div>
  );
}

function TaxBreakdown({ tax, year }: { tax: any; year: string }) {
  const t = tax || {};
  const gstPayable = t.netGstPayable || 0;
  return (
    <>
      <div className="stagger grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Gross Invoiced" value={t.grossInvoiced || 0} color="#0f766e" hint={`Incl. GST · ${year}`} />
        <StatCard label="GST Collected" value={t.gstCollected || 0} color="#059669" hint="Output GST on sales" />
        <StatCard label="TDS Deducted" value={t.tdsDeducted || 0} color="#f59e0b" hint="Withheld by clients" />
        <StatCard label="Net Received" value={t.netReceived || 0} color="#3199d4" hint="Actual cash in hand" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Earnings reconciliation */}
        <Card>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 2 }}>Earnings Reconciliation</div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>How invoiced value becomes cash received</div>
          <Line label="Taxable Value" value={t.taxableValue || 0} />
          <Line label="GST Collected (output)" value={t.gstCollected || 0} sign="+" color="#059669" />
          <Line label="Gross Invoiced" value={t.grossInvoiced || 0} strong sign="=" />
          <Line label="TDS Deducted (by client)" value={t.tdsDeducted || 0} sign="−" color="#f59e0b" />
          <Line label="Net Received (cash)" value={t.netReceived || 0} strong sign="=" color="#3199d4" sub="Cash actually banked" />
        </Card>

        {/* GST & TDS summary */}
        <div className="flex flex-col gap-4">
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 4 }}>GST Summary</div>
            <Line label="Output GST (on sales)" value={t.gstCollected || 0} color="#059669" />
            <Line label="Input GST (on expenses)" value={t.gstInput || 0} sign="−" color="#dc2626" />
            <Line label={gstPayable >= 0 ? 'Net GST Payable' : 'Net GST Refundable'} value={Math.abs(gstPayable)} strong sign="=" color={gstPayable >= 0 ? '#be123c' : '#059669'} sub="Output GST − Input credit" />
          </Card>
          <Card>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 4 }}>TDS</div>
            <Line label="TDS Deducted by clients" value={t.tdsDeducted || 0} strong color="#f59e0b" sub="Claimable as tax credit when filing returns" />
          </Card>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function FinancePage() {
  const { toast, ToastContainer } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [cid, setCid] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [tab, setTab] = useState<'overview' | 'tax'>('overview');
  const [overview, setOverview] = useState<any>(null);
  const [investments, setInvestments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);
  const [showInv, setShowInv] = useState(false);
  const [editInv, setEditInv] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await companyApi.mine();
        const arr = list?.companies || [];
        setCompanies(arr);
        const stored = localStorage.getItem('selectedCompanyId');
        if (stored && arr.find((c: any) => c.companyId === stored)) setCid(stored);
        else if (arr.length) setCid(arr[0].companyId);
      } catch {}
    })();
  }, []);

  useEffect(() => { if (cid) localStorage.setItem('selectedCompanyId', cid); }, [cid]);

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    setDenied(false);
    try {
      const [ov, inv] = await Promise.all([
        financeApi.overview(cid, { year }),
        financeApi.listInv(cid, { year }),
      ]);
      setOverview(ov);
      setInvestments(inv?.investments || []);
    } catch (e: any) {
      if (/permission|denied|403/i.test(e.message)) setDenied(true);
      else toast(e.message, 'err');
    } finally { setLoading(false); }
  }, [cid, year]);

  useEffect(() => { load(); }, [cid, year]);

  const removeInv = async (i: any) => {
    if (!confirm(`Delete investment "${i.source}" (${inr(i.amount)})?`)) return;
    try { await financeApi.removeInv(cid, i.investmentId); toast('Deleted.'); load(); }
    catch (e: any) { toast(e.message, 'err'); }
  };

  const earnings = overview?.earnings || 0;
  const expenses = overview?.expenses || 0;
  const investment = overview?.investment || 0;
  const net = overview?.netProfit || 0;
  const cash = overview?.cashPosition || 0;
  const companyName = companies.find(c => c.companyId === cid)?.name || '';

  // Where-money-comes-from split (earnings + investment) for a simple animated bar
  const inflow = earnings + investment;

  return (
    <div className="flex flex-col h-screen" style={{ background: '#f0f5fa' }}>
      <Topbar
        title="Finance"
        subtitle={companyName ? `Earnings, expenses & investment for ${companyName}` : 'Financial Overview'}
        actions={
          <div className="flex items-center gap-2">
            {companies.length > 1 && (
              <select value={cid} onChange={e => setCid(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </select>
            )}
            <select value={year} onChange={e => setYear(e.target.value)}
              style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <Btn variant="primary" size="sm" onClick={() => { setEditInv(null); setShowInv(true); }}>+ Add Investment</Btn>
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2eaf2', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {([['overview', 'Overview'], ['tax', 'Earnings & Tax']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '12px 20px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid #3199d4' : '2px solid transparent',
                color: tab === t ? '#3199d4' : '#7a9baf', fontFamily: 'inherit',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {denied ? (
          <Card><Empty icon="🔒" title="No access to Finance" desc="Ask an admin to enable the Finance permission for your account." /></Card>
        ) : loading && !overview ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#7a9baf', fontSize: 13 }}>Loading finance data…</div>
        ) : (
          <div className="flex flex-col gap-4">
            {tab === 'overview' && (<>
            {/* Summary cards */}
            <div className="stagger grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Earnings (received)" value={earnings} color="#059669" hint={`Money received · ${year}`} />
              <StatCard label="Expenses" value={expenses} color="#dc2626" hint={`Spent · ${year}`} />
              <StatCard label="Investment" value={investment} color="#3199d4" hint={`Capital added · ${year}`} />
              <StatCard label={net >= 0 ? 'Net Profit' : 'Net Loss'} value={Math.abs(net)} color={net >= 0 ? '#7c3aed' : '#dc2626'} hint="Earnings − Expenses" />
            </div>

            {/* Cash position banner */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cash Position</div>
                  <div style={{ fontSize: 26, fontWeight: 800, color: cash >= 0 ? '#192b3f' : '#dc2626', letterSpacing: '-0.02em' }}>{inr(cash)}</div>
                  <div style={{ fontSize: 11, color: '#94a3b8' }}>Earnings + Investment − Expenses</div>
                </div>
                {/* Inflow split bar */}
                <div style={{ flex: 1, minWidth: 220, maxWidth: 420 }}>
                  <div style={{ fontSize: 11, color: '#4a6a85', fontWeight: 600, marginBottom: 6 }}>Money In: {inr(inflow)}</div>
                  <div style={{ display: 'flex', height: 14, borderRadius: 8, overflow: 'hidden', background: '#eef3f8' }}>
                    <div style={{ width: `${inflow ? (earnings / inflow) * 100 : 0}%`, background: '#059669', transition: 'width 0.8s cubic-bezier(.22,1,.36,1)' }} title={`Earnings ${inr(earnings)}`} />
                    <div style={{ width: `${inflow ? (investment / inflow) * 100 : 0}%`, background: '#3199d4', transition: 'width 0.8s cubic-bezier(.22,1,.36,1)' }} title={`Investment ${inr(investment)}`} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, color: '#94a3b8', marginTop: 4 }}>
                    <span>🟢 Earnings {inflow ? Math.round((earnings / inflow) * 100) : 0}%</span>
                    <span>🔵 Investment {inflow ? Math.round((investment / inflow) * 100) : 0}%</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* Monthly comparison chart */}
            <Card>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 4 }}>Monthly: Earnings vs Expenses vs Investment · {year}</div>
              {overview?.months ? <GroupedBarChart months={overview.months} /> : null}
            </Card>

            {/* Investments table */}
            <Card className="p-0 overflow-hidden">
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>Direct Investments · {year}</div>
                <Btn variant="secondary" size="sm" onClick={() => { setEditInv(null); setShowInv(true); }}>+ Add</Btn>
              </div>
              {!investments.length ? (
                <Empty icon="💰" title="No investments yet" desc="Record capital added directly to the company." action={
                  <Btn variant="primary" size="sm" onClick={() => { setEditInv(null); setShowInv(true); }}>+ Add Investment</Btn>
                } />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fbfd' }}>
                        {['Date', 'Source', 'Type', 'Amount', 'Notes', ''].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#4a6a85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid #e2eaf2' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {investments.map((i: any) => (
                        <tr key={i.investmentId} style={{ borderBottom: '1px solid #f0f5fa' }}>
                          <td style={{ padding: '10px 12px', color: '#4a6a85', whiteSpace: 'nowrap' }}>{dateStr(i.date)}</td>
                          <td style={{ padding: '10px 12px', color: '#192b3f', fontWeight: 600 }}>{i.source}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{ background: '#3199d420', color: '#3199d4', padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{TYPE_LABEL[i.type] || i.type}</span>
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#059669', whiteSpace: 'nowrap' }}>{inr(i.amount)}</td>
                          <td style={{ padding: '10px 12px', color: '#7a9baf', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.notes || '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Btn size="sm" variant="ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setEditInv(i); setShowInv(true); }}>Edit</Btn>
                              <Btn size="sm" variant="danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => removeInv(i)}>Delete</Btn>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '8px 12px', fontSize: 11.5, color: '#7a9baf', borderTop: '1px solid #f0f5fa' }}>
                    {investments.length} investment{investments.length !== 1 ? 's' : ''} · total {inr(investment)}
                  </div>
                </div>
              )}
            </Card>
            </>)}

            {tab === 'tax' && overview?.tax && (
              <TaxBreakdown tax={overview.tax} year={year} />
            )}
          </div>
        )}
      </div>

      {showInv && <InvestmentModal cid={cid} editing={editInv} onClose={() => setShowInv(false)} onDone={load} />}
      <ToastContainer />
    </div>
  );
}
