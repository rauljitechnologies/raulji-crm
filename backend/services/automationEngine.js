// backend/services/automationEngine.js
// Core automation trigger engine

const prisma           = require('../lib/prisma');
const wati             = require('./watiService');
const { renderTemplate } = require('./templateRenderer');

// Called after lead create/update to fire matching automation rules
exports.fireTrigger = async (trigger, lead, companyId, context = {}) => {
  try {
    const rules = await prisma.automationRule.findMany({
      where: { companyId, trigger, isActive: true },
      include: { template: true }
    });

    const jobs = [];
    for (const rule of rules) {
      // Check trigger value match (for STATUS_CHANGED, triggerValue = new status)
      if (rule.triggerValue && trigger === 'STATUS_CHANGED') {
        if (rule.triggerValue !== context.newStatus) continue;
      }

      // Check conditions (e.g. { service: 'SEO', country: 'India' })
      if (rule.conditions) {
        const conds = rule.conditions;
        if (conds.service  && lead.service  !== conds.service)  continue;
        if (conds.country  && lead.country  !== conds.country)  continue;
        if (conds.status   && lead.status   !== conds.status)   continue;
        if (conds.source   && lead.source   !== conds.source)   continue;
      }

      const scheduledAt = new Date(Date.now() + rule.delayMinutes * 60000);
      const job = await prisma.automationJob.create({
        data: { ruleId: rule.ruleId, leadId: lead.leadId, companyId, status: 'PENDING', scheduledAt }
      });
      jobs.push(job.jobId);
    }
    return jobs;
  } catch (err) {
    console.error('[AutomationEngine] fireTrigger error:', err.message);
    return [];
  }
};

// Process a single pending job
exports.processJob = async (job) => {
  try {
    const rule = await prisma.automationRule.findUnique({ where: { ruleId: job.ruleId }, include: { template: true } });
    const lead = await prisma.lead.findUnique({ where: { leadId: job.leadId } });
    const company = await prisma.company.findUnique({ where: { companyId: job.companyId } });

    if (!rule || !lead || !company) {
      await prisma.automationJob.update({ where: { jobId: job.jobId }, data: { status: 'FAILED', error: 'Missing rule, lead, or company', executedAt: new Date() } });
      return;
    }

    const message = renderTemplate(rule.template.body, lead, company.name);
    const result  = await wati.sendSessionMessage(lead.phone, message);

    // Record communication
    await prisma.communication.create({
      data: {
        companyId: job.companyId,
        leadId:    job.leadId,
        channel:   rule.channel,
        direction: 'OUTBOUND',
        status:    'SENT',
        toNumber:  lead.phone,
        body:      message,
        templateId: rule.templateId,
        watiMessageId: result?.messageId || null,
        sentAt:    new Date(),
      }
    });

    await prisma.automationJob.update({ where: { jobId: job.jobId }, data: { status: 'SENT', executedAt: new Date() } });
    await prisma.automationRule.update({ where: { ruleId: rule.ruleId }, data: { executionCount: { increment: 1 } } });
  } catch (err) {
    console.error('[AutomationEngine] processJob error:', err.message);
    await prisma.automationJob.update({ where: { jobId: job.jobId }, data: { status: 'FAILED', error: err.message, executedAt: new Date() } }).catch(() => {});
  }
};

// Process all jobs that are due — called by job runner every minute
exports.processDuePendingJobs = async () => {
  try {
    const jobs = await prisma.automationJob.findMany({
      where: { status: 'PENDING', scheduledAt: { lte: new Date() } },
      take: 50,
      orderBy: { scheduledAt: 'asc' }
    });
    for (const job of jobs) await exports.processJob(job);
    if (jobs.length > 0) console.log(`[AutomationEngine] Processed ${jobs.length} jobs`);
  } catch (err) {
    console.error('[AutomationEngine] processDuePendingJobs error:', err.message);
  }
};

// Handle inbound WhatsApp message (from WATI webhook)
exports.handleInboundMessage = async (phone, body, companyId) => {
  try {
    // Find lead by phone
    const lead = await prisma.lead.findFirst({ where: { phone: { contains: phone.slice(-10) }, companyId } });

    if (!lead) return; // Unknown number — ignore

    // Save inbound communication
    await prisma.communication.create({
      data: {
        companyId,
        leadId:     lead.leadId,
        channel:    'WHATSAPP',
        direction:  'INBOUND',
        status:     'READ',
        fromNumber: phone,
        body,
        createdAt:  new Date(),
      }
    }).catch(() => {});

    // Find matching auto-reply rule
    const rules = await prisma.autoReplyRule.findMany({
      where: { companyId, isActive: true },
      orderBy: { priority: 'asc' }
    });

    const lowerBody = body.toLowerCase();
    let matchedRule = null;
    for (const rule of rules) {
      const kw = rule.keyword.toLowerCase();
      if (rule.matchType === 'EXACT'      && lowerBody === kw) { matchedRule = rule; break; }
      if (rule.matchType === 'STARTS_WITH'&& lowerBody.startsWith(kw)) { matchedRule = rule; break; }
      if (rule.matchType === 'CONTAINS'   && lowerBody.includes(kw)) { matchedRule = rule; break; }
    }

    if (matchedRule) {
      const company = await prisma.company.findUnique({ where: { companyId } });
      const reply   = renderTemplate(matchedRule.replyBody, lead, company?.name || 'Raulji Technologies');
      await wati.sendSessionMessage(phone, reply);
      await prisma.communication.create({
        data: {
          companyId,
          leadId:    lead.leadId,
          channel:   'WHATSAPP',
          direction: 'OUTBOUND',
          status:    'SENT',
          toNumber:  phone,
          body:      reply,
          sentAt:    new Date(),
          metadata:  { autoReply: true, ruleId: matchedRule.replyRuleId }
        }
      });
    }
  } catch (err) {
    console.error('[AutomationEngine] handleInboundMessage error:', err.message);
  }
};
