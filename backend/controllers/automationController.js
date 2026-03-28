// backend/controllers/automationController.js
const prisma = require('../lib/prisma');

exports.listRules = async (req, res) => {
  try {
    const { companyId } = req.params;
    const rules = await prisma.automationRule.findMany({
      where: { companyId },
      include: { template: { select: { templateId: true, name: true, channel: true } } },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: { rules } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.getRule = async (req, res) => {
  try {
    const rule = await prisma.automationRule.findFirst({
      where: { ruleId: req.params.id, companyId: req.params.companyId },
      include: { template: true }
    });
    if (!rule) return res.status(404).json({ success: false, error: { message: 'Rule not found.' } });
    return res.json({ success: true, data: rule });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.createRule = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, trigger, triggerValue, channel = 'WHATSAPP', templateId, delayMinutes = 0, conditions } = req.body;
    if (!name || !trigger || !templateId) return res.status(400).json({ success: false, error: { message: 'Name, trigger and templateId required.' } });
    const rule = await prisma.automationRule.create({
      data: { companyId, name, trigger, triggerValue: triggerValue || null, channel, templateId, delayMinutes: +delayMinutes, conditions: conditions || null }
    });
    return res.status(201).json({ success: true, data: rule });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.updateRule = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const upd = {};
    if (b.name         !== undefined) upd.name         = b.name;
    if (b.trigger      !== undefined) upd.trigger      = b.trigger;
    if (b.triggerValue !== undefined) upd.triggerValue = b.triggerValue;
    if (b.channel      !== undefined) upd.channel      = b.channel;
    if (b.templateId   !== undefined) upd.templateId   = b.templateId;
    if (b.delayMinutes !== undefined) upd.delayMinutes = +b.delayMinutes;
    if (b.conditions   !== undefined) upd.conditions   = b.conditions;
    if (b.isActive     !== undefined) upd.isActive     = b.isActive;
    await prisma.automationRule.updateMany({ where: { ruleId: id, companyId }, data: upd });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.toggleRule = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    await prisma.automationRule.updateMany({ where: { ruleId: id, companyId }, data: { isActive: req.body.isActive } });
    return res.json({ success: true, message: 'Toggled.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteRule = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    // Cancel pending jobs first
    await prisma.automationJob.updateMany({ where: { ruleId: id, status: 'PENDING' }, data: { status: 'CANCELLED' } });
    await prisma.automationRule.deleteMany({ where: { ruleId: id, companyId } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.listJobs = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, page = 1, limit = 30 } = req.query;
    const where = { companyId, ...(status && { status }) };
    const [jobs, total] = await Promise.all([
      prisma.automationJob.findMany({
        where,
        include: { rule: { select: { name: true, trigger: true, channel: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * +limit, take: +limit
      }),
      prisma.automationJob.count({ where })
    ]);
    return res.json({ success: true, data: { jobs, total } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.retryJob = async (req, res) => {
  try {
    const job = await prisma.automationJob.findFirst({ where: { jobId: req.params.id, companyId: req.params.companyId } });
    if (!job) return res.status(404).json({ success: false, error: { message: 'Job not found.' } });
    await prisma.automationJob.update({ where: { jobId: job.jobId }, data: { status: 'PENDING', scheduledAt: new Date(), error: null } });
    return res.json({ success: true, message: 'Job queued for retry.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
