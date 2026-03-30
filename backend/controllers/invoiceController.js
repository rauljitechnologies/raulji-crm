// backend/controllers/invoiceController.js

const prisma = require('../lib/prisma');
const pdfSvc  = require('../services/pdfService');

const calcTotals = (items) => {
  let subtotal = 0, totalGst = 0, totalDiscount = 0;
  const processed = items.map(item => {
    const after   = item.quantity * (item.unitPrice || 0) - (item.discount || 0);
    const gst     = Math.round(after * (item.gstPercent || 18) / 100);
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

// ── GET ALL ───────────────────────────────────────────────────
exports.getInvoices = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 100, status, search, clientName } = req.query;
    const where = {
      companyId,
      ...(status && { status }),
      ...(clientName
        ? { clientName: { equals: clientName, mode: 'insensitive' } }
        : search
          ? { OR: [
              { invoiceNumber: { contains: search, mode: 'insensitive' } },
              { clientName:    { contains: search, mode: 'insensitive' } },
              { clientEmail:   { contains: search, mode: 'insensitive' } },
            ]}
          : {}),
    };
    const [invoices, total, summary] = await Promise.all([
      prisma.invoice.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * +limit, take: +limit }),
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
      where: { invoiceId: req.params.id, companyId: req.params.companyId },
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
        notes:          notes         || null,
        status:         'DRAFT'
      }
    });
    return res.status(201).json({ success: true, data: inv });
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
    if (b.items && b.items.length) {
      const totals = calcTotals(b.items);
      updateData.items         = totals.items;
      updateData.subtotal      = totals.subtotal;
      updateData.totalGst      = totals.totalGst;
      updateData.totalDiscount = totals.totalDiscount;
      updateData.grandTotal    = totals.grandTotal;
    }
    await prisma.invoice.updateMany({ where: { invoiceId: id, companyId }, data: updateData });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DELETE / CANCEL ───────────────────────────────────────────
exports.removeInvoice = async (req, res) => {
  try {
    await prisma.invoice.updateMany({ where: { invoiceId: req.params.id, companyId: req.params.companyId }, data: { status: 'CANCELLED' } });
    return res.json({ success: true, message: 'Cancelled.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── MARK PAID ─────────────────────────────────────────────────
exports.markPaid = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { paidAmount, paymentMethod, transactionId } = req.body;
    const inv    = await prisma.invoice.findFirst({ where: { invoiceId: id, companyId } });
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const paid   = +(paidAmount || inv.grandTotal);
    const status = paid >= inv.grandTotal ? 'PAID' : 'PARTIAL';
    const upd    = { paidAmount: paid, status, paidAt: new Date() };
    if (paymentMethod !== undefined) upd.paymentMethod = paymentMethod;
    if (transactionId !== undefined) upd.transactionId = transactionId;
    await prisma.invoice.update({ where: { invoiceId: id }, data: upd });
    return res.json({ success: true, data: { status, paidAmount: paid } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── SEND ──────────────────────────────────────────────────────
exports.sendInvoice = async (req, res) => {
  try {
    await prisma.invoice.updateMany({ where: { invoiceId: req.params.id, companyId: req.params.companyId }, data: { status: 'SENT', sentAt: new Date() } });
    return res.json({ success: true, message: `Sent via ${req.body.channel || 'email'}.` });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DOWNLOAD PDF ──────────────────────────────────────────────
exports.getInvoicePdf = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const inv = await prisma.invoice.findFirst({ where: { invoiceId: id, companyId } });
    if (!inv) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const result = await pdfSvc.generateInvoicePdf(id);
    if (result.buffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${inv.invoiceNumber}.pdf"`);
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
    const html = await pdfSvc.buildInvoiceHtml(id);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
