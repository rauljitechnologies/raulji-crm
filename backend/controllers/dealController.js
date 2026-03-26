const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ================= GET DEALS =================
exports.getDeals = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { stage, page = 1, limit = 25 } = req.query;

    const where = {
      companyId,
      ...(stage && { stage })
    };

    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: {
          lead: {
            select: { leadId: true, name: true, phone: true }
          }
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * +limit,
        take: +limit
      }),
      prisma.deal.count({ where })
    ]);

    const pipeline = await prisma.deal.groupBy({
      by: ['stage'],
      where: { companyId },
      _count: { stage: true },
      _sum: { value: true }
    });

    return res.json({
      success: true,
      data: {
        deals,
        pagination: {
          total,
          page: +page,
          limit: +limit,
          pages: Math.ceil(total / limit)
        },
        pipeline
      }
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message }
    });
  }
};

// ================= GET SINGLE DEAL =================
exports.getDeal = async (req, res) => {
  try {
    const deal = await prisma.deal.findFirst({
      where: {
        dealId: req.params.dealId,
        companyId: req.params.companyId
      },
      include: { lead: true }
    });

    if (!deal) {
      return res.status(404).json({
        success: false,
        error: { message: 'Not found.' }
      });
    }

    return res.json({ success: true, data: deal });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message }
    });
  }
};

// ================= CREATE DEAL =================
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
      assignedToId
    } = req.body;

    const deal = await prisma.deal.create({
      data: {
        companyId,
        leadId: leadId || null,
        name,
        value: +value,
        currency,
        stage,
        probability: +probability,
        expectedCloseDate: expectedCloseDate
          ? new Date(expectedCloseDate)
          : null,
        assignedToId: assignedToId || null
      }
    });

    return res.status(201).json({
      success: true,
      data: deal
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message }
    });
  }
};

// ================= UPDATE DEAL (FIXED) =================
exports.updateDeal = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;
    const b = req.body;

    const data = {
      ...(b.name && { name: b.name }),
      ...(b.value !== undefined && { value: +b.value }),
      ...(b.stage && {
        stage: b.stage,
        ...(b.stage === 'WON' && { closedAt: new Date() })
      }),
      ...(b.probability !== undefined && {
        probability: +b.probability
      }),
      ...(b.assignedToId !== undefined && {
        assignedToId: b.assignedToId
      }),
      ...(b.lostReason && { lostReason: b.lostReason })
    };

    await prisma.deal.updateMany({
      where: { dealId, companyId },
      data
    });

    return res.json({
      success: true,
      message: 'Updated.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message }
    });
  }
};

// ================= UPDATE STAGE =================
exports.updateStage = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;
    const { stage } = req.body;

    await prisma.deal.updateMany({
      where: { dealId, companyId },
      data: {
        stage,
        ...(stage === 'WON' && { closedAt: new Date() })
      }
    });

    return res.json({
      success: true,
      message: 'Stage updated.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message }
    });
  }
};

// ================= DELETE DEAL =================
exports.deleteDeal = async (req, res) => {
  try {
    await prisma.deal.deleteMany({
      where: {
        dealId: req.params.dealId,
        companyId: req.params.companyId
      }
    });

    return res.json({
      success: true,
      message: 'Deleted.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { message: err.message }
    });
  }
};