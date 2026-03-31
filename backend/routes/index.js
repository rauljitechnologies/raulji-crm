// backend/routes/index.js
const router = require('express').Router();
const { authenticate, requireRole, requireCompanyAccess, apiKeyAuth } = require('../middleware/auth');

const auth      = require('../controllers/authController');
const company   = require('../controllers/companyController');
const lead      = require('../controllers/leadController');
const deal      = require('../controllers/dealController');
const quotation = require('../controllers/quotationController');
const invoice   = require('../controllers/invoiceController');
const client    = require('../controllers/clientController');
const gst       = require('../controllers/gstController');
const user      = require('../controllers/userController');
const analytics = require('../controllers/analyticsController');
const template  = require('../controllers/templateController');
//const automation= require('../controllers/automationController');
const campaign  = require('../controllers/campaignController');
const comm      = require('../controllers/communicationController');
const geo       = require('../controllers/geoController');
const backup    = require('../controllers/backupController');
const seo       = require('../controllers/seoController');

// Shorthand: authenticate + verify company ownership
const authCo = [authenticate, requireCompanyAccess];

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/auth/register',        auth.register);
router.post('/auth/login',           auth.login);
router.post('/auth/refresh',         auth.refreshToken);
router.post('/auth/logout',          auth.logout);
router.get( '/auth/me',              authenticate, auth.getMe);
router.put( '/auth/me',              authenticate, auth.updateMe);
router.post('/auth/change-password', authenticate, auth.changePassword);
router.post('/auth/forgot-password', auth.forgotPassword);
router.post('/auth/reset-password',  auth.resetPassword);
router.post('/auth/accept-invite',   user.acceptInvite);

// ── Companies ─────────────────────────────────────────────────────────────────
router.get(   '/companies/mine',                      authenticate, company.myCompanies);
router.get(   '/companies',                           authenticate, requireRole(['SUPER_ADMIN']), company.getAll);
router.post(  '/companies',                           authenticate, requireRole(['SUPER_ADMIN']), company.create);
router.get(   '/companies/:companyId',                ...authCo, company.getOne);
router.put(   '/companies/:companyId',                ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), company.update);
router.delete('/companies/:companyId',                authenticate, requireRole(['SUPER_ADMIN']), company.remove);
router.post(  '/companies/:companyId/regenerate-key', ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), company.regenerateKey);
router.get(   '/companies/:companyId/settings',       ...authCo, company.getSettings);
router.put(   '/companies/:companyId/settings',       ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), company.updateSettings);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get(   '/admin/users',                                          authenticate, requireRole(['SUPER_ADMIN']), user.getAllUsers);
router.put(   '/admin/users/:userId/assign-company',                   authenticate, requireRole(['SUPER_ADMIN']), user.assignCompany);
router.delete('/admin/users/:userId/companies/:companyId',             authenticate, requireRole(['SUPER_ADMIN']), user.removeFromCompany);
router.post(  '/admin/users/:userId/unremove',                         authenticate, requireRole(['SUPER_ADMIN']), user.unremove);
router.delete('/admin/users/:userId/permanent',                        authenticate, requireRole(['SUPER_ADMIN']), user.permanentDelete);
router.get(   '/companies/:companyId/users',                     ...authCo, user.getUsers);
router.post(  '/companies/:companyId/users/invite',              ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), user.invite);
router.put(   '/companies/:companyId/users/:userId/role',        ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), user.updateRole);
router.put(   '/companies/:companyId/users/:userId/permissions', ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), user.updatePermissions);
router.delete('/companies/:companyId/users/:userId',             ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), user.remove);

// ── Leads ─────────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/leads/export',             ...authCo, lead.exportLeads);
router.post(  '/companies/:companyId/leads/import',             ...authCo, lead.importLeads);
router.get(   '/companies/:companyId/leads',                    ...authCo, lead.getLeads);
router.post(  '/companies/:companyId/leads',                    ...authCo, lead.createLead);
router.get(   '/companies/:companyId/leads/:leadId',            ...authCo, lead.getLead);
router.put(   '/companies/:companyId/leads/:leadId',            ...authCo, lead.updateLead);
router.delete('/companies/:companyId/leads/:leadId',            ...authCo, lead.deleteLead);
router.post(  '/companies/:companyId/leads/:leadId/activities', ...authCo, lead.addActivity);
router.post(  '/companies/:companyId/leads/:leadId/convert',    ...authCo, lead.convertToDeal);

// ── Deals ─────────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/deals',               ...authCo, deal.getDeals);
router.post(  '/companies/:companyId/deals',               ...authCo, deal.createDeal);
router.get(   '/companies/:companyId/deals/:dealId',       ...authCo, deal.getDeal);
router.put(   '/companies/:companyId/deals/:dealId',       ...authCo, deal.updateDeal);
router.put(   '/companies/:companyId/deals/:dealId/stage', ...authCo, deal.updateStage);
router.delete('/companies/:companyId/deals/:dealId',       ...authCo, deal.deleteDeal);

