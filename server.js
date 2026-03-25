require('dotenv').config();

const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const morgan  = require('morgan');
const { PrismaClient } = require('@prisma/client');

const app    = express();
const prisma = new PrismaClient();
const PORT   = process.env.PORT || 4000;

// Validate env
const missing = ['DATABASE_URL','JWT_SECRET'].filter(v => !process.env[v]);
if (missing.length) {
  console.error('\n❌  Missing env vars:', missing.join(', '));
  console.error('👉  Copy .env.example → .env and fill in values\n');
  process.exit(1);
}

// Middleware
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-API-Key','X-Company-ID']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check
app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', env: process.env.NODE_ENV, db: 'connected', version: '1.0.0' });
  } catch (e) {
    res.status(503).json({ status: 'error', db: 'disconnected', error: e.message });
  }
});

// API Routes
app.use('/api/v1', require('./backend/routes'));

// 404
app.use((req, res) => res.status(404).json({
  success: false,
  error: { code: 'NOT_FOUND', message: `${req.method} ${req.path} not found` }
}));

// Error handler
app.use((err, req, res, next) => {
  console.error('[Error]', err.message);
  res.status(err.status || 500).json({
    success: false,
    error: { code: 'SERVER_ERROR', message: err.message }
  });
});

// Start
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
