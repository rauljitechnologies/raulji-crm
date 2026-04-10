'use client';
import { useEffect, useState, useCallback } from 'react';
import { companyApi, expenseApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast, Badge, Empty } from '@/components/ui';

// ─── Helpers ─────────────────────────────────────────────────
const inr = (n: number) => '₹' + (n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });
const dateStr = (d?: string) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const isoDate = (d: string) => new Date(d).toISOString().slice(0, 10);

const CATEGORIES = ['RENT','SALARY','SOFTWARE','TRAVEL','VENDOR','UTILITIES','TAX','MARKETING','OTHER'];
const PAY_MODES  = ['BANK','CASH','UPI','CARD','CHEQUE'];
const STATUSES   = ['PAID','PENDING','CANCELLED'];

const CAT_COLORS: Record<string, string> = {
  RENT:'#3199d4', SALARY:'#7c3aed', SOFTWARE:'#059669', TRAVEL:'#f59e0b',
  VENDOR:'#dc2626', UTILITIES:'#0891b2', TAX:'#be123c', MARKETING:'#16a34a', OTHER:'#64748b',
};

function CatBadge({ cat }: { cat: string }) {
  const bg = CAT_COLORS[cat] || '#64748b';
  return (
    <span style={{ background: bg + '20', color: bg, padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 700 }}>
      {cat}
    </span>
  );
}

// ─── CSV Parser ───────────────────────────────────────────────
function parseCSV(raw: string): { date: string; description: string; debit: number; credit: number; balance: number | null }[] {
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Find header row — first row with recognizable column names
  let headerIdx = 0;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const cols = splitCSVLine(lines[i]).map(c => c.toLowerCase().trim());
    if (cols.some(c => c.includes('date') || c.includes('narration') || c.includes('description') || c.includes('debit') || c.includes('withdrawal'))) {
      headerIdx = i;
      headers = cols;
      break;
    }
  }

  // Map column indices
  const idx = (keywords: string[]) => headers.findIndex(h => keywords.some(k => h.includes(k)));
  const dateIdx   = idx(['date']);
  const descIdx   = idx(['narration','description','particulars','remarks']);
  const debitIdx  = idx(['withdrawal','debit','dr']);
  const creditIdx = idx(['deposit','credit','cr']);
  const balIdx    = idx(['closing balance','balance']);

  if (dateIdx === -1) return [];

  const rows: { date: string; description: string; debit: number; credit: number; balance: number | null }[] = [];

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const cols = splitCSVLine(lines[i]);
    if (!cols[dateIdx]?.trim()) continue;

    const rawDate = cols[dateIdx]?.trim();
    const parsed  = parseFlexDate(rawDate);
    if (!parsed) continue;

    const debit  = parseAmt(cols[debitIdx]);
    const credit = parseAmt(cols[creditIdx]);
    if (debit === 0 && credit === 0) continue; // skip zero rows

    rows.push({
      date:        parsed,
      description: cols[descIdx]?.trim() || '',
      debit,
      credit,
      balance:     balIdx >= 0 ? parseAmt(cols[balIdx]) : null,
    });
  }
  return rows;
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
    else { cur += ch; }
  }
  result.push(cur);
  return result.map(s => s.replace(/^"|"$/g, '').trim());
}

