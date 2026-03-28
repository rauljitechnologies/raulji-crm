// backend/controllers/communicationController.js
const prisma  = require('../lib/prisma');
const wati    = require('../services/watiService');
const { renderTemplate } = require('../services/templateRenderer');

// ── Lead Communication Timeline ───────────────────────────────────────────
exports.getTimeline = async (req, res) => {
  try {
    const { companyId, leadId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const [items, total] = await Promise.all([
      prisma.communication.findMany({
        where: { companyId, leadId },
        include: { template: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * +limit, take: +limit
      }),
      prisma.communication.count({ where: { companyId, leadId } })
    ]);
    return res.json({ success: true, data: { items, total } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── Manual Send ───────────────────────────────────────────────────────────
exports.sendManual = async (req, res) => {
  try {
    const { companyId, leadId } = req.params;
    const { channel = 'WHATSAPP', body, templateId, subject } = req.body;
    if (!body && !templateId) return res.status(400).json({ success: false, error: { message: 'body or templateId required.' } });

    const lead    = await prisma.lead.findFirst({ where: { leadId, companyId } });
    if (!lead)    return res.status(404).json({ success: false, error: { message: 'Lead not found.' } });
    const company = await prisma.company.findUnique({ where: { companyId } });

    let msgBody = body;
    if (templateId) {
      const tpl = await prisma.messageTemplate.findFirst({ where: { templateId, companyId } });
      if (tpl) msgBody = renderTemplate(tpl.body, lead, company?.name || 'Raulji Technologies');
    }

    let status = 'SENT', watiMessageId = null;
    if (channel === 'WHATSAPP') {
      const r = await wati.sendSessionMessage(lead.phone, msgBody);
      watiMessageId = r?.messageId || null;
    }

    const comm = await prisma.communication.create({
      data: {
        companyId, leadId, channel, direction: 'OUTBOUND', status,
        toNumber: lead.phone, body: msgBody, subject: subject || null,
        templateId: templateId || null, watiMessageId, userId: req.user?.userId || null, sentAt: new Date()
      }
    });
    return res.status(201).json({ success: true, data: comm });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── Auto Reply Rules ───────────────────────────────────────────────────────
exports.getAutoReplyRules = async (req, res) => {
  try {
    const rules = await prisma.autoReplyRule.findMany({ where: { companyId: req.params.companyId }, orderBy: { priority: 'asc' } });
    return res.json({ success: true, data: { rules } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.createAutoReplyRule = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { keyword, matchType = 'CONTAINS', replyBody, priority = 0 } = req.body;
    if (!keyword || !replyBody) return res.status(400).json({ success: false, error: { message: 'keyword and replyBody required.' } });
    const rule = await prisma.autoReplyRule.create({ data: { companyId, keyword, matchType, replyBody, priority: +priority } });
    return res.status(201).json({ success: true, data: rule });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.updateAutoReplyRule = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const upd = {};
    ['keyword','matchType','replyBody','isActive'].forEach(k => { if (b[k] !== undefined) upd[k] = b[k]; });
    if (b.priority !== undefined) upd.priority = +b.priority;
    await prisma.autoReplyRule.updateMany({ where: { replyRuleId: id, companyId }, data: upd });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteAutoReplyRule = async (req, res) => {
  try {
    await prisma.autoReplyRule.deleteMany({ where: { replyRuleId: req.params.id, companyId: req.params.companyId } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── WATI Inbound Webhook ───────────────────────────────────────────────────
const crypto = require('crypto');
const { handleInboundMessage } = require('../services/automationEngine');

exports.handleWatiWebhook = async (req, res) => {
  // Verify WATI webhook secret if configured
  const webhookSecret = process.env.WATI_WEBHOOK_SECRET;
  if (webhookSecret) {
    const signature = req.headers['x-wati-signature'] || req.headers['x-hub-signature-256'] || '';
    const payload   = JSON.stringify(req.body);
    const expected  = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(payload).digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
      return res.status(401).json({ success: false, error: { message: 'Invalid webhook signature.' } });
    }
  }

  res.sendStatus(200); // Respond immediately before processing
  try {
    const companyId = req.query.companyId;
    if (!companyId || typeof companyId !== 'string' || companyId.length > 64) return;

    const { parseInboundWebhook } = require('../services/watiService');
    const { phone, body } = parseInboundWebhook(req.body);
    if (!phone || !body) return;

    await handleInboundMessage(phone, body, companyId);
  } catch (err) { console.error('[WATI Webhook]', err.message); }
};
