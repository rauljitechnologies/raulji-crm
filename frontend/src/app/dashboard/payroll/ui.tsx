'use client';
import { useEffect, useRef, useState } from 'react';
import { payrollApi } from '@/lib/api';
import { Btn, Input, Sel, Modal, useToast, Empty } from '@/components/ui';

/* ══════════════════════════════════════════════════════════════
   Payroll — shared helpers, employee editor, payslip generator,
   payslip editor and the payslip preview/download sheet.
   ══════════════════════════════════════════════════════════════ */

export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';
export const tok = () => (typeof window !== 'undefined' ? localStorage.getItem('accessToken') || '' : '');

export const inr = (n: number) => '₹' + (+n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const inrShort = (n: number) => '₹' + Math.round(+n || 0).toLocaleString('en-IN');
export const dateStr = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
export const num = (v: any) => (v === '' || v === null || v === undefined || isNaN(+v) ? 0 : +v);

export const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
                       'July', 'August', 'September', 'October', 'November', 'December'];
export const GENDERS = ['Male', 'Female', 'Other'];
export const PAY_MODES = ['BANK', 'CASH', 'UPI', 'CHEQUE'];

// Default paid days for a month = weekdays (Mon–Fri). Mirrors the server.
export function weekdaysInMonth(year: number, month: number) {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

const STATUS_TOKENS: Record<string, { bg: string; fg: string }> = {
  DRAFT:     { bg: 'var(--surface-2)',    fg: 'var(--text-2)' },
  PUBLISHED: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  PAID:      { bg: 'var(--success-soft)', fg: 'var(--success-ink)' },
  ACTIVE:    { bg: 'var(--success-soft)', fg: 'var(--success-ink)' },
  INACTIVE:  { bg: 'var(--surface-2)',    fg: 'var(--text-3)' },
};
export function StatusPill({ s }: { s: string }) {
  const c = STATUS_TOKENS[s] || STATUS_TOKENS.DRAFT;
  return (
    <span style={{
      background: c.bg, color: c.fg, display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '2.5px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap',
      boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.08)',
    }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.fg, flexShrink: 0 }} />
      {s.charAt(0) + s.slice(1).toLowerCase()}
    </span>
  );
}

export function Stat({ label, value, sub, color }: { label: string; value: string; sub?: string; color?: string }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: '13px 15px', boxShadow: 'var(--shadow-xs)' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: color || 'var(--text)', marginTop: 3, letterSpacing: '-0.02em' }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

export const th: React.CSSProperties = {
  padding: '10px 12px', textAlign: 'left', fontWeight: 700, color: 'var(--text-2)', fontSize: 10.5,
  textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)',
};
export const td: React.CSSProperties = { padding: '10px 12px', color: 'var(--text)', fontSize: 12.5, whiteSpace: 'nowrap' };

const sectionLbl: React.CSSProperties = {
  fontSize: 10.5, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase',
  letterSpacing: '0.08em', marginTop: 4, marginBottom: 2,
};

// ─── Employee add / edit ──────────────────────────────────────
const BLANK_EMP = () => ({
  empCode: '', name: '', designation: '', department: '', gender: 'Male', email: '', phone: '',
  panNo: '', uanNo: '', dateOfJoining: '', dateOfLeaving: '', status: 'ACTIVE',
  bankName: '', accountNumber: '', ifsc: '',
  basic: '', hra: '', otherAllowance: '',
  incomeTax: '', providentFund: '', pfPercent: '', professionalTax: '200', otherDeduction: '', notes: '',
});

