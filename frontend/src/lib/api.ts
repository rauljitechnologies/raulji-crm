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
  markPaid: (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/invoices/${id}/mark-paid`, { method: 'PUT', body: JSON.stringify(body) }),
  send:     (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/invoices/${id}/send`, { method: 'POST', body: JSON.stringify(body) }),
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
};

// Message Templates
export const templateApi = {
  list:    (cid: string, params?: any) => request<any>(`/companies/${cid}/templates?${new URLSearchParams(params||{})}`),
  get:     (cid: string, id: string)   => request<any>(`/companies/${cid}/templates/${id}`),
  create:  (cid: string, body: any)    => request<any>(`/companies/${cid}/templates`, { method: 'POST', body: JSON.stringify(body) }),
  update:  (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove:  (cid: string, id: string)   => request<any>(`/companies/${cid}/templates/${id}`, { method: 'DELETE' }),
  preview: (cid: string, id: string, lead?: any) => request<any>(`/companies/${cid}/templates/${id}/preview`, { method: 'POST', body: JSON.stringify({ lead }) }),
};

// Automation
export const automationApi = {
  listRules:  (cid: string)                          => request<any>(`/companies/${cid}/automation/rules`),
  createRule: (cid: string, body: any)               => request<any>(`/companies/${cid}/automation/rules`, { method: 'POST', body: JSON.stringify(body) }),
  updateRule: (cid: string, id: string, body: any)   => request<any>(`/companies/${cid}/automation/rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleRule: (cid: string, id: string, isActive: boolean) => request<any>(`/companies/${cid}/automation/rules/${id}/toggle`, { method: 'PUT', body: JSON.stringify({ isActive }) }),
  deleteRule: (cid: string, id: string)              => request<any>(`/companies/${cid}/automation/rules/${id}`, { method: 'DELETE' }),
  listJobs:   (cid: string, params?: any)            => request<any>(`/companies/${cid}/automation/jobs?${new URLSearchParams(params||{})}`),
  retryJob:   (cid: string, id: string)              => request<any>(`/companies/${cid}/automation/jobs/${id}/retry`, { method: 'POST' }),
};

// Campaigns
export const campaignApi = {
  list:            (cid: string)                        => request<any>(`/companies/${cid}/campaigns`),
  get:             (cid: string, id: string)            => request<any>(`/companies/${cid}/campaigns/${id}`),
  create:          (cid: string, body: any)             => request<any>(`/companies/${cid}/campaigns`, { method: 'POST', body: JSON.stringify(body) }),
  update:          (cid: string, id: string, body: any) => request<any>(`/companies/${cid}/campaigns/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  previewAudience: (cid: string, id: string)            => request<any>(`/companies/${cid}/campaigns/${id}/preview-audience`, { method: 'POST' }),
  launch:          (cid: string, id: string)            => request<any>(`/companies/${cid}/campaigns/${id}/launch`, { method: 'POST' }),
  cancel:          (cid: string, id: string)            => request<any>(`/companies/${cid}/campaigns/${id}/cancel`, { method: 'POST' }),
  remove:          (cid: string, id: string)            => request<any>(`/companies/${cid}/campaigns/${id}`, { method: 'DELETE' }),
};

// Communications
export const commApi = {
  getTimeline:         (cid: string, leadId: string)             => request<any>(`/companies/${cid}/leads/${leadId}/timeline`),
  sendManual:          (cid: string, leadId: string, body: any)  => request<any>(`/companies/${cid}/leads/${leadId}/send`, { method: 'POST', body: JSON.stringify(body) }),
  getAutoReplyRules:   (cid: string)                             => request<any>(`/companies/${cid}/auto-reply-rules`),
  createAutoReplyRule: (cid: string, body: any)                  => request<any>(`/companies/${cid}/auto-reply-rules`, { method: 'POST', body: JSON.stringify(body) }),
  updateAutoReplyRule: (cid: string, id: string, body: any)      => request<any>(`/companies/${cid}/auto-reply-rules/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteAutoReplyRule: (cid: string, id: string)                 => request<any>(`/companies/${cid}/auto-reply-rules/${id}`, { method: 'DELETE' }),
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

// Projects
export const projectApi = {
  list:             (cid: string, params?: any) => request<any>(`/companies/${cid}/projects${params ? '?' + new URLSearchParams(params) : ''}`),
  create:           (cid: string, body: any)    => request<any>(`/companies/${cid}/projects`, { method: 'POST', body: JSON.stringify(body) }),
  get:              (cid: string, pid: string)  => request<any>(`/companies/${cid}/projects/${pid}`),
  update:           (cid: string, pid: string, body: any) => request<any>(`/companies/${cid}/projects/${pid}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove:           (cid: string, pid: string)  => request<any>(`/companies/${cid}/projects/${pid}`, { method: 'DELETE' }),
  assignCompany:    (cid: string, pid: string, body: any) => request<any>(`/companies/${cid}/projects/${pid}/assign`, { method: 'POST', body: JSON.stringify(body) }),
  removeAssignment: (cid: string, pid: string, assignedCid: string) => request<any>(`/companies/${cid}/projects/${pid}/assign/${assignedCid}`, { method: 'DELETE' }),
  addDocument:      (cid: string, pid: string, body: any) => request<any>(`/companies/${cid}/projects/${pid}/documents`, { method: 'POST', body: JSON.stringify(body) }),
  removeDocument:   (cid: string, pid: string, docId: string) => request<any>(`/companies/${cid}/projects/${pid}/documents/${docId}`, { method: 'DELETE' }),
  addCredential:    (cid: string, pid: string, body: any) => request<any>(`/companies/${cid}/projects/${pid}/credentials`, { method: 'POST', body: JSON.stringify(body) }),
  updateCredential: (cid: string, pid: string, credId: string, body: any) => request<any>(`/companies/${cid}/projects/${pid}/credentials/${credId}`, { method: 'PUT', body: JSON.stringify(body) }),
  removeCredential: (cid: string, pid: string, credId: string) => request<any>(`/companies/${cid}/projects/${pid}/credentials/${credId}`, { method: 'DELETE' }),
  revealCredential: (cid: string, pid: string, credId: string) => request<any>(`/companies/${cid}/projects/${pid}/credentials/${credId}/reveal`),
  addHistory:       (cid: string, pid: string, body: any) => request<any>(`/companies/${cid}/projects/${pid}/history`, { method: 'POST', body: JSON.stringify(body) }),
};

// Backup (SUPER_ADMIN only)
export const backupApi = {
  list:    (params?: any) => request<any>(`/admin/backups?${new URLSearchParams(params||{})}`),
  trigger: ()             => request<any>('/admin/backups/trigger', { method: 'POST' }),
  delete:  (id: string)   => request<any>(`/admin/backups/${id}`, { method: 'DELETE' }),
  downloadUrl: (id: string, type: 'db' | 'code') => `${BASE}/admin/backups/${id}/download/${type}`,
};

// SEO
export const seoApi = {
  triggerAudit:  (cid: string)                        => request<any>(`/companies/${cid}/seo/audits`, { method: 'POST' }),
  getAudits:     (cid: string, params?: any)          => request<any>(`/companies/${cid}/seo/audits?${new URLSearchParams(params||{})}`),
  getLatest:     (cid: string)                        => request<any>(`/companies/${cid}/seo/audits/latest`),
  getAudit:      (cid: string, id: string)            => request<any>(`/companies/${cid}/seo/audits/${id}`),
  getKeywords:   (cid: string)                        => request<any>(`/companies/${cid}/seo/keywords`),
  addKeyword:    (cid: string, body: any)             => request<any>(`/companies/${cid}/seo/keywords`, { method: 'POST', body: JSON.stringify(body) }),
  removeKeyword: (cid: string, kid: string)           => request<any>(`/companies/${cid}/seo/keywords/${kid}`, { method: 'DELETE' }),
  checkUrls:     (cid: string, urls: string[])        => request<any>(`/companies/${cid}/seo/url-check`, { method: 'POST', body: JSON.stringify({ urls }) }),
};
