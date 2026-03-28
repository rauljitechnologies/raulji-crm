const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

// Access token uses JWT_SECRET; refresh token uses its own separate secret
const signAccess  = (p) => jwt.sign(p, process.env.JWT_SECRET,         { expiresIn: process.env.JWT_EXPIRES_IN           || '1h',  algorithm: 'HS256' });
const signRefresh = (p) => jwt.sign(p, process.env.JWT_REFRESH_SECRET  || process.env.JWT_SECRET, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d', algorithm: 'HS256' });

// Minimum password length
const MIN_PASSWORD = 8;

// ── Register ──────────────────────────────────────────────────────────────────
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ success: false, error: { message: 'Name, email, password required.' } });
    if (password.length < MIN_PASSWORD)
      return res.status(400).json({ success: false, error: { message: `Password must be at least ${MIN_PASSWORD} characters.` } });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return res.status(400).json({ success: false, error: { message: 'Invalid email address.' } });

    if (await prisma.user.findUnique({ where: { email: email.toLowerCase() } }))
      return res.status(422).json({ success: false, error: { message: 'Email already registered.' } });

    const user = await prisma.user.create({
      data: { name: name.trim(), email: email.toLowerCase(), password: await bcrypt.hash(password, 12), role: 'SUPER_ADMIN', isActive: true, isVerified: true, permissions: {} }
    });
    return res.status(201).json({ success: true, data: { userId: user.userId, email: user.email } });
  } catch (err) { console.error('[Auth] register:', err); return res.status(500).json({ success: false, error: { message: 'Registration failed.' } }); }
};

// ── Login ─────────────────────────────────────────────────────────────────────
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, error: { message: 'Email and password required.' } });

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      include: { company: { select: { companyId: true, name: true, logo: true, plan: true, slug: true } } }
    });

    // Always run bcrypt to prevent timing-based user enumeration
    const dummyHash = '$2a$12$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
    const validPass = user ? await bcrypt.compare(password, user.password) : await bcrypt.compare(password, dummyHash);

    if (!user || !user.isActive || !validPass)
      return res.status(401).json({ success: false, error: { code: 'AUTH_001', message: 'Invalid credentials.' } });

    const payload = { userId: user.userId, email: user.email, role: user.role, companyId: user.companyId };
    const accessToken  = signAccess(payload);
    const refreshToken = signRefresh(payload);

    await prisma.refreshToken.create({ data: { token: refreshToken, userId: user.userId, expiresAt: new Date(Date.now() + 30*86400000) } });
    await prisma.user.update({ where: { userId: user.userId }, data: { lastLogin: new Date() } });

    return res.json({ success: true, data: {
      accessToken, refreshToken, expiresIn: 3600, tokenType: 'Bearer',
      user: { userId: user.userId, name: user.name, email: user.email, role: user.role, companyId: user.companyId, avatar: user.avatar, permissions: user.permissions, company: user.company }
    }});
  } catch (err) { console.error('[Auth] login:', err); return res.status(500).json({ success: false, error: { message: 'Login failed.' } }); }
};

// ── Refresh Token ─────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return res.status(400).json({ success: false, error: { message: 'Refresh token required.' } });

    const stored = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });
    if (!stored || stored.expiresAt < new Date())
      return res.status(401).json({ success: false, error: { message: 'Refresh token expired.' } });

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const newAccess = signAccess({ userId: decoded.userId, email: decoded.email, role: decoded.role, companyId: decoded.companyId });
    return res.json({ success: true, data: { accessToken: newAccess, expiresIn: 3600 } });
  } catch { return res.status(401).json({ success: false, error: { message: 'Invalid refresh token.' } }); }
};

// ── Logout ────────────────────────────────────────────────────────────────────
exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (refreshToken) await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    return res.json({ success: true, message: 'Logged out.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Logout failed.' } }); }
};