function parseAmt(s?: string): number {
  if (!s) return 0;
  const n = parseFloat(s.replace(/[^\d.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function parseFlexDate(s: string): string | null {
  if (!s) return null;
  // Try DD/MM/YYYY or DD-MM-YYYY
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,'0')}-${m1[1].padStart(2,'0')}`;
  // Try YYYY-MM-DD
  const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return s;
  // Try DD-Mon-YYYY e.g. 01-Jan-2024
  const m3 = s.match(/^(\d{1,2})[\/\-]([A-Za-z]{3})[\/\-](\d{4})$/);
  if (m3) {
    const months: Record<string,string> = { jan:'01',feb:'02',mar:'03',apr:'04',may:'05',jun:'06',jul:'07',aug:'08',sep:'09',oct:'10',nov:'11',dec:'12' };
    const mo = months[m3[2].toLowerCase()];
    if (mo) return `${m3[3]}-${mo}-${m3[1].padStart(2,'0')}`;
  }
  // Fallback
  const d = new Date(s);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

// ─── Expense Form ─────────────────────────────────────────────
const BLANK_EXP = () => ({
  date: new Date().toISOString().slice(0, 10),
  category: 'OTHER',
  description: '',
  amount: '',
  gstPercent: '',
  payMode: 'BANK',
  reference: '',
  notes: '',
  status: 'PAID',
});

function ExpenseForm({ form, setForm }: { form: any; setForm: (f: any) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <Input label="Date" type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
      </div>
      <div>
        <Sel label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
          options={CATEGORIES.map(c => ({ value: c, label: c }))} />
      </div>
      <div className="col-span-2">
        <Input label="Description" value={form.description} placeholder="e.g. Office Rent April 2026"
          onChange={e => setForm({ ...form, description: e.target.value })} />
      </div>
      <div>
        <Input label="Amount (₹)" type="number" value={form.amount} placeholder="0.00"
          onChange={e => setForm({ ...form, amount: e.target.value })} />
      </div>
      <div>
        <Input label="GST %" type="number" value={form.gstPercent} placeholder="18"
          onChange={e => setForm({ ...form, gstPercent: e.target.value })} />
      </div>
      <div>
        <Sel label="Pay Mode" value={form.payMode} onChange={e => setForm({ ...form, payMode: e.target.value })}
          options={PAY_MODES.map(m => ({ value: m, label: m }))} />
      </div>
      <div>
        <Sel label="Status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}
          options={STATUSES.map(s => ({ value: s, label: s }))} />
      </div>
      <div className="col-span-2">
        <Input label="Reference / Txn No." value={form.reference} placeholder="Cheque no. or UPI ref"
          onChange={e => setForm({ ...form, reference: e.target.value })} />
      </div>
      <div className="col-span-2">
        <Input label="Notes" value={form.notes} placeholder="Optional notes"
          onChange={e => setForm({ ...form, notes: e.target.value })} />
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
export default function ExpensesPage() {
  const { toast, ToastContainer } = useToast();

  // Company selector
  const [companies, setCompanies] = useState<any[]>([]);
  const [cid, setCid]             = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  // Tab
  const [tab, setTab] = useState<'expenses'|'statements'|'reconcile'>('expenses');

  // Expenses
  const [expData, setExpData]       = useState<any>(null);
  const [expLoading, setExpLoading] = useState(false);
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1).padStart(2,'0'));
  const [filterYear, setFilterYear]   = useState(String(new Date().getFullYear()));
  const [filterCat, setFilterCat]     = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [showAdd, setShowAdd]       = useState(false);
  const [editExp, setEditExp]       = useState<any>(null);
  const [addForm, setAddForm]       = useState(BLANK_EXP());
  const [saving, setSaving]         = useState(false);

  // Bank Statements
  const [statements, setStatements]   = useState<any[]>([]);
  const [stmtLoading, setStmtLoading] = useState(false);
  const [selStmt, setSelStmt]         = useState<any>(null);
  const [txns, setTxns]               = useState<any[]>([]);
  const [txnLoading, setTxnLoading]   = useState(false);
  const [csvText, setCsvText]         = useState('');
  const [bankName, setBankName]       = useState('');
  const [acctLast4, setAcctLast4]     = useState('');
  const [parsedRows, setParsedRows]   = useState<any[]>([]);
  const [importing, setImporting]     = useState(false);

  // Reconcile
  const [recTxns, setRecTxns]         = useState<any[]>([]);
  const [recExps, setRecExps]         = useState<any[]>([]);
  const [recLoading, setRecLoading]   = useState(false);
  const [autoMatching, setAutoMatching] = useState(false);
  const [linkModal, setLinkModal]     = useState<any>(null); // { txn }
  const [linkExpId, setLinkExpId]     = useState('');

  // ── Load companies ──
  useEffect(() => {
    (async () => {
      try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        const isAdmin = u?.role === 'SUPER_ADMIN';
        setIsSuperAdmin(isAdmin);
        const list = await companyApi.mine();
        const arr  = list?.companies || [];
        setCompanies(arr);
        const stored = localStorage.getItem('selectedCompanyId');
        if (stored && arr.find((c: any) => c.companyId === stored)) setCid(stored);
        else if (arr.length) setCid(arr[0].companyId);
      } catch {}
    })();
  }, []);

  useEffect(() => { if (cid) localStorage.setItem('selectedCompanyId', cid); }, [cid]);

  // ── Load Expenses ──
  const loadExpenses = useCallback(async () => {
    if (!cid) return;
    setExpLoading(true);
    try {
      const params: any = { month: filterMonth, year: filterYear };
      if (filterCat !== 'ALL') params.category = filterCat;
      if (filterStatus !== 'ALL') params.status = filterStatus;
      const d = await expenseApi.list(cid, params);
      setExpData(d);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setExpLoading(false); }
  }, [cid, filterMonth, filterYear, filterCat, filterStatus]);

  useEffect(() => { if (tab === 'expenses') loadExpenses(); }, [tab, cid, filterMonth, filterYear, filterCat, filterStatus]);

  // ── Load Statements ──
  const loadStatements = useCallback(async () => {
    if (!cid) return;
    setStmtLoading(true);
    try {
      const d = await expenseApi.listStatements(cid);
      setStatements(Array.isArray(d) ? d : []);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setStmtLoading(false); }
  }, [cid]);

  useEffect(() => { if (tab === 'statements') loadStatements(); }, [tab, cid]);

  // ── Load Transactions for selected statement ──
  const loadTxns = async (stmt: any) => {
    setSelStmt(stmt);
    setTxnLoading(true);
    try {
      const d = await expenseApi.listTxns(cid, stmt.statementId);
      setTxns(Array.isArray(d) ? d : []);
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setTxnLoading(false); }
  };

  // ── Load Reconcile data ──
  const loadReconcile = useCallback(async () => {
    if (!cid) return;
    setRecLoading(true);
    try {
      const [allTxns, expD] = await Promise.all([
        expenseApi.listAllTxns(cid, { type: 'DEBIT' }),
        expenseApi.list(cid, { limit: '500' }),
      ]);
      setRecTxns(Array.isArray(allTxns) ? allTxns : []);
      const allExps = expD?.expenses || [];
      setRecExps(allExps.filter((e: any) => e.status !== 'CANCELLED' && !e.bankTxn));
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setRecLoading(false); }
  }, [cid]);

  useEffect(() => { if (tab === 'reconcile') loadReconcile(); }, [tab, cid]);

  // ── Expense CRUD ──
  const saveExpense = async () => {
    if (!addForm.description || !addForm.amount) { toast('Description and amount required.', 'err'); return; }
    setSaving(true);
    try {
      if (editExp) {
        await expenseApi.update(cid, editExp.expenseId, addForm);
        toast('Expense updated.');
        setEditExp(null);
      } else {
        await expenseApi.create(cid, addForm);
        toast('Expense added.');
        setShowAdd(false);
      }
      setAddForm(BLANK_EXP());
      loadExpenses();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const cancelExpense = async (exp: any) => {
    if (!confirm(`Cancel expense "${exp.description}"?`)) return;
    try {
      await expenseApi.remove(cid, exp.expenseId);
      toast('Expense cancelled.');
      loadExpenses();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  // ── CSV Import ──
  const handleParseCSV = () => {
    const rows = parseCSV(csvText);
    if (!rows.length) { toast('Could not parse CSV. Check format.', 'err'); return; }
    setParsedRows(rows);
    toast(`Parsed ${rows.length} rows.`);
  };

  const handleImport = async () => {
    if (!parsedRows.length) { toast('Parse CSV first.', 'err'); return; }
    if (!bankName) { toast('Enter bank name.', 'err'); return; }
    setImporting(true);
    try {
      await expenseApi.importStatement(cid, { bankName, accountLast4: acctLast4 || undefined, rows: parsedRows });
      toast('Statement imported successfully.');
      setCsvText(''); setParsedRows([]); setBankName(''); setAcctLast4('');
      loadStatements();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setImporting(false); }
  };

  const handleDeleteStatement = async (sid: string) => {
    if (!confirm('Delete this statement and all its transactions?')) return;
    try {
      await expenseApi.deleteStatement(cid, sid);
      toast('Statement deleted.');
      if (selStmt?.statementId === sid) { setSelStmt(null); setTxns([]); }
      loadStatements();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  // ── Reconcile actions ──
  const handleAutoMatch = async () => {
    setAutoMatching(true);
    try {
      const r = await expenseApi.autoReconcile(cid);
      toast(`Auto-matched ${r?.matched ?? 0} transactions.`);
      loadReconcile();
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setAutoMatching(false); }
  };

  const handleIgnore = async (txnId: string) => {
    try {
      await expenseApi.reconcile(cid, { txnId, action: 'ignore' });
      toast('Marked as ignored.');
      loadReconcile();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const handleUnmatch = async (txnId: string) => {
    try {
      await expenseApi.reconcile(cid, { txnId, action: 'unmatch' });
      toast('Unlinked.');
      loadReconcile();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  const handleLink = async () => {
    if (!linkExpId) { toast('Select an expense.', 'err'); return; }
    try {
      await expenseApi.reconcile(cid, { txnId: linkModal.txnId, expenseId: linkExpId, action: 'match' });
      toast('Linked successfully.');
      setLinkModal(null); setLinkExpId('');
      loadReconcile();
    } catch (e: any) { toast(e.message, 'err'); }
  };

  // ── Derived stats ──
  const totalExp    = expData?.totalAmount || 0;
  const totalGst    = expData?.totalGst    || 0;
  const pending     = (expData?.expenses || []).filter((e: any) => e.status === 'PENDING').reduce((a: number, e: any) => a + e.amount, 0);
  const thisMonth   = (expData?.expenses || []).filter((e: any) => {
    const d = new Date(e.date);
    return d.getMonth() + 1 === +filterMonth && d.getFullYear() === +filterYear;
  }).reduce((a: number, e: any) => a + e.amount, 0);

  const recMatched   = recTxns.filter(t => t.status === 'MATCHED').length;
  const recUnmatched = recTxns.filter(t => t.status === 'UNMATCHED').length;
  const recIgnored   = recTxns.filter(t => t.status === 'IGNORED').length;

  const MONTHS = ['01','02','03','04','05','06','07','08','09','10','11','12'];
  const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const YEARS = ['2023','2024','2025','2026','2027'];

  // Company name
  const companyName = companies.find(c => c.companyId === cid)?.name || '';

  return (
    <div className="flex flex-col h-screen" style={{ background: '#f0f5fa' }}>
      <Topbar
        title="Expenses"
        subtitle={companyName ? `Managing expenses for ${companyName}` : 'Expense Management'}
        actions={
          <div className="flex items-center gap-2">
            {companies.length > 1 && (
              <select
                value={cid}
                onChange={e => setCid(e.target.value)}
                style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                {companies.map((c: any) => (
                  <option key={c.companyId} value={c.companyId}>{c.name}</option>
                ))}
              </select>
            )}
            {tab === 'expenses' && (
              <Btn variant="primary" size="sm" onClick={() => { setAddForm(BLANK_EXP()); setShowAdd(true); }}>
                + Add Expense
              </Btn>
            )}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e2eaf2', padding: '0 24px' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          {(['expenses','statements','reconcile'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                padding: '12px 20px', fontSize: 13, fontWeight: 600, border: 'none',
                background: 'none', cursor: 'pointer', borderBottom: tab === t ? '2px solid #3199d4' : '2px solid transparent',
                color: tab === t ? '#3199d4' : '#7a9baf', transition: 'all 0.15s', fontFamily: 'inherit',
              }}>
              {t === 'expenses' ? 'Expenses' : t === 'statements' ? 'Bank Statements' : 'Reconcile'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">

        {/* ── TAB: EXPENSES ── */}
        {tab === 'expenses' && (
          <div className="flex flex-col gap-4">
            {/* Summary cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'Total Expenses', value: inr(totalExp), color: '#3199d4' },
                { label: 'GST Input Credit', value: inr(totalGst), color: '#059669' },
                { label: 'Pending', value: inr(pending), color: '#f59e0b' },
                { label: 'This Month', value: inr(thisMonth), color: '#7c3aed' },
              ].map(c => (
                <Card key={c.label}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{c.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: c.color, marginTop: 4, letterSpacing: '-0.02em' }}>{c.value}</div>
                </Card>
              ))}
            </div>

            {/* Category breakdown */}
            {expData?.byCategory && Object.keys(expData.byCategory).length > 0 && (
              <Card>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 10 }}>By Category</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {Object.entries(expData.byCategory as Record<string, number>).map(([cat, amt]) => (
                    <div key={cat} style={{ background: (CAT_COLORS[cat] || '#64748b') + '15', border: `1px solid ${(CAT_COLORS[cat] || '#64748b')}30`, borderRadius: 8, padding: '6px 12px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: CAT_COLORS[cat] || '#64748b' }}>{cat}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#192b3f' }}>{inr(amt)}</div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Filters */}
            <Card className="p-3">
              <div className="flex items-center gap-3 flex-wrap">
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Month:</span>
                  <select value={filterMonth} onChange={e => setFilterMonth(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                    {MONTHS.map((m, i) => <option key={m} value={m}>{MONTH_LABELS[i]}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Year:</span>
                  <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                    {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Category:</span>
                  <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                    <option value="ALL">All</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Status:</span>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
                    style={{ padding: '5px 8px', fontSize: 12, borderRadius: 7, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}>
                    <option value="ALL">All</option>
                    {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </Card>

            {/* Table */}
            <Card className="p-0 overflow-hidden">
              {expLoading ? (
                <div style={{ padding: 40, textAlign: 'center', color: '#7a9baf', fontSize: 13 }}>Loading expenses...</div>
              ) : !expData?.expenses?.length ? (
                <Empty icon="💸" title="No expenses found" desc="Add your first expense to get started." action={
                  <Btn variant="primary" size="sm" onClick={() => { setAddForm(BLANK_EXP()); setShowAdd(true); }}>+ Add Expense</Btn>
                } />
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fbfd' }}>
                        {['Date','Category','Description','Pay Mode','Amount','GST','Status',''].map(h => (
                          <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: '#4a6a85', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap', borderBottom: '1px solid #e2eaf2' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {expData.expenses.map((exp: any) => (
                        <tr key={exp.expenseId} style={{ borderBottom: '1px solid #f0f5fa' }}
                          onMouseEnter={e => (e.currentTarget.style.background = '#f8fbfd')}
                          onMouseLeave={e => (e.currentTarget.style.background = '')}>
                          <td style={{ padding: '10px 12px', color: '#4a6a85', whiteSpace: 'nowrap' }}>{dateStr(exp.date)}</td>
                          <td style={{ padding: '10px 12px' }}><CatBadge cat={exp.category} /></td>
                          <td style={{ padding: '10px 12px', color: '#192b3f', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {exp.description}
                            {exp.notes && <div style={{ fontSize: 11, color: '#7a9baf' }}>{exp.notes}</div>}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#64748b' }}>{exp.payMode}</td>
                          <td style={{ padding: '10px 12px', fontWeight: 700, color: '#192b3f', whiteSpace: 'nowrap' }}>{inr(exp.amount)}</td>
                          <td style={{ padding: '10px 12px', color: '#059669', whiteSpace: 'nowrap' }}>{exp.gstAmount > 0 ? inr(exp.gstAmount) : '—'}</td>
                          <td style={{ padding: '10px 12px' }}>
                            <Badge status={exp.status.toLowerCase()} label={exp.status} />
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Btn size="sm" variant="ghost" style={{ padding: '3px 8px', fontSize: 11 }}
                                onClick={() => { setEditExp(exp); setAddForm({ date: isoDate(exp.date), category: exp.category, description: exp.description, amount: String(exp.amount), gstPercent: exp.gstPercent != null ? String(exp.gstPercent) : '', payMode: exp.payMode, reference: exp.reference || '', notes: exp.notes || '', status: exp.status }); }}>
                                Edit
                              </Btn>
                              {exp.status !== 'CANCELLED' && (
                                <Btn size="sm" variant="danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => cancelExpense(exp)}>
                                  Cancel
                                </Btn>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div style={{ padding: '8px 12px', fontSize: 11.5, color: '#7a9baf', borderTop: '1px solid #f0f5fa' }}>
                    {expData.total} expense{expData.total !== 1 ? 's' : ''} total
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ── TAB: BANK STATEMENTS ── */}
        {tab === 'statements' && (
          <div className="flex flex-col gap-4">
            {/* Import section */}
            <Card>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f', marginBottom: 12 }}>Import Bank Statement (CSV)</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                <Input label="Bank Name" value={bankName} placeholder="e.g. HDFC Bank"
                  onChange={e => setBankName(e.target.value)} />
                <Input label="Account Last 4 Digits" value={acctLast4} placeholder="1234" maxLength={4}
                  onChange={e => setAcctLast4(e.target.value)} />
              </div>
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>
                  Paste CSV Content
                </label>
                <div style={{ fontSize: 11, color: '#7a9baf', marginBottom: 6 }}>
                  Supports HDFC, SBI, ICICI, Axis and generic formats. Columns should include: Date, Narration/Description, Withdrawal/Debit, Deposit/Credit, Balance.
                </div>
                <textarea
                  value={csvText}
                  onChange={e => { setCsvText(e.target.value); setParsedRows([]); }}
                  rows={6}
                  placeholder={`Date,Narration,Chq/Ref No.,Value Date,Withdrawal Amt.(INR ),Deposit Amt.(INR ),Closing Balance(INR )\n01/04/2026,NEFT-Vendor Payment,,01/04/2026,50000.00,,125000.00`}
                  style={{ width: '100%', padding: '8px 12px', fontSize: 12, border: '1px solid #d4e1ec', borderRadius: 8, background: '#fff', color: '#192b3f', fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Btn size="sm" variant="secondary" onClick={handleParseCSV} disabled={!csvText.trim()}>
                  Parse CSV
                </Btn>
                {parsedRows.length > 0 && (
                  <Btn size="sm" variant="primary" loading={importing} onClick={handleImport} disabled={!bankName}>
                    Confirm Import ({parsedRows.length} rows)
                  </Btn>
                )}
                {parsedRows.length > 0 && (
                  <span style={{ fontSize: 12, color: '#059669', fontWeight: 600 }}>
                    {parsedRows.length} rows parsed
                  </span>
                )}
              </div>

              {/* Preview table */}
              {parsedRows.length > 0 && (
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: '#192b3f', marginBottom: 6 }}>Preview (first 10 rows)</div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                    <thead>
                      <tr style={{ background: '#f8fbfd' }}>
                        {['Date','Description','Debit','Credit','Balance'].map(h => (
                          <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 700, color: '#4a6a85', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #e2eaf2' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {parsedRows.slice(0, 10).map((r, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f0f5fa' }}>
                          <td style={{ padding: '6px 10px', color: '#4a6a85' }}>{r.date}</td>
                          <td style={{ padding: '6px 10px', color: '#192b3f', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.description}</td>
                          <td style={{ padding: '6px 10px', color: r.debit > 0 ? '#dc2626' : '#c0d0dd', fontWeight: r.debit > 0 ? 700 : 400 }}>{r.debit > 0 ? inr(r.debit) : '—'}</td>
                          <td style={{ padding: '6px 10px', color: r.credit > 0 ? '#059669' : '#c0d0dd', fontWeight: r.credit > 0 ? 700 : 400 }}>{r.credit > 0 ? inr(r.credit) : '—'}</td>
                          <td style={{ padding: '6px 10px', color: '#64748b' }}>{r.balance != null ? inr(r.balance) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedRows.length > 10 && (
                    <div style={{ fontSize: 11, color: '#7a9baf', padding: '4px 10px' }}>...and {parsedRows.length - 10} more rows</div>
                  )}
                </div>
              )}
            </Card>

            {/* Statements list */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Statements column */}
              <div className="md:col-span-1 flex flex-col gap-3">
                <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>Imported Statements</div>
                {stmtLoading ? (
                  <Card><div style={{ padding: 20, textAlign: 'center', color: '#7a9baf', fontSize: 12 }}>Loading...</div></Card>
                ) : !statements.length ? (
                  <Card><Empty icon="🏦" title="No statements yet" desc="Import your first bank statement above." /></Card>
                ) : (
                  statements.map((s: any) => {
                    const matched   = s.transactions?.filter((t: any) => t.status === 'MATCHED').length ?? 0;
                    const total     = s._count?.transactions ?? s.rowCount;
                    const isSelected = selStmt?.statementId === s.statementId;
                    return (
                      <Card key={s.statementId} style={{ cursor: 'pointer', border: isSelected ? '1px solid #3199d4' : undefined, background: isSelected ? '#f0f8ff' : '#fff' }}>
                      <div onClick={() => loadTxns(s)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{s.bankName}</div>
                            {s.accountLast4 && <div style={{ fontSize: 11, color: '#7a9baf' }}>•••• {s.accountLast4}</div>}
                            <div style={{ fontSize: 11, color: '#7a9baf', marginTop: 2 }}>
                              {dateStr(s.fromDate)} → {dateStr(s.toDate)}
                            </div>
                            <div style={{ fontSize: 11, color: '#4a6a85', marginTop: 4 }}>
                              {total} txns
                            </div>
                          </div>
                          <button onClick={e => { e.stopPropagation(); handleDeleteStatement(s.statementId); }}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 16, padding: 4 }}>
                            ×
                          </button>
                        </div>
                      </div>
                      </Card>
                    );
                  })
                )}
              </div>

              {/* Transactions column */}
              <div className="md:col-span-2">
                {!selStmt ? (
                  <Card style={{ height: '100%' }}>
                    <Empty icon="👈" title="Select a statement" desc="Click on a statement to view its transactions." />
                  </Card>
                ) : (
                  <Card className="p-0 overflow-hidden">
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #f0f5fa', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{selStmt.bankName} Transactions</div>
                        <div style={{ fontSize: 11, color: '#7a9baf' }}>{dateStr(selStmt.fromDate)} → {dateStr(selStmt.toDate)}</div>
                      </div>
                    </div>
                    {txnLoading ? (
                      <div style={{ padding: 32, textAlign: 'center', color: '#7a9baf', fontSize: 12 }}>Loading transactions...</div>
                    ) : !txns.length ? (
                      <Empty icon="📋" title="No transactions" />
                    ) : (
                      <div style={{ overflowX: 'auto', maxHeight: 480 }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                          <thead style={{ position: 'sticky', top: 0, background: '#f8fbfd' }}>
                            <tr>
                              {['Date','Description','Debit','Credit','Status','Expense'].map(h => (
                                <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 700, color: '#4a6a85', fontSize: 10, textTransform: 'uppercase', borderBottom: '1px solid #e2eaf2' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {txns.map((t: any) => (
                              <tr key={t.txnId} style={{ borderBottom: '1px solid #f0f5fa' }}>
                                <td style={{ padding: '7px 10px', color: '#4a6a85', whiteSpace: 'nowrap' }}>{dateStr(t.date)}</td>
                                <td style={{ padding: '7px 10px', color: '#192b3f', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</td>
                                <td style={{ padding: '7px 10px', color: '#dc2626', fontWeight: 700 }}>{t.debit > 0 ? inr(t.debit) : '—'}</td>
                                <td style={{ padding: '7px 10px', color: '#059669', fontWeight: 700 }}>{t.credit > 0 ? inr(t.credit) : '—'}</td>
                                <td style={{ padding: '7px 10px' }}>
                                  <span style={{
                                    padding: '2px 7px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                                    background: t.status === 'MATCHED' ? '#d1fae5' : t.status === 'IGNORED' ? '#f0f5fa' : '#fef3c7',
                                    color: t.status === 'MATCHED' ? '#047857' : t.status === 'IGNORED' ? '#64748b' : '#b45309',
                                  }}>{t.status}</span>
                                </td>
                                <td style={{ padding: '7px 10px' }}>
                                  {t.expense ? (
                                    <span style={{ fontSize: 11, color: '#059669' }}>{t.expense.description}</span>
                                  ) : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: RECONCILE ── */}
        {tab === 'reconcile' && (
          <div className="flex flex-col gap-4">
            {/* Header with auto-match + summary */}
            <Card>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>Bank Reconciliation</div>
                  <div style={{ fontSize: 12, color: '#7a9baf', marginTop: 2 }}>
                    Match bank debit transactions to your recorded expenses.
                  </div>
                </div>
                <Btn variant="primary" size="sm" loading={autoMatching} onClick={handleAutoMatch}>
                  Auto-Match
                </Btn>
              </div>
              <div style={{ display: 'flex', gap: 20, marginTop: 12 }}>
                {[
                  { label: 'Matched', val: recMatched, color: '#059669' },
                  { label: 'Unmatched', val: recUnmatched, color: '#f59e0b' },
                  { label: 'Ignored', val: recIgnored, color: '#94a3b8' },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#7a9baf', textTransform: 'uppercase' }}>{s.label}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>

            {recLoading ? (
              <div style={{ padding: 40, textAlign: 'center', color: '#7a9baf', fontSize: 13 }}>Loading reconciliation data...</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Bank Transactions */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 8 }}>Bank Debit Transactions</div>
                  {!recTxns.length ? (
                    <Card><Empty icon="🏦" title="No bank transactions" desc="Import a bank statement first." /></Card>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {recTxns.map((t: any) => (
                        <Card key={t.txnId} style={{
                          border: t.status === 'MATCHED' ? '1px solid #86efac' : t.status === 'IGNORED' ? '1px solid #e2eaf2' : '1px solid #fde68a',
                          background: t.status === 'MATCHED' ? '#f0fdf4' : t.status === 'IGNORED' ? '#f8fbfd' : '#fff',
                          opacity: t.status === 'IGNORED' ? 0.6 : 1,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#192b3f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.description}</div>
                              <div style={{ fontSize: 11, color: '#7a9baf' }}>{dateStr(t.date)}</div>
                              {t.expense && (
                                <div style={{ fontSize: 11, color: '#059669', marginTop: 2 }}>
                                  Linked: {t.expense.description} ({t.expense.category})
                                </div>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>{inr(t.debit)}</div>
                              <div style={{ display: 'flex', gap: 4, marginTop: 4, justifyContent: 'flex-end' }}>
                                {t.status === 'MATCHED' && (
                                  <Btn size="sm" variant="ghost" style={{ padding: '2px 7px', fontSize: 10, color: '#dc2626' }} onClick={() => handleUnmatch(t.txnId)}>Unlink</Btn>
                                )}
                                {t.status === 'UNMATCHED' && (
                                  <>
                                    <Btn size="sm" variant="primary" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => { setLinkModal(t); setLinkExpId(''); }}>Link</Btn>
                                    <Btn size="sm" variant="ghost" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => handleIgnore(t.txnId)}>Ignore</Btn>
                                  </>
                                )}
                                {t.status === 'IGNORED' && (
                                  <Btn size="sm" variant="ghost" style={{ padding: '2px 7px', fontSize: 10 }} onClick={() => handleUnmatch(t.txnId)}>Restore</Btn>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>

                {/* Unmatched Expenses */}
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f', marginBottom: 8 }}>Unmatched Expenses</div>
                  {!recExps.length ? (
                    <Card><Empty icon="✅" title="All expenses matched!" desc="Every expense has a bank transaction linked." /></Card>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {recExps.map((e: any) => (
                        <Card key={e.expenseId} style={{ border: '1px solid #e2eaf2' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 11.5, fontWeight: 700, color: '#192b3f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</div>
                              <div style={{ fontSize: 11, color: '#7a9baf' }}>{dateStr(e.date)}</div>
                              <CatBadge cat={e.category} />
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 8 }}>
                              <div style={{ fontSize: 13, fontWeight: 800, color: '#192b3f' }}>{inr(e.amount)}</div>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Expense Modal ── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Expense"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setShowAdd(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={saving} onClick={saveExpense}>Add Expense</Btn>
          </>
        }>
        <ExpenseForm form={addForm} setForm={setAddForm} />
      </Modal>

      {/* ── Edit Expense Modal ── */}
      <Modal open={!!editExp} onClose={() => setEditExp(null)} title="Edit Expense"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setEditExp(null)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={saving} onClick={saveExpense}>Save Changes</Btn>
          </>
        }>
        <ExpenseForm form={addForm} setForm={setAddForm} />
      </Modal>

      {/* ── Link to Expense Modal ── */}
      <Modal open={!!linkModal} onClose={() => setLinkModal(null)} title="Link Bank Transaction to Expense" size="sm"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setLinkModal(null)}>Cancel</Btn>
            <Btn variant="primary" size="sm" onClick={handleLink} disabled={!linkExpId}>Link</Btn>
          </>
        }>
        {linkModal && (
          <div className="flex flex-col gap-3">
            <div style={{ background: '#f8fbfd', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#192b3f' }}>{linkModal.description}</div>
              <div style={{ fontSize: 12, color: '#dc2626', fontWeight: 700 }}>{inr(linkModal.debit)}</div>
              <div style={{ fontSize: 11, color: '#7a9baf' }}>{dateStr(linkModal.date)}</div>
            </div>
            <Sel label="Select Expense to Link"
              value={linkExpId}
              onChange={e => setLinkExpId(e.target.value)}
              options={[
                { value: '', label: '— Pick an expense —' },
                ...recExps.map((e: any) => ({
                  value: e.expenseId,
                  label: `${dateStr(e.date)} | ${e.description} | ${inr(e.amount)}`,
                })),
              ]}
            />
          </div>
        )}
      </Modal>

      <ToastContainer />
    </div>
  );
}