// ── Quotations ────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/quotations',             ...authCo, quotation.getQuotations);
router.post(  '/companies/:companyId/quotations',             ...authCo, quotation.createQuotation);
router.get(   '/companies/:companyId/quotations/:id',         ...authCo, quotation.getQuotation);
router.put(   '/companies/:companyId/quotations/:id',         ...authCo, quotation.updateQuotation);
router.delete('/companies/:companyId/quotations/:id',         ...authCo, quotation.removeQuotation);
router.post(  '/companies/:companyId/quotations/:id/send',    ...authCo, quotation.sendQuotation);
router.post(  '/companies/:companyId/quotations/:id/convert', ...authCo, quotation.convertQuotationToInvoice);
router.get(   '/companies/:companyId/quotations/:id/pdf',     ...authCo, quotation.getQuotationPdf);
router.get(   '/companies/:companyId/quotations/:id/view',    ...authCo, quotation.viewQuotationPdf);

// ── Invoices ──────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/invoices',               ...authCo, invoice.getInvoices);
router.post(  '/companies/:companyId/invoices',               ...authCo, invoice.createInvoice);
router.get(   '/companies/:companyId/invoices/:id',           ...authCo, invoice.getInvoice);
router.put(   '/companies/:companyId/invoices/:id',           ...authCo, invoice.updateInvoice);
router.delete('/companies/:companyId/invoices/:id',           ...authCo, invoice.removeInvoice);
router.put(   '/companies/:companyId/invoices/:id/mark-paid', ...authCo, invoice.markPaid);
router.post(  '/companies/:companyId/invoices/:id/send',      ...authCo, invoice.sendInvoice);
router.get(   '/companies/:companyId/invoices/:id/pdf',       ...authCo, invoice.getInvoicePdf);
router.get(   '/companies/:companyId/invoices/:id/view',      ...authCo, invoice.viewInvoicePdf);

// ── Clients ───────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/clients',     ...authCo, client.getClients);
router.post(  '/companies/:companyId/clients',     ...authCo, client.createClient);
router.get(   '/companies/:companyId/clients/:id', ...authCo, client.getClient);
router.put(   '/companies/:companyId/clients/:id', ...authCo, client.updateClient);
router.delete('/companies/:companyId/clients/:id', ...authCo, client.removeClient);

// ── GST Lookup (public, read-only) ────────────────────────────────────────────
router.get('/gst/validate/:gstin', authenticate, gst.validate);
router.get('/gst/lookup/:gstin',   authenticate, gst.lookup);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/companies/:companyId/analytics/overview',  ...authCo, analytics.getOverview);
router.get('/companies/:companyId/analytics/leads',     ...authCo, analytics.getLeadAnalytics);
router.get('/companies/:companyId/analytics/revenue',   ...authCo, analytics.getRevenue);
router.get('/companies/:companyId/analytics/team',      ...authCo, analytics.getTeam);
router.get('/companies/:companyId/analytics/pipeline',  ...authCo, analytics.getPipeline);

// ── Message Templates ─────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/templates',             ...authCo, template.list);
router.post(  '/companies/:companyId/templates',             ...authCo, template.create);
router.get(   '/companies/:companyId/templates/:id',         ...authCo, template.get);
router.put(   '/companies/:companyId/templates/:id',         ...authCo, template.update);
router.delete('/companies/:companyId/templates/:id',         ...authCo, template.remove);
router.post(  '/companies/:companyId/templates/:id/preview', ...authCo, template.preview);

// ── Automation Rules ──────────────────────────────────────────────────────────
//router.get(   '/companies/:companyId/automation/rules',            ...authCo, automation.listRules);
//router.post(  '/companies/:companyId/automation/rules',            ...authCo, automation.createRule);
//router.get(   '/companies/:companyId/automation/rules/:id',        ...authCo, automation.getRule);
//router.put(   '/companies/:companyId/automation/rules/:id',        ...authCo, automation.updateRule);
//router.put(   '/companies/:companyId/automation/rules/:id/toggle', ...authCo, automation.toggleRule);
//router.delete('/companies/:companyId/automation/rules/:id',        ...authCo, automation.deleteRule);
//router.get(   '/companies/:companyId/automation/jobs',             ...authCo, automation.listJobs);
//router.post(  '/companies/:companyId/automation/jobs/:id/retry',   ...authCo, automation.retryJob);