export function EmployeeModal({ cid, editing, onClose, onDone }: any) {
  const [form, setForm] = useState<any>(() => {
    if (!editing) return BLANK_EMP();
    const d = (v: any) => (v ? new Date(v).toISOString().slice(0, 10) : '');
    const n = (v: any) => (v === null || v === undefined ? '' : String(v));
    return {
      ...BLANK_EMP(), ...editing,
      designation: editing.designation || '', department: editing.department || '', gender: editing.gender || 'Male',
      email: editing.email || '', phone: editing.phone || '', panNo: editing.panNo || '', uanNo: editing.uanNo || '',
      bankName: editing.bankName || '', accountNumber: editing.accountNumber || '', ifsc: editing.ifsc || '',
      notes: editing.notes || '',
      dateOfJoining: d(editing.dateOfJoining), dateOfLeaving: d(editing.dateOfLeaving),
      basic: n(editing.basic), hra: n(editing.hra), otherAllowance: n(editing.otherAllowance),
      incomeTax: n(editing.incomeTax), providentFund: n(editing.providentFund),
      pfPercent: editing.pfPercent === null || editing.pfPercent === undefined ? '' : String(editing.pfPercent),
      professionalTax: n(editing.professionalTax), otherDeduction: n(editing.otherDeduction),
    };
  });
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  // Suggest the next code in the company series for new employees
  useEffect(() => {
    if (editing) return;
    payrollApi.nextEmpCode(cid).then((r: any) => setForm((f: any) => (f.empCode ? f : { ...f, empCode: r.empCode }))).catch(() => {});
  }, [cid, editing]);

  const gross = num(form.basic) + num(form.hra) + num(form.otherAllowance);
  const pf = form.pfPercent !== '' ? (num(form.basic) * num(form.pfPercent)) / 100 : num(form.providentFund);
  const deductions = num(form.incomeTax) + pf + num(form.professionalTax) + num(form.otherDeduction);

  const save = async () => {
    if (!form.name.trim())    { toast('Employee name is required.', 'err'); return; }
    if (!form.empCode.trim()) { toast('Employee ID is required.', 'err'); return; }
    setSaving(true);
    try {
      if (editing) await payrollApi.updateEmployee(cid, editing.employeeId, form);
      else         await payrollApi.createEmployee(cid, form);
      toast(editing ? 'Employee updated.' : 'Employee added.');
      setTimeout(() => { onDone(); onClose(); }, 300);
    } catch (e: any) { toast(e.message, 'err'); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={editing ? `Edit ${editing.name}` : 'Add Employee'}
      footer={<>
        <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" loading={saving} onClick={save}>{editing ? 'Save Changes' : 'Add Employee'}</Btn>
      </>}>
      <div className="flex flex-col gap-3">
        <div style={sectionLbl}>Identity</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Employee ID *" value={form.empCode} placeholder="INC-009" onChange={e => set('empCode', e.target.value)} />
          <Input label="Full Name *" value={form.name} placeholder="Zeal Chhasatiya" onChange={e => set('name', e.target.value)} />
          <Sel label="Gender" value={form.gender} onChange={e => set('gender', e.target.value)} options={GENDERS.map(g => ({ value: g, label: g }))} />
          <Input label="PAN No." value={form.panNo} placeholder="BVVPC7479L" onChange={e => set('panNo', e.target.value.toUpperCase())} />
          <Input label="UAN No. (PF)" value={form.uanNo} placeholder="Optional" onChange={e => set('uanNo', e.target.value)} />
          <Sel label="Status" value={form.status} onChange={e => set('status', e.target.value)}
            options={[{ value: 'ACTIVE', label: 'Active' }, { value: 'INACTIVE', label: 'Inactive' }]} />
        </div>

        <div style={sectionLbl}>Employment</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Designation" value={form.designation} placeholder="IT Security Analyst" onChange={e => set('designation', e.target.value)} />
          <Input label="Department" value={form.department} placeholder="Technology" onChange={e => set('department', e.target.value)} />
          <Input label="Date of Joining" type="date" value={form.dateOfJoining} onChange={e => set('dateOfJoining', e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          <Input label="Phone" value={form.phone} onChange={e => set('phone', e.target.value)} />
          <Input label="Date of Leaving" type="date" value={form.dateOfLeaving} onChange={e => set('dateOfLeaving', e.target.value)} />
        </div>

        <div style={sectionLbl}>Monthly Earnings</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Basic (₹)" type="number" value={form.basic} placeholder="15000" onChange={e => set('basic', e.target.value)} />
          <Input label="House Rent Allowance (₹)" type="number" value={form.hra} placeholder="9000" onChange={e => set('hra', e.target.value)} />
          <Input label="Other Allowance (₹)" type="number" value={form.otherAllowance} placeholder="6000" onChange={e => set('otherAllowance', e.target.value)} />
        </div>

        <div style={sectionLbl}>Monthly Deductions</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Income Tax (TDS) (₹)" type="number" value={form.incomeTax} placeholder="0" onChange={e => set('incomeTax', e.target.value)} />
          <Input label="Provident Fund (₹)" type="number" value={form.providentFund} placeholder="0"
            disabled={form.pfPercent !== ''} onChange={e => set('providentFund', e.target.value)} />
          <Input label="PF as % of Basic" type="number" value={form.pfPercent} placeholder="e.g. 12 — overrides ₹"
            onChange={e => set('pfPercent', e.target.value)} />
          <Input label="Professional Tax (₹)" type="number" value={form.professionalTax} placeholder="200" onChange={e => set('professionalTax', e.target.value)} />
          <Input label="Other Deduction (₹)" type="number" value={form.otherDeduction} placeholder="0" onChange={e => set('otherDeduction', e.target.value)} />
        </div>

        {/* Live preview of what a full-month payslip will look like */}
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 14px', display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gross / month</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--success-ink)' }}>{inr(gross)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deductions</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--danger-ink)' }}>{inr(deductions)}</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Net payable</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{inr(gross - deductions)}</div>
          </div>
        </div>

        <div style={sectionLbl}>Bank (printed on the payslip)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Input label="Bank Name" value={form.bankName} onChange={e => set('bankName', e.target.value)} />
          <Input label="Account Number" value={form.accountNumber} onChange={e => set('accountNumber', e.target.value)} />
          <Input label="IFSC" value={form.ifsc} onChange={e => set('ifsc', e.target.value.toUpperCase())} />
        </div>
        <Input label="Notes" value={form.notes} placeholder="Optional" onChange={e => set('notes', e.target.value)} />
      </div>
      <ToastContainer />
    </Modal>
  );
}

// Salary for a month is normally paid on its last day — a sensible, editable default.
export const lastDayOfMonth = (year: number, month: number) =>
  new Date(year, month, 0).toLocaleDateString('en-CA');   // en-CA → YYYY-MM-DD, no UTC shift

// ─── Generate payslips for a month ────────────────────────────
export function GenerateModal({ cid, month, year, onClose, onDone }: any) {
  const [m, setM] = useState(String(month));
  const [y, setY] = useState(String(year));
  const [workingDays, setWorkingDays] = useState('');
  const [payDate, setPayDate] = useState(() => lastDayOfMonth(year, month));
  const [payMode, setPayMode] = useState('BANK');
  const [rows, setRows] = useState<any[]>([]);
  const [paidDays, setPaidDays] = useState<Record<string, string>>({});
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [overwrite, setOverwrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();

  // Follow the period when it changes, so the pay date never lags behind the month
  useEffect(() => { setPayDate(lastDayOfMonth(+y, +m)); }, [m, y]);

  // Pull the server's computed figures whenever the period changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const params: any = { month: m, year: y };
    if (workingDays) params.workingDays = workingDays;
    payrollApi.previewSlips(cid, params)
      .then((r: any) => {
        if (cancelled) return;
        setRows(r.rows || []);
        setWorkingDays(String(r.workingDays));
        const pd: Record<string, string> = {}, pk: Record<string, boolean> = {};
        (r.rows || []).forEach((row: any) => {
          pd[row.employeeId] = String(row.paidDays);
          pk[row.employeeId] = !row.notEmployed && !row.existingPayslipId;
        });
        setPaidDays(pd);
        setPicked(pk);
      })
      .catch((e: any) => !cancelled && toast(e.message, 'err'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // workingDays is intentionally not a dependency — it is echoed back by the server
    // and re-running on every keystroke would fight the input.
  }, [cid, m, y]);

  const selected = rows.filter(r => picked[r.employeeId]);

  // Recompute locally so editing paid days updates the row immediately.
  // Preview rows always come back at factor 1, so r.basic/hra/other are the
  // full monthly amounts — mirror the server rule from there.
  const netFor = (r: any) => {
    const wd = num(workingDays) || r.workingDays || 1;
    const pd = Math.min(num(paidDays[r.employeeId] ?? r.paidDays), wd);
    const factor = wd > 0 ? pd / wd : 1;
    const gross = (r.basic + r.hra + r.otherAllowance) * factor;
    // Deductions are fixed monthly amounts — except PF when set as a % of basic
    const ded = r.pfPercent != null
      ? r.totalDeductions - r.providentFund + (r.basic * factor * r.pfPercent) / 100
      : r.totalDeductions;
    return { pd, gross, ded, net: gross - ded };
  };

  const generate = async () => {
    if (!selected.length) { toast('Select at least one employee.', 'err'); return; }
    setSaving(true);
    try {
      const body: any = {
        month: +m, year: +y, workingDays: num(workingDays) || undefined,
        paidOn: payDate || undefined, payMode: payMode || undefined,
        employeeIds: selected.map(r => r.employeeId),
        paidDaysByEmployee: Object.fromEntries(selected.map(r => [r.employeeId, num(paidDays[r.employeeId] ?? r.paidDays)])),
        overwrite,
      };
      const res: any = await payrollApi.generateSlips(cid, body);
      const skipped = res?.skipped?.length || 0;
      toast(`${res?.created?.length || 0} created, ${res?.updated?.length || 0} regenerated${skipped ? `, ${skipped} skipped` : ''}.`);
      setTimeout(() => { onDone(+m, +y); onClose(); }, 500);
    } catch (e: any) { toast(e.message, 'err'); setSaving(false); }
  };

  const allOn = rows.length > 0 && rows.every(r => picked[r.employeeId]);
  const toggleAll = () => {
    const next = !allOn;
    setPicked(Object.fromEntries(rows.map(r => [r.employeeId, next && !r.notEmployed])));
  };

  return (
    <Modal open onClose={onClose} size="xl" title="Generate Payslips"
      footer={<>
        <div style={{ marginRight: 'auto', fontSize: 12, color: 'var(--text-2)' }}>
          {selected.length} of {rows.length} selected · net {inr(selected.reduce((a, r) => a + netFor(r).net, 0))}
        </div>
        <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" loading={saving} onClick={generate}>Generate {selected.length || ''}</Btn>
      </>}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Sel label="Month" value={m} onChange={e => setM(e.target.value)}
            options={MONTHS.map((label, i) => ({ value: String(i + 1), label }))} />
          <Sel label="Year" value={y} onChange={e => setY(e.target.value)}
            options={Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 3 + i)).map(v => ({ value: v, label: v }))} />
          <Input label="Working Days" type="number" value={workingDays} onChange={e => setWorkingDays(e.target.value)} />
          <Input label="Pay Date" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
          <Sel label="Pay Mode" value={payMode} onChange={e => setPayMode(e.target.value)}
            options={[{ value: '', label: '—' }, ...PAY_MODES.map(p => ({ value: p, label: p }))]} />
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--text-2)', paddingTop: 18, cursor: 'pointer' }}>
            <input type="checkbox" checked={overwrite} onChange={e => setOverwrite(e.target.checked)} />
            Regenerate existing slips
          </label>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>Calculating…</div>
        ) : !rows.length ? (
          <Empty icon="👥" title="No active employees" desc="Add employees before generating payslips." />
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ maxHeight: '45vh', overflowY: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ position: 'sticky', top: 0, background: 'var(--surface-2)', zIndex: 1 }}>
                  <tr>
                    <th style={{ ...th, width: 36 }}><input type="checkbox" checked={allOn} onChange={toggleAll} /></th>
                    <th style={th}>Employee</th>
                    <th style={{ ...th, textAlign: 'center' }}>Paid Days</th>
                    <th style={{ ...th, textAlign: 'right' }}>Gross</th>
                    <th style={{ ...th, textAlign: 'right' }}>Deductions</th>
                    <th style={{ ...th, textAlign: 'right' }}>Net Payable</th>
                    <th style={th}></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => {
                    const calc = netFor(r);
                    return (
                      <tr key={r.employeeId} style={{ borderTop: '1px solid var(--border)', opacity: r.notEmployed ? 0.5 : 1 }}>
                        <td style={td}>
                          <input type="checkbox" checked={!!picked[r.employeeId]} disabled={r.notEmployed}
                            onChange={e => setPicked({ ...picked, [r.employeeId]: e.target.checked })} />
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 600 }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{r.empCode}{r.designation ? ` · ${r.designation}` : ''}</div>
                        </td>
                        <td style={{ ...td, textAlign: 'center' }}>
                          <input type="number" value={paidDays[r.employeeId] ?? ''} disabled={r.notEmployed}
                            onChange={e => setPaidDays({ ...paidDays, [r.employeeId]: e.target.value })}
                            style={{ width: 58, padding: '4px 6px', fontSize: 12, textAlign: 'center', borderRadius: 8, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }} />
                        </td>
                        <td style={{ ...td, textAlign: 'right' }}>{inr(calc.gross)}</td>
                        <td style={{ ...td, textAlign: 'right', color: 'var(--danger-ink)' }}>{inr(calc.ded)}</td>
                        <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(calc.net)}</td>
                        <td style={td}>
                          {r.notEmployed ? <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Not employed this period</span>
                            : r.existingPayslipId ? <span style={{ fontSize: 11, color: 'var(--warning-ink)' }}>Slip exists</span> : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>
          Earnings are prorated by paid days ÷ working days. Deductions are fixed monthly amounts, except PF when set as a % of basic.
        </div>
      </div>
      <ToastContainer />
    </Modal>
  );
}

