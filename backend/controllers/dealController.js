const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

exports.getDeals = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      stage,
      search,
      assignedTo,
      page = 1,
      limit = 25,
      sortBy = 'updatedAt',
      sortOrder = 'desc',
    } = req.query;

    const where = {
      companyId,
      ...(stage && { stage }),
      ...(assignedTo && { assignedToId: assignedTo }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { lostReason: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [deals, total, pipeline] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          lead: {
            select: {
              leadId: true,
              name: true,
              phone: true,
            },
          },
          assignedTo: {
            select: {
              userId: true,
              name: true,
              avatar: true,
            },
          },
        },
        orderBy: { [sortBy]: sortOrder },
        skip: (+page - 1) * +limit,
        take: +limit,
      }),
      prisma.deal.count({ where }),
      prisma.deal.groupBy({
        by: ['stage'],
        where: { companyId },
        _count: { stage: true },
        _sum: { value: true },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        deals,
        pagination: {
          total,
          page: +page,
          limit: +limit,
          pages: Math.ceil(total / limit),
        },
        pipeline,
      },
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.getDeal = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;

    const deal = await prisma.deal.findFirst({
      where: { dealId, companyId },
      include: {
        lead: true,
        assignedTo: true,
      },
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        error: { message: 'Deal not found.' },
      });
    }

    return res.json({ success: true, data: deal });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.createDeal = async (req, res) => {
  try {
    const { companyId } = req.params;
    const {
      leadId,
      name,
      value = 0,
      currency = 'INR',
      stage = 'NEW_LEAD',
      probability = 0,
      expectedCloseDate,
      assignedToId,
      lostReason,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: { message: 'Deal name is required.' },
      });
    }

    const deal = await prisma.deal.create({
      data: {
        companyId,
        leadId: leadId || null,
        name,
        value: +value || 0,
        currency,
        stage,
        probability: +probability || 0,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assignedToId: assignedToId || null,
        lostReason: lostReason || null,
        ...(stage === 'WON' || stage === 'LOST' ? { closedAt: new Date() } : {}),
      },
      include: {
        lead: true,
        assignedTo: true,
      },
    });

    return res.status(201).json({ success: true, data: deal });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.updateDeal = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;
    const old = await prisma.deal.findFirst({ where: { dealId, companyId } });

    if (!old) {
      return res.status(404).json({
        success: false,
        error: { message: 'Deal not found.' },
      });
    }

    const {
      leadId,
      name,
      value,
      currency,
      stage,
      probability,
      expectedCloseDate,
      assignedToId,
      lostReason,
      closedAt,
    } = req.body;

    const updateData = {};

    if (leadId !== undefined) updateData.leadId = leadId || null;
    if (name !== undefined) updateData.name = name;
    if (value !== undefined) updateData.value = +value;
    if (currency !== undefined) updateData.currency = currency;
    if (stage !== undefined) updateData.stage = stage;
    if (probability !== undefined) updateData.probability = +probability;
    if (expectedCloseDate !== undefined) {
      updateData.expectedCloseDate = expectedCloseDate ? new Date(expectedCloseDate) : null;
    }
    if (assignedToId !== undefined) updateData.assignedToId = assignedToId || null;
    if (lostReason !== undefined) updateData.lostReason = lostReason || null;
    if (closedAt !== undefined) updateData.closedAt = closedAt ? new Date(closedAt) : null;

    if (stage === 'WON' || stage === 'LOST') {
      updateData.closedAt = old.closedAt || new Date();
    }

    if (stage && stage !== 'WON' && stage !== 'LOST' && closedAt === undefined) {
      updateData.closedAt = null;
    }

    const result = await prisma.deal.updateMany({
      where: { dealId, companyId },
      data: updateData,
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Deal not found.' },
      });
    }

    const deal = await prisma.deal.findFirst({
      where: { dealId, companyId },
      include: {
        lead: true,
        assignedTo: true,
      },
    });

    return res.json({ success: true, data: deal });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.updateStage = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;
    const { stage, lostReason } = req.body;

    const old = await prisma.deal.findFirst({ where: { dealId, companyId } });

    if (!old) {
      return res.status(404).json({
        success: false,
        error: { message: 'Deal not found.' },
      });
    }

    const updateData = { stage };

    if (lostReason !== undefined) updateData.lostReason = lostReason || null;

    if (stage === 'WON' || stage === 'LOST') {
      updateData.closedAt = old.closedAt || new Date();
    } else {
      updateData.closedAt = null;
    }

    await prisma.deal.updateMany({
      where: { dealId, companyId },
      data: updateData,
    });

    return res.json({ success: true, message: 'Stage updated.' });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message },
    });
  }
};

exports.deleteDeal = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;

    const result = await prisma.deal.deleteMany({
      where: { dealId, companyId },
    });

    if (!result.count) {
      return res.status(404).json({
        success: false,
        error: { message: 'Deal not found.' },
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