// ── Campaigns ─────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/campaigns',                     ...authCo, campaign.listCampaigns);
router.post(  '/companies/:companyId/campaigns',                     ...authCo, campaign.createCampaign);
router.get(   '/companies/:companyId/campaigns/:id',                 ...authCo, campaign.getCampaign);
router.put(   '/companies/:companyId/campaigns/:id',                 ...authCo, campaign.updateCampaign);
router.delete('/companies/:companyId/campaigns/:id',                 ...authCo, campaign.deleteCampaign);
router.post(  '/companies/:companyId/campaigns/:id/preview-audience',...authCo, campaign.previewAudience);
router.post(  '/companies/:companyId/campaigns/:id/launch',          ...authCo, campaign.launchCampaign);
router.post(  '/companies/:companyId/campaigns/:id/cancel',          ...authCo, campaign.cancelCampaign);

// ── Communications / Timeline ─────────────────────────────────────────────────
router.get(   '/companies/:companyId/leads/:leadId/timeline',  ...authCo, comm.getTimeline);
router.post(  '/companies/:companyId/leads/:leadId/send',      ...authCo, comm.sendManual);
router.get(   '/companies/:companyId/auto-reply-rules',        ...authCo, comm.getAutoReplyRules);
router.post(  '/companies/:companyId/auto-reply-rules',        ...authCo, comm.createAutoReplyRule);
router.put(   '/companies/:companyId/auto-reply-rules/:id',    ...authCo, comm.updateAutoReplyRule);
router.delete('/companies/:companyId/auto-reply-rules/:id',    ...authCo, comm.deleteAutoReplyRule);

// ── Geography (public, static data) ──────────────────────────────────────────
router.get('/geo/countries',              geo.getCountries);
router.get('/geo/countries/:code/states', geo.getStates);

// ── WATI Inbound Webhook ──────────────────────────────────────────────────────
router.post('/webhooks/wati', comm.handleWatiWebhook);

// ── Backup Management (SUPER_ADMIN only) ──────────────────────────────────────
router.get(   '/admin/backups',                    authenticate, requireRole(['SUPER_ADMIN']), backup.listBackups);
router.post(  '/admin/backups/trigger',            authenticate, requireRole(['SUPER_ADMIN']), backup.triggerBackup);
router.get(   '/admin/backups/:id/download/:type', authenticate, requireRole(['SUPER_ADMIN']), backup.downloadBackup);
router.delete('/admin/backups/:id',                authenticate, requireRole(['SUPER_ADMIN']), backup.deleteBackup);

// ── Public API ────────────────────────────────────────────────────────────────
router.post('/public/leads', apiKeyAuth, lead.createPublicLead);


const project = require('../controllers/projectController');

// ── Projects ──────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/projects',                                        ...authCo, project.listProjects);
router.post(  '/companies/:companyId/projects',                                        ...authCo, project.createProject);
router.get(   '/companies/:companyId/projects/:projectId',                             ...authCo, project.getProject);
router.put(   '/companies/:companyId/projects/:projectId',                             ...authCo, project.updateProject);
router.delete('/companies/:companyId/projects/:projectId',                             ...authCo, project.deleteProject);
router.post(  '/companies/:companyId/projects/:projectId/assign',                      ...authCo, project.assignCompany);
router.delete('/companies/:companyId/projects/:projectId/assign/:assignedCompanyId',   ...authCo, project.removeAssignment);
router.post(  '/companies/:companyId/projects/:projectId/documents',                   ...authCo, project.addDocument);
router.delete('/companies/:companyId/projects/:projectId/documents/:docId',            ...authCo, project.removeDocument);
router.post(  '/companies/:companyId/projects/:projectId/credentials',                 ...authCo, project.addCredential);
router.put(   '/companies/:companyId/projects/:projectId/credentials/:credId',         ...authCo, project.updateCredential);
router.delete('/companies/:companyId/projects/:projectId/credentials/:credId',         ...authCo, project.removeCredential);
router.get(   '/companies/:companyId/projects/:projectId/credentials/:credId/reveal',  ...authCo, project.getCredentialPlain);
router.post(  '/companies/:companyId/projects/:projectId/history',                     ...authCo, project.addHistory);

// ── SEO Audits ────────────────────────────────────────────────────────────────
router.post(  '/companies/:companyId/seo/audits',                  ...authCo, seo.triggerAudit);
router.get(   '/companies/:companyId/seo/audits',                  ...authCo, seo.getAudits);
router.get(   '/companies/:companyId/seo/audits/latest',           ...authCo, seo.getLatestAudit);
router.get(   '/companies/:companyId/seo/audits/:auditId',         ...authCo, seo.getAudit);
router.get(   '/companies/:companyId/seo/keywords',                ...authCo, seo.getKeywords);
router.post(  '/companies/:companyId/seo/keywords',                ...authCo, seo.addKeyword);
router.delete('/companies/:companyId/seo/keywords/:keywordId',     ...authCo, seo.removeKeyword);
router.post(  '/companies/:companyId/seo/url-check',               ...authCo, seo.checkUrlEndpoint);

module.exports = router;
