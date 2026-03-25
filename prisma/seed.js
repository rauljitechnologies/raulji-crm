const { PrismaClient } = require('@prisma/client');
const bcrypt  = require('bcryptjs');
const crypto  = require('crypto');
const prisma  = new PrismaClient();

const hash   = (p) => bcrypt.hashSync(p, 10);
const apiKey = (prefix) => `rcrm_live_${prefix}_${crypto.randomBytes(16).toString('hex')}`;

async function main() {
  console.log('🌱 Seeding Raulji CRM...\n');

  // Companies
  const companies = await Promise.all([
    prisma.company.upsert({ where: { slug: 'raulji-technologies' }, update: {}, create: {
      name: 'Raulji Technologies', slug: 'raulji-technologies',
      domain: 'rauljitechnologies.com', gst: '24AAPL0000A1Z5',
      industry: 'technology', plan: 'GROWTH',
      apiKey: apiKey('co01'), apiSecret: crypto.randomBytes(16).toString('hex'),
      address: { city: 'Vadodara', state: 'Gujarat' },
      settings: { currency: 'INR', timezone: 'Asia/Kolkata', gstRate: 18 }
    }}),
    prisma.company.upsert({ where: { slug: 'ariya-infra' }, update: {}, create: {
      name: 'Ariya Infra', slug: 'ariya-infra',
      domain: 'ariyainfra.com', gst: '27AAPL0000A1Z5',
      industry: 'real_estate', plan: 'ENTERPRISE',
      apiKey: apiKey('co02'), apiSecret: crypto.randomBytes(16).toString('hex'),
      address: { city: 'Mumbai', state: 'Maharashtra' },
      settings: { currency: 'INR', timezone: 'Asia/Kolkata', gstRate: 18 }
    }}),
    prisma.company.upsert({ where: { slug: 'nova-digital' }, update: {}, create: {
      name: 'Nova Digital', slug: 'nova-digital',
      domain: 'novadigital.in', plan: 'STARTER',
      apiKey: apiKey('co03'), apiSecret: crypto.randomBytes(16).toString('hex'),
      address: { city: 'Delhi', state: 'Delhi' },
      settings: { currency: 'INR', timezone: 'Asia/Kolkata', gstRate: 18 }
    }}),
  ]);
  console.log(`✅ ${companies.length} companies`);

  // Super Admin
  await prisma.user.upsert({ where: { email: 'admin@raulji.com' }, update: {}, create: {
    name: 'Super Admin', email: 'admin@raulji.com',
    password: hash('Admin@123'), role: 'SUPER_ADMIN',
    isActive: true, isVerified: true, permissions: {}
  }});

  // Company users
  const userDefs = [
    { name: 'Ariya Raulji',  email: 'ariya@raulji.com',  role: 'ADMIN',         co: 0 },
    { name: 'Priya Mehta',   email: 'priya@raulji.com',  role: 'SALES_MANAGER', co: 0 },
    { name: 'Kiran Rathi',   email: 'kiran@raulji.com',  role: 'SALES_REP',     co: 0 },
    { name: 'Ravi Kumar',    email: 'ravi@ariya.com',    role: 'ADMIN',         co: 1 },
    { name: 'Meena Shah',    email: 'meena@ariya.com',   role: 'SALES_REP',     co: 1 },
    { name: 'Meera Sharma',  email: 'meera@nova.com',    role: 'ADMIN',         co: 2 },
  ];
  const users = [];
  for (const u of userDefs) {
    const user = await prisma.user.upsert({ where: { email: u.email }, update: {}, create: {
      name: u.name, email: u.email, password: hash('Admin@123'),
      role: u.role, companyId: companies[u.co].companyId,
      isActive: true, isVerified: true, permissions: {}
    }});
    users.push(user);
  }
  console.log(`✅ ${users.length + 1} users`);

  // Leads
  const leadDefs = [
    { name: 'Rahul Sharma',  email: 'rahul.s@ex.com',  phone: '+919876543210', city: 'Mumbai',    source: 'FACEBOOK',  status: 'QUALIFIED',   score: 87, value: 67260,  co: 0, ui: 0 },
    { name: 'Anjali Patel',  email: 'anjali.p@ex.com', phone: '+919865432109', city: 'Pune',      source: 'WHATSAPP',  status: 'NEW',         score: 62, value: 45000,  co: 0, ui: 1 },
    { name: 'Vijay Desai',   email: 'vijay.d@ex.com',  phone: '+919854321098', city: 'Ahmedabad', source: 'FACEBOOK',  status: 'LOST',        score: 31, value: 28000,  co: 0, ui: 2 },
    { name: 'Kavita Shah',   email: 'kavita.s@ex.com', phone: '+919843210987', city: 'Surat',     source: 'REFERRAL',  status: 'CONTACTED',   score: 55, value: 35000,  co: 0, ui: 1 },
    { name: 'Rohan Mehta',   email: 'rohan.m@ex.com',  phone: '+919832109876', city: 'Vadodara',  source: 'GOOGLE',    status: 'PROPOSAL',    score: 72, value: 52000,  co: 0, ui: 0 },
    { name: 'Mohit Kumar',   email: 'mohit.k@ex.com',  phone: '+919821098765', city: 'Delhi',     source: 'GOOGLE',    status: 'WON',         score: 94, value: 380000, co: 1, ui: 3 },
    { name: 'Neha Kulkarni', email: 'neha.k@ex.com',   phone: '+919810987654', city: 'Bangalore', source: 'GOOGLE',    status: 'QUALIFIED',   score: 79, value: 75000,  co: 1, ui: 4 },
    { name: 'Ritu Shah',     email: 'ritu.s@ex.com',   phone: '+919809876543', city: 'Mumbai',    source: 'REFERRAL',  status: 'NEGOTIATION', score: 88, value: 240000, co: 1, ui: 3 },
    { name: 'Sanjay Gupta',  email: 'sanjay.g@ex.com', phone: '+919798765432', city: 'Hyderabad', source: 'FACEBOOK',  status: 'NEW',         score: 48, value: 60000,  co: 1, ui: 4 },
    { name: 'Prachi Joshi',  email: 'prachi.j@ex.com', phone: '+919787654321', city: 'Nagpur',    source: 'ORGANIC',   status: 'CONTACTED',   score: 59, value: 25000,  co: 2, ui: 5 },
    { name: 'Amit Sharma',   email: 'amit.sh@ex.com',  phone: '+919776543210', city: 'Jaipur',    source: 'GOOGLE',    status: 'QUALIFIED',   score: 74, value: 48000,  co: 2, ui: 5 },
  ];
  for (const l of leadDefs) {
    try {
      await prisma.lead.create({ data: {
        companyId: companies[l.co].companyId,
        name: l.name, email: l.email, phone: l.phone, city: l.city,
        source: l.source, status: l.status, aiScore: l.score,
        dealValue: l.value, currency: 'INR',
        assignedToId: users[l.ui]?.userId,
        lastActivityAt: new Date()
      }});
    } catch(e) { /* skip duplicates */ }
  }
  console.log(`✅ ${leadDefs.length} leads`);

  console.log('\n╔═══════════════════════════════════════════╗');
  console.log('║  ✅ Seed complete!                         ║');
  console.log('║                                            ║');
  console.log('║  Login: admin@raulji.com / Admin@123       ║');
  console.log('║         ariya@raulji.com / Admin@123       ║');
  console.log('║         priya@raulji.com / Admin@123       ║');
  console.log('╚═══════════════════════════════════════════╝\n');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
