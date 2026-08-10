const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('accessToken');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  // Handle non-JSON responses (e.g. 502 gateway errors returning HTML)
  let data: any;
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    if (!res.ok) throw new Error(`Server error (${res.status})`);
    return res as unknown as T; // PDF/CSV/binary — caller handles
  }
  try {
    data = await res.json();
  } catch {
    throw new Error(`Server error (${res.status}): Invalid response`);
  }

  if (!data.success) throw new Error(data.error?.message || 'Request failed');
  return data.data;
}

// Auth
export const authApi = {
  login:          (body: any) => request<any>('/auth/login',           { method: 'POST', body: JSON.stringify(body) }),
  me:             ()          => request<any>('/auth/me'),
  logout:         (body: any) => request<any>('/auth/logout',          { method: 'POST', body: JSON.stringify(body) }),
  updateMe:       (body: any) => request<any>('/auth/me',              { method: 'PUT',  body: JSON.stringify(body) }),
  changePassword: (body: any) => request<any>('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
};

// Companies
export const companyApi = {
  mine:           ()                      => request<any>('/companies/mine'),
  list:           (params?: any)          => request<any>(`/companies?${new URLSearchParams(params||{})}`),
  get:            (id: string)            => request<any>(`/companies/${id}`),
  create:         (body: any)             => request<any>('/companies', { method: 'POST', body: JSON.stringify(body) }),
  update:         (id: string, body: any) => request<any>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove:         (id: string)            => request<any>(`/companies/${id}`, { method: 'DELETE' }),
  getSettings:    (id: string)            => request<any>(`/companies/${id}/settings`),
  updateSettings: (id: string, body: any) => request<any>(`/companies/${id}/settings`, { method: 'PUT', body: JSON.stringify(body) }),
  regenerateKey:  (id: string)            => request<any>(`/companies/${id}/regenerate-key`, { method: 'POST' }),
};

// Leads
export const leadApi = {
  list:   (cid: string, params?: any) => request<any>(`/companies/${cid}/leads?${new URLSearchParams(params||{})}`),
  get:    (cid: string, id: string)   => request<any>(`/companies/${cid}/leads/${id}`),
  create: (cid: string, body: any)    => request<any>(`/companies/${cid}/leads`, { method: 'POST', body: JSON.stringify(body) }),
  update: (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/leads/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (cid: string, id: string)   => request<any>(`/companies/${cid}/leads/${id}`, { method: 'DELETE' }),
  addActivity: (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/leads/${id}/activities`, { method: 'POST', body: JSON.stringify(body) }),
  convert:(cid: string, id: string)   => request<any>(`/companies/${cid}/leads/${id}/convert`, { method: 'POST' }),
};

// Deals
export const dealApi = {
  list:        (cid: string, params?: any) => request<any>(`/companies/${cid}/deals?${new URLSearchParams(params||{})}`),
  create:      (cid: string, body: any)    => request<any>(`/companies/${cid}/deals`, { method: 'POST', body: JSON.stringify(body) }),
  update:      (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/deals/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateStage: (cid: string, id: string, stage: string) => request<any>(`/companies/${cid}/deals/${id}/stage`, { method: 'PUT', body: JSON.stringify({ stage }) }),
  delete:      (cid: string, id: string)   => request<any>(`/companies/${cid}/deals/${id}`, { method: 'DELETE' }),
};

// Quotations
export const quotationApi = {
  list:    (cid: string, params?: any) => request<any>(`/companies/${cid}/quotations?${new URLSearchParams(params||{})}`),
  get:     (cid: string, id: string)   => request<any>(`/companies/${cid}/quotations/${id}`),
  create:  (cid: string, body: any)    => request<any>(`/companies/${cid}/quotations`, { method: 'POST', body: JSON.stringify(body) }),
  update:  (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/quotations/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  send:    (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/quotations/${id}/send`, { method: 'POST', body: JSON.stringify(body) }),
  convert: (cid: string, id: string)   => request<any>(`/companies/${cid}/quotations/${id}/convert`, { method: 'POST' }),
};

// Invoices
export const invoiceApi = {
  list:     (cid: string, params?: any) => request<any>(`/companies/${cid}/invoices?${new URLSearchParams(params||{})}`),
  get:      (cid: string, id: string)   => request<any>(`/companies/${cid}/invoices/${id}`),
  create:   (cid: string, body: any)    => request<any>(`/companies/${cid}/invoices`, { method: 'POST', body: JSON.stringify(body) }),
  update:   (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/invoices/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  markPaid:   (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/invoices/${id}/mark-paid`, { method: 'PUT', body: JSON.stringify(body) }),
  assign:     (cid: string, id: string, userIds: string[]) => request<any>(`/companies/${cid}/invoices/${id}/assign`, { method: 'PUT', body: JSON.stringify({ userIds }) }),
  send:       (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/invoices/${id}/send`, { method: 'POST', body: JSON.stringify(body) }),
  nextNumber: (cid: string)                        => request<any>(`/companies/${cid}/invoices/next-number`),
};

// Clients
export const clientApi = {
  list:   (cid: string, params?: any) => request<any>(`/companies/${cid}/clients?${new URLSearchParams(params||{})}`),
  get:    (cid: string, id: string)   => request<any>(`/companies/${cid}/clients/${id}`),
  create: (cid: string, body: any)    => request<any>(`/companies/${cid}/clients`, { method: 'POST', body: JSON.stringify(body) }),
  update: (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/clients/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (cid: string, id: string)   => request<any>(`/companies/${cid}/clients/${id}`, { method: 'DELETE' }),
};

// GST
export const gstApi = {
  validate: (gstin: string) => request<any>(`/gst/validate/${encodeURIComponent(gstin)}`),
  lookup:   (gstin: string) => request<any>(`/gst/lookup/${encodeURIComponent(gstin)}`),
};

// Users
export const userApi = {
  listAll:    ()                         => request<any>(`/admin/users`),
  list:       (cid: string)              => request<any>(`/companies/${cid}/users`),
  invite:     (cid: string, body: any)   => request<any>(`/companies/${cid}/users/invite`, { method: 'POST', body: JSON.stringify(body) }),
  updateRole:        (cid: string, uid: string, role: string)        => request<any>(`/companies/${cid}/users/${uid}/role`,        { method: 'PUT', body: JSON.stringify({ role }) }),
  updatePermissions: (cid: string, uid: string, permissions: any)   => request<any>(`/companies/${cid}/users/${uid}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions }) }),
  remove:            (cid: string, uid: string)                     => request<any>(`/companies/${cid}/users/${uid}`, { method: 'DELETE' }),
  unremove:          (uid: string)                                  => request<any>(`/admin/users/${uid}/unremove`, { method: 'POST' }),
  permanentDelete:   (uid: string)                                  => request<any>(`/admin/users/${uid}/permanent`, { method: 'DELETE' }),
  setPassword:       (uid: string, newPassword: string)             => request<any>(`/admin/users/${uid}/password`, { method: 'PUT', body: JSON.stringify({ newPassword }) }),
  assignCompany:        (uid: string, body: { companyId: string; role?: string }) => request<any>(`/admin/users/${uid}/assign-company`,      { method: 'PUT',    body: JSON.stringify(body) }),
  removeFromCompany:    (uid: string, cid: string)                                => request<any>(`/admin/users/${uid}/companies/${cid}`,        { method: 'DELETE' }),
};

// Geography
export const geoApi = {
  countries: ()                   => request<any>('/geo/countries'),
  states:    (code: string)       => request<any>(`/geo/countries/${code}/states`),
};

// Analytics
export const analyticsApi = {
  overview: (cid: string) => request<any>(`/companies/${cid}/analytics/overview`),
  team:     (cid: string) => request<any>(`/companies/${cid}/analytics/team`),
  pipeline: (cid: string) => request<any>(`/companies/${cid}/analytics/pipeline`),
};


// Backup (SUPER_ADMIN only)
export const backupApi = {
  list:    (params?: any) => request<any>(`/admin/backups?${new URLSearchParams(params||{})}`),
  trigger: ()             => request<any>('/admin/backups/trigger', { method: 'POST' }),
  delete:  (id: string)   => request<any>(`/admin/backups/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: string, type: 'db' | 'code') => `${BASE}/admin/backups/${id}/download/${type}`,
};

// Expenses
export const expenseApi = {
  list:           (cid: string, params?: any)              => request<any>(`/companies/${cid}/expenses?${new URLSearchParams(params||{})}`),
  create:         (cid: string, body: any)                 => request<any>(`/companies/${cid}/expenses`, { method: 'POST', body: JSON.stringify(body) }),
  importExpenses: (cid: string, rows: any[])               => request<any>(`/companies/${cid}/expenses/import`, { method: 'POST', body: JSON.stringify({ rows }) }),
  assign:         (cid: string, id: string, userIds: string[]) => request<any>(`/companies/${cid}/expenses/${id}/assign`, { method: 'PUT', body: JSON.stringify({ userIds }) }),
  update:         (cid: string, id: string, body: any)     => request<any>(`/companies/${cid}/expenses/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove:         (cid: string, id: string)                => request<any>(`/companies/${cid}/expenses/${id}`, { method: 'DELETE' }),
  listStatements: (cid: string)                            => request<any>(`/companies/${cid}/bank-statements`),
  importStatement:(cid: string, body: any)                 => request<any>(`/companies/${cid}/bank-statements`, { method: 'POST', body: JSON.stringify(body) }),
  deleteStatement:(cid: string, sid: string)               => request<any>(`/companies/${cid}/bank-statements/${sid}`, { method: 'DELETE' }),
  listTxns:       (cid: string, sid: string, params?: any) => request<any>(`/companies/${cid}/bank-statements/${sid}/txns?${new URLSearchParams(params||{})}`),
  reconcile:      (cid: string, body: any)                 => request<any>(`/companies/${cid}/reconcile`, { method: 'POST', body: JSON.stringify(body) }),
  autoReconcile:  (cid: string)                            => request<any>(`/companies/${cid}/reconcile/auto`, { method: 'POST', body: '{}' }),
  listAllTxns:    (cid: string, params?: any)              => request<any>(`/companies/${cid}/bank-transactions?${new URLSearchParams(params||{})}`),
};

// Finance (overview + direct investments)
export const financeApi = {
  overview:    (cid: string, params?: any)          => request<any>(`/companies/${cid}/finance/overview?${new URLSearchParams(params||{})}`),
  listInv:     (cid: string, params?: any)          => request<any>(`/companies/${cid}/investments?${new URLSearchParams(params||{})}`),
  createInv:   (cid: string, body: any)             => request<any>(`/companies/${cid}/investments`, { method: 'POST', body: JSON.stringify(body) }),
  updateInv:   (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/investments/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  removeInv:   (cid: string, id: string)            => request<any>(`/companies/${cid}/investments/${id}`, { method: 'DELETE' }),
};

// Payroll (employees + salary slips)
export const payrollApi = {
  listEmployees:  (cid: string, params?: any)          => request<any>(`/companies/${cid}/employees?${new URLSearchParams(params||{})}`),
  createEmployee: (cid: string, body: any)             => request<any>(`/companies/${cid}/employees`, { method: 'POST', body: JSON.stringify(body) }),
  updateEmployee: (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  removeEmployee: (cid: string, id: string)            => request<any>(`/companies/${cid}/employees/${id}`, { method: 'DELETE' }),
  nextEmpCode:    (cid: string, prefix?: string)       => request<any>(`/companies/${cid}/employees/next-code?${new URLSearchParams(prefix ? { prefix } : {})}`),

  listPayslips:   (cid: string, params?: any)          => request<any>(`/companies/${cid}/payslips?${new URLSearchParams(params||{})}`),
  previewSlips:   (cid: string, params: any)           => request<any>(`/companies/${cid}/payslips/preview?${new URLSearchParams(params)}`),
  generateSlips:  (cid: string, body: any)             => request<any>(`/companies/${cid}/payslips/generate`, { method: 'POST', body: JSON.stringify(body) }),
  updatePayslip:  (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/payslips/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  removePayslip:  (cid: string, id: string)            => request<any>(`/companies/${cid}/payslips/${id}`, { method: 'DELETE' }),
  viewUrl:        (cid: string, id: string)            => `${BASE}/companies/${cid}/payslips/${id}/view`,
  pdfUrl:         (cid: string, id: string)            => `${BASE}/companies/${cid}/payslips/${id}/pdf`,
};
