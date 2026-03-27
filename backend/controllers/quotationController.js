// backend/controllers/quotationController.js

const prisma    = require("../lib/prisma");
const pdfSvc    = require('../services/pdfService');

const calcTotals = (items) => {
  let subtotal = 0, totalGst = 0, totalDiscount = 0;
  const processed = items.map(item => {
    const after   = item.quantity * item.unitPrice - (item.discount || 0);
    const gst     = Math.round(after * (item.gstPercent || 18) / 100);
    subtotal      += after;
    totalGst      += gst;
    totalDiscount += (item.discount || 0);
    return { ...item, total: after + gst, gstAmount: gst };
  });
  return { items: processed, subtotal, totalGst, totalDiscount, grandTotal: subtotal + totalGst };
};

const nextQtNum = async (companyId) => {
  const c = await prisma.quotation.count({ where: { companyId } });
  return `QT-${new Date().getFullYear()}-${String(c + 1).padStart(4, '0')}`;
};

const nextInvNum = async (companyId) => {
  const c = await prisma.invoice.count({ where: { companyId } });
  return `INV-${new Date().getFullYear()}-${String(c + 1).padStart(4, '0')}`;
};

// ── GET ALL ───────────────────────────────────────────────────────────────────
exports.getQuotations = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page = 1, limit = 20, status, search } = req.query;
    const where = {
      companyId,
      ...(status && { status }),
      ...(search && { OR: [
        { quotationNumber: { contains: search, mode: 'insensitive' } },
        { clientName:      { contains: search, mode: 'insensitive' } }
      ]})
    };
    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * +limit, take: +limit }),
      prisma.quotation.count({ where })
    ]);
    return res.json({ success: true, data: { quotations, pagination: { total, page: +page, limit: +limit, pages: Math.ceil(total / limit) } } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── GET ONE ───────────────────────────────────────────────────────────────────
exports.getQuotation = async (req, res) => {
  try {
    const qt = await prisma.quotation.findFirst({
      where: { quotationId: req.params.id, companyId: req.params.companyId },
      include: { company: { select: { name: true, logo: true, gst: true, address: true, phone: true, email: true } } }
    });
    if (!qt) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    return res.json({ success: true, data: qt });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── CREATE ────────────────────────────────────────────────────────────────────
exports.createQuotation = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      leadId, clientName, clientEmail, clientPhone,
      clientAddress, clientGst, validUntil,
      currency = 'INR', items = [], notes, termsConditions
    } = req.body;

    if (!clientName)   return res.status(400).json({ success: false, error: { message: 'Client name required.' } });
    if (!items.length) return res.status(400).json({ success: false, error: { message: 'At least one item required.' } });

    const totals = calcTotals(items);
    const qt = await prisma.quotation.create({
      data: {
        quotationNumber:  await nextQtNum(companyId),
        companyId,
        leadId:           leadId          || null,
        clientName,
        clientEmail:      clientEmail     || null,
        clientPhone:      clientPhone     || null,
        clientAddress:    clientAddress   || null,
        clientGst:        clientGst       || null,
        validUntil:       validUntil      ? new Date(validUntil) : null,
        currency,
        items:            totals.items,
        subtotal:         totals.subtotal,
        totalGst:         totals.totalGst,
        totalDiscount:    totals.totalDiscount,
        grandTotal:       totals.grandTotal,
        notes:            notes           || null,
        termsConditions:  termsConditions || null,
        status:           'DRAFT'
      }
    });
    return res.status(201).json({ success: true, data: qt });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── UPDATE ────────────────────────────────────────────────────────────────────
exports.updateQuotation = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const updateData = {};
    if (req.body.clientName      !== undefined) updateData.clientName      = req.body.clientName;
    if (req.body.clientEmail     !== undefined) updateData.clientEmail     = req.body.clientEmail;
    if (req.body.clientPhone     !== undefined) updateData.clientPhone     = req.body.clientPhone;
    if (req.body.clientAddress   !== undefined) updateData.clientAddress   = req.body.clientAddress;
    if (req.body.clientGst       !== undefined) updateData.clientGst       = req.body.clientGst;
    if (req.body.notes           !== undefined) updateData.notes           = req.body.notes;
    if (req.body.termsConditions !== undefined) updateData.termsConditions = req.body.termsConditions;
    if (req.body.status          !== undefined) updateData.status          = req.body.status;
    if (req.body.validUntil      !== undefined) updateData.validUntil      = new Date(req.body.validUntil);
    if (req.body.items) {
      const t = calcTotals(req.body.items);
      updateData.items         = t.items;
      updateData.subtotal      = t.subtotal;
      updateData.totalGst      = t.totalGst;
      updateData.totalDiscount = t.totalDiscount;
      updateData.grandTotal    = t.grandTotal;
    }
    await prisma.quotation.updateMany({ where: { quotationId: id, companyId }, data: updateData });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DELETE ────────────────────────────────────────────────────────────────────
exports.removeQuotation = async (req, res) => {
  try {
    await prisma.quotation.updateMany({ where: { quotationId: req.params.id, companyId: req.params.companyId }, data: { status: 'EXPIRED' } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── SEND ──────────────────────────────────────────────────────────────────────
exports.sendQuotation = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const qt = await prisma.quotation.findFirst({ where: { quotationId: id, companyId } });
    if (!qt) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    await prisma.quotation.update({ where: { quotationId: id }, data: { status: 'SENT', sentAt: new Date() } });
    return res.json({ success: true, message: `Quotation marked as sent via ${req.body.channel || 'email'}.` });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── CONVERT TO INVOICE ────────────────────────────────────────────────────────
exports.convertQuotationToInvoice = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const qt = await prisma.quotation.findFirst({ where: { quotationId: id, companyId } });
    if (!qt) return res.status(404).json({ success: false, error: { message: 'Not found.' } });
    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber:  await nextInvNum(companyId),
        companyId,
        leadId:         qt.leadId        || null,
        quotationId:    qt.quotationId,
        clientName:     qt.clientName,
        clientEmail:    qt.clientEmail   || null,
        clientPhone:    qt.clientPhone   || null,
        clientGst:      qt.clientGst     || null,
        clientAddress:  qt.clientAddress || null,
        dueDate:        new Date(Date.now() + 30 * 86400000),
        currency:       qt.currency,
        items:          qt.items,
        subtotal:       qt.subtotal,
        totalGst:       qt.totalGst,
        totalDiscount:  qt.totalDiscount,
        grandTotal:     qt.grandTotal,
        notes:          qt.notes         || null,
        status:         'DRAFT',
        paymentTerms:   'Net 30'
      }
    });
    await prisma.quotation.update({ where: { quotationId: id }, data: { status: 'CONVERTED', convertedToInvoiceId: inv.invoiceId } });
    return res.status(201).json({ success: true, data: { invoiceId: inv.invoiceId, invoiceNumber: inv.invoiceNumber, grandTotal: inv.grandTotal } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── DOWNLOAD PDF ──────────────────────────────────────────────────────────────
exports.getQuotationPdf = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const qt = await prisma.quotation.findFirst({ where: { quotationId: id, companyId } });
    if (!qt) return res.status(404).json({ success: false, error: { message: 'Not found.' } });

    const result = await pdfSvc.generateQuotationPdf(id);

    if (result.buffer) {
      // Return actual PDF binary
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${qt.quotationNumber}.pdf"`);
      return res.send(result.buffer);
    } else {
      // Return HTML for browser printing (fallback)
      res.setHeader('Content-Type', 'text/html');
      return res.send(result.html + `<script>window.onload=()=>window.print();</script>`);
    }
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── VIEW PDF IN BROWSER ───────────────────────────────────────────────────────
exports.viewQuotationPdf = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const qt = await prisma.quotation.findFirst({ where: { quotationId: id, companyId } });
    if (!qt) return res.status(404).json({ success: false, error: { message: 'Not found.' } });

    const html = await pdfSvc.buildQuotationHtml(id);
    res.setHeader('Content-Type', 'text/html');
    return res.send(html);
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
