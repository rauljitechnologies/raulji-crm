const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const signAccess  = (p) => jwt.sign(p, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN  || '1h'  });
const signRefresh = (p) => jwt.sign(p, process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' });
const normalizeCompanyIds = (user) => {
  const extra = Array.isArray(user?.permissions?.accessibleCompanyIds) ? user.permissions.accessibleCompanyIds : [];
  return [...new Set([user?.companyId, ...extra].filter(Boolean))];
};

exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: { message: 'Name, email, password required.' } });
    if (await prisma.user.findUnique({ where: { email } }))
      return res.status(422).json({ success: false, error: { message: 'Email already registered.' } });
    const user = await prisma.user.create({
      data: { name, email, password: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN', isActive: true, isVerified: true, permissions: {} }
    });
    return res.status(201).json({ success: true, data: { userId: user.userId, email: user.email } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: { message: 'Email and password required.' } });
    const user = await prisma.user.findUnique({
      where: { email },
      include: { company: { select: { companyId: true, name: true, logo: true, plan: true, slug: true } } }
    });
    if (!user || !user.isActive)
      return res.status(401).json({ success: false, error: { code: 'AUTH_001', message: 'Invalid credentials.' } });
    if (!await bcrypt.compare(password, user.password))
      return res.status(401).json({ success: false, error: { code: 'AUTH_001', message: 'Invalid credentials.' } });

    const accessibleCompanyIds = normalizeCompanyIds(user);
    const accessibleCompanies = user.role === 'SUPER_ADMIN'
      ? await prisma.company.findMany({
          where: { deletedAt: null, status: { not: 'DELETED' } },
          select: { companyId: true, name: true, logo: true, plan: true, slug: true },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.company.findMany({
          where: { companyId: { in: accessibleCompanyIds }, deletedAt: null, status: { not: 'DELETED' } },
          select: { companyId: true, name: true, logo: true, plan: true, slug: true },
          orderBy: { createdAt: 'desc' },
        });

    const payload = { userId: user.userId, email: user.email, role: user.role, companyId: user.companyId, companyIds: accessibleCompanyIds };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.userId, expiresAt: new Date(Date.now() + 30*86400000) } });
    await prisma.user.update({ where: { userId: user.userId }, data: { lastLogin: new Date() } });

    return res.json({ success: true, data: {
      accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        companyId: user.companyId,
        companyIds: accessibleCompanyIds,
        avatar: user.avatar,
        permissions: { ...(user.permissions || {}), accessibleCompanyIds },
        company: user.company,
        companies: accessibleCompanies,
      }
    }});
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: { message: 'Refresh token required.' } });
    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date())
      return res.status(401).json({ success: false, error: { message: 'Refresh token expired.' } });
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    return res.json({ success: true, data: { accessToken: signAccess({ userId: decoded.userId, email: decoded.email, role: decoded.role, companyId: decoded.companyId, companyIds: decoded.companyIds || [] }), expiresIn: 3600 } });
  } catch (err) { return res.status(401).json({ success: false, error: { message: 'Invalid refresh token.' } }); }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return res.json({ success: true, message: 'Logged out.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: req.user.userId },
      include: { company: { select: { companyId: true, name: true, logo: true, plan: true, slug: true, apiKey: true } } }
    });
    const accessibleCompanyIds = normalizeCompanyIds(user);
    const companies = user.role === 'SUPER_ADMIN'
      ? await prisma.company.findMany({
          where: { deletedAt: null, status: { not: 'DELETED' } },
          select: { companyId: true, name: true, logo: true, plan: true, slug: true },
          orderBy: { createdAt: 'desc' },
        })
      : await prisma.company.findMany({
          where: { companyId: { in: accessibleCompanyIds }, deletedAt: null, status: { not: 'DELETED' } },
          select: { companyId: true, name: true, logo: true, plan: true, slug: true },
          orderBy: { createdAt: 'desc' },
        });
    return res.json({ success: true, data: {
      userId: user.userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      permissions: { ...(user.permissions || {}), accessibleCompanyIds },
      avatar: user.avatar,
      companyId: user.companyId,
      companyIds: accessibleCompanyIds,
      isVerified: user.isVerified,
      lastLogin: user.lastLogin,
      company: user.company,
      companies,
      createdAt: user.createdAt,
    } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.updateMe = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const updated = await prisma.user.update({ where: { userId: req.user.userId }, data: { ...(name&&{name}), ...(phone&&{phone}), ...(avatar&&{avatar}) }, select: { userId: true, name: true, email: true, phone: true, avatar: true } });
    return res.json({ success: true, data: updated });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { userId: req.user.userId } });
    if (!await bcrypt.compare(currentPassword, user.password))
      return res.status(400).json({ success: false, error: { message: 'Current password incorrect.' } });
    await prisma.user.update({ where: { userId: req.user.userId }, data: { password: await bcrypt.hash(newPassword, 12) } });
    return res.json({ success: true, message: 'Password changed.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.json({ success: true, message: 'If email exists, OTP sent.' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await prisma.user.update({ where: { userId: user.userId }, data: { inviteToken: `otp:${otp}`, inviteExpiry: new Date(Date.now() + 15*60000) } });
    console.log(`[DEV] OTP for ${email}: ${otp}`);
    return res.json({ success: true, message: 'OTP sent.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.inviteToken?.startsWith('otp:') || user.inviteExpiry < new Date())
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired OTP.' } });
    if (user.inviteToken.replace('otp:','') !== otp)
      return res.status(400).json({ success: false, error: { message: 'Wrong OTP.' } });
    await prisma.user.update({ where: { userId: user.userId }, data: { password: await bcrypt.hash(newPassword, 12), inviteToken: null, inviteExpiry: null } });
    return res.json({ success: true, message: 'Password reset.' });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
