const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getLeads = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page=1, limit=25, status, source, search, assignedTo, sortBy='createdAt', sortOrder='desc' } = req.query;
    const where = {
      companyId,
      isDeleted: false,
      ...(status     && { status }),
      ...(source     && { source }),
      ...(assignedTo && { assignedToId: assignedTo }),
      ...(search && { OR:[
        { name:  { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } }
      ]})
    };
    const [leads, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: { assignedTo: { select: { userId:true, name:true, avatar:true } } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * +limit,
        take: +limit
      }),
      prisma.lead.count({ where })
    ]);
    return res.json({ success:true, data:{ leads, pagination:{ total, page:+page, limit:+limit, pages:Math.ceil(total/limit) } } });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.getLead = async (req, res) => {
  try {
    const lead = await prisma.lead.findFirst({
      where: { leadId: req.params.leadId, companyId: req.params.companyId, isDeleted: false },
      include: { assignedTo: true, activities: { orderBy: { createdAt: 'desc' }, take: 20 } }
    });
    if (!lead) return res.status(404).json({ success:false, error:{ message:'Lead not found.' } });
    return res.json({ success:true, data:lead });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.createLead = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, email, phone, city, source='MANUAL', status='NEW', priority='MEDIUM', dealValue, notes, assignedToId } = req.body;
    if (!name || !phone) return res.status(400).json({ success:false, error:{ message:'Name and phone required.' } });
    if (email) {
      const exists = await prisma.lead.findFirst({ where: { companyId, email, isDeleted: false } });
      if (exists) return res.status(422).json({ success:false, error:{ code:'LEAD_002', message:'Lead with this email already exists.' } });
    }
    const lead = await prisma.lead.create({
      data: {
        companyId, name,
        email:        email        || null,
        phone,
        city:         city         || null,
        source, status, priority,
        dealValue:    dealValue    ? +dealValue : null,
        notes:        notes        || null,
        assignedToId: assignedToId || null,
        lastActivityAt: new Date()
      }
    });
    await prisma.activity.create({ data:{ companyId, leadId:lead.leadId, userId:req.user?.userId, type:'NOTE', description:`Lead created via ${source.toLowerCase()}` } });
    return res.status(201).json({ success:true, data:lead });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.updateLead = async (req, res) => {
  try {
    const { companyId, leadId } = req.params;
    const old = await prisma.lead.findFirst({ where: { leadId, companyId } });
    if (!old) return res.status(404).json({ success:false, error:{ message:'Lead not found.' } });

    const { name, email, phone, city, source, status, priority, dealValue, notes, assignedToId, nextFollowUpAt } = req.body;

    const data = { lastActivityAt: new Date() };
    if (name           !== undefined) data.name           = name;
    if (email          !== undefined) data.email          = email;
    if (phone          !== undefined) data.phone          = phone;
    if (city           !== undefined) data.city           = city;
    if (source         !== undefined) data.source         = source;
    if (status         !== undefined) data.status         = status;
    if (priority       !== undefined) data.priority       = priority;
    if (dealValue      !== undefined) data.dealValue      = +dealValue;
    if (notes          !== undefined) data.notes          = notes;
    if (assignedToId   !== undefined) data.assignedToId   = assignedToId;
    if (nextFollowUpAt !== undefined) data.nextFollowUpAt = new Date(nextFollowUpAt);

    const lead = await prisma.lead.update({ where: { leadId }, data });

    if (status && status !== old.status) {
      await prisma.activity.create({ data:{ companyId, leadId, userId:req.user?.userId, type:'STATUS_CHANGE', description:`Status changed from ${old.status} to ${status}` } });
    }
    return res.json({ success:true, data:lead });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.deleteLead = async (req, res) => {
  try {
    await prisma.lead.update({ where: { leadId: req.params.leadId }, data: { isDeleted: true } });
    return res.json({ success:true, message:'Lead deleted.' });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.addActivity = async (req, res) => {
  try {
    const { companyId, leadId } = req.params;
    const { type, description, metadata } = req.body;
    const activity = await prisma.activity.create({
      data: { companyId, leadId, userId: req.user?.userId, type: type || 'NOTE', description, metadata: metadata || null }
    });
    await prisma.lead.update({ where: { leadId }, data: { lastActivityAt: new Date() } });
    return res.status(201).json({ success:true, data:activity });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.convertToDeal = async (req, res) => {
  try {
    const { companyId, leadId } = req.params;
    const lead = await prisma.lead.findFirst({ where: { leadId, companyId } });
    if (!lead) return res.status(404).json({ success:false, error:{ message:'Lead not found.' } });
    const deal = await prisma.deal.create({
      data: {
        companyId, leadId,
        name:         `Deal — ${lead.name}`,
        value:        lead.dealValue || 0,
        currency:     'INR',
        stage:        'NEW_LEAD',
        assignedToId: lead.assignedToId
      }
    });
    await prisma.lead.update({ where: { leadId }, data: { status: 'QUALIFIED', lastActivityAt: new Date() } });
    await prisma.activity.create({ data:{ companyId, leadId, userId:req.user?.userId, type:'DEAL_CREATED', description:`Converted to deal: ${deal.name}` } });
    return res.status(201).json({ success:true, data:deal });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.importLeads = async (req, res) => {
  return res.json({ success:true, message:'Import endpoint — attach CSV file.' });
};

exports.exportLeads = async (req, res) => {
  try {
    const { companyId } = req.params;
    const leads = await prisma.lead.findMany({ where: { companyId, isDeleted: false }, orderBy: { createdAt: 'desc' } });
    const csv = [
      'Name,Email,Phone,City,Source,Status,Score,Deal Value,Created',
      ...leads.map(l => `"${l.name}","${l.email||''}","${l.phone}","${l.city||''}","${l.source}","${l.status}","${l.aiScore||''}","${l.dealValue||''}","${l.createdAt.toISOString()}"`)
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    return res.send(csv);
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.createPublicLead = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { name, email, phone, city, source='WEBSITE_FORM', notes, customFields } = req.body;
    if (!name || !phone) return res.status(400).json({ success:false, error:{ message:'Name and phone required.' } });
    const lead = await prisma.lead.create({
      data: {
        companyId, name,
        email:        email        || null,
        phone,
        city:         city         || null,
        source,
        notes:        notes        || null,
        customFields: customFields || null,
        lastActivityAt: new Date()
      }
    });
    return res.status(201).json({ success:true, data:{ leadId:lead.leadId, message:'Lead received.' } });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};
