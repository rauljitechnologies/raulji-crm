const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

const genKey = (slug) => `rcrm_live_${slug.slice(0,6)}_${crypto.randomBytes(16).toString('hex')}`;
const clean = (value) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed || null;
};

const buildAddress = (input = {}) => {
  const address = {
    street: clean(input.street),
    area: clean(input.area),
    city: clean(input.city),
    state: clean(input.state),
    country: clean(input.country),
    pincode: clean(input.pincode),
  };
  return Object.fromEntries(Object.entries(address).filter(([, value]) => value != null));
};

const buildCompanySettings = (existing = {}, input = {}) => {
  const merged = {
    ...existing,
    brandName: clean(input.brandName),
    contactPerson: clean(input.contactPerson),
    mobileNumber: clean(input.mobileNumber),
    email: clean(input.email),
    website: clean(input.website),
    otherInformation: clean(input.otherInformation),
  };
  return Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== undefined));
};

const normalizeCompanyIds = (user) => {
  const extra = Array.isArray(user?.permissions?.accessibleCompanyIds) ? user.permissions.accessibleCompanyIds : [];
  return [...new Set([user?.companyId, ...extra].filter(Boolean))];
};

exports.getAll = async (req, res) => {
  try {
    const { search, status, page=1, limit=20 } = req.query;
    const where = {
      deletedAt: null,
      ...(status && { status }),
      ...(search && { OR:[{name:{contains:search,mode:'insensitive'}},{domain:{contains:search,mode:'insensitive'}}] })
    };
    if (req.user?.role !== 'SUPER_ADMIN') {
      const currentUser = await prisma.user.findUnique({
        where: { userId: req.user.userId },
        select: { companyId: true, permissions: true },
      });
      where.companyId = { in: normalizeCompanyIds(currentUser) };
    }
    const [companies, total] = await Promise.all([
      prisma.company.findMany({ where, include:{ _count:{ select:{ leads:true, users:true } } }, orderBy:{ createdAt:'desc' }, skip:(page-1)*+limit, take:+limit }),
      prisma.company.count({ where })
    ]);
    return res.json({ success:true, data:{ companies, pagination:{ total, page:+page, limit:+limit, pages:Math.ceil(total/limit) } } });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.create = async (req, res) => {
  try {
    const {
      name, domain, gst, industry, plan, address, logo,
      brandName, contactPerson, mobileNumber, email, website, otherInformation
    } = req.body;
    if (!name) return res.status(400).json({ success:false, error:{ message:'Name required.' } });
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
    const exists = await prisma.company.findUnique({ where:{ slug } });
    const finalSlug = exists ? `${slug}-${Date.now()}` : slug;
    const company = await prisma.company.create({ data:{
      name, slug:finalSlug,
      domain: clean(domain),
      logo: clean(logo),
      gst: clean(gst),
      industry: clean(industry),
      plan: (plan || 'STARTER').toUpperCase(),
      apiKey: genKey(finalSlug),
      apiSecret: crypto.randomBytes(16).toString('hex'),
      address: buildAddress(address),
      settings: {
        currency:'INR',
        timezone:'Asia/Kolkata',
        gstRate:18,
        ...buildCompanySettings({}, { brandName, contactPerson, mobileNumber, email, website, otherInformation }),
      }
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
    const {
      name, domain, gst, industry, plan, status, logo, address,
      brandName, contactPerson, mobileNumber, email, website, otherInformation
    } = req.body;
    const current = await prisma.company.findUnique({ where:{ companyId:req.params.companyId } });
    if (!current) return res.status(404).json({ success:false, error:{ message:'Not found.' } });
    const updateData = {};
    if (name     !== undefined) updateData.name     = name;
    if (domain   !== undefined) updateData.domain   = clean(domain);
    if (logo     !== undefined) updateData.logo     = clean(logo);
    if (gst      !== undefined) updateData.gst      = clean(gst);
    if (industry !== undefined) updateData.industry = clean(industry);
    if (plan     !== undefined) updateData.plan     = plan.toUpperCase();
    if (status   !== undefined) updateData.status   = status;
    if (address  !== undefined) updateData.address  = buildAddress(address);
    if ([brandName, contactPerson, mobileNumber, email, website, otherInformation].some(v => v !== undefined)) {
      updateData.settings = buildCompanySettings(current.settings || {}, {
        brandName, contactPerson, mobileNumber, email, website, otherInformation
      });
    }
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

exports.getSettings = async (req, res) => {
  try {
    const co = await prisma.company.findUnique({
      where: { companyId:req.params.companyId },
      select: { companyId:true, name:true, logo:true, domain:true, settings:true, plan:true, apiKey:true, gst:true, address:true }
    });
    return res.json({ success:true, data:co });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};

exports.updateSettings = async (req, res) => {
  try {
    const co = await prisma.company.findUnique({ where:{ companyId:req.params.companyId } });
    const merged = { ...(co.settings || {}), ...req.body };
    await prisma.company.update({ where:{ companyId:req.params.companyId }, data:{ settings:merged } });
    return res.json({ success:true, data:{ settings:merged } });
  } catch(err) { return res.status(500).json({ success:false, error:{ message:err.message } }); }
};
