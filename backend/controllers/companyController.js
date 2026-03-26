const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma  = new PrismaClient();

const genKey = (slug) => `rcrm_live_${slug.slice(0,6)}_${crypto.randomBytes(16).toString('hex')}`;

exports.getAll = async (req, res) => {
  try {
    const { search, status, page=1, limit=20 } = req.query;
    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && { OR:[{name:{contains:search,mode:'insensitive'}},{domain:{contains:search,mode:'insensitive'}}] })
    };
    const [companies, total] = await Promise.all([
      prisma.company.findMany({ where, include:{ _count:{ select:{ leads:true, users:true } } }, orderBy:{ createdAt:'desc' }, skip:(page-1)*+limit, take:+limit }),
      prisma.company.count({ where })
    ]);
    return res.json({ success:true, data:{ companies, pagination:{ total, page:+page, limit:+limit, pages:Math.ceil(total/limit) } } });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.create = async (req, res) => {
  try {
    const { name, domain, gst, industry, plan, address, phone, email, website } = req.body;
    if (!name) return res.status(400).json({ success:false, error:{ message:'Name required.' } });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const exists = await prisma.company.findUnique({ where:{ slug } });
    const finalSlug = exists ? `${slug}-${Date.now()}` : slug;
    const company = await prisma.company.create({ data:{
      name, slug:finalSlug,
      domain:   domain   || null,
      gst:      gst      || null,
      industry: industry || null,
      phone:    phone    || null,
      email:    email    || null,
      website:  website  || null,
      plan:     (plan || 'STARTER').toUpperCase(),
      apiKey:   genKey(finalSlug),
      apiSecret: crypto.randomBytes(16).toString('hex'),
      address:  address || {},
      settings: { currency:'INR', timezone:'Asia/Kolkata', gstRate:18 }
    }});
    return res.status(201).json({ success:true, data:company });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.getOne = async (req, res) => {
  try {
    const co = await prisma.company.findFirst({
      where: { companyId:req.params.companyId, deletedAt:null },
      include: { users:{ select:{ userId:true, name:true, email:true, role:true } }, _count:{ select:{ leads:true, deals:true } } }
    });
    if (!co) return res.status(404).json({ success:false, error:{ message:'Not found.' } });
    return res.json({ success:true, data:co });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.update = async (req, res) => {
  try {
    const updateData = {};
    const fields = ['name','domain','gst','industry','phone','email','website','plan','status','address','bankDetails'];
    fields.forEach(f => { if (req.body[f] !== undefined) updateData[f] = req.body[f]; });
    if (updateData.plan) updateData.plan = updateData.plan.toUpperCase();
    const co = await prisma.company.update({ where:{ companyId:req.params.companyId }, data:updateData });
    return res.json({ success:true, data:co });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.remove = async (req, res) => {
  try {
    await prisma.company.update({ where:{ companyId:req.params.companyId }, data:{ deletedAt:new Date(), status:'DELETED' } });
    return res.json({ success:true, message:'Deleted.' });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.regenerateKey = async (req, res) => {
  try {
    const co = await prisma.company.findUnique({ where:{ companyId:req.params.companyId } });
    const apiKey = genKey(co.slug);
    await prisma.company.update({ where:{ companyId:req.params.companyId }, data:{ apiKey } });
    return res.json({ success:true, data:{ apiKey } });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

// Returns full company profile — used by invoice/quotation create forms
exports.getSettings = async (req, res) => {
  try {
    const co = await prisma.company.findUnique({
      where: { companyId:req.params.companyId },
      select: { companyId:true, name:true, logo:true, gst:true, phone:true, email:true, website:true, address:true, bankDetails:true, settings:true, plan:true, apiKey:true }
    });
    return res.json({ success:true, data:co });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

// Updates both settings JSON and top-level fields (phone, email, website, bankDetails, etc.)
exports.updateSettings = async (req, res) => {
  try {
    const { phone, email, website, address, gst, bankDetails, ...settingsFields } = req.body;
    const co      = await prisma.company.findUnique({ where:{ companyId:req.params.companyId } });
    const merged  = { ...(co.settings || {}), ...settingsFields };
    const updateData = { settings: merged };
    if (phone       !== undefined) updateData.phone       = phone;
    if (email       !== undefined) updateData.email       = email;
    if (website     !== undefined) updateData.website     = website;
    if (address     !== undefined) updateData.address     = address;
    if (gst         !== undefined) updateData.gst         = gst;
    if (bankDetails !== undefined) updateData.bankDetails = bankDetails;
    await prisma.company.update({ where:{ companyId:req.params.companyId }, data: updateData });
    return res.json({ success:true, data:{ settings:merged } });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};
