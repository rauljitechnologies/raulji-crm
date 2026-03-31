// ── userController.js ─────────────────────────────────────────
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

const VALID_ROLES = ['SUPER_ADMIN', 'ADMIN', 'MANAGER', 'SALES_REP', 'VIEWER'];

exports.getUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { companyId: req.params.companyId, isActive: true },
      select: { userId: true, name: true, email: true, phone: true, role: true, permissions: true, avatar: true, isVerified: true, lastLogin: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
    return res.json({ success: true, data: { users } });
  } catch { return res.status(500).json({ success: false, error: { message: 'Failed to fetch users.' } }); }
};

exports.getAllUsers = async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        userId: true, name: true, email: true, role: true, permissions: true,
        isActive: true, isVerified: true, lastLogin: true, createdAt: true, companyId: true,
        company: { select: { companyId: true, name: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json({ success: true, data: { users } });
  } catch { return res.status(500).json({ success: false, error: { message: 'Failed to fetch users.' } }); }
};

exports.invite = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { name, email, role = 'SALES_REP', password } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, error: { message: 'Name and email required.' } });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, error: { message: 'Invalid email address.' } });

    if (password !== undefined && password !== '' && password.length < 8)
      return res.status(400).json({ success: false, error: { message: 'Password must be at least 8 characters.' } });

    const normalizedRole = role.toUpperCase();
    if (!VALID_ROLES.includes(normalizedRole))
      return res.status(400).json({ success: false, error: { message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` } });

    // Prevent inviting a SUPER_ADMIN from a non-super-admin
    if (normalizedRole === 'SUPER_ADMIN' && req.user?.role !== 'SUPER_ADMIN')
      return res.status(403).json({ success: false, error: { message: 'Only Super Admins can create Super Admin accounts.' } });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      if (existing.isActive)
        return res.status(422).json({ success: false, error: { message: 'Email already registered.' } });
      // Reactivate a previously removed user
      const useDirectPassword = password && password.length >= 8;
      const updated = await prisma.user.update({
        where: { userId: existing.userId },
        data: {
          name: name.trim(),
          role: normalizedRole,
          companyId,
          isActive: true,
          permissions: {},
          ...(useDirectPassword
            ? { password: await bcrypt.hash(password, 12), isVerified: true, inviteToken: null, inviteExpiry: null }
            : { inviteToken: crypto.randomBytes(32).toString('hex'), inviteExpiry: new Date(Date.now() + 7 * 86400000), isVerified: false })
        }
      });
      return res.status(200).json({
        success: true,
        data: { userId: updated.userId, name: updated.name, email: updated.email, role: updated.role, status: useDirectPassword ? 'active' : 'pending' }
      });
    }

    const useDirectPassword = password && password.length >= 8;
    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase(),
        password: useDirectPassword
          ? await bcrypt.hash(password, 12)
          : await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10),
        role: normalizedRole,
        companyId,
        isActive: true,
        isVerified: useDirectPassword ? true : false,
        inviteToken: useDirectPassword ? null : crypto.randomBytes(32).toString('hex'),
        inviteExpiry: useDirectPassword ? null : new Date(Date.now() + 7 * 86400000),
        permissions: {}
      }
    });
    return res.status(201).json({
      success: true,
      data: { userId: user.userId, name, email, role: user.role, status: useDirectPassword ? 'active' : 'pending' }
    });
  } catch { return res.status(500).json({ success: false, error: { message: 'Invite failed.' } }); }
};

exports.updateRole = async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    const normalizedRole = req.body.role?.toUpperCase();
    if (!normalizedRole || !VALID_ROLES.includes(normalizedRole))
      return res.status(400).json({ success: false, error: { message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}.` } });

    // Prevent escalation to SUPER_ADMIN unless caller is SUPER_ADMIN
    if (normalizedRole === 'SUPER_ADMIN' && req.user?.role !== 'SUPER_ADMIN')
      return res.status(403).json({ success: false, error: { message: 'Only Super Admins can assign Super Admin role.' } });

    await prisma.user.updateMany({ where: { userId, companyId }, data: { role: normalizedRole } });
    return res.json({ success: true, message: 'Role updated.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Update failed.' } }); }
};

exports.remove = async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    // Prevent removing yourself
    if (req.user?.userId === userId)
      return res.status(400).json({ success: false, error: { message: 'You cannot remove your own account.' } });
    await prisma.user.updateMany({ where: { userId, companyId }, data: { isActive: false, companyId: null } });
    return res.json({ success: true, message: 'User removed.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Remove failed.' } }); }
};

exports.updatePermissions = async (req, res) => {
  try {
    const { companyId, userId } = req.params;
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object' || Array.isArray(permissions))
      return res.status(400).json({ success: false, error: { message: 'permissions must be a plain object.' } });

    // Whitelist allowed permission keys
    const ALLOWED_KEYS = ['leads', 'deals', 'invoices', 'quotations', 'clients', 'analytics', 'settings', 'users', 'campaigns', 'templates', 'automation'];
    const sanitized = {};
    for (const key of ALLOWED_KEYS) {
      if (permissions[key] !== undefined) {
        sanitized[key] = Boolean(permissions[key]);
      }
    }
    await prisma.user.updateMany({ where: { userId, companyId }, data: { permissions: sanitized } });
    return res.json({ success: true, message: 'Permissions updated.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Update failed.' } }); }
};

exports.unremove = async (req, res) => {
  try {
    const { userId } = req.params;
    const u = await prisma.user.findUnique({ where: { userId } });
    if (!u) return res.status(404).json({ success: false, error: { message: 'User not found.' } });
    if (u.isActive) return res.status(400).json({ success: false, error: { message: 'User is already active.' } });
    await prisma.user.update({ where: { userId }, data: { isActive: true } });
    return res.json({ success: true, message: 'User restored.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Restore failed.' } }); }
};

exports.permanentDelete = async (req, res) => {
  try {
    const { userId } = req.params;
    const u = await prisma.user.findUnique({ where: { userId } });
    if (!u) return res.status(404).json({ success: false, error: { message: 'User not found.' } });
    if (u.isActive) return res.status(400).json({ success: false, error: { message: 'Cannot permanently delete an active user. Remove them first.' } });
    await prisma.user.delete({ where: { userId } });
    return res.json({ success: true, message: 'User permanently deleted.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Delete failed.' } }); }
};

exports.acceptInvite = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ success: false, error: { message: 'token and password required.' } });
    if (password.length < 8)
      return res.status(400).json({ success: false, error: { message: 'Password must be at least 8 characters.' } });
    // Ensure token is a valid hex string (prevents injection of otp: prefix tokens)
    if (!/^[a-f0-9]{64}$/.test(token))
      return res.status(400).json({ success: false, error: { message: 'Invalid invite token.' } });

    const user = await prisma.user.findFirst({ where: { inviteToken: token } });
    if (!user || user.inviteExpiry < new Date())
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired invite.' } });

    await prisma.user.update({
      where: { userId: user.userId },
      data: { password: await bcrypt.hash(password, 12), isVerified: true, inviteToken: null, inviteExpiry: null }
    });
    return res.json({ success: true, message: 'Account activated. You can now log in.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Activation failed.' } }); }
};