// Free-form extra earning / deduction lines. Declared at module scope so it
// keeps its identity across renders — inline it and every keystroke remounts
// the inputs and drops focus.
function LineEditor({ title, lines, setLines }: { title: string; lines: any[]; setLines: (l: any[]) => void }) {
  return (
    <div className="flex flex-col gap-2">
      <div style={sectionLbl}>{title}</div>
      {lines.map((l: any, i: number) => (
        <div key={i} className="flex gap-2 items-end">
          <div style={{ flex: 2 }}>
            <Input label={i === 0 ? 'Label' : undefined} value={l.label || ''} placeholder="e.g. Bonus"
              onChange={e => setLines(lines.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
          </div>
          <div style={{ flex: 1 }}>
            <Input label={i === 0 ? 'Amount (₹)' : undefined} type="number" value={l.amount ?? ''}
              onChange={e => setLines(lines.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} />
          </div>
          <Btn size="sm" variant="ghost" style={{ marginBottom: 2 }} onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</Btn>
        </div>
      ))}
      <div><Btn size="sm" variant="secondary" onClick={() => setLines([...lines, { label: '', amount: '' }])}>+ Add line</Btn></div>
    </div>
  );
}

// ─── Edit a generated payslip ─────────────────────────────────
export function PayslipEditModal({ cid, slip, onClose, onDone }: any) {
  const [form, setForm] = useState<any>({
    workingDays: String(slip.workingDays), paidDays: String(slip.paidDays),
    basic: String(slip.basic), hra: String(slip.hra), otherAllowance: String(slip.otherAllowance),
    incomeTax: String(slip.incomeTax), providentFund: String(slip.providentFund),
    professionalTax: String(slip.professionalTax), otherDeduction: String(slip.otherDeduction),
    status: slip.status, payMode: slip.payMode || '', notes: slip.notes || '',
    paidOn: slip.paidOn ? new Date(slip.paidOn).toISOString().slice(0, 10) : '',
  });
  const [extraE, setExtraE] = useState<any[]>(Array.isArray(slip.extraEarnings) ? slip.extraEarnings : []);
  const [extraD, setExtraD] = useState<any[]>(Array.isArray(slip.extraDeductions) ? slip.extraDeductions : []);
  const [saving, setSaving] = useState(false);
  const { toast, ToastContainer } = useToast();
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const gross = num(form.basic) + num(form.hra) + num(form.otherAllowance) + extraE.reduce((a, l) => a + num(l.amount), 0);
  const ded = num(form.incomeTax) + num(form.providentFund) + num(form.professionalTax) + num(form.otherDeduction) + extraD.reduce((a, l) => a + num(l.amount), 0);

  const save = async () => {
    setSaving(true);
    try {
      await payrollApi.updatePayslip(cid, slip.payslipId, { ...form, extraEarnings: extraE, extraDeductions: extraD });
      toast('Payslip updated.');
      setTimeout(() => { onDone(); onClose(); }, 300);
    } catch (e: any) { toast(e.message, 'err'); setSaving(false); }
  };

  return (
    <Modal open onClose={onClose} size="lg"
      title={`${slip.employeeName} · ${MONTHS[slip.month - 1]} ${slip.year}`}
      footer={<>
        <div style={{ marginRight: 'auto', fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>Net {inr(gross - ded)}</div>
        <Btn variant="secondary" size="sm" onClick={onClose}>Cancel</Btn>
        <Btn variant="primary" size="sm" loading={saving} onClick={save}>Save</Btn>
      </>}>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Working Days" type="number" value={form.workingDays} onChange={e => set('workingDays', e.target.value)} />
          <Input label="Paid Days" type="number" value={form.paidDays} onChange={e => set('paidDays', e.target.value)} />
          <Sel label="Status" value={form.status} onChange={e => set('status', e.target.value)}
            options={[{ value: 'DRAFT', label: 'Draft' }, { value: 'PUBLISHED', label: 'Published' }, { value: 'PAID', label: 'Paid' }]} />
          <Sel label="Pay Mode" value={form.payMode} onChange={e => set('payMode', e.target.value)}
            options={[{ value: '', label: '—' }, ...PAY_MODES.map(p => ({ value: p, label: p }))]} />
        </div>

        <div style={sectionLbl}>Earnings</div>
        <div className="grid grid-cols-3 gap-3">
          <Input label="Basic (₹)" type="number" value={form.basic} onChange={e => set('basic', e.target.value)} />
          <Input label="HRA (₹)" type="number" value={form.hra} onChange={e => set('hra', e.target.value)} />
          <Input label="Other Allowance (₹)" type="number" value={form.otherAllowance} onChange={e => set('otherAllowance', e.target.value)} />
        </div>
        <LineEditor title="Additional Earnings" lines={extraE} setLines={setExtraE} />

        <div style={sectionLbl}>Deductions</div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Input label="Income Tax (₹)" type="number" value={form.incomeTax} onChange={e => set('incomeTax', e.target.value)} />
          <Input label="Provident Fund (₹)" type="number" value={form.providentFund} onChange={e => set('providentFund', e.target.value)} />
          <Input label="Professional Tax (₹)" type="number" value={form.professionalTax} onChange={e => set('professionalTax', e.target.value)} />
          <Input label="Other Deduction (₹)" type="number" value={form.otherDeduction} onChange={e => set('otherDeduction', e.target.value)} />
        </div>
        <LineEditor title="Additional Deductions" lines={extraD} setLines={setExtraD} />

        <div className="grid grid-cols-2 gap-3">
          <Input label="Pay Date" type="date" value={form.paidOn} onChange={e => set('paidOn', e.target.value)} />
          <Input label="Note (printed on slip)" value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>

        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 12, padding: '11px 14px', display: 'flex', gap: 22, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>GROSS</div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--success-ink)' }}>{inr(gross)}</div></div>
          <div><div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>DEDUCTIONS</div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--danger-ink)' }}>{inr(ded)}</div></div>
          <div><div style={{ fontSize: 10.5, color: 'var(--text-3)', fontWeight: 700 }}>NET PAYABLE</div><div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)' }}>{inr(gross - ded)}</div></div>
        </div>
      </div>
      <ToastContainer />
    </Modal>
  );
}

// ─── Payslip preview + download ───────────────────────────────
export function PayslipViewModal({ cid, slip, onClose }: any) {
  const [src, setSrc] = useState('');
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const blobRef = useRef('');
  const viewUrl = payrollApi.viewUrl(cid, slip.payslipId);
  const filename = `Payslip_${slip.empCode}_${slip.year}-${String(slip.month).padStart(2, '0')}.pdf`;

  useEffect(() => {
    setLoading(true);
    fetch(viewUrl, { headers: { Authorization: `Bearer ${tok()}` } })
      .then(r => r.text())
      .then(html => {
        if (blobRef.current) URL.revokeObjectURL(blobRef.current);
        blobRef.current = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
        setSrc(blobRef.current);
      })
      .catch(() => setSrc(''))
      .finally(() => setLoading(false));
    return () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); };
  }, [viewUrl]);

  const download = async () => {
    setDownloading(true);
    try {
      const r = await fetch(payrollApi.pdfUrl(cid, slip.payslipId), { headers: { Authorization: `Bearer ${tok()}` } });
      const blob = await r.blob();
      if (blob.type === 'application/pdf') {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
        URL.revokeObjectURL(a.href);
      } else {
        // Server fell back to HTML (no headless Chrome) — open it for printing
        window.open(URL.createObjectURL(new Blob([await blob.text()], { type: 'text/html' })), '_blank');
      }
    } catch { if (src) window.open(src, '_blank'); }
    finally { setDownloading(false); }
  };

  const print = () => {
    if (!src) return;
    const w = window.open(src, '_blank');
    if (w) w.onload = () => w.print();
  };

  return (
    <Modal open onClose={onClose} size="xl" title={`Payslip · ${slip.employeeName} · ${MONTHS[slip.month - 1]} ${slip.year}`}
      footer={<>
        <div style={{ marginRight: 'auto', fontSize: 12.5, color: 'var(--text-2)' }}>Net payable <b style={{ color: 'var(--text)' }}>{inr(slip.netPayable)}</b></div>
        <Btn variant="secondary" size="sm" onClick={print} disabled={!src}>Print</Btn>
        <Btn variant="primary" size="sm" loading={downloading} onClick={download}>Download PDF</Btn>
      </>}>
      <div style={{ height: '68vh', background: 'var(--surface-2)', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-2)', fontSize: 13 }}>Loading payslip…</div>
        ) : src ? (
          <iframe src={src} style={{ width: '100%', height: '100%', border: 'none', background: '#fff' }} title="Payslip preview" />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-2)', fontSize: 13 }}>Preview unavailable.</div>
        )}
      </div>
    </Modal>
  );
}
