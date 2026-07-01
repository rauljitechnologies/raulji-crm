// backend/controllers/financeController.js
const prisma = require('../lib/prisma');

const VALID_TYPES = ['OWNER_FUNDS', 'EQUITY', 'LOAN', 'OTHER'];

// ── INVESTMENTS CRUD ──────────────────────────────────────────
exports.listInvestments = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { year } = req.query;
    const where = { companyId };
    if (year) where.date = { gte: new Date(+year, 0, 1), lte: new Date(+year, 11, 31, 23, 59, 59) };
    const investments = await prisma.investment.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { createdByUser: { select: { userId: true, name: true } } },
    });
    const total = investments.reduce((a, i) => a + i.amount, 0);
    return res.json({ success: true, data: { investments, total } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.createInvestment = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { date, amount, source, type, notes } = req.body;
    if (!date || !amount || !source) return res.status(400).json({ success: false, error: { message: 'date, amount and source are required.' } });
    if (+amount <= 0) return res.status(400).json({ success: false, error: { message: 'amount must be greater than 0.' } });
    const t = (type || 'OWNER_FUNDS').toUpperCase();
    const inv = await prisma.investment.create({
      data: {
        companyId,
        date: new Date(date),
        amount: +amount,
        source: String(source).trim(),
        type: VALID_TYPES.includes(t) ? t : 'OWNER_FUNDS',
        notes: notes ? String(notes).trim() : null,
        createdByUserId: req.user?.userId || null,
      },
    });
    return res.status(201).json({ success: true, data: inv });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.updateInvestment = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const data = {};
    if (b.date   !== undefined) data.date   = new Date(b.date);
    if (b.amount !== undefined) data.amount = +b.amount;
    if (b.source !== undefined) data.source = String(b.source).trim();
    if (b.type   !== undefined) { const t = String(b.type).toUpperCase(); data.type = VALID_TYPES.includes(t) ? t : 'OWNER_FUNDS'; }
    if (b.notes  !== undefined) data.notes  = b.notes ? String(b.notes).trim() : null;
    const result = await prisma.investment.updateMany({ where: { investmentId: id, companyId }, data });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Investment not found.' } });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteInvestment = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const result = await prisma.investment.deleteMany({ where: { investmentId: id, companyId } });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Investment not found.' } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── FINANCE OVERVIEW ──────────────────────────────────────────
// Combines: Earnings (money actually received on invoices), Expenses (non-cancelled),
// and Investment (direct capital) — for the selected year — with a monthly series.
exports.getOverview = async (req, res) => {
  try {
    const { companyId } = req.params;
    const year = +req.query.year || new Date().getFullYear();
    const from = new Date(year, 0, 1);
    const to   = new Date(year, 11, 31, 23, 59, 59);

    const [paidInvoices, expenses, investments] = await Promise.all([
      // Earnings = money received. Bucket by when it was received (paidAt), fall back
      // to updatedAt/invoiceDate. Only invoices with a paidAmount matter.
      prisma.invoice.findMany({
        where: { companyId, status: { in: ['PAID', 'PARTIAL'] }, paidAmount: { not: null } },
        select: { paidAmount: true, paidAt: true, updatedAt: true, invoiceDate: true, subtotal: true, totalGst: true, grandTotal: true, tdsAmount: true },
      }),
      prisma.expense.findMany({
        where: { companyId, status: { not: 'CANCELLED' }, date: { gte: from, lte: to } },
        select: { amount: true, date: true, category: true, gstAmount: true },
      }),
      prisma.investment.findMany({
        where: { companyId, date: { gte: from, lte: to } },
        select: { amount: true, date: true, type: true },
      }),
    ]);

    const months = Array.from({ length: 12 }, () => ({ earnings: 0, expenses: 0, investment: 0 }));
    const inYear = (d) => d && new Date(d).getFullYear() === year;

    let earnings = 0;
    // Tax breakdown on the invoices whose payments landed this year
    const tax = { grossInvoiced: 0, taxableValue: 0, gstCollected: 0, tdsDeducted: 0, netReceived: 0, gstInput: 0, netGstPayable: 0 };
    paidInvoices.forEach(inv => {
      const when = inv.paidAt || inv.updatedAt || inv.invoiceDate;
      if (!inYear(when)) return;
      const amt = inv.paidAmount || 0;
      earnings += amt;
      months[new Date(when).getMonth()].earnings += amt;
      tax.grossInvoiced += inv.grandTotal || 0;
      tax.taxableValue  += inv.subtotal   || 0;
      tax.gstCollected  += inv.totalGst   || 0;
      tax.tdsDeducted   += inv.tdsAmount  || 0;
      tax.netReceived   += amt;
    });

    let expenseTotal = 0;
    const byCategory = {};
    expenses.forEach(e => {
      expenseTotal += e.amount;
      tax.gstInput += e.gstAmount || 0;
      months[new Date(e.date).getMonth()].expenses += e.amount;
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
    });
    tax.netGstPayable = tax.gstCollected - tax.gstInput;

    let investmentTotal = 0;
    const byType = {};
    investments.forEach(i => {
      investmentTotal += i.amount;
      months[new Date(i.date).getMonth()].investment += i.amount;
      byType[i.type] = (byType[i.type] || 0) + i.amount;
    });

    return res.json({
      success: true,
      data: {
        year,
        earnings,
        expenses: expenseTotal,
        investment: investmentTotal,
        netProfit: earnings - expenseTotal,               // operating profit/loss
        cashPosition: earnings + investmentTotal - expenseTotal, // capital + earnings - spend
        tax,
        months,
        byCategory,
        byType,
      },
    });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
