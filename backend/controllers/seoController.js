// backend/controllers/seoController.js

const prisma = require('../lib/prisma');
const { runAudit, checkUrl } = require('../services/seoAuditEngine');

// ── Trigger audit ──────────────────────────────────────────────────────────────
exports.triggerAudit = async (req, res) => {
  try {
    const { companyId } = req.params;
    const co = await prisma.company.findUnique({ where: { companyId }, select: { website: true, domain: true } });
    const domain = co?.website || co?.domain;
    if (!domain) return res.status(400).json({ success: false, error: { message: 'Company has no website/domain set. Update company settings first.' } });

    // Create pending audit record
    const audit = await prisma.seoAudit.create({
      data: { companyId, domain, status: 'RUNNING', triggeredBy: 'MANUAL' }
    });

    // Run async (don't await in request)
    (async () => {
      try {
        const keywords = await prisma.seoKeyword.findMany({ where: { companyId } });
        const result = await runAudit(domain, keywords);
        await prisma.seoAudit.update({
          where: { auditId: audit.auditId },
          data: { status: 'DONE', score: result.score, summary: result.summary, issues: result.issues, pageData: result.pageData },
        });
      } catch (err) {
        await prisma.seoAudit.update({
          where: { auditId: audit.auditId },
          data: { status: 'FAILED', summary: { error: err.message } },
        });
      }
    })();

    return res.json({ success: true, data: { auditId: audit.auditId, message: 'Audit started. Refresh in a few seconds.' } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── Get audit list ─────────────────────────────────────────────────────────────
exports.getAudits = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { limit = 20, page = 1 } = req.query;
    const [audits, total] = await Promise.all([
      prisma.seoAudit.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * +limit,
        take: +limit,
        select: { auditId: true, domain: true, score: true, status: true, triggeredBy: true, createdAt: true, summary: true },
      }),
      prisma.seoAudit.count({ where: { companyId } }),
    ]);
    return res.json({ success: true, data: { audits, total } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── Get single audit ───────────────────────────────────────────────────────────
exports.getAudit = async (req, res) => {
  try {
    const { companyId, auditId } = req.params;
    const audit = await prisma.seoAudit.findFirst({ where: { auditId, companyId } });
    if (!audit) return res.status(404).json({ success: false, error: { message: 'Audit not found.' } });
    return res.json({ success: true, data: audit });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── Get latest audit ───────────────────────────────────────────────────────────
exports.getLatestAudit = async (req, res) => {
  try {
    const { companyId } = req.params;
    const audit = await prisma.seoAudit.findFirst({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, data: audit || null });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── Keywords ───────────────────────────────────────────────────────────────────
exports.getKeywords = async (req, res) => {
  try {
    const kws = await prisma.seoKeyword.findMany({ where: { companyId: req.params.companyId }, orderBy: { createdAt: 'asc' } });
    return res.json({ success: true, data: { keywords: kws } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.addKeyword = async (req, res) => {
  try {
    const { keyword, targetUrl, targetCountry = 'IN', notes } = req.body;
    if (!keyword) return res.status(400).json({ success: false, error: { message: 'Keyword required.' } });
    const kw = await prisma.seoKeyword.create({
      data: { companyId: req.params.companyId, keyword: keyword.trim(), targetUrl: targetUrl || null, targetCountry, notes: notes || null },
    });
    return res.status(201).json({ success: true, data: kw });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

exports.removeKeyword = async (req, res) => {
  try {
    // Verify ownership then delete
    const kw = await prisma.seoKeyword.findFirst({ where: { keywordId: req.params.keywordId, companyId: req.params.companyId } });
    if (!kw) return res.status(404).json({ success: false, error: { message: 'Keyword not found.' } });
    await prisma.seoKeyword.delete({ where: { keywordId: req.params.keywordId } });
    return res.json({ success: true });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};

// ── URL Checker ────────────────────────────────────────────────────────────────
exports.checkUrlEndpoint = async (req, res) => {
  try {
    const { urls } = req.body; // array of URL strings
    if (!urls || !Array.isArray(urls) || urls.length === 0)
      return res.status(400).json({ success: false, error: { message: 'urls[] array required.' } });
    if (urls.length > 20)
      return res.status(400).json({ success: false, error: { message: 'Max 20 URLs per request.' } });

    const results = await Promise.all(urls.map(u => checkUrl(u)));
    return res.json({ success: true, data: { results } });
  } catch (err) { return res.status(500).json({ success: false, error: { message: err.message } }); }
};
