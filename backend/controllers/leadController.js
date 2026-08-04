
const prisma  = require('../lib/prisma');

exports.getLeads = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { page=1, limit=25, status, source, service, country, search, assignedTo, sortBy='createdAt', sortOrder='desc' } = req.query;
    const where = {
      companyId,
      isDeleted: false,
      ...(status     && { status }),
      ...(source     && { source }),
      ...(service    && { service: { equals: service, mode: 'insensitive' } }),
      ...(country    && { country: { equals: country, mode: 'insensitive' } }),
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
    const { name, email, phone, city, state, country, service, source='MANUAL', status='NEW', priority='MEDIUM', dealValue, notes, message, assignedToId } = req.body;
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
        state:        state        || null,
        country:      country      || null,
        service:      service      || null,
        source, status, priority,
        dealValue:    dealValue    ? +dealValue : null,
        notes:        notes        || null,
        message:      message      || null,
        assignedToId: assignedToId || null,
        lastActivityAt: new Date()
      }
    });
    const activityDesc = message ? `Lead created via ${source.toLowerCase()} — Message: ${message}` : `Lead created via ${source.toLowerCase()}`;
    await prisma.activity.create({ data:{ companyId, leadId:lead.leadId, userId:req.user?.userId, type:'NOTE', description:activityDesc } });
    return res.status(201).json({ success:true, data:lead });
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.updateLead = async (req, res) => {
  try {
    const { companyId, leadId } = req.params;
    const old = await prisma.lead.findFirst({ where: { leadId, companyId } });
    if (!old) return res.status(404).json({ success:false, error:{ message:'Lead not found.' } });

    const { name, email, phone, city, state, country, service, source, status, priority, dealValue, notes, message, assignedToId, nextFollowUpAt } = req.body;

    const data = { lastActivityAt: new Date() };
    if (name           !== undefined) data.name           = name;
    if (email          !== undefined) data.email          = email;
    if (phone          !== undefined) data.phone          = phone;
    if (city           !== undefined) data.city           = city;
    if (state          !== undefined) data.state          = state;
    if (country        !== undefined) data.country        = country;
    if (service        !== undefined) data.service        = service;
    if (source         !== undefined) data.source         = source;
    if (status         !== undefined) data.status         = status;
    if (priority       !== undefined) data.priority       = priority;
    if (dealValue      !== undefined) data.dealValue      = +dealValue;
    if (notes          !== undefined) data.notes          = notes;
    if (message        !== undefined) data.message        = message;
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
      'Name,Email,Phone,City,State,Country,Service,Source,Status,Score,Deal Value,Created',
      ...leads.map(l => `"${(l.name||'').replace(/"/g,'""')}","${l.email||''}","${l.phone||''}","${l.city||''}","${l.state||''}","${l.country||''}","${l.service||''}","${l.source||''}","${l.status||''}","${l.aiScore||''}","${l.dealValue||''}","${l.createdAt.toISOString()}"`)
    ].join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=leads.csv');
    return res.send(csv);
  } catch (err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.createPublicLead = async (req, res) => {
  try {
    const companyId = req.companyId;
    const { name, email, phone, city, state, country, service, source='WEBSITE_FORM', notes, message, customFields } = req.body;
    if (!name || !phone) return res.status(400).json({ success:false, error:{ message:'Name and phone required.' } });
    const lead = await prisma.lead.create({
      data: {
        companyId, name,
        email:        email        || null,
        phone,
        city:         city         || null,
        state:        state        || null,
        country:      country      || null,
        service:      service      || null,
        source,
        notes:        notes        || null,
        message:      message      || null,
        customFields: customFields || null,
        lastActivityAt: new Date()
      }
    });
    if (message) {
      await prisma.activity.create({ data:{ companyId, leadId:lead.leadId, type:'NOTE', description:`Message: ${message}` } });
    }
    return res.status(201).json({ success:true, data:{ leadId:lead.leadId, duplicate:false, message:'Lead received.' } });
  } catch (err) {
    // Leads are unique on (companyId, email). A repeat enquiry from someone we
    // already hold is normal for a website form, not an error — record it on the
    // existing lead so the enquiry is never dropped, rather than 500ing.
    if (err.code === 'P2002' && req.body.email) {
      try {
        const existing = await prisma.lead.findFirst({
          where:  { companyId: req.companyId, email: req.body.email },
          select: { leadId: true }
        });
        if (existing) {
          const { message, notes, service, source='WEBSITE_FORM' } = req.body;
          const detail = [message, notes, service && `Service: ${service}`]
            .filter(Boolean).join(' | ') || 'No additional detail.';
          await prisma.activity.create({
            data: {
              companyId: req.companyId,
              leadId:    existing.leadId,
              type:      'NOTE',
              description: `Repeat enquiry via ${source}: ${detail}`
            }
          });
          await prisma.lead.update({
            where: { leadId: existing.leadId },
            data:  { lastActivityAt: new Date() }
          });
          return res.status(200).json({
            success: true,
            data: { leadId: existing.leadId, duplicate: true, message: 'Enquiry recorded on existing lead.' }
          });
        }
      } catch { /* fall through to the generic error below */ }
    }
    // Never surface raw ORM errors — they expose schema internals to callers.
    console.error('[createPublicLead]', err);
    return res.status(500).json({ success:false, error:{ message:'Could not record lead. Please try again.' } });
  }
};
