
const prisma = require('../lib/prisma');

exports.getDeals = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { stage, page=1, limit=25 } = req.query;
    const where = { companyId, ...(stage && { stage }) };
    const [deals, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: { lead: { select: { leadId:true, name:true, phone:true } } },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * +limit,
        take: +limit
      }),
      prisma.deal.count({ where })
    ]);
    const pipeline = await prisma.deal.groupBy({ by:['stage'], where:{ companyId }, _count:{ stage:true }, _sum:{ value:true } });
    return res.json({ success:true, data:{ deals, pagination:{ total, page:+page, limit:+limit, pages:Math.ceil(total/limit) }, pipeline } });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.getDeal = async (req, res) => {
  try {
    const deal = await prisma.deal.findFirst({
      where: { dealId: req.params.dealId, companyId: req.params.companyId },
      include: { lead: true }
    });
    if (!deal) return res.status(404).json({ success:false, error:{ message:'Not found.' } });
    return res.json({ success:true, data:deal });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.createDeal = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { leadId, name, value=0, currency='INR', stage='NEW_LEAD', probability=0, expectedCloseDate, assignedToId } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: { message: 'Deal name required.' } });
    const deal = await prisma.deal.create({
      data: {
        companyId,
        leadId:            leadId            || null,
        name,
        value:             +value,
        currency,
        stage,
        probability:       +probability,
        expectedCloseDate: expectedCloseDate ? new Date(expectedCloseDate) : null,
        assignedToId:      assignedToId      || null
      }
    });
    return res.status(201).json({ success:true, data:deal });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.updateDeal = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;
    const { name, value, stage, probability, expectedCloseDate, assignedToId, lostReason } = req.body;

    const data = {};
    if (name              !== undefined) data.name              = name;
    if (value             !== undefined) data.value             = +value;
    if (stage             !== undefined) {
      data.stage = stage;
      if (stage === 'WON') data.closedAt = new Date();
    }
    if (probability       !== undefined) data.probability       = +probability;
    if (expectedCloseDate !== undefined) data.expectedCloseDate = new Date(expectedCloseDate);
    if (assignedToId      !== undefined) data.assignedToId      = assignedToId;
    if (lostReason        !== undefined) data.lostReason        = lostReason;

    await prisma.deal.updateMany({ where: { dealId, companyId }, data });
    return res.json({ success:true, message:'Updated.' });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.updateStage = async (req, res) => {
  try {
    const { companyId, dealId } = req.params;
    const { stage } = req.body;
    const data = { stage };
    if (stage === 'WON') data.closedAt = new Date();
    await prisma.deal.updateMany({ where: { dealId, companyId }, data });
    return res.json({ success:true, message:'Stage updated.' });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.deleteDeal = async (req, res) => {
  try {
    await prisma.deal.deleteMany({ where: { dealId: req.params.dealId, companyId: req.params.companyId } });
    return res.json({ success:true, message:'Deleted.' });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};
