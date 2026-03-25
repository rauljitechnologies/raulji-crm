const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const calcTotals = (items = []) => {
  let subtotal = 0;
  let totalGst = 0;
  let totalDiscount = 0;

  const processed = items.map((item) => {
    const quantity = +item.quantity || 0;
    const unitPrice = +item.unitPrice || 0;
    const discount = +item.discount || 0;
    const gstPercent = +item.gstPercent || 18;

    const afterDiscount = quantity * unitPrice - discount;
    const gstAmount = Math.round((afterDiscount * gstPercent) / 100);

    subtotal += afterDiscount;
    totalGst += gstAmount;
    totalDiscount += discount;

    return {
      ...item,
      quantity,
      unitPrice,
      discount,
      gstPercent,
      gstAmount,
      total: afterDiscount + gstAmount,
    };
  });

  return {
    items: processed,
    subtotal,
    totalGst,
    totalDiscount,
    grandTotal: subtotal + totalGst,
  };
};

const nextQtNum = async (companyId) => {
  const count = await prisma.quotation.count({ where: { companyId } });
  return `QT-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

const nextInvNum = async (companyId) => {
  const count = await prisma.invoice.count({ where: { companyId } });
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

exports.getQuotations = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      page = 1,
      limit = 20,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = req.query;

    const where = {
      companyId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { quotationNumber: { contains: search, mode: 'insensitive' } },
          { clientName: { contains: search, mode: 'insensitive' } },
          { clientEmail: { contains: search, mode: 'insensitive' } },
          { clientPhone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [quotations, total] = await Promise.all([
      prisma.quotation.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (+page - 1) * +limit,
        take: +limit,
      }),
      prisma.quotation.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        quotations,
        pagination: {
          total,
          page: +page,
          limit: +limit,
          pages: Math.ceil(total / limit),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.getQuotation = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const quotation = await prisma.quotation.findFirst({
      where: { quotationId: id, companyId },
      include: {
        company: {
          select: {
            name: true,
            logo: true,
            gst: true,
            address: true,
          },
        },
      },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    return res.json({ success: true, data: quotation });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.createQuotation = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      leadId,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientGst,
      validUntil,
      currency = 'INR',
      items = [],
      notes,
      termsConditions,
    } = req.body;

    if (!clientName || !items.length) {
      return res.status(400).json({
        success: false,
        error: { message: 'Client name and items are required.' },
      });
    }

    const totals = calcTotals(items);

    const quotation = await prisma.quotation.create({
      data: {
        quotationNumber: await nextQtNum(companyId),
        companyId,
        leadId: leadId || null,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        clientAddress: clientAddress || null,
        clientGst: clientGst || null,
        validUntil: validUntil ? new Date(validUntil) : null,
        currency,
        ...totals,
        notes: notes || null,
        termsConditions: termsConditions || null,
        status: 'DRAFT',
      },
    });

    return res.status(201).json({ success: true, data: quotation });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.updateQuotation = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const existing = await prisma.quotation.findFirst({
      where: { quotationId: id, companyId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    const {
      leadId,
      clientName,
      clientEmail,
      clientPhone,
      clientAddress,
      clientGst,
      validUntil,
      currency,
      items,
      notes,
      termsConditions,
      status,
      sentAt,
      pdfUrl,
    } = req.body;

    const updateData = {};

    if (leadId !== undefined) updateData.leadId = leadId || null;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail || null;
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone || null;
    if (clientAddress !== undefined) updateData.clientAddress = clientAddress || null;
    if (clientGst !== undefined) updateData.clientGst = clientGst || null;
    if (validUntil !== undefined) {
      updateData.validUntil = validUntil ? new Date(validUntil) : null;
    }
    if (currency !== undefined) updateData.currency = currency;
    if (notes !== undefined) updateData.notes = notes;
    if (termsConditions !== undefined) updateData.termsConditions = termsConditions;
    if (status !== undefined) updateData.status = status;
    if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;
    if (pdfUrl !== undefined) updateData.pdfUrl = pdfUrl || null;

    if (items !== undefined) {
      Object.assign(updateData, calcTotals(items));
    }

    const result = await prisma.quotation.updateMany({
      where: { quotationId: id, companyId },
      data: updateData,
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    const quotation = await prisma.quotation.findFirst({
      where: { quotationId: id, companyId },
    });

    return res.json({ success: true, data: quotation });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.removeQuotation = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const result = await prisma.quotation.updateMany({
      where: { quotationId: id, companyId },
      data: { status: 'EXPIRED' },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.sendQuotation = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const quotation = await prisma.quotation.findFirst({
      where: { quotationId: id, companyId },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    await prisma.quotation.update({
      where: { quotationId: id },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return res.json({
      success: true,
      message: `Quotation marked as sent via ${req.body.channel || 'email'}.`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.convertQuotationToInvoice = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const quotation = await prisma.quotation.findFirst({
      where: { quotationId: id, companyId },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await nextInvNum(companyId),
        companyId,
        leadId: quotation.leadId,
        quotationId: quotation.quotationId,
        clientName: quotation.clientName,
        clientEmail: quotation.clientEmail,
        clientPhone: quotation.clientPhone,
        clientGst: quotation.clientGst,
        clientAddress: quotation.clientAddress,
        dueDate: new Date(Date.now() + 30 * 86400000),
        currency: quotation.currency,
        items: quotation.items,
        subtotal: quotation.subtotal,
        totalGst: quotation.totalGst,
        totalDiscount: quotation.totalDiscount,
        grandTotal: quotation.grandTotal,
        notes: quotation.notes,
        status: 'DRAFT',
        paymentTerms: 'Net 30',
      },
    });

    await prisma.quotation.update({
      where: { quotationId: id },
      data: {
        status: 'CONVERTED',
        convertedToInvoiceId: invoice.invoiceId,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        invoiceId: invoice.invoiceId,
        invoiceNumber: invoice.invoiceNumber,
        grandTotal: invoice.grandTotal,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.getQuotationPdf = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const quotation = await prisma.quotation.findFirst({
      where: { quotationId: id, companyId },
    });

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: { message: 'Quotation not found.' },
      });
    }

    return res.json({
      success: true,
      data: {
        pdfUrl: quotation.pdfUrl || null,
        message: 'PDF generation requires Puppeteer setup.',
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};
