const bcrypt = require('bcryptjs');
const crypto2 = require('crypto');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const normalizeCompanyIds = (user) => {
  const extra = Array.isArray(user?.permissions?.accessibleCompanyIds) ? user.permissions.accessibleCompanyIds : [];
  return [...new Set([user?.companyId, ...extra].filter(Boolean))];
};

const buildPermissions = (existing = {}, companyIds = []) => ({
  ...existing,
  accessibleCompanyIds: [...new Set(companyIds.filter(Boolean))],
});

exports.getUsers = async (req, res) => {
  try {
    const companyId = req.params.companyId;
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        OR: [
          { companyId },
          { permissions: { path: ['accessibleCompanyIds'], array_contains: companyId } },
        ],
      },
      select: {
        userId: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        permissions: true,
        avatar: true,
        isVerified: true,
        lastLogin: true,
        createdAt: true,
        companyId: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({
      success: true,
      data: {
        users: users.map((user) => ({
          ...user,
          companyIds: normalizeCompanyIds(user),
        })),
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

exports.invite = async (req, res) => {
  try {
    const fallbackCompanyId = req.params.companyId;
    const { name, email, role = 'SALES_REP', companyIds } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, error: { message: 'Name and email required.' } });
    }

    const selectedCompanyIds = [...new Set((Array.isArray(companyIds) && companyIds.length ? companyIds : [fallbackCompanyId]).filter(Boolean))];
    if (!selectedCompanyIds.length) {
      return res.status(400).json({ success: false, error: { message: 'Select at least one company.' } });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const mergedCompanyIds = [...new Set([...normalizeCompanyIds(existing), ...selectedCompanyIds])];
      const updated = await prisma.user.update({
        where: { userId: existing.userId },
        data: {
          name,
          role: role.toUpperCase(),
          isActive: true,
          companyId: existing.companyId || mergedCompanyIds[0] || null,
          permissions: buildPermissions(existing.permissions || {}, mergedCompanyIds),
        },
      });
      return res.status(200).json({
        success: true,
        data: {
          userId: updated.userId,
          name: updated.name,
          email: updated.email,
          role: updated.role,
          status: updated.isVerified ? 'active' : 'pending',
          companyIds: mergedCompanyIds,
        },
      });
    }

    const password = await bcrypt.hash(crypto2.randomBytes(8).toString('hex'), 10);
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password,
        role: role.toUpperCase(),
        companyId: selectedCompanyIds[0],
        isActive: true,
        isVerified: false,
        inviteToken: crypto2.randomBytes(32).toString('hex'),
        inviteExpiry: new Date(Date.now() + 7 * 86400000),
        permissions: buildPermissions({}, selectedCompanyIds),
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        userId: user.userId,
        name,
        email,
        role: user.role,
        status: 'pending',
        companyIds: selectedCompanyIds,
      },
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

exports.updateRole = async (req, res) => {
  try {
    const { userId } = req.params;
    await prisma.user.update({ where: { userId }, data: { role: req.body.role.toUpperCase() } });
    return res.json({ success: true, message: 'Role updated.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

exports.remove = async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    const user = await prisma.user.findUnique({ where: { userId } });
    if (!user) return res.status(404).json({ success: false, error: { message: 'User not found.' } });

    const remainingCompanyIds = normalizeCompanyIds(user).filter((id) => id !== companyId);
    await prisma.user.update({
      where: { userId },
      data: {
        isActive: remainingCompanyIds.length ? user.isActive : false,
        companyId: remainingCompanyIds[0] || null,
        permissions: buildPermissions(user.permissions || {}, remainingCompanyIds),
      },
    });

    return res.json({ success: true, message: remainingCompanyIds.length ? 'Company access removed.' : 'User removed.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

exports.acceptInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await prisma.user.findFirst({ where: { inviteToken: token } });
    if (!user || user.inviteExpiry < new Date()) {
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired invite.' } });
    }
    await prisma.user.update({
      where: { userId: user.userId },
      data: { password: await bcrypt.hash(password, 12), isVerified: true, inviteToken: null, inviteExpiry: null },
    });
    return res.json({ success: true, message: 'Account activated. You can now login.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};
