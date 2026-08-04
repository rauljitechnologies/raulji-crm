// backend/controllers/invoiceController.js

const prisma = require('../lib/prisma');
const pdfSvc  = require('../services/pdfService');

const calcTotals = (items) => {
  let subtotal = 0, totalGst = 0, totalDiscount = 0;
  const processed = items.map(item => {
    const after   = item.quantity * (item.unitPrice || 0) - (item.discount || 0);
    // gstPercent === null means "No GST" — treat as 0, NOT default to 18
    const gst     = item.gstPercent != null ? Math.round(after * item.gstPercent / 100) : 0;
    subtotal      += after;
    totalGst      += gst;
    totalDiscount += (item.discount || 0);
    return { ...item, total: after + gst, gstAmount: gst };
  });
  return { items: processed, subtotal, totalGst, totalDiscount, grandTotal: subtotal + totalGst };
};

const nextInvNum = async (companyId) => {
  const [company, c] = await Promise.all([
    prisma.company.findUnique({ where: { companyId }, select: { settings: true } }),
    prisma.invoice.count({ where: { companyId } }),
  ]);
  const raw    = company?.settings?.invoicePrefix?.toUpperCase().trim() || 'INV';
  const prefix = raw.replace(/[\/\-]+$/, '');          // strip any trailing / or -
  const year   = new Date().getFullYear();
  return `${prefix}/${year}-${String(c + 1).padStart(4, '0')}`;
};

// Non-admins may only see/mutate invoices they created OR were assigned to;
// SUPER_ADMIN and ADMIN can act on any of the company's invoices. Returned as a
// spreadable filter fragment so it AND-combines with companyId (and other clauses).
const ownerScope = (req) => {
  const isAdmin = req.user?.role === 'SUPER_ADMIN' || req.user?.role === 'ADMIN';
  return isAdmin ? {} : {
    OR: [
      { createdByUserId: req.user?.userId },
      { assignedUserIds: { has: req.user?.userId } },
    ],
  };
};

// ── GET ALL ───────────────────────────────────────────────────
exports.getInvoices = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 100, status, search, clientName } = req.query;

    // SUPER_ADMIN and ADMIN see all invoices; other roles see only invoices
    // they created OR have been assigned to.
    // Combine the per-user visibility filter and the search filter with AND so
    // their two OR clauses don't collide.
    const and = [];
    const scope = ownerScope(req);
    if (scope.OR) and.push(scope);
    if (clientName) {
      and.push({ clientName: { equals: clientName, mode: 'insensitive' } });
    } else if (search) {
      and.push({ OR: [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { clientName:    { contains: search, mode: 'insensitive' } },
        { clientEmail:   { contains: search, mode: 'insensitive' } },
      ]});
    }

    const where = {
      companyId,
      ...(status && { status }),
      ...(and.length && { AND: and }),
    };
    const [invoices, total, summary] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * +limit,
        take: +limit,
        include: { createdByUser: { select: { userId: true, name: true, email: true } } },
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({ by: ['status'], where: { companyId }, _count: { status: true }, _sum: { grandTotal: true } })
    ]);
    const summaryMap = {};
    summary.forEach(s => { summaryMap[s.status.toLowerCase()] = { count: s._count.status, amount: s._sum.grandTotal || 0 }; });
    const safeLimit = Math.max(+limit || 100, 1);
    return res.json({ success: true, data: { invoices, pagination: { total, page: +page, limit: safeLimit, pages: Math.ceil(total / safeLimit) }, summary: summaryMap } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── GET ONE ───────────────────────────────────────────────────
exports.getInvoice = async (req, res) => {
  try {
    const inv = await prisma.invoice.findFirst({
      where: { invoiceId: req.params.id, companyId: req.params.companyId, ...ownerScope(req) },
      include: { company: { select: { name:true, logo:true, gst:true, address:true, phone:true, email:true, website:true, bankDetails:true } } }
    });
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    return res.json({ success: true, data: inv });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── CREATE ────────────────────────────────────────────────────
exports.createInvoice = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      leadId, clientName, clientEmail, clientPhone,
      clientGst, clientAddress, invoiceDate, dueDate,
      currency = 'INR', items = [],
      paymentTerms = 'Net 30', bankDetails, notes
    } = req.body;
    if (!clientName)   return res.status(400).json({ success: false, error: { message: 'Client name required.' } });
    if (!items.length) return res.status(400).json({ success: false, error: { message: 'At least one item required.' } });
    const totals = calcTotals(items);
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber:  await nextInvNum(companyId),
        companyId,
        leadId:         leadId        || null,
        clientName,
        clientEmail:    clientEmail   || null,
        clientPhone:    clientPhone   || null,
        clientGst:      clientGst     || null,
        clientAddress:  clientAddress || null,
        invoiceDate:    invoiceDate   ? new Date(invoiceDate) : new Date(),
        invoiceDate:    invoiceDate   ? new Date(invoiceDate) : new Date(),
        dueDate:        dueDate       ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000),
        currency,
        items:          totals.items,
        subtotal:       totals.subtotal,
        totalGst:       totals.totalGst,
        totalDiscount:  totals.totalDiscount,
        grandTotal:     totals.grandTotal,
        paymentTerms,
        bankDetails:    bankDetails   || null,
        notes:            notes         || null,
        status:           'DRAFT',
        createdByUserId:  req.user?.userId || null,
      }
    });
    return res.status(201).json({ success: true, data: inv });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── GET NEXT NUMBER (preview for admin) ──────────────────────
