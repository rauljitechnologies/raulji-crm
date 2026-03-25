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

const nextInvNum = async (companyId) => {
  const count = await prisma.invoice.count({ where: { companyId } });
  return `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`;
};

exports.getInvoices = async (req, res) => {
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
          { invoiceNumber: { contains: search, mode: 'insensitive' } },
          { clientName: { contains: search, mode: 'insensitive' } },
          { clientEmail: { contains: search, mode: 'insensitive' } },
          { clientPhone: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [invoices, total, summary] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip: (+page - 1) * +limit,
        take: +limit,
      }),
      prisma.invoice.count({ where }),
      prisma.invoice.groupBy({
        by: ['status'],
        where: { companyId },
        _count: { status: true },
        _sum: { grandTotal: true },
      }),
    ]);

    const summaryMap = {};
    summary.forEach((row) => {
      summaryMap[row.status.toLowerCase()] = {
        count: row._count.status,
        amount: row._sum.grandTotal || 0,
      };
    });

    return res.json({
      success: true,
      data: {
        invoices,
        pagination: {
          total,
          page: +page,
          limit: +limit,
          pages: Math.ceil(total / limit),
        },
        summary: summaryMap,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.getInvoice = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const invoice = await prisma.invoice.findFirst({
      where: { invoiceId: id, companyId },
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

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    return res.json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.createInvoice = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      leadId,
      clientName,
      clientEmail,
      clientPhone,
      clientGst,
      clientAddress,
      dueDate,
      currency = 'INR',
      items = [],
      paymentTerms = 'Net 30',
      bankDetails,
      notes,
    } = req.body;

    if (!clientName || !items.length) {
      return res.status(400).json({
        success: false,
        error: { message: 'Client name and items are required.' },
      });
    }

    const totals = calcTotals(items);

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber: await nextInvNum(companyId),
        companyId,
        leadId: leadId || null,
        clientName,
        clientEmail: clientEmail || null,
        clientPhone: clientPhone || null,
        clientGst: clientGst || null,
        clientAddress: clientAddress || null,
        dueDate: dueDate ? new Date(dueDate) : new Date(Date.now() + 30 * 86400000),
        currency,
        ...totals,
        paymentTerms,
        bankDetails: bankDetails || null,
        notes: notes || null,
        status: 'DRAFT',
      },
    });

    return res.status(201).json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const existing = await prisma.invoice.findFirst({
      where: { invoiceId: id, companyId },
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    const {
      leadId,
      clientName,
      clientEmail,
      clientPhone,
      clientGst,
      clientAddress,
      dueDate,
      currency,
      items,
      paymentTerms,
      bankDetails,
      notes,
      status,
      sentAt,
      pdfUrl,
    } = req.body;

    const updateData = {};

    if (leadId !== undefined) updateData.leadId = leadId || null;
    if (clientName !== undefined) updateData.clientName = clientName;
    if (clientEmail !== undefined) updateData.clientEmail = clientEmail || null;
    if (clientPhone !== undefined) updateData.clientPhone = clientPhone || null;
    if (clientGst !== undefined) updateData.clientGst = clientGst || null;
    if (clientAddress !== undefined) updateData.clientAddress = clientAddress || null;
    if (dueDate !== undefined) updateData.dueDate = dueDate ? new Date(dueDate) : null;
    if (currency !== undefined) updateData.currency = currency;
    if (paymentTerms !== undefined) updateData.paymentTerms = paymentTerms;
    if (bankDetails !== undefined) updateData.bankDetails = bankDetails;
    if (notes !== undefined) updateData.notes = notes;
    if (status !== undefined) updateData.status = status;
    if (sentAt !== undefined) updateData.sentAt = sentAt ? new Date(sentAt) : null;
    if (pdfUrl !== undefined) updateData.pdfUrl = pdfUrl || null;

    if (items !== undefined) {
      Object.assign(updateData, calcTotals(items));
    }

    const result = await prisma.invoice.updateMany({
      where: { invoiceId: id, companyId },
      data: updateData,
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    const invoice = await prisma.invoice.findFirst({
      where: { invoiceId: id, companyId },
    });

    return res.json({ success: true, data: invoice });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.removeInvoice = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const result = await prisma.invoice.updateMany({
      where: { invoiceId: id, companyId },
      data: { status: 'CANCELLED' },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    return res.json({ success: true, message: 'Cancelled.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.markPaid = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const { paidAmount, paymentMethod, transactionId } = req.body;

    const invoice = await prisma.invoice.findFirst({
      where: { invoiceId: id, companyId },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    const paid = +(paidAmount || invoice.grandTotal);
    const nextStatus = paid >= invoice.grandTotal ? 'PAID' : 'PARTIAL';

    await prisma.invoice.update({
      where: { invoiceId: id },
      data: {
        paidAmount: paid,
        status: nextStatus,
        paidAt: new Date(),
        paymentMethod: paymentMethod || null,
        transactionId: transactionId || null,
      },
    });

    return res.json({
      success: true,
      data: {
        status: nextStatus,
        paidAmount: paid,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.sendInvoice = async (req, res) => {
  try {
    const { companyId, id } = req.params;

    const result = await prisma.invoice.updateMany({
      where: { invoiceId: id, companyId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    return res.json({
      success: true,
      message: `Invoice marked sent via ${req.body.channel || 'email'}.`,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.getInvoicePdf = async (req, res) => {
  try {
    const { companyId, id } = req.params;
    const invoice = await prisma.invoice.findFirst({
      where: { invoiceId: id, companyId },
    });

    if (!invoice) {
      return res.status(404).json({
        success: false,
        error: { message: 'Invoice not found.' },
      });
    }

    return res.json({
      success: true,
      data: {
        pdfUrl: invoice.pdfUrl || null,
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
