// backend/controllers/templateController.js
const prisma = require('../lib/prisma');
const { extractVariables, renderTemplate, validateTemplate } = require('../services/templateRenderer');

exports.list = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { channel } = req.query;
    const where = { companyId, ...(channel && { channel }) };
    const templates = await prisma.messageTemplate.findMany({ where, orderBy: { createdAt: 'desc' } });
    return res.json({ success: true, data: { templates } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.get = async (req, res) => {
  try {
    const t = await prisma.messageTemplate.findFirst({ where: { templateId: req.params.id, companyId: req.params.companyId } });
    if (!t) return res.status(404).json({ success: false, error: { message: 'Template not found.' } });
    return res.json({ success: true, data: t });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.create = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, category = 'CUSTOM', channel = 'WHATSAPP', subject, body } = req.body;
    if (!name || !body) return res.status(400).json({ success: false, error: { message: 'Name and body required.' } });
    const variables = extractVariables(body);
    const t = await prisma.messageTemplate.create({ data: { companyId, name, category, channel, subject: subject || null, body, variables } });
    return res.status(201).json({ success: true, data: t });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.update = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const b = req.body;
    const upd = {};
    if (b.name     !== undefined) upd.name     = b.name;
    if (b.category !== undefined) upd.category = b.category;
    if (b.channel  !== undefined) upd.channel  = b.channel;
    if (b.subject  !== undefined) upd.subject  = b.subject;
    if (b.isActive !== undefined) upd.isActive = b.isActive;
    if (b.body     !== undefined) { upd.body = b.body; upd.variables = extractVariables(b.body); }
    await prisma.messageTemplate.updateMany({ where: { templateId: id, companyId }, data: upd });
    return res.json({ success: true, message: 'Updated.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.remove = async (req, res) => {
  try {
    await prisma.messageTemplate.deleteMany({ where: { templateId: req.params.id, companyId: req.params.companyId } });
    return res.json({ success: true, message: 'Deleted.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.preview = async (req, res) => {
  try {
    const { id, companyId } = req.params;
    const { lead } = req.body;
    const t = await prisma.messageTemplate.findFirst({ where: { templateId: id, companyId } });
    if (!t) return res.status(404).json({ success: false, error: { message: 'Template not found.' } });
    const company = await prisma.company.findUnique({ where: { companyId } });
    const sampleLead = lead || { name: 'Rahul Sharma', service: 'Website Development', city: 'Ahmedabad', state: 'Gujarat', country: 'India', phone: '9876543210', email: 'rahul@example.com', status: 'NEW' };
    const rendered = renderTemplate(t.body, sampleLead, company?.name || 'Raulji Technologies');
    return res.json({ success: true, data: { rendered, variables: t.variables } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
