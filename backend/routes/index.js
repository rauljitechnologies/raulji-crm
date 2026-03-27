// backend/routes/index.js
const router = require('express').Router();
const { authenticate, requireRole, apiKeyAuth } = require('../middleware/auth');

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
router.get(   '/companies',                           authenticate, requireRole(['SUPER_ADMIN']), company.getAll);
router.post(  '/companies',                           authenticate, requireRole(['SUPER_ADMIN']), company.create);
router.get(   '/companies/:companyId',                authenticate, company.getOne);
router.put(   '/companies/:companyId',                authenticate, company.update);
router.delete('/companies/:companyId',                authenticate, company.remove);
router.post(  '/companies/:companyId/regenerate-key', authenticate, company.regenerateKey);
router.get(   '/companies/:companyId/settings',       authenticate, company.getSettings);
router.put(   '/companies/:companyId/settings',       authenticate, company.updateSettings);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/users',              authenticate, user.getUsers);
router.post(  '/companies/:companyId/users/invite',       authenticate, user.invite);
router.put(   '/companies/:companyId/users/:userId/role', authenticate, user.updateRole);
router.delete('/companies/:companyId/users/:userId',      authenticate, user.remove);

// ── Leads (export before :leadId to avoid conflict) ──────────────────────────
router.get(   '/companies/:companyId/leads/export',             authenticate, lead.exportLeads);
router.post(  '/companies/:companyId/leads/import',             authenticate, lead.importLeads);
router.get(   '/companies/:companyId/leads',                    authenticate, lead.getLeads);
router.post(  '/companies/:companyId/leads',                    authenticate, lead.createLead);
router.get(   '/companies/:companyId/leads/:leadId',            authenticate, lead.getLead);
router.put(   '/companies/:companyId/leads/:leadId',            authenticate, lead.updateLead);
router.delete('/companies/:companyId/leads/:leadId',            authenticate, lead.deleteLead);
router.post(  '/companies/:companyId/leads/:leadId/activities', authenticate, lead.addActivity);
router.post(  '/companies/:companyId/leads/:leadId/convert',    authenticate, lead.convertToDeal);

// ── Deals ─────────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/deals',               authenticate, deal.getDeals);
router.post(  '/companies/:companyId/deals',               authenticate, deal.createDeal);
router.get(   '/companies/:companyId/deals/:dealId',       authenticate, deal.getDeal);
router.put(   '/companies/:companyId/deals/:dealId',       authenticate, deal.updateDeal);
router.put(   '/companies/:companyId/deals/:dealId/stage', authenticate, deal.updateStage);
router.delete('/companies/:companyId/deals/:dealId',       authenticate, deal.deleteDeal);

// ── Quotations ────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/quotations',             authenticate, quotation.getQuotations);
router.post(  '/companies/:companyId/quotations',             authenticate, quotation.createQuotation);
router.get(   '/companies/:companyId/quotations/:id',         authenticate, quotation.getQuotation);
router.put(   '/companies/:companyId/quotations/:id',         authenticate, quotation.updateQuotation);
router.delete('/companies/:companyId/quotations/:id',         authenticate, quotation.removeQuotation);
router.post(  '/companies/:companyId/quotations/:id/send',    authenticate, quotation.sendQuotation);
router.post(  '/companies/:companyId/quotations/:id/convert', authenticate, quotation.convertQuotationToInvoice);
router.get(   '/companies/:companyId/quotations/:id/pdf',     authenticate, quotation.getQuotationPdf);   // download
router.get(   '/companies/:companyId/quotations/:id/view',    authenticate, quotation.viewQuotationPdf);  // view in browser

// ── Invoices ──────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/invoices',               authenticate, invoice.getInvoices);
router.post(  '/companies/:companyId/invoices',               authenticate, invoice.createInvoice);
router.get(   '/companies/:companyId/invoices/:id',           authenticate, invoice.getInvoice);
router.put(   '/companies/:companyId/invoices/:id',           authenticate, invoice.updateInvoice);
router.delete('/companies/:companyId/invoices/:id',           authenticate, invoice.removeInvoice);
router.put(   '/companies/:companyId/invoices/:id/mark-paid', authenticate, invoice.markPaid);
router.post(  '/companies/:companyId/invoices/:id/send',      authenticate, invoice.sendInvoice);
router.get(   '/companies/:companyId/invoices/:id/pdf',       authenticate, invoice.getInvoicePdf);   // download
router.get(   '/companies/:companyId/invoices/:id/view',      authenticate, invoice.viewInvoicePdf);  // view in browser

// ── Clients ───────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/clients',          authenticate, client.getClients);
router.post(  '/companies/:companyId/clients',          authenticate, client.createClient);
router.get(   '/companies/:companyId/clients/:id',      authenticate, client.getClient);
router.put(   '/companies/:companyId/clients/:id',      authenticate, client.updateClient);
router.delete('/companies/:companyId/clients/:id',      authenticate, client.removeClient);

// ── GST Lookup ────────────────────────────────────────────────────────────────
router.get('/gst/validate/:gstin', gst.validate);
router.get('/gst/lookup/:gstin',   gst.lookup);

// ── Analytics ─────────────────────────────────────────────────────────────────
router.get('/companies/:companyId/analytics/overview',  authenticate, analytics.getOverview);
router.get('/companies/:companyId/analytics/leads',     authenticate, analytics.getLeadAnalytics);
router.get('/companies/:companyId/analytics/revenue',   authenticate, analytics.getRevenue);
router.get('/companies/:companyId/analytics/team',      authenticate, analytics.getTeam);
router.get('/companies/:companyId/analytics/pipeline',  authenticate, analytics.getPipeline);

// ── Public API ────────────────────────────────────────────────────────────────
router.post('/public/leads', apiKeyAuth, lead.createPublicLead);

module.exports = router;
