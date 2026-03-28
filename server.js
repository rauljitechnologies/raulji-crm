require('dotenv').config();

const express   = require('express');
const cors      = require('cors');
const helmet    = require('helmet');
const morgan    = require('morgan');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const app    = express();
const prisma = new PrismaClient();
const PORT   = process.env.PORT || 4000;

// ── Validate env ──────────────────────────────────────────────────────────────
const missing = ['DATABASE_URL', 'JWT_SECRET'].filter(v => !process.env[v]);
if (missing.length) {
  console.error('\n❌  Missing env vars:', missing.join(', '));
  console.error('👉  Copy .env.example → .env and fill in values\n');
  process.exit(1);
}
if (!process.env.JWT_REFRESH_SECRET) {
  console.warn('[Security] JWT_REFRESH_SECRET not set — falling back to JWT_SECRET. Set a separate secret in production.');
}

// ── Security Middleware ───────────────────────────────────────────────────────
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false, // API server — CSP handled by frontend
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
}));

app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',').map(o => o.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Company-ID'],
}));

// ── Rate Limiters ─────────────────────────────────────────────────────────────
// Strict: auth endpoints (login, register, forgot/reset password)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please try again in 15 minutes.' } },
});

// General: all other API routes
const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests. Please slow down.' } },
});

// Public API: webhook and public lead submission
const publicLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMIT', message: 'Too many requests.' } },
});

// ── Body Parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// ── Health check (minimal info) ───────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok' });
  } catch {
    res.status(503).json({ status: 'error' });
  }
});

// ── API Routes ────────────────────────────────────────────────────────────────
// Apply rate limiters at route level (see routes/index.js for per-route application)
app.use('/api/v1/auth',         authLimiter);
app.use('/api/v1/public',       publicLimiter);
app.use('/api/v1/webhooks',     publicLimiter);
app.use('/api/v1',              generalLimiter);
app.use('/api/v1',              require('./backend/routes'));

// ── Automation job runner ─────────────────────────────────────────────────────
require('./backend/services/jobRunner').start();

// ── Daily backup scheduler (05:00 AM IST) ────────────────────────────────────
require('./backend/services/backupScheduler').start();
require('./backend/services/seoScheduler').start();

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` }
}));

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Never leak stack traces in production
  const msg = process.env.NODE_ENV === 'production' ? 'Internal server error.' : err.message;
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: msg }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
async function start() {
  try {
    await prisma.$connect();
    app.listen(PORT, () => {
      console.log('\n╔══════════════════════════════════════════╗');
      console.log('║     ✅  Raulji CRM API is RUNNING!        ║');
      console.log('╠══════════════════════════════════════════╣');
      console.log(`║  Port : ${PORT}                              ║`);
      console.log(`║  ENV  : ${process.env.NODE_ENV || 'development'}                    ║`);
      console.log(`║  DB   : Connected ✓                       ║`);
      console.log(`║  URL  : http://localhost:${PORT}/api/v1       ║`);
      console.log('╚══════════════════════════════════════════╝\n');
    });
  } catch (err) {
    console.error('\n❌ Startup failed:', err.message);
    if (err.message.includes('ECONNREFUSED') || err.message.includes('connect')) {
      console.error('   ➜ PostgreSQL not running. Run: brew services start postgresql@16');
      console.error(`   ➜ DATABASE_URL: ${process.env.DATABASE_URL}`);
    }
    process.exit(1);
  }
}

start();
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