// ── Get Me ────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { userId: req.user.userId },
      select: {
        userId: true, name: true, email: true, phone: true,
        role: true, permissions: true, avatar: true,
        companyId: true, isVerified: true, lastLogin: true, createdAt: true,
        // apiKey intentionally excluded from company select
        company: { select: { companyId: true, name: true, logo: true, plan: true, slug: true } }
      }
    });
    return res.json({ success: true, data: user });
  } catch (err) { console.error('[Auth] getMe:', err); return res.status(500).json({ success: false, error: { message: 'Failed to fetch user.' } }); }
};

// ── Update Me ─────────────────────────────────────────────────────────────────
exports.updateMe = async (req, res) => {
  try {
    const { name, phone, avatar } = req.body;
    const updated = await prisma.user.update({
      where: { userId: req.user.userId },
      data: { ...(name && { name: name.trim() }), ...(phone && { phone }), ...(avatar && { avatar }) },
      select: { userId: true, name: true, email: true, phone: true, avatar: true }
    });
    return res.json({ success: true, data: updated });
  } catch { return res.status(500).json({ success: false, error: { message: 'Update failed.' } }); }
};

// ── Change Password ───────────────────────────────────────────────────────────
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, error: { message: 'currentPassword and newPassword required.' } });
    if (newPassword.length < MIN_PASSWORD)
      return res.status(400).json({ success: false, error: { message: `Password must be at least ${MIN_PASSWORD} characters.` } });

    const user = await prisma.user.findUnique({ where: { userId: req.user.userId } });
    if (!await bcrypt.compare(currentPassword, user.password))
      return res.status(400).json({ success: false, error: { message: 'Current password incorrect.' } });

    await prisma.user.update({ where: { userId: req.user.userId }, data: { password: await bcrypt.hash(newPassword, 12) } });
    // Revoke all existing refresh tokens to force re-login on other devices
    await prisma.refreshToken.deleteMany({ where: { userId: req.user.userId } });
    return res.json({ success: true, message: 'Password changed. Please log in again on other devices.' });
  } catch (err) { console.error('[Auth] changePassword:', err); return res.status(500).json({ success: false, error: { message: 'Password change failed.' } }); }
};

// ── Forgot Password ───────────────────────────────────────────────────────────
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: { message: 'Email required.' } });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always return the same response to avoid user enumeration
    if (!user) return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });

    // Cryptographically secure 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    await prisma.user.update({
      where: { userId: user.userId },
      data: { inviteToken: `otp:${otp}`, inviteExpiry: new Date(Date.now() + 10 * 60000) } // 10 min expiry
    });
    // In production: send via email/SMS. Removed console.log to avoid OTP leaking in logs.
    // TODO: plug in your SMTP/SMS service here
    return res.json({ success: true, message: 'If that email exists, an OTP has been sent.' });
  } catch { return res.status(500).json({ success: false, error: { message: 'Request failed.' } }); }
};

// ── Reset Password ────────────────────────────────────────────────────────────
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword)
      return res.status(400).json({ success: false, error: { message: 'email, otp, newPassword required.' } });
    if (newPassword.length < MIN_PASSWORD)
      return res.status(400).json({ success: false, error: { message: `Password must be at least ${MIN_PASSWORD} characters.` } });

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (!user || !user.inviteToken?.startsWith('otp:') || user.inviteExpiry < new Date())
      return res.status(400).json({ success: false, error: { message: 'Invalid or expired OTP.' } });

    // Constant-time comparison to prevent timing attacks
    const storedOtp  = user.inviteToken.replace('otp:', '');
    const inputBuf   = Buffer.from(otp.padEnd(6, ' '));
    const storedBuf  = Buffer.from(storedOtp.padEnd(6, ' '));
    const match      = inputBuf.length === storedBuf.length && crypto.timingSafeEqual(inputBuf, storedBuf);
    if (!match)
      return res.status(400).json({ success: false, error: { message: 'Wrong OTP.' } });

    await prisma.user.update({
      where: { userId: user.userId },
      data: { password: await bcrypt.hash(newPassword, 12), inviteToken: null, inviteExpiry: null }
    });
    // Revoke all refresh tokens after password reset
    await prisma.refreshToken.deleteMany({ where: { userId: user.userId } });
    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (err) { console.error('[Auth] resetPassword:', err); return res.status(500).json({ success: false, error: { message: 'Reset failed.' } }); }
};
