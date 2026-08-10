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
const geo       = require('../controllers/geoController');
const backup    = require('../controllers/backupController');
const seo       = require('../controllers/seoController');
const expense   = require('../controllers/expenseController');
const finance   = require('../controllers/financeController');
const payroll   = require('../controllers/payrollController');

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
router.put(   '/admin/users/:userId/password',                         authenticate, requireRole(['SUPER_ADMIN']), user.setUserPassword);
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
router.delete('/companies/:companyId/leads/:leadId',            ...authCo, requireRole(['SUPER_ADMIN']), lead.deleteLead);
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
router.get(   '/companies/:companyId/invoices/next-number',   ...authCo, requireRole(['SUPER_ADMIN']), invoice.getNextNumber);
router.get(   '/companies/:companyId/invoices/:id',           ...authCo, invoice.getInvoice);
router.put(   '/companies/:companyId/invoices/:id',           ...authCo, invoice.updateInvoice);
router.delete('/companies/:companyId/invoices/:id',           ...authCo, invoice.removeInvoice);
router.put(   '/companies/:companyId/invoices/:id/assign',    ...authCo, requireRole(['SUPER_ADMIN']), invoice.assignInvoice);
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

// ── Geography (public, static data) ──────────────────────────────────────────
router.get('/geo/countries',              geo.getCountries);
router.get('/geo/countries/:code/states', geo.getStates);

// ── Backup Management (SUPER_ADMIN only) ──────────────────────────────────────
router.get(   '/admin/backups',                    authenticate, requireRole(['SUPER_ADMIN']), backup.listBackups);
router.post(  '/admin/backups/trigger',            authenticate, requireRole(['SUPER_ADMIN']), backup.triggerBackup);
router.get(   '/admin/backups/:id/download/:type', authenticate, requireRole(['SUPER_ADMIN']), backup.downloadBackup);
router.delete('/admin/backups/:id',                authenticate, requireRole(['SUPER_ADMIN']), backup.deleteBackup);

// ── Public API ────────────────────────────────────────────────────────────────
router.post('/public/leads', apiKeyAuth, lead.createPublicLead);

// ── SEO Audits ────────────────────────────────────────────────────────────────
router.post(  '/companies/:companyId/seo/audits',                  ...authCo, seo.triggerAudit);
router.get(   '/companies/:companyId/seo/audits',                  ...authCo, seo.getAudits);
router.get(   '/companies/:companyId/seo/audits/latest',           ...authCo, seo.getLatestAudit);
router.get(   '/companies/:companyId/seo/audits/:auditId',         ...authCo, seo.getAudit);
router.get(   '/companies/:companyId/seo/keywords',                ...authCo, seo.getKeywords);
router.post(  '/companies/:companyId/seo/keywords',                ...authCo, seo.addKeyword);
router.delete('/companies/:companyId/seo/keywords/:keywordId',     ...authCo, seo.removeKeyword);
router.post(  '/companies/:companyId/seo/url-check',               ...authCo, seo.checkUrlEndpoint);

// ── Expenses ──────────────────────────────────────────────────────────────────
router.get(   '/companies/:companyId/expenses',                          ...authCo, expense.listExpenses);
router.post(  '/companies/:companyId/expenses',                          ...authCo, expense.createExpense);
router.post(  '/companies/:companyId/expenses/import',                   ...authCo, expense.importExpenses);
router.put(   '/companies/:companyId/expenses/:id/assign',              ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), expense.assignExpense);
router.put(   '/companies/:companyId/expenses/:id',                      ...authCo, expense.updateExpense);
router.delete('/companies/:companyId/expenses/:id',                      ...authCo, expense.deleteExpense);
router.get(   '/companies/:companyId/bank-statements',                   ...authCo, expense.listStatements);
router.post(  '/companies/:companyId/bank-statements',                   ...authCo, expense.importStatement);
router.delete('/companies/:companyId/bank-statements/:statementId',      ...authCo, expense.deleteStatement);
router.get(   '/companies/:companyId/bank-statements/:statementId/txns', ...authCo, expense.listTransactions);
router.get(   '/companies/:companyId/bank-transactions',                 ...authCo, expense.listAllTransactions);
router.post(  '/companies/:companyId/reconcile',                         ...authCo, expense.reconcile);
router.post(  '/companies/:companyId/reconcile/auto',                    ...authCo, expense.autoReconcile);

// ── Finance (overview + direct investments) — admin only ──────────────────────
router.get(   '/companies/:companyId/finance/overview',    ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), finance.getOverview);
router.get(   '/companies/:companyId/investments',         ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), finance.listInvestments);
router.post(  '/companies/:companyId/investments',         ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), finance.createInvestment);
router.put(   '/companies/:companyId/investments/:id',     ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), finance.updateInvestment);
router.delete('/companies/:companyId/investments/:id',     ...authCo, requireRole(['SUPER_ADMIN', 'ADMIN']), finance.deleteInvestment);

// ── Payroll (employees + salary slips) — admin only ───────────────────────────
const authAdmin = [...authCo, requireRole(['SUPER_ADMIN', 'ADMIN'])];
router.get(   '/companies/:companyId/employees',                ...authAdmin, payroll.listEmployees);
router.post(  '/companies/:companyId/employees',                ...authAdmin, payroll.createEmployee);
router.get(   '/companies/:companyId/employees/next-code',      ...authAdmin, payroll.nextEmpCode);
router.put(   '/companies/:companyId/employees/:id',            ...authAdmin, payroll.updateEmployee);
router.delete('/companies/:companyId/employees/:id',            ...authAdmin, payroll.deleteEmployee);

router.get(   '/companies/:companyId/payslips',                 ...authAdmin, payroll.listPayslips);
router.get(   '/companies/:companyId/payslips/preview',         ...authAdmin, payroll.previewPayslips);
router.post(  '/companies/:companyId/payslips/generate',        ...authAdmin, payroll.generatePayslips);
router.get(   '/companies/:companyId/payslips/:id',             ...authAdmin, payroll.getPayslip);
router.put(   '/companies/:companyId/payslips/:id',             ...authAdmin, payroll.updatePayslip);
router.delete('/companies/:companyId/payslips/:id',             ...authAdmin, payroll.deletePayslip);
router.get(   '/companies/:companyId/payslips/:id/view',        ...authAdmin, payroll.viewPayslip);
router.get(   '/companies/:companyId/payslips/:id/pdf',         ...authAdmin, payroll.getPayslipPdf);

module.exports = router;
