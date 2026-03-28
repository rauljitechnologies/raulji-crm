#!/usr/bin/env node
// Comprehensive API test suite for Raulji CRM
'use strict';
const http = require('http');

const BASE = 'http://localhost:4000/api/v1';
let passed = 0, failed = 0;
let accessToken = '', refreshToken = '', testEmail = `test_${Date.now()}@test.com`;

function req(method, path, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname, port: url.port, path: url.pathname + url.search,
      method, headers: {
        'Content-Type': 'application/json',
        ...(data && { 'Content-Length': Buffer.byteLength(data) }),
        ...(token && { Authorization: `Bearer ${token}` }),
      }
    };
    const r = http.request(opts, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => {
        let json;
        try { json = JSON.parse(raw); } catch { json = raw; }
        resolve({ status: res.statusCode, body: json });
      });
    });
    r.on('error', e => resolve({ status: 0, body: e.message }));
    if (data) r.write(data);
    r.end();
  });
}

function check(name, condition, got) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name} — got: ${JSON.stringify(got)}`);
    failed++;
  }
}

async function run() {
  console.log('\n=== Raulji CRM API Test Suite ===\n');

  // ── Health ──
  console.log('[ Health ]');
  {
    const r = await req('GET', '/../../health');
    // try direct health endpoint
    const h = await new Promise(resolve => {
      const opts = { hostname: 'localhost', port: 4000, path: '/health', method: 'GET' };
      const rr = http.request(opts, res => {
        let raw = ''; res.on('data', c => raw += c);
        res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
      });
      rr.on('error', e => resolve({ status: 0, body: e.message }));
      rr.end();
    });
    check('GET /health → 200', h.status === 200, h.body);
    check('health body has status:ok', h.body?.status === 'ok', h.body);
  }

  // ── Auth: Register ──
  console.log('\n[ Auth — Register ]');
  {
    const r = await req('POST', '/auth/register', { name: 'Test User', email: testEmail, password: 'TestPass123' });
    check('POST /auth/register → 201', r.status === 201, r.status);
    check('register returns userId', !!r.body?.data?.userId, r.body);

    // Duplicate
    const r2 = await req('POST', '/auth/register', { name: 'Test User', email: testEmail, password: 'TestPass123' });
    check('duplicate email → 422', r2.status === 422, r2.status);

    // Weak password
    const r3 = await req('POST', '/auth/register', { name: 'Test', email: 'weak@test.com', password: '123' });
    check('weak password → 400', r3.status === 400, r3.status);

    // Missing fields
    const r4 = await req('POST', '/auth/register', { email: 'nopwd@test.com' });
    check('missing fields → 400', r4.status === 400, r4.status);
  }

  // ── Auth: Login ──
  console.log('\n[ Auth — Login ]');
  {
    const r = await req('POST', '/auth/login', { email: testEmail, password: 'TestPass123' });
    check('POST /auth/login → 200', r.status === 200, r.status);
    check('login returns accessToken', !!r.body?.data?.accessToken, r.body);
    check('login returns refreshToken', !!r.body?.data?.refreshToken, r.body);
    accessToken  = r.body?.data?.accessToken  || '';
    refreshToken = r.body?.data?.refreshToken || '';

    // Wrong password
    const r2 = await req('POST', '/auth/login', { email: testEmail, password: 'wrongpassword' });
    check('wrong password → 401', r2.status === 401, r2.status);

    // Non-existent user (same 401 to prevent enumeration)
    const r3 = await req('POST', '/auth/login', { email: 'nobody@test.com', password: 'whatever123' });
    check('unknown user → 401', r3.status === 401, r3.status);
  }

  // ── Auth: Get Me ──
  console.log('\n[ Auth — Get Me ]');
  {
    const r = await req('GET', '/auth/me', null, accessToken);
    check('GET /auth/me → 200', r.status === 200, r.status);
    check('me has userId', !!r.body?.data?.userId, r.body);
    check('me has email', r.body?.data?.email === testEmail, r.body?.data?.email);
    check('me.company is object or null', r.body?.data?.company !== undefined, r.body?.data);

    // No token
    const r2 = await req('GET', '/auth/me');
    check('no token → 401', r2.status === 401, r2.status);
  }

  // ── Auth: Token Refresh ──
  console.log('\n[ Auth — Token Refresh ]');
  {
    const r = await req('POST', '/auth/refresh', { refreshToken });
    check('POST /auth/refresh → 200', r.status === 200, r.status);
    check('refresh returns new accessToken', !!r.body?.data?.accessToken, r.body);

    // Invalid token
    const r2 = await req('POST', '/auth/refresh', { refreshToken: 'invalid.token.here' });
    check('invalid refresh → 401', r2.status === 401, r2.status);

    // Missing token
    const r3 = await req('POST', '/auth/refresh', {});
    check('missing refresh → 400', r3.status === 400, r3.status);
  }

  // ── Auth: Update Me ──
  console.log('\n[ Auth — Update Me ]');
  {
    const r = await req('PUT', '/auth/me', { name: 'Updated Name' }, accessToken);
    check('PUT /auth/me → 200', r.status === 200, r.status);
    check('name updated', r.body?.data?.name === 'Updated Name', r.body?.data?.name);
  }

  // ── Auth: Change Password ──
  console.log('\n[ Auth — Change Password ]');
  {
    const r = await req('POST', '/auth/change-password', { currentPassword: 'TestPass123', newPassword: 'NewPass456!' }, accessToken);
    check('POST /auth/change-password → 200', r.status === 200, r.status);

    // Change back
    const r2 = await req('POST', '/auth/login', { email: testEmail, password: 'NewPass456!' });
    check('login with new password works', r2.status === 200, r2.status);
    accessToken  = r2.body?.data?.accessToken  || accessToken;
    refreshToken = r2.body?.data?.refreshToken || refreshToken;
  }

  // ── Auth: Forgot Password ──
  console.log('\n[ Auth — Forgot Password ]');
  {
    const r = await req('POST', '/auth/forgot-password', { email: testEmail });
    check('POST /auth/forgot-password → 200', r.status === 200, r.status);
    check('success message returned', r.body?.success === true, r.body);

    // Non-existent email — same response (no enumeration)
    const r2 = await req('POST', '/auth/forgot-password', { email: 'nobody@xyz.com' });
    check('unknown email → 200 (no enumeration)', r2.status === 200, r2.status);
  }

  // ── Companies ──
  console.log('\n[ Companies ]');
  let companyId = '';
  {
    const r = await req('POST', '/companies', { name: 'Test Company', email: 'co@test.com', slug: `testco${Date.now()}` }, accessToken);
    check('POST /companies → 201', r.status === 201, r.status);
    companyId = r.body?.data?.companyId || '';
    check('company has companyId', !!companyId, r.body);

    const r2 = await req('GET', `/companies/${companyId}`, null, accessToken);
    check('GET /companies/:id → 200', r2.status === 200, r2.status);
    check('company name matches', r2.body?.data?.name === 'Test Company', r2.body?.data?.name);

    const r3 = await req('PUT', `/companies/${companyId}`, { name: 'Updated Co' }, accessToken);
    check('PUT /companies/:id → 200', r3.status === 200, r3.status);
  }

  // ── Leads ──
  console.log('\n[ Leads ]');
  let leadId = '';
  if (companyId) {
    const r = await req('POST', `/companies/${companyId}/leads`, { name: 'John Lead', email: 'john@lead.com', phone: '9876543210', source: 'WEBSITE' }, accessToken);
    check('POST /companies/:id/leads → 201', r.status === 201, r.status);
    leadId = r.body?.data?.leadId || '';
    check('lead has leadId', !!leadId, r.body);

    const r2 = await req('GET', `/companies/${companyId}/leads`, null, accessToken);
    check('GET /companies/:id/leads → 200', r2.status === 200, r2.status);
    check('leads data is array', Array.isArray(r2.body?.data?.leads), r2.body?.data);

    if (leadId) {
      const r3 = await req('PUT', `/companies/${companyId}/leads/${leadId}`, { status: 'CONTACTED' }, accessToken);
      check('PUT lead status → 200', r3.status === 200, r3.status);
    }
  }

  // ── Invoices ──
  console.log('\n[ Invoices ]');
  if (companyId) {
    const r = await req('POST', `/companies/${companyId}/invoices`, {
      clientName: 'Test Client', clientEmail: 'client@test.com',
      items: [{ description: 'Service', quantity: 1, unitPrice: 1000, tax: 18 }],
      dueDate: new Date(Date.now() + 7*86400000).toISOString()
    }, accessToken);
    check('POST /companies/:id/invoices → 201', r.status === 201, r.status);
    check('invoice has invoiceId', !!r.body?.data?.invoiceId, r.body);
  }

  // ── Users (company) ──
  console.log('\n[ Users ]');
  if (companyId) {
    const r = await req('GET', `/companies/${companyId}/users`, null, accessToken);
    check('GET /companies/:id/users → 200', r.status === 200, r.status);
    check('users is array', Array.isArray(r.body?.data?.users), r.body?.data);
  }

  // ── Backup Admin ──
  console.log('\n[ Admin — Backups ]');
  {
    const r = await req('GET', '/admin/backups', null, accessToken);
    check('GET /admin/backups → 200', r.status === 200, r.status);
    check('backups has logs array', Array.isArray(r.body?.data?.logs), r.body?.data);
    check('backups has total', typeof r.body?.data?.total === 'number', r.body?.data);

    // Non-SUPER_ADMIN should be blocked (but our test user is SUPER_ADMIN, so just check the route exists)
    check('backup response is success', r.body?.success === true, r.body?.success);
  }

  // ── Logout ──
  console.log('\n[ Auth — Logout ]');
  {
    const r = await req('POST', '/auth/logout', { refreshToken }, accessToken);
    check('POST /auth/logout → 200', r.status === 200, r.status);
    check('logout success', r.body?.success === true, r.body);
  }

  // ── Rate Limit Check (light) ──
  console.log('\n[ Security — No token → 401 ]');
  {
    const routes = [
      ['GET', '/auth/me'],
      ['GET', companyId ? `/companies/${companyId}/leads` : '/companies'],
    ];
    for (const [method, path] of routes) {
      const r = await req(method, path);
      check(`${method} ${path} without token → 401`, r.status === 401, r.status);
    }
  }

  // ── Summary ──
  console.log('\n=====================================');
  console.log(` FINAL RESULT: ${passed} passed, ${failed} failed`);
  console.log('=====================================\n');
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(e => { console.error(e); process.exit(1); });
