'use client';
import { useCallback, useEffect, useState } from 'react';
import { companyApi, payrollApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, useToast, Empty } from '@/components/ui';
import {
  MONTHS, inr, inrShort, dateStr, th, td, Stat, StatusPill,
  EmployeeModal, GenerateModal, PayslipEditModal, PayslipViewModal,
} from './ui';

const YEARS = Array.from({ length: 7 }, (_, i) => String(new Date().getFullYear() - 3 + i));

const selectStyle: React.CSSProperties = {
  padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--text)', fontFamily: 'inherit',
};

export default function PayrollPage() {
  const { toast, ToastContainer } = useToast();
  const [companies, setCompanies] = useState<any[]>([]);
  const [cid, setCid] = useState('');
  const [tab, setTab] = useState<'employees' | 'payslips'>('employees');

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const [employees, setEmployees] = useState<any[]>([]);
  const [empStats, setEmpStats] = useState<any>({});
  const [payslips, setPayslips] = useState<any[]>([]);
  const [totals, setTotals] = useState<any>({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);
  const [denied, setDenied] = useState(false);

  const [showEmp, setShowEmp] = useState(false);
  const [editEmp, setEditEmp] = useState<any>(null);
  const [showGen, setShowGen] = useState(false);
  const [editSlip, setEditSlip] = useState<any>(null);
  const [viewSlip, setViewSlip] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const list: any = await companyApi.mine();
        const arr = list?.companies || [];
        setCompanies(arr);
        const stored = typeof window !== 'undefined' ? localStorage.getItem('selectedCompanyId') : null;
        if (stored && arr.find((c: any) => c.companyId === stored)) setCid(stored);
        else if (arr.length) setCid(arr[0].companyId);
      } catch { /* company list is best-effort */ }
    })();
  }, []);

  useEffect(() => { if (cid) localStorage.setItem('selectedCompanyId', cid); }, [cid]);

  const load = useCallback(async () => {
    if (!cid) return;
    setLoading(true);
    setDenied(false);
    try {
      const [emp, slips] = await Promise.all([
        payrollApi.listEmployees(cid, q ? { q } : {}),
        payrollApi.listPayslips(cid, { month: String(month), year: String(year) }),
      ]);
      setEmployees(emp?.employees || []);
      setEmpStats(emp?.stats || {});
      setPayslips(slips?.payslips || []);
      setTotals(slips?.totals || {});
    } catch (e: any) {
      if (/permission|denied|403/i.test(e.message)) setDenied(true);
      else toast(e.message, 'err');
    } finally { setLoading(false); }
  }, [cid, month, year, q]);

  useEffect(() => {
    const id = setTimeout(load, q ? 300 : 0);   // debounce only while typing a search
    return () => clearTimeout(id);
  }, [load, q]);

  const removeEmployee = async (e: any) => {
    if (!confirm(`Remove ${e.name} (${e.empCode})?\n\nIf payslips exist they are kept and the employee is marked Inactive instead.`)) return;
    try { const r: any = await payrollApi.removeEmployee(cid, e.employeeId); toast(r?.deactivated ? 'Employee marked Inactive (payslips on record).' : 'Employee deleted.'); load(); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  const removeSlip = async (s: any) => {
    if (!confirm(`Delete the ${MONTHS[s.month - 1]} ${s.year} payslip for ${s.employeeName}?`)) return;
    try { await payrollApi.removePayslip(cid, s.payslipId); toast('Payslip deleted.'); load(); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  const setSlipStatus = async (s: any, status: string) => {
    try { await payrollApi.updatePayslip(cid, s.payslipId, { status }); toast(`Marked ${status.toLowerCase()}.`); load(); }
    catch (err: any) { toast(err.message, 'err'); }
  };

  const companyName = companies.find(c => c.companyId === cid)?.name || '';
  const period = `${MONTHS[month - 1]} ${year}`;

  return (
    <div className="flex flex-col h-screen" style={{ background: 'var(--bg)' }}>
      <Topbar
        title="Payroll"
        subtitle={companyName ? `Employees & salary slips for ${companyName}` : 'Employees & salary slips'}
        actions={
          <div className="flex items-center gap-2">
            {companies.length > 1 && (
              <select value={cid} onChange={e => setCid(e.target.value)} style={selectStyle} aria-label="Company">
                {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
              </select>
            )}
            <select value={month} onChange={e => setMonth(+e.target.value)} style={selectStyle} aria-label="Month">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(+e.target.value)} style={selectStyle} aria-label="Year">
              {YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            {tab === 'employees'
              ? <Btn variant="primary" size="sm" onClick={() => { setEditEmp(null); setShowEmp(true); }}>+ Add Employee</Btn>
              : <Btn variant="primary" size="sm" onClick={() => setShowGen(true)}>Generate Payslips</Btn>}
          </div>
        }
      />

      {/* Tabs */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px' }}>
        <div style={{ display: 'flex' }}>
          {([['employees', `Employees${empStats.total ? ` (${empStats.total})` : ''}`], ['payslips', `Payslips · ${period}`]] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t as any)}
              style={{
                padding: '12px 20px', fontSize: 13, fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer',
                borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
                color: tab === t ? 'var(--primary)' : 'var(--text-2)', fontFamily: 'inherit',
              }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6">
        {denied ? (
          <Card><Empty icon="🔒" title="No access to Payroll" desc="Ask an admin to enable the Payroll permission for your account." /></Card>
        ) : loading && !employees.length && !payslips.length ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-2)', fontSize: 13 }}>Loading payroll…</div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* ── EMPLOYEES ── */}
            {tab === 'employees' && (<>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Employees" value={String(empStats.total ?? 0)} sub={`${empStats.active ?? 0} active · ${empStats.inactive ?? 0} inactive`} />
                <Stat label="Active" value={String(empStats.active ?? 0)} color="var(--success-ink)" sub="On the payroll" />
                <Stat label="Monthly Gross" value={inrShort(empStats.monthlyGross ?? 0)} color="var(--primary)" sub="Active employees, full month" />
                <Stat label="Annual Gross" value={inrShort((empStats.monthlyGross ?? 0) * 12)} sub="Monthly gross × 12" />
              </div>

              <Card className="p-0 overflow-hidden">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Employee Directory</div>
                  <div style={{ width: 240 }}>
                    <Input value={q} placeholder="Search name, ID, designation…" onChange={e => setQ(e.target.value)} />
                  </div>
                </div>
                {!employees.length ? (
                  <Empty icon="👥" title={q ? 'No matching employees' : 'No employees yet'}
                    desc={q ? 'Try a different search.' : 'Add your team to start generating salary slips.'}
                    action={!q ? <Btn variant="primary" size="sm" onClick={() => { setEditEmp(null); setShowEmp(true); }}>+ Add Employee</Btn> : undefined} />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Employee ID', 'Name', 'Designation', 'Joined', 'PAN', 'Gross', 'Deductions', 'Net', 'Status', ''].map((h, i) => (
                            <th key={h + i} style={{ ...th, textAlign: ['Gross', 'Deductions', 'Net'].includes(h) ? 'right' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {employees.map((e: any) => {
                          const gross = e.basic + e.hra + e.otherAllowance;
                          const pf = e.pfPercent != null ? (e.basic * e.pfPercent) / 100 : e.providentFund;
                          const ded = e.incomeTax + pf + e.professionalTax + e.otherDeduction;
                          return (
                            <tr key={e.employeeId} style={{ borderTop: '1px solid var(--border)' }}>
                              <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{e.empCode}</td>
                              <td style={td}>
                                <div style={{ fontWeight: 600 }}>{e.name}</div>
                                {e.email && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.email}</div>}
                              </td>
                              <td style={{ ...td, color: 'var(--text-2)' }}>{e.designation || '—'}</td>
                              <td style={{ ...td, color: 'var(--text-2)' }}>{dateStr(e.dateOfJoining)}</td>
                              <td style={{ ...td, fontFamily: 'monospace', color: 'var(--text-2)' }}>{e.panNo || '—'}</td>
                              <td style={{ ...td, textAlign: 'right' }}>{inr(gross)}</td>
                              <td style={{ ...td, textAlign: 'right', color: 'var(--danger-ink)' }}>{inr(ded)}</td>
                              <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(gross - ded)}</td>
                              <td style={td}><StatusPill s={e.status} /></td>
                              <td style={td}>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <Btn size="sm" variant="ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => { setEditEmp(e); setShowEmp(true); }}>Edit</Btn>
                                  <Btn size="sm" variant="danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => removeEmployee(e)}>Remove</Btn>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </>)}

            {/* ── PAYSLIPS ── */}
            {tab === 'payslips' && (<>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="Payslips" value={String(totals.count ?? 0)} sub={period} />
                <Stat label="Gross Earnings" value={inrShort(totals.gross ?? 0)} color="var(--success-ink)" sub="Before deductions" />
                <Stat label="Deductions" value={inrShort(totals.deductions ?? 0)} color="var(--danger-ink)" sub="Tax, PF, PT & other" />
                <Stat label="Net Payable" value={inrShort(totals.net ?? 0)} color="var(--primary)" sub="Take-home total" />
              </div>

              <Card className="p-0 overflow-hidden">
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Salary Slips · {period}</div>
                  <Btn variant="secondary" size="sm" onClick={() => setShowGen(true)}>Generate</Btn>
                </div>
                {!payslips.length ? (
                  <Empty icon="🧾" title={`No payslips for ${period}`}
                    desc="Pick a month and generate slips for every active employee in one go."
                    action={<Btn variant="primary" size="sm" onClick={() => setShowGen(true)}>Generate Payslips</Btn>} />
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--surface-2)' }}>
                          {['Employee ID', 'Name', 'Designation', 'Pay Date', 'Paid Days', 'Gross', 'Deductions', 'Net Payable', 'Status', ''].map((h, i) => (
                            <th key={h + i} style={{ ...th, textAlign: ['Gross', 'Deductions', 'Net Payable'].includes(h) ? 'right' : h === 'Paid Days' ? 'center' : 'left' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {payslips.map((s: any) => (
                          <tr key={s.payslipId} style={{ borderTop: '1px solid var(--border)' }}>
                            <td style={{ ...td, fontFamily: 'monospace', fontWeight: 600 }}>{s.empCode}</td>
                            <td style={{ ...td, fontWeight: 600 }}>{s.employeeName}</td>
                            <td style={{ ...td, color: 'var(--text-2)' }}>{s.designation || '—'}</td>
                            <td style={{ ...td, color: 'var(--text-2)' }}>{dateStr(s.paidOn)}</td>
                            <td style={{ ...td, textAlign: 'center', color: 'var(--text-2)' }}>{s.paidDays} / {s.workingDays}</td>
                            <td style={{ ...td, textAlign: 'right' }}>{inr(s.grossEarnings)}</td>
                            <td style={{ ...td, textAlign: 'right', color: 'var(--danger-ink)' }}>{inr(s.totalDeductions)}</td>
                            <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(s.netPayable)}</td>
                            <td style={td}><StatusPill s={s.status} /></td>
                            <td style={td}>
                              <div style={{ display: 'flex', gap: 6 }}>
                                <Btn size="sm" variant="secondary" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setViewSlip(s)}>View</Btn>
                                <Btn size="sm" variant="ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setEditSlip(s)}>Edit</Btn>
                                {s.status !== 'PAID' && (
                                  <Btn size="sm" variant="ghost" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => setSlipStatus(s, 'PAID')}>Mark Paid</Btn>
                                )}
                                <Btn size="sm" variant="danger" style={{ padding: '3px 8px', fontSize: 11 }} onClick={() => removeSlip(s)}>Delete</Btn>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr style={{ background: 'var(--surface-2)', borderTop: '1px solid var(--border-strong)' }}>
                          <td colSpan={5} style={{ ...td, fontWeight: 700 }}>Total · {payslips.length} slip{payslips.length !== 1 ? 's' : ''}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700 }}>{inr(totals.gross ?? 0)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: 'var(--danger-ink)' }}>{inr(totals.deductions ?? 0)}</td>
                          <td style={{ ...td, textAlign: 'right', fontWeight: 800 }}>{inr(totals.net ?? 0)}</td>
                          <td colSpan={2} style={td}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </Card>
            </>)}
          </div>
        )}
      </div>

      {showEmp  && <EmployeeModal cid={cid} editing={editEmp} onClose={() => setShowEmp(false)} onDone={load} />}
      {showGen  && <GenerateModal cid={cid} month={month} year={year} onClose={() => setShowGen(false)}
                     onDone={(m: number, y: number) => { setMonth(m); setYear(y); setTab('payslips'); load(); }} />}
      {editSlip && <PayslipEditModal cid={cid} slip={editSlip} onClose={() => setEditSlip(null)} onDone={load} />}
      {viewSlip && <PayslipViewModal cid={cid} slip={viewSlip} onClose={() => setViewSlip(null)} />}
      <ToastContainer />
    </div>
  );
}