exports.getNextNumber = async (req, res) => {
  try {
    const { companyId } = req.params;
    const next = await nextInvNum(companyId);
    // Get last 3 invoice numbers for reference
    const recent = await prisma.invoice.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { invoiceNumber: true, createdAt: true },
    });
    return res.json({ success: true, data: { nextNumber: next, recent } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── UPDATE (full edit — all fields) ──────────────────────────
exports.updateInvoice = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const updateData = {};
    if (b.clientName    !== undefined) updateData.clientName    = b.clientName;
    if (b.clientEmail   !== undefined) updateData.clientEmail   = b.clientEmail;
    if (b.clientPhone   !== undefined) updateData.clientPhone   = b.clientPhone;
    if (b.clientGst     !== undefined) updateData.clientGst     = b.clientGst;
    if (b.clientAddress !== undefined) updateData.clientAddress = b.clientAddress;
    if (b.invoiceDate   !== undefined) updateData.invoiceDate   = new Date(b.invoiceDate);
    if (b.dueDate       !== undefined) updateData.dueDate       = new Date(b.dueDate);
    if (b.paymentTerms  !== undefined) updateData.paymentTerms  = b.paymentTerms;
    if (b.notes         !== undefined) updateData.notes         = b.notes;
    if (b.status        !== undefined) updateData.status        = b.status;
    if (b.bankDetails   !== undefined) updateData.bankDetails   = b.bankDetails;
    // invoiceNumber can only be changed by SUPER_ADMIN
    if (b.invoiceNumber !== undefined && req.user?.role === 'SUPER_ADMIN') {
      const trimmed = b.invoiceNumber.trim();
      if (trimmed) updateData.invoiceNumber = trimmed;
    }
    if (b.items && b.items.length) {
      const totals = calcTotals(b.items);
      updateData.items         = totals.items;
      updateData.subtotal      = totals.subtotal;
      updateData.totalGst      = totals.totalGst;
      updateData.totalDiscount = totals.totalDiscount;
      updateData.grandTotal    = totals.grandTotal;
    }
    const result = await prisma.invoice.updateMany({ where: { invoiceId: id, companyId, ...ownerScope(req) }, data: updateData });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Invoice not found or not permitted.' } });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── ASSIGN TO USERS (SUPER_ADMIN) ─────────────────────────────
// Assigns the invoice to one or more users so it shows in each user's account
// (non-admins see invoices they created OR are assigned to) and they can edit
// it. Pass userIds = [] to clear all assignments.
exports.assignInvoice = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    // Accept `userIds` (array) — also tolerate a single `userId` for compatibility.
    let userIds = Array.isArray(req.body.userIds)
      ? req.body.userIds
      : (req.body.userId ? [req.body.userId] : []);
    // De-dupe and drop empties
    userIds = [...new Set(userIds.filter(Boolean))];

    if (userIds.length) {
      // Every target must exist and belong to this company (primary or via junction)
      const members = await prisma.user.findMany({
        where: {
          userId: { in: userIds },
          OR: [{ companyId }, { companies: { some: { companyId } } }],
        },
        select: { userId: true },
      });
      if (members.length !== userIds.length)
        return res.status(404).json({ success: false, error: { message: 'One or more users are not members of this company.' } });
    }

    const result = await prisma.invoice.updateMany({
      where: { invoiceId: id, companyId },
      data: { assignedUserIds: userIds },
    });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Invoice not found.' } });

    return res.json({ success: true, message: userIds.length ? `Invoice assigned to ${userIds.length} user(s).` : 'Invoice unassigned.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DELETE / CANCEL ───────────────────────────────────────────
exports.removeInvoice = async (req, res) => {
  try {
    const result = await prisma.invoice.updateMany({ where: { invoiceId: req.params.id, companyId: req.params.companyId, ...ownerScope(req) }, data: { status: 'CANCELLED' } });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Invoice not found or not permitted.' } });
    return res.json({ success: true, message: 'Cancelled.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── MARK PAID ─────────────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { paidAmount, paymentMethod, transactionId, paymentDate, tdsAmount, tdsRate } = req.body;
    const inv    = await prisma.invoice.findFirst({ where: { invoiceId: id, companyId, ...ownerScope(req) } });
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const tds     = +(tdsAmount || 0);
    const paid    = +(paidAmount || (inv.grandTotal - tds));
    const cleared = paid + tds;                                        // cash received + TDS credit
    const status  = cleared >= inv.grandTotal ? 'PAID' : 'PARTIAL';
    const resolvedPaidAt = paymentDate ? new Date(paymentDate) : new Date();
    const upd    = { paidAmount: paid, status, paidAt: resolvedPaidAt };
    if (paymentMethod !== undefined) upd.paymentMethod = paymentMethod;
    if (transactionId !== undefined) upd.transactionId = transactionId;
    if (tds > 0)                     { upd.tdsAmount = tds; upd.tdsRate = +(tdsRate || 0); }
    await prisma.invoice.update({ where: { invoiceId: id }, data: upd });
    return res.json({ success: true, data: { status, paidAmount: paid, tdsAmount: tds } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── SEND ──────────────────────────────────────────────────────
exports.sendInvoice = async (req, res) => {
  try {
    const result = await prisma.invoice.updateMany({ where: { invoiceId: req.params.id, companyId: req.params.companyId, ...ownerScope(req) }, data: { status: 'SENT', sentAt: new Date() } });
    if (!result.count) return res.status(404).json({ success: false, error: { message: 'Invoice not found or not permitted.' } });
    return res.json({ success: true, message: `Sent via ${req.body.channel || 'email'}.` });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DOWNLOAD PDF ──────────────────────────────────────────────
exports.getInvoicePdf = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const inv = await prisma.invoice.findFirst({ where: { invoiceId: id, companyId, ...ownerScope(req) } });
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const original = req.query.original === '1' || req.query.original === 'true';
    const result = await pdfSvc.generateInvoicePdf(id, { original });
    if (result.buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber}${original ? '_ORIGINAL' : ''}.pdf"`);
      return res.send(result.buffer);
    }
    res.setHeader('Content-Type', 'text/html');
    return res.send(result.html + '<script>window.onload=()=>window.print();</script>');
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── VIEW IN BROWSER ───────────────────────────────────────────
exports.viewInvoicePdf = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    // Guard: the invoice must belong to this company AND be visible to this user.
    // (buildInvoiceHtml only takes an id, so without this a member of any company
    // could view any invoice from any company by guessing its id.)
    const inv = await prisma.invoice.findFirst({ where: { invoiceId: id, companyId, ...ownerScope(req) }, select: { invoiceId: true } });
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const original = req.query.original === '1' || req.query.original === 'true';
    const html = await pdfSvc.buildInvoiceHtml(id, { original });
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
