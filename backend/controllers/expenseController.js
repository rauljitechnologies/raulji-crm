// backend/controllers/expenseController.js
const prisma = require('../lib/prisma');

// ── EXPENSES ──────────────────────────────────────────────────

exports.listExpenses = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { month, year, category, status, page = 1, limit = 100 } = req.query;

    // SUPER_ADMIN and ADMIN see all of a company's expenses; everyone else sees
    // only the entries they created OR have been assigned to by an admin.
    const userFilter = ownerScope(req);

    const where = { companyId, ...userFilter };
    if (category && category !== 'ALL') where.category = category;
    if (status   && status   !== 'ALL') where.status   = status;
    if (month && year) {
      const from = new Date(+year, +month - 1, 1);
      const to   = new Date(+year, +month, 0, 23, 59, 59);
      where.date = { gte: from, lte: to };
    } else if (year) {
      where.date = { gte: new Date(+year, 0, 1), lte: new Date(+year, 11, 31, 23, 59, 59) };
    }
    const [expenses, total] = await Promise.all([
      prisma.expense.findMany({ where, orderBy: { date: 'desc' }, skip: (+page - 1) * +limit, take: +limit, include: { bankTxn: { select: { txnId: true, description: true, date: true } }, createdByUser: { select: { userId: true, name: true } } } }),
      prisma.expense.count({ where }),
    ]);
    // Summary by category — scoped to what this user is allowed to see
    const all = await prisma.expense.findMany({ where: { companyId, status: { not: 'CANCELLED' }, ...userFilter }, select: { category: true, amount: true, gstAmount: true } });
    const byCategory = {};
    all.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    const totalAmount = all.reduce((a, e) => a + e.amount, 0);
    const totalGst    = all.reduce((a, e) => a + e.gstAmount, 0);
    return res.json({ success: true, data: { expenses, total, totalAmount, totalGst, byCategory } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.createExpense = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { date, category, description, amount, gstPercent, payMode, reference, notes, status, dueDate } = req.body;
    if (!date || !category || !description || !amount) return res.status(400).json({ success: false, error: { message: 'date, category, description, amount required.' } });
    const gstAmount = gstPercent ? Math.round(+amount * +gstPercent / 100) : 0;
    const exp = await prisma.expense.create({
      data: { companyId, date: new Date(date), category, description, amount: +amount, gstAmount, gstPercent: gstPercent ? +gstPercent : null, payMode: payMode || 'BANK', reference: reference || null, notes: notes || null, status: status || 'PAID', dueDate: dueDate ? new Date(dueDate) : null, createdByUserId: req.user?.userId || null }
    });
    return res.status(201).json({ success: true, data: exp });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// Non-admins may only mutate expenses they created OR were assigned to — the same
// scope they can see in listExpenses. Admins can mutate any of the company's.
const ownerScope = (req) => {
  const isAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
  return isAdmin ? {} : {
    OR: [
      { createdByUserId: req.user?.userId },
      { assignedUserIds: { has: req.user?.userId } },
    ],
  };
};

exports.updateExpense = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const data = {};
    if (b.date        !== undefined) data.date        = new Date(b.date);
    if (b.category    !== undefined) data.category    = b.category;
    if (b.description !== undefined) data.description = b.description;
    if (b.amount      !== undefined) data.amount      = +b.amount;
    if (b.gstPercent  !== undefined) { data.gstPercent = b.gstPercent != null ? +b.gstPercent : null; data.gstAmount = b.gstPercent ? Math.round(+b.amount * +b.gstPercent / 100) : 0; }
    if (b.payMode     !== undefined) data.payMode     = b.payMode;
    if (b.reference   !== undefined) data.reference   = b.reference;
    if (b.notes       !== undefined) data.notes       = b.notes;
    if (b.status      !== undefined) data.status      = b.status;
    if (b.dueDate     !== undefined) data.dueDate     = b.dueDate ? new Date(b.dueDate) : null;
    const result = await prisma.expense.updateMany({ where: { expenseId: id, companyId, ...ownerScope(req) }, data });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Expense not found or not permitted.' } });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteExpense = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const result = await prisma.expense.updateMany({ where: { expenseId: id, companyId, ...ownerScope(req) }, data: { status: 'CANCELLED' } });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Expense not found or not permitted.' } });
    return res.json({ success: true, message: 'Cancelled.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── BULK CSV IMPORT ───────────────────────────────────────────
// Accepts { rows: [{ date, category, description, amount, gstPercent?, payMode?,
// reference?, status?, dueDate?, notes? }] }, validates, and creates expenses
// for this company. Skips rows that duplicate an existing date+amount+description.
const VALID_CATEGORIES = ['RENT', 'SALARY', 'SOFTWARE', 'TRAVEL', 'VENDOR', 'UTILITIES', 'TAX', 'MARKETING', 'OTHER'];
const VALID_PAYMODES   = ['BANK', 'CASH', 'UPI', 'CARD', 'CHEQUE'];
const VALID_STATUSES   = ['PAID', 'PENDING', 'CANCELLED'];

exports.importExpenses = async (req, res) => {
  try {
    const { companyId } = req.params;
    const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
    if (!rows.length) return res.status(400).json({ success: false, error: { message: 'No rows to import.' } });
    if (rows.length > 2000) return res.status(400).json({ success: false, error: { message: 'Too many rows (max 2000 per import).' } });

    // Pre-load existing expenses for duplicate detection (key: date|amount|description)
    const existing = await prisma.expense.findMany({ where: { companyId }, select: { date: true, amount: true, description: true } });
    const keyOf = (d, amt, desc) => `${new Date(d).toISOString().slice(0, 10)}|${amt}|${(desc || '').trim().toLowerCase()}`;
    const existingKeys = new Set(existing.map(e => keyOf(e.date, e.amount, e.description)));

    const valid = [];
    const errors = [];
    let skipped = 0;
    const seenInBatch = new Set();

    rows.forEach((r, i) => {
      const line = i + 1;
      const date = r.date && new Date(r.date);
      const amount = Number(r.amount);
      const category = (r.category || '').toString().trim().toUpperCase();
      const description = (r.description || '').toString().trim();

      if (!r.date || isNaN(date?.getTime())) return errors.push({ line, error: 'invalid or missing date' });
      if (!category) return errors.push({ line, error: 'missing category' });
      if (!VALID_CATEGORIES.includes(category)) return errors.push({ line, error: `unknown category "${category}"` });
      if (!description) return errors.push({ line, error: 'missing description' });
      if (!r.amount || isNaN(amount) || amount <= 0) return errors.push({ line, error: 'invalid amount' });

      const payMode = (r.payMode || 'BANK').toString().trim().toUpperCase();
      if (!VALID_PAYMODES.includes(payMode)) return errors.push({ line, error: `unknown pay mode "${payMode}"` });
      const status = (r.status || 'PAID').toString().trim().toUpperCase();
      if (!VALID_STATUSES.includes(status)) return errors.push({ line, error: `unknown status "${status}"` });

      const gstPercent = r.gstPercent != null && r.gstPercent !== '' ? Number(r.gstPercent) : null;
      if (gstPercent != null && (isNaN(gstPercent) || gstPercent < 0)) return errors.push({ line, error: 'invalid GST%' });
      const gstAmount = gstPercent ? Math.round(amount * gstPercent / 100) : 0;

      const key = keyOf(date, amount, description);
      if (existingKeys.has(key) || seenInBatch.has(key)) { skipped++; return; }
      seenInBatch.add(key);

      valid.push({
        companyId, date, category, description, amount,
        gstPercent, gstAmount, payMode, status,
        reference: r.reference ? String(r.reference).trim() : null,
        notes:     r.notes     ? String(r.notes).trim()     : null,
        dueDate:   r.dueDate && !isNaN(new Date(r.dueDate).getTime()) ? new Date(r.dueDate) : null,
        createdByUserId: req.user?.userId || null,
      });
    });

    if (valid.length) await prisma.expense.createMany({ data: valid });

    return res.json({ success: true, data: { imported: valid.length, skipped, errors } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── ASSIGN EXPENSE TO USERS (admin) ───────────────────────────
// Lets an admin assign an expense entry to one or more users so it shows in
// each user's expense list. Pass userIds = [] to clear assignment.
exports.assignExpense = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    let userIds = Array.isArray(req.body.userIds)
      ? req.body.userIds
      : (req.body.userId ? [req.body.userId] : []);
    userIds = [...new Set(userIds.filter(Boolean))];

    if (userIds.length) {
      const members = await prisma.user.findMany({
        where: { userId: { in: userIds }, OR: [{ companyId }, { companies: { some: { companyId } } }] },
        select: { userId: true },
      });
      if (members.length !== userIds.length)
        return res.status(404).json({ success: false, error: { message: 'One or more users are not members of this company.' } });
    }

    const result = await prisma.expense.updateMany({
      where: { expenseId: id, companyId },
      data: { assignedUserIds: userIds },
    });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Expense not found.' } });

    return res.json({ success: true, message: userIds.length ? `Assigned to ${userIds.length} user(s).` : 'Expense unassigned.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── BANK STATEMENTS ───────────────────────────────────────────

exports.importStatement = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { bankName, accountLast4, rows } = req.body; // rows = parsed CSV array from frontend
    if (!rows || !rows.length) return res.status(400).json({ success: false, error: { message: 'No rows provided.' } });

    const from = rows.reduce((min, r) => r.date < min ? r.date : min, rows[0].date);
    const to   = rows.reduce((max, r) => r.date > max ? r.date : max, rows[0].date);

    const stmt = await prisma.bankStatement.create({
      data: {
        companyId, bankName: bankName || 'Unknown Bank',
        accountLast4: accountLast4 || null,
        fromDate: new Date(from), toDate: new Date(to), rowCount: rows.length,
        transactions: {
          create: rows.map(r => ({
            date: new Date(r.date),
            description: r.description || '',
            debit:  +(r.debit  || 0),
            credit: +(r.credit || 0),
            balance: r.balance != null ? +r.balance : null,
            type: (+r.debit || 0) > 0 ? 'DEBIT' : 'CREDIT',
            status: 'UNMATCHED',
          }))
        }
      },
      include: { transactions: true }
    });
    return res.status(201).json({ success: true, data: stmt });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.listStatements = async (req, res) => {
  try {
    const { companyId } = req.params;
    const stmts = await prisma.bankStatement.findMany({
      where: { companyId }, orderBy: { uploadedAt: 'desc' },
      include: { _count: { select: { transactions: true } } }
    });
    return res.json({ success: true, data: stmts });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.listTransactions = async (req, res) => {
  try {
    const { companyId, statementId } = req.params;
    const { status } = req.query;
    const stmt = await prisma.bankStatement.findFirst({ where: { statementId, companyId } });
    if (!stmt) return res.status(404).json({ success: false, error: { message: 'Statement not found.' } });
    const where = { statementId, ...(status && status !== 'ALL' ? { status } : {}) };
    const txns  = await prisma.bankTransaction.findMany({ where, orderBy: { date: 'desc' }, include: { expense: { select: { expenseId: true, description: true, amount: true, category: true } } } });
    return res.json({ success: true, data: txns });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── GET ALL TRANSACTIONS for a company (for reconcile view) ──
exports.listAllTransactions = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, type } = req.query;
    const where = {
      statement: { companyId },
      ...(status && status !== 'ALL' ? { status } : {}),
      ...(type   && type   !== 'ALL' ? { type   } : {}),
    };
    const txns = await prisma.bankTransaction.findMany({
      where,
      orderBy: { date: 'desc' },
      include: {
        expense:   { select: { expenseId: true, description: true, amount: true, category: true } },
        statement: { select: { bankName: true, accountLast4: true } },
      },
    });
    return res.json({ success: true, data: txns });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteStatement = async (req, res) => {
  try {
    const { companyId, statementId } = req.params;
    const stmt = await prisma.bankStatement.findFirst({ where: { statementId, companyId } });
    if (!stmt) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    await prisma.bankStatement.delete({ where: { statementId } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── RECONCILIATION ────────────────────────────────────────────

exports.reconcile = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { txnId, expenseId, action } = req.body; // action: 'match' | 'unmatch' | 'ignore'

    if (action === 'ignore') {
      await prisma.bankTransaction.updateMany({ where: { txnId, statement: { companyId } }, data: { status: 'IGNORED' } });
      return res.json({ success: true, message: 'Ignored.' });
    }
    if (action === 'unmatch') {
      const txn = await prisma.bankTransaction.findUnique({ where: { txnId } });
      if (txn?.expenseId) await prisma.bankTransaction.update({ where: { txnId }, data: { status: 'UNMATCHED', expenseId: null } });
      return res.json({ success: true, message: 'Unmatched.' });
    }
    // match
    if (!txnId || !expenseId) return res.status(400).json({ success: false, error: { message: 'txnId and expenseId required.' } });
    await prisma.bankTransaction.update({ where: { txnId }, data: { status: 'MATCHED', expenseId } });
    return res.json({ success: true, message: 'Matched.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.autoReconcile = async (req, res) => {
  try {
    const { companyId } = req.params;
    // Get all unmatched DEBIT transactions + unmatched expenses
    const [txns, expenses] = await Promise.all([
      prisma.bankTransaction.findMany({ where: { statement: { companyId }, status: 'UNMATCHED', type: 'DEBIT' }, orderBy: { date: 'asc' } }),
      prisma.expense.findMany({ where: { companyId, status: 'PAID', bankTxn: null }, orderBy: { date: 'asc' } }),
    ]);
    let matched = 0;
    for (const txn of txns) {
      const match = expenses.find(e =>
        Math.abs(e.amount - txn.debit) < 1 &&
        Math.abs(new Date(e.date).getTime() - new Date(txn.date).getTime()) <= 3 * 86400000 &&
        !e.bankTxn
      );
      if (match) {
        await prisma.bankTransaction.update({ where: { txnId: txn.txnId }, data: { status: 'MATCHED', expenseId: match.expenseId } });
        matched++;
      }
    }
    return res.json({ success: true, data: { matched } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
