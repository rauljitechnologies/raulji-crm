const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer '))
      return res.status(401).json({ success: false, error: { code: 'AUTH_001', message: 'No token provided.' } });

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: { code: 'AUTH_002', message: 'Token invalid or expired.' } });
  }
};

exports.requireRole = (roles) => (req, res, next) => {
  if (!roles.includes(req.user?.role))
    return res.status(403).json({ success: false, error: { code: 'AUTH_003', message: 'Insufficient permissions.' } });
  next();
};

exports.apiKeyAuth = async (req, res, next) => {
  try {
    const key = req.headers['x-api-key'];
    if (!key)
      return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'API key required.' } });

    const company = await prisma.company.findFirst({ where: { apiKey: key, status: 'ACTIVE' } });
    if (!company)
      return res.status(401).json({ success: false, error: { code: 'AUTH_004', message: 'Invalid API key.' } });

    req.company  = company;
    req.companyId = company.companyId;
    next();
  } catch (err) {
    return res.status(500).json({ success: false, error: { code: 'SERVER_001', message: err.message } });
  }
};
