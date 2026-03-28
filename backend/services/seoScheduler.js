// backend/services/seoScheduler.js
// Runs SEO audit for all active companies at midnight every night (12:00 AM IST)

const cron = require('node-cron');
const prisma = require('../lib/prisma');
const { runAudit } = require('./seoAuditEngine');

exports.start = () => {
  // "0 0 * * *" = midnight every day (server time)
  cron.schedule('0 0 * * *', async () => {
    console.log('[SEOScheduler] Starting nightly SEO audit run...');
    try {
      const companies = await prisma.company.findMany({
        where: { deletedAt: null, status: 'ACTIVE' },
        select: { companyId: true, website: true, domain: true, name: true },
      });

      let ran = 0;
      for (const co of companies) {
        const domain = co.website || co.domain;
        if (!domain) continue;
        try {
          const audit = await prisma.seoAudit.create({
            data: { companyId: co.companyId, domain, status: 'RUNNING', triggeredBy: 'SCHEDULED' }
          });
          const keywords = await prisma.seoKeyword.findMany({ where: { companyId: co.companyId } });
          const result   = await runAudit(domain, keywords);
          await prisma.seoAudit.update({
            where: { auditId: audit.auditId },
            data: { status: 'DONE', score: result.score, summary: result.summary, issues: result.issues, pageData: result.pageData },
          });
          ran++;
          console.log(`[SEOScheduler] ✓ ${co.name} — score: ${result.score}`);
        } catch (err) {
          console.error(`[SEOScheduler] ✗ ${co.name}: ${err.message}`);
        }
      }
      console.log(`[SEOScheduler] Done. Audited ${ran} companies.`);
    } catch (err) {
      console.error('[SEOScheduler] Fatal error:', err.message);
    }
  }, { timezone: 'Asia/Kolkata' });

  console.log('[SEOScheduler] Scheduled — runs nightly at 12:00 AM IST');
};
