// backend/controllers/campaignController.js
const prisma  = require('../lib/prisma');
const wati    = require('../services/watiService');
const { renderTemplate } = require('../services/templateRenderer');

function buildLeadWhere(companyId, filters = {}) {
  const where = { companyId, isDeleted: false };
  if (filters.country  && filters.country.length)  where.country  = { in: filters.country };
  if (filters.status   && filters.status.length)   where.status   = { in: filters.status };
  if (filters.service  && filters.service.length)  where.service  = { in: filters.service };
  if (filters.source   && filters.source.length)   where.source   = { in: filters.source };
  return where;
}

exports.listCampaigns = async (req, res) => {
  try {
    const campaigns = await prisma.campaign.findMany({
      where: { companyId: req.params.companyId },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: { campaigns } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.getCampaign = async (req, res) => {
  try {
    const c = await prisma.campaign.findFirst({
      where: { campaignId: req.params.id, companyId: req.params.companyId },
      include: {
        campaignLeads: {
          include: { lead: { select: { leadId: true, name: true, phone: true, country: true, service: true, status: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    if (!c) return res.status(404).json({ success: false, error: { message: 'Campaign not found.' } });
    return res.json({ success: true, data: c });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.createCampaign = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, description, channel = 'WHATSAPP', templateId, subject, body, filters, scheduledAt } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'Campaign name required.' } });
    const c = await prisma.campaign.create({
      data: { companyId, name, description: description || null, channel, templateId: templateId || null, subject: subject || null, body: body || null, filters: filters || null, scheduledAt: scheduledAt ? new Date(scheduledAt) : null, createdById: req.user?.userId || null }
    });
    return res.status(201).json({ success: true, data: c });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.updateCampaign = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const upd = {};
    ['name','description','channel','templateId','subject','body'].forEach(k => { if (b[k] !== undefined) upd[k] = b[k]; });
    if (b.filters     !== undefined) upd.filters     = b.filters;
    if (b.scheduledAt !== undefined) upd.scheduledAt = new Date(b.scheduledAt);
    await prisma.campaign.updateMany({ where: { campaignId: id, companyId }, data: upd });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.deleteCampaign = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    await prisma.campaignLead.deleteMany({ where: { campaignId: id } });
    await prisma.campaign.deleteMany({ where: { campaignId: id, companyId, status: { in: ['DRAFT', 'CANCELLED'] } } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.previewAudience = async (req, res) => {
  try {
    const { companyId } = req.params;
    const c = await prisma.campaign.findFirst({ where: { campaignId: req.params.id, companyId } });
    if (!c) return res.status(404).json({ success: false, error: { message: 'Campaign not found.' } });
    const where = buildLeadWhere(companyId, c.filters || {});
    const [count, sample] = await Promise.all([
      prisma.lead.count({ where }),
      prisma.lead.findMany({ where, take: 5, select: { name: true, phone: true, country: true, service: true, status: true } })
    ]);
    return res.json({ success: true, data: { count, sample } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.launchCampaign = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const c = await prisma.campaign.findFirst({ where: { campaignId: id, companyId }, include: { company: true } });
    if (!c) return res.status(404).json({ success: false, error: { message: 'Campaign not found.' } });
    if (c.status === 'RUNNING' || c.status === 'COMPLETED') return res.status(422).json({ success: false, error: { message: 'Campaign already launched.' } });

    // Get template if linked
    let template = null;
    if (c.templateId) template = await prisma.messageTemplate.findUnique({ where: { templateId: c.templateId } });
    const bodyTemplate = template?.body || c.body || '';
    if (!bodyTemplate) return res.status(400).json({ success: false, error: { message: 'No message body or template set.' } });

    // Get target leads
    const leads = await prisma.lead.findMany({ where: buildLeadWhere(companyId, c.filters || {}) });
    if (leads.length === 0) return res.status(422).json({ success: false, error: { message: 'No leads match the filters.' } });

    // Update campaign status
    await prisma.campaign.update({ where: { campaignId: id }, data: { status: 'RUNNING', startedAt: new Date(), totalLeads: leads.length } });
    res.json({ success: true, message: `Campaign launched to ${leads.length} leads.` });

    // Send in background (batch of 20, 500ms delay between batches)
    let sent = 0, failed = 0;
    const BATCH = 20;
    for (let i = 0; i < leads.length; i += BATCH) {
      const batch = leads.slice(i, i + BATCH);
      await Promise.all(batch.map(async (lead) => {
        const msg = renderTemplate(bodyTemplate, lead, c.company?.name || 'Raulji Technologies');
        let status = 'SENT', error = null;
        try {
          await wati.sendSessionMessage(lead.phone, msg);
          sent++;
        } catch (e) { status = 'FAILED'; error = e.message; failed++; }
        await prisma.campaignLead.upsert({
          where: { campaignId_leadId: { campaignId: id, leadId: lead.leadId } },
          update: { status, ...(status === 'SENT' ? { sentAt: new Date() } : {}), error },
          create: { campaignId: id, leadId: lead.leadId, status, sentAt: status === 'SENT' ? new Date() : null, error }
        });
      }));
      if (i + BATCH < leads.length) await new Promise(r => setTimeout(r, 500));
    }

    await prisma.campaign.update({ where: { campaignId: id }, data: { status: 'COMPLETED', completedAt: new Date(), sentCount: sent, failedCount: failed } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.cancelCampaign = async (req, res) => {
  try {
    await prisma.campaign.updateMany({ where: { campaignId: req.params.id, companyId: req.params.companyId }, data: { status: 'CANCELLED' } });
    return res.json({ success: true, message: 'Cancelled.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
