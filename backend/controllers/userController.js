// ── userController.js ─────────────────────────────────────────
const bcrypt = require('bcryptjs');
const crypto2 = require('crypto');

exports.getUsers = async (req,res) => {
  try {
    const users = await prisma.user.findMany({ where:{companyId:req.params.companyId,isActive:true}, select:{userId:true,name:true,email:true,phone:true,role:true,permissions:true,avatar:true,isVerified:true,lastLogin:true,createdAt:true}, orderBy:{createdAt:'asc'} });
    return res.json({ success:true,data:{users} });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};

exports.invite = async (req,res) => {
  try {
    const { companyId } = req.params;
    const { name, email, role='SALES_REP' } = req.body;
    if (!name||!email) return res.status(400).json({ success:false,error:{message:'Name and email required.'} });
    if (await prisma.user.findUnique({where:{email}})) return res.status(422).json({ success:false,error:{message:'Email already registered.'} });
    const user = await prisma.user.create({ data:{ name, email, password:await bcrypt.hash(crypto2.randomBytes(8).toString('hex'),10), role:role.toUpperCase(), companyId, isActive:true, isVerified:false, inviteToken:crypto2.randomBytes(32).toString('hex'), inviteExpiry:new Date(Date.now()+7*86400000), permissions:{} } });
    return res.status(201).json({ success:true,data:{userId:user.userId,name,email,role:user.role,status:'pending'} });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};

exports.updateRole = async (req,res) => {
  try {
    const { companyId, userId } = req.params;
    await prisma.user.updateMany({ where:{userId,companyId}, data:{role:req.body.role.toUpperCase()} });
    return res.json({ success:true,message:'Role updated.' });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};

exports.remove = async (req,res) => {
  try {
    const { companyId, userId } = req.params;
    await prisma.user.updateMany({ where:{userId,companyId}, data:{isActive:false,companyId:null} });
    return res.json({ success:true,message:'User removed.' });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};

exports.acceptInvite = async (req,res) => {
  try {
    const { token, password } = req.body;
    const user = await prisma.user.findFirst({ where:{inviteToken:token} });
    if (!user||user.inviteExpiry<new Date()) return res.status(400).json({ success:false,error:{message:'Invalid or expired invite.'} });
    await prisma.user.update({ where:{userId:user.userId}, data:{password:await bcrypt.hash(password,12),isVerified:true,inviteToken:null,inviteExpiry:null} });
    return res.json({ success:true,message:'Account activated. You can now login.' });
  } catch(err) { return res.status(500).json({ success:false,error:{message:err.message} }); }
};


