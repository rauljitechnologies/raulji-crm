// backend/controllers/payrollController.js
const prisma    = require('../lib/prisma');
const payslipSvc = require('../services/payslipService');

const round2 = (n) => Math.round((+n || 0) * 100) / 100;
const num    = (v, fallback = 0) => (v === undefined || v === null || v === '' ? fallback : (isNaN(+v) ? fallback : +v));
const str    = (v) => (v === undefined || v === null || String(v).trim() === '' ? null : String(v).trim());

const EMP_STATUS     = ['ACTIVE', 'INACTIVE'];
const PAYSLIP_STATUS = ['DRAFT', 'PUBLISHED', 'PAID'];
const PAY_MODES      = ['BANK', 'CASH', 'UPI', 'CHEQUE'];

// Default paid days for a month = weekdays (Mon–Fri). April 2026 → 22.
function weekdaysInMonth(year, month /* 1-12 */) {
  const days = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    if (dow !== 0 && dow !== 6) count++;
  }
  return count;
}

// Normalise a [{label, amount}] list coming from the client.
function cleanLines(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(l => ({ label: str(l?.label), amount: round2(num(l?.amount)) }))
    .filter(l => l.label && l.amount !== 0);
}
const sumLines = (lines) => lines.reduce((a, l) => a + l.amount, 0);

// ── Salary computation ────────────────────────────────────────
// Earnings are prorated by paidDays / workingDays. Deductions are fixed
// monthly amounts (statutory PT / TDS do not prorate), except PF when the
// employee is configured with a percentage — that follows the prorated basic.
function computeSlip(emp, { workingDays, paidDays, extraEarnings = [], extraDeductions = [] }) {
  const factor = workingDays > 0 ? Math.min(paidDays / workingDays, 1) : 1;

  const basic          = round2(emp.basic * factor);
  const hra            = round2(emp.hra * factor);
  const otherAllowance = round2(emp.otherAllowance * factor);
  const grossEarnings  = round2(basic + hra + otherAllowance + sumLines(extraEarnings));

  const providentFund = emp.pfPercent != null
    ? round2(basic * emp.pfPercent / 100)
    : round2(emp.providentFund);

  const incomeTax       = round2(emp.incomeTax);
  const professionalTax = round2(emp.professionalTax);
  const otherDeduction  = round2(emp.otherDeduction);
  const totalDeductions = round2(incomeTax + providentFund + professionalTax + otherDeduction + sumLines(extraDeductions));

  return {
    basic, hra, otherAllowance, extraEarnings, grossEarnings,
    incomeTax, providentFund, professionalTax, otherDeduction, extraDeductions,
    totalDeductions,
    netPayable: round2(grossEarnings - totalDeductions),
  };
}

// Recompute the derived totals from whatever amounts a slip currently holds.
// Used when an admin hand-edits individual figures on a generated slip.
function recomputeTotals(s) {
  const extraEarnings   = cleanLines(s.extraEarnings);
  const extraDeductions = cleanLines(s.extraDeductions);
  const grossEarnings   = round2(num(s.basic) + num(s.hra) + num(s.otherAllowance) + sumLines(extraEarnings));
  const totalDeductions = round2(num(s.incomeTax) + num(s.providentFund) + num(s.professionalTax) + num(s.otherDeduction) + sumLines(extraDeductions));
  return { grossEarnings, totalDeductions, netPayable: round2(grossEarnings - totalDeductions) };
}

// ── EMPLOYEES ─────────────────────────────────────────────────
exports.listEmployees = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, q } = req.query;
    const where = { companyId };
    if (status && EMP_STATUS.includes(String(status).toUpperCase())) where.status = String(status).toUpperCase();
    if (q) {
      where.OR = [
        { name:        { contains: String(q), mode: 'insensitive' } },
        { empCode:     { contains: String(q), mode: 'insensitive' } },
        { designation: { contains: String(q), mode: 'insensitive' } },
        { email:       { contains: String(q), mode: 'insensitive' } },
      ];
    }
    const employees = await prisma.employee.findMany({ where, orderBy: { empCode: 'asc' } });
    const active = employees.filter(e => e.status === 'ACTIVE');
    return res.json({
      success: true,
      data: {
        employees,
        stats: {
          total:        employees.length,
          active:       active.length,
          inactive:     employees.length - active.length,
          monthlyGross: round2(active.reduce((a, e) => a + e.basic + e.hra + e.otherAllowance, 0)),
        },
      },
    });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// Next employee code in this company's series, e.g. INC-009 → INC-010.
