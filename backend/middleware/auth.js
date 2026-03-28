const jwt    = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// ── Authenticate JWT ──────────────────────────────────────────────────────────
exports.authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ success: false, error: { code: 'AUTH_001', message: 'No token provided.' } });

    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ success: false, error: { code: 'AUTH_002', message: 'Token invalid or expired.' } });
  }
};

// ── Require Role ──────────────────────────────────────────────────────────────
exports.requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ success: false, error: { code: 'AUTH_003', message: 'Insufficient permissions.' } });
  next();
};

// ── Company Ownership Guard ───────────────────────────────────────────────────
// Ensures the authenticated user belongs to the companyId in the URL param.
// SUPER_ADMIN bypasses this check (they manage all companies).
exports.requireCompanyAccess = (req, res, next) => {
  const { companyId } = req.params;
  if (!companyId)      return next();
  if (req.user?.role === 'SUPER_ADMIN') return next();
  if (req.user?.companyId !== companyId)
    return res.status(403).json({ success: false, error: { code: 'AUTH_005', message: 'Access denied to this company.' } });
  next();
};

// ── API Key Auth ──────────────────────────────────────────────────────────────
exports.apiKeyAuth = async (req, res, next) => {
  try {
    const key = req.headers['x-api-key'];
    if (!key)
      return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'API key required.' } });

    // Prevent excessively long keys (security: avoid ReDoS / DB abuse)
    if (typeof key !== 'string' || key.length > 128)
      return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'Invalid API key.' } });

    const company = await prisma.company.findFirst({ where: { apiKey: key, status: 'ACTIVE' } });
    if (!company)
      return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'Invalid API key.' } });

    req.company   = company;
    req.companyId = company.companyId;
    next();
  } catch {
    return res.status(500).json({ success: false, error: { code: 'SERVER_001', message: 'Authentication error.' } });
  }
};
