const router = require('express').Router();
const { authenticate, requireRole, authorizeCompanyAccess, apiKeyAuth } = require('../middleware/auth');

const auth      = require('../controllers/authController');
const company   = require('../controllers/companyController');
const lead      = require('../controllers/leadController');
const deal      = require('../controllers/dealController');
const quotation = require('../controllers/quotationController');
const invoice   = require('../controllers/invoiceController');
const user      = require('../controllers/userController');
const analytics = require('../controllers/analyticsController');

// Auth
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

// Companies
router.get(   '/companies',                           authenticate, company.getAll);
router.post(  '/companies',                           authenticate, requireRole(['SUPER_ADMIN']), company.create);
router.get(   '/companies/:companyId',                authenticate, authorizeCompanyAccess, company.getOne);
router.put(   '/companies/:companyId',                authenticate, authorizeCompanyAccess, company.update);
router.delete('/companies/:companyId',                authenticate, authorizeCompanyAccess, company.remove);
router.post(  '/companies/:companyId/regenerate-key', authenticate, authorizeCompanyAccess, company.regenerateKey);
router.get(   '/companies/:companyId/settings',       authenticate, authorizeCompanyAccess, company.getSettings);
router.put(   '/companies/:companyId/settings',       authenticate, authorizeCompanyAccess, company.updateSettings);

// Users
router.get(   '/companies/:companyId/users',              authenticate, authorizeCompanyAccess, user.getUsers);
router.post(  '/companies/:companyId/users/invite',       authenticate, authorizeCompanyAccess, user.invite);
router.put(   '/companies/:companyId/users/:userId/role', authenticate, authorizeCompanyAccess, user.updateRole);
router.delete('/companies/:companyId/users/:userId',      authenticate, authorizeCompanyAccess, user.remove);

// Leads (export before :leadId to avoid route conflict)
router.get(   '/companies/:companyId/leads/export',             authenticate, authorizeCompanyAccess, lead.exportLeads);
router.post(  '/companies/:companyId/leads/import',             authenticate, authorizeCompanyAccess, lead.importLeads);
router.get(   '/companies/:companyId/leads',                    authenticate, authorizeCompanyAccess, lead.getLeads);
router.post(  '/companies/:companyId/leads',                    authenticate, authorizeCompanyAccess, lead.createLead);
router.get(   '/companies/:companyId/leads/:leadId',            authenticate, authorizeCompanyAccess, lead.getLead);
router.put(   '/companies/:companyId/leads/:leadId',            authenticate, authorizeCompanyAccess, lead.updateLead);
router.delete('/companies/:companyId/leads/:leadId',            authenticate, authorizeCompanyAccess, lead.deleteLead);
router.post(  '/companies/:companyId/leads/:leadId/activities', authenticate, authorizeCompanyAccess, lead.addActivity);
router.post(  '/companies/:companyId/leads/:leadId/convert',    authenticate, authorizeCompanyAccess, lead.convertToDeal);

// Deals
router.get(   '/companies/:companyId/deals',               authenticate, authorizeCompanyAccess, deal.getDeals);
router.post(  '/companies/:companyId/deals',               authenticate, authorizeCompanyAccess, deal.createDeal);
router.get(   '/companies/:companyId/deals/:dealId',       authenticate, authorizeCompanyAccess, deal.getDeal);
router.put(   '/companies/:companyId/deals/:dealId',       authenticate, authorizeCompanyAccess, deal.updateDeal);
router.put(   '/companies/:companyId/deals/:dealId/stage', authenticate, authorizeCompanyAccess, deal.updateStage);
router.delete('/companies/:companyId/deals/:dealId',       authenticate, authorizeCompanyAccess, deal.deleteDeal);

// Quotations
router.get(   '/companies/:companyId/quotations',             authenticate, authorizeCompanyAccess, quotation.getQuotations);
router.post(  '/companies/:companyId/quotations',             authenticate, authorizeCompanyAccess, quotation.createQuotation);
router.get(   '/companies/:companyId/quotations/:id',         authenticate, authorizeCompanyAccess, quotation.getQuotation);
router.put(   '/companies/:companyId/quotations/:id',         authenticate, authorizeCompanyAccess, quotation.updateQuotation);
router.delete('/companies/:companyId/quotations/:id',         authenticate, authorizeCompanyAccess, quotation.removeQuotation);
router.post(  '/companies/:companyId/quotations/:id/send',    authenticate, authorizeCompanyAccess, quotation.sendQuotation);
router.post(  '/companies/:companyId/quotations/:id/convert', authenticate, authorizeCompanyAccess, quotation.convertQuotationToInvoice);
router.get(   '/companies/:companyId/quotations/:id/pdf',     authenticate, authorizeCompanyAccess, quotation.getQuotationPdf);

// Invoices
router.get(   '/companies/:companyId/invoices',               authenticate, authorizeCompanyAccess, invoice.getInvoices);
router.post(  '/companies/:companyId/invoices',               authenticate, authorizeCompanyAccess, invoice.createInvoice);
router.get(   '/companies/:companyId/invoices/:id',           authenticate, authorizeCompanyAccess, invoice.getInvoice);
router.put(   '/companies/:companyId/invoices/:id',           authenticate, authorizeCompanyAccess, invoice.updateInvoice);
router.delete('/companies/:companyId/invoices/:id',           authenticate, authorizeCompanyAccess, invoice.removeInvoice);
router.put(   '/companies/:companyId/invoices/:id/mark-paid', authenticate, authorizeCompanyAccess, invoice.markPaid);
router.post(  '/companies/:companyId/invoices/:id/send',      authenticate, authorizeCompanyAccess, invoice.sendInvoice);
router.get(   '/companies/:companyId/invoices/:id/pdf',       authenticate, authorizeCompanyAccess, invoice.getInvoicePdf);

// Analytics
router.get('/companies/:companyId/analytics/overview',  authenticate, authorizeCompanyAccess, analytics.getOverview);
router.get('/companies/:companyId/analytics/leads',     authenticate, authorizeCompanyAccess, analytics.getLeadAnalytics);
router.get('/companies/:companyId/analytics/revenue',   authenticate, authorizeCompanyAccess, analytics.getRevenue);
router.get('/companies/:companyId/analytics/team',      authenticate, authorizeCompanyAccess, analytics.getTeam);
router.get('/companies/:companyId/analytics/pipeline',  authenticate, authorizeCompanyAccess, analytics.getPipeline);

// Public API
router.post('/public/leads', apiKeyAuth, lead.createPublicLead);

module.exports = router;