exports.nextEmpCode = async (req, res) => {
  try {
    const { companyId } = req.params;
    const prefix = str(req.query.prefix) || 'EMP';
    const rows = await prisma.employee.findMany({ where: { companyId }, select: { empCode: true } });
    const esc = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re  = new RegExp(`^${esc}-(\\d+)$`, 'i');
    let max = 0, width = 3;
    rows.forEach(r => {
      const m = re.exec(r.empCode || '');
      if (m) { max = Math.max(max, parseInt(m[1], 10)); width = Math.max(width, m[1].length); }
    });
    return res.json({ success: true, data: { empCode: `${prefix}-${String(max + 1).padStart(width, '0')}` } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

function employeePayload(b) {
  const data = {};
  const setStr = (k) => { if (b[k] !== undefined) data[k] = str(b[k]); };
  const setNum = (k) => { if (b[k] !== undefined) data[k] = round2(num(b[k])); };

  if (b.name !== undefined) data.name = str(b.name);
  ['designation', 'department', 'email', 'phone', 'panNo', 'uanNo', 'bankName', 'accountNumber', 'ifsc', 'notes'].forEach(setStr);
  ['basic', 'hra', 'otherAllowance', 'incomeTax', 'providentFund', 'professionalTax', 'otherDeduction'].forEach(setNum);

  if (b.empCode !== undefined) data.empCode = str(b.empCode);
  if (b.gender  !== undefined) data.gender  = str(b.gender);
  if (b.pfPercent !== undefined) data.pfPercent = (b.pfPercent === '' || b.pfPercent === null) ? null : round2(num(b.pfPercent));
  if (b.dateOfJoining !== undefined) data.dateOfJoining = b.dateOfJoining ? new Date(b.dateOfJoining) : null;
  if (b.dateOfLeaving !== undefined) data.dateOfLeaving = b.dateOfLeaving ? new Date(b.dateOfLeaving) : null;
  if (b.status !== undefined) { const s = String(b.status).toUpperCase(); data.status = EMP_STATUS.includes(s) ? s : 'ACTIVE'; }
  return data;
}

exports.createEmployee = async (req, res) => {
  try {
    const { companyId } = req.params;
    const data = employeePayload(req.body);
    if (!data.name)    return res.status(400).json({ success: false, error: { message: 'Employee name is required.' } });
    if (!data.empCode) return res.status(400).json({ success: false, error: { message: 'Employee ID is required.' } });

    const dupe = await prisma.employee.findFirst({ where: { companyId, empCode: data.empCode } });
    if (dupe) return dupeCodeError(res, data.empCode);

    const emp = await prisma.employee.create({ data: { ...data, companyId } });
    return res.status(201).json({ success: true, data: emp });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

const dupeCodeError = (res, code) =>
  res.status(409).json({ success: false, error: { message: `Employee ID "${code}" is already used in this company.` } });

exports.updateEmployee = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const data = employeePayload(req.body);
    if (data.name    === null) return res.status(400).json({ success: false, error: { message: 'Employee name cannot be blank.' } });
    if (data.empCode === null) return res.status(400).json({ success: false, error: { message: 'Employee ID cannot be blank.' } });

    if (data.empCode) {
      const dupe = await prisma.employee.findFirst({ where: { companyId, empCode: data.empCode, NOT: { employeeId: id } } });
      if (dupe) return dupeCodeError(res, data.empCode);
    }
    const result = await prisma.employee.updateMany({ where: { employeeId: id, companyId }, data });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Employee not found.' } });
    return res.json({ success: true, message: 'Employee updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const emp = await prisma.employee.findFirst({ where: { employeeId: id, companyId }, select: { employeeId: true } });
    if (!emp) return res.status(404).json({ success: false, error: { message: 'Employee not found.' } });

    // Payslips are financial records — never silently destroy them. Deactivate instead.
    const slips = await prisma.payslip.count({ where: { employeeId: id } });
    if (slips > 0) {
      await prisma.employee.update({ where: { employeeId: id }, data: { status: 'INACTIVE' } });
      return res.json({ success: true, message: `Employee has ${slips} payslip${slips !== 1 ? 's' : ''} on record and was marked Inactive instead of deleted.`, data: { deactivated: true } });
    }
    await prisma.employee.delete({ where: { employeeId: id } });
    return res.json({ success: true, message: 'Employee deleted.', data: { deactivated: false } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── PAYSLIPS ──────────────────────────────────────────────────
exports.listPayslips = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, year, employeeId, status } = req.query;
    const where = { companyId };
    if (year)  where.year  = +year;
    if (month) where.month = +month;
    if (employeeId) where.employeeId = employeeId;
    if (status && PAYSLIP_STATUS.includes(String(status).toUpperCase())) where.status = String(status).toUpperCase();

    const payslips = await prisma.payslip.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { empCode: 'asc' }],
      include: { createdByUser: { select: { userId: true, name: true } } },
    });
    return res.json({
      success: true,
      data: {
        payslips,
        totals: {
          count:      payslips.length,
          gross:      round2(payslips.reduce((a, p) => a + p.grossEarnings, 0)),
          deductions: round2(payslips.reduce((a, p) => a + p.totalDeductions, 0)),
          net:        round2(payslips.reduce((a, p) => a + p.netPayable, 0)),
        },
      },
    });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.getPayslip = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const slip = await prisma.payslip.findFirst({ where: { payslipId: id, companyId }, include: { employee: true } });
    if (!slip) return res.status(404).json({ success: false, error: { message: 'Payslip not found.' } });
    return res.json({ success: true, data: slip });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// Preview what a month would generate — no writes. Lets the admin see the
// figures (and which employees already have a slip) before committing.
exports.previewPayslips = async (req, res) => {
  try {
    const { companyId } = req.params;
    const month = +req.query.month, year = +req.query.year;
    if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100))
      return res.status(400).json({ success: false, error: { message: 'A valid month (1-12) and year are required.' } });

    const workingDays = num(req.query.workingDays) || weekdaysInMonth(year, month);
    const [employees, existing] = await Promise.all([
      prisma.employee.findMany({ where: { companyId, status: 'ACTIVE' }, orderBy: { empCode: 'asc' } }),
      prisma.payslip.findMany({ where: { companyId, month, year }, select: { employeeId: true, payslipId: true } }),
    ]);
    const done = new Map(existing.map(p => [p.employeeId, p.payslipId]));
    const periodEnd = new Date(year, month, 0, 23, 59, 59);

    const rows = employees.map(e => ({
      employeeId: e.employeeId, empCode: e.empCode, name: e.name, designation: e.designation,
      // Someone who joins after the period ends, or left before it began, is not payable
      notEmployed: !!(e.dateOfJoining && new Date(e.dateOfJoining) > periodEnd)
                || !!(e.dateOfLeaving && new Date(e.dateOfLeaving) < new Date(year, month - 1, 1)),
      existingPayslipId: done.get(e.employeeId) || null,
      pfPercent: e.pfPercent,          // lets the client mirror PF proration live
      workingDays, paidDays: workingDays,
      ...computeSlip(e, { workingDays, paidDays: workingDays }),
    }));
    return res.json({ success: true, data: { month, year, workingDays, rows } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// Auto-generate slips for a month. Body:
//   { month, year, workingDays?, paidOn?, payMode?, employeeIds?: [],
//     paidDaysByEmployee?: {id: days}, overwrite?: bool }
exports.generatePayslips = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, year, employeeIds, paidDaysByEmployee = {}, overwrite, paidOn, payMode } = req.body;
    if (!(+month >= 1 && +month <= 12) || !(+year >= 2000 && +year <= 2100))
      return res.status(400).json({ success: false, error: { message: 'A valid month (1-12) and year are required.' } });

    // Pay date is optional, but a supplied one must be a real date
    let payDate;
    if (paidOn) {
      payDate = new Date(paidOn);
      if (isNaN(payDate.getTime())) return res.status(400).json({ success: false, error: { message: 'Pay date is not a valid date.' } });
    }
    const mode = payMode ? String(payMode).toUpperCase() : null;
    if (mode && !PAY_MODES.includes(mode))
      return res.status(400).json({ success: false, error: { message: `payMode must be one of ${PAY_MODES.join(', ')}.` } });

    const m = +month, y = +year;
    const defaultWorkingDays = num(req.body.workingDays) || weekdaysInMonth(y, m);

    const where = { companyId, status: 'ACTIVE' };
    if (Array.isArray(employeeIds) && employeeIds.length) where.employeeId = { in: employeeIds };
    const employees = await prisma.employee.findMany({ where, orderBy: { empCode: 'asc' } });
    if (!employees.length) return res.status(400).json({ success: false, error: { message: 'No active employees selected.' } });

    const existing = await prisma.payslip.findMany({
      where: { companyId, month: m, year: y, employeeId: { in: employees.map(e => e.employeeId) } },
      select: { payslipId: true, employeeId: true, status: true },
    });
    const byEmployee = new Map(existing.map(p => [p.employeeId, p]));

    const created = [], updated = [], skipped = [];
    for (const e of employees) {
      const prior = byEmployee.get(e.employeeId);
      if (prior && !overwrite) { skipped.push({ empCode: e.empCode, name: e.name, reason: 'Payslip already exists' }); continue; }
      if (prior && prior.status === 'PAID') { skipped.push({ empCode: e.empCode, name: e.name, reason: 'Already marked Paid' }); continue; }

      const workingDays = defaultWorkingDays;
      const paidDays    = Math.min(num(paidDaysByEmployee[e.employeeId], workingDays), workingDays);
      const amounts     = computeSlip(e, { workingDays, paidDays });
      const data = {
        companyId, employeeId: e.employeeId, month: m, year: y,
        empCode: e.empCode, employeeName: e.name, designation: e.designation,
        gender: e.gender, panNo: e.panNo, dateOfJoining: e.dateOfJoining,
        workingDays, paidDays, ...amounts,
        createdByUserId: req.user?.userId || null,
      };
      // Only touch the pay date when one was supplied, so regenerating a slip
      // without picking a date keeps the date it already carries.
      if (payDate) data.paidOn = payDate;
      if (mode)    data.payMode = mode;
      if (prior) {
        await prisma.payslip.update({ where: { payslipId: prior.payslipId }, data });
        updated.push({ empCode: e.empCode, name: e.name });
      } else {
        await prisma.payslip.create({ data });
        created.push({ empCode: e.empCode, name: e.name });
      }
    }

    return res.status(201).json({
      success: true,
      message: `${created.length} generated, ${updated.length} regenerated, ${skipped.length} skipped.`,
      data: { created, updated, skipped, month: m, year: y, workingDays: defaultWorkingDays, paidOn: payDate || null },
    });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.updatePayslip = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const slip = await prisma.payslip.findFirst({ where: { payslipId: id, companyId } });
    if (!slip) return res.status(404).json({ success: false, error: { message: 'Payslip not found.' } });

    const b = req.body;
    const data = {};
    ['basic', 'hra', 'otherAllowance', 'incomeTax', 'providentFund', 'professionalTax', 'otherDeduction', 'workingDays', 'paidDays']
      .forEach(k => { if (b[k] !== undefined) data[k] = round2(num(b[k])); });
    if (b.extraEarnings   !== undefined) data.extraEarnings   = cleanLines(b.extraEarnings);
    if (b.extraDeductions !== undefined) data.extraDeductions = cleanLines(b.extraDeductions);
    if (b.notes  !== undefined) data.notes  = str(b.notes);
    if (b.paidOn !== undefined) data.paidOn = b.paidOn ? new Date(b.paidOn) : null;
    if (b.payMode !== undefined) { const p = String(b.payMode || '').toUpperCase(); data.payMode = PAY_MODES.includes(p) ? p : null; }
    if (b.status !== undefined) {
      const s = String(b.status).toUpperCase();
      if (!PAYSLIP_STATUS.includes(s)) return res.status(400).json({ success: false, error: { message: `status must be one of ${PAYSLIP_STATUS.join(', ')}.` } });
      data.status = s;
      if (s === 'PAID' && !data.paidOn && !slip.paidOn) data.paidOn = new Date();
    }

    // Totals are always derived — never trusted from the client.
    Object.assign(data, recomputeTotals({ ...slip, ...data }));

    const out = await prisma.payslip.update({ where: { payslipId: id }, data });
    return res.json({ success: true, message: 'Payslip updated.', data: out });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deletePayslip = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const result = await prisma.payslip.deleteMany({ where: { payslipId: id, companyId } });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Payslip not found.' } });
    return res.json({ success: true, message: 'Payslip deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── PAYSLIP DOCUMENT ──────────────────────────────────────────
exports.viewPayslip = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const slip = await prisma.payslip.findFirst({ where: { payslipId: id, companyId }, select: { payslipId: true } });
    if (!slip) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const html = await payslipSvc.buildPayslipHtml(id);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.getPayslipPdf = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const slip = await prisma.payslip.findFirst({ where: { payslipId: id, companyId }, select: { empCode: true, month: true, year: true } });
    if (!slip) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const filename = `Payslip_${slip.empCode}_${slip.year}-${String(slip.month).padStart(2, '0')}.pdf`;
    const result = await payslipSvc.generatePayslipPdf(id);
    if (result.buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(result.buffer);
    }
    res.setHeader('Content-Type', 'text/html');
    return res.send(result.html + '<script>window.onload=()=>window.print();</script>');
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports._internals = { weekdaysInMonth, computeSlip, recomputeTotals };
