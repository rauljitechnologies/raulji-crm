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
  const data = await res.json();
  if (!data.success) throw new Error(data.error?.message || 'Request failed');
  return data.data;
}

// Auth
export const authApi = {
  login:  (body: any) => request<any>('/auth/login',  { method: 'POST', body: JSON.stringify(body) }),
  me:     ()         => request<any>('/auth/me'),
  logout: (body: any) => request<any>('/auth/logout', { method: 'POST', body: JSON.stringify(body) }),
};

// Companies
export const companyApi = {
  list:           (params?: any)          => request<any>(`/companies?${new URLSearchParams(params||{})}`),
  get:            (id: string)            => request<any>(`/companies/${id}`),
  create:         (body: any)             => request<any>('/companies', { method: 'POST', body: JSON.stringify(body) }),
  update:         (id: string, body: any) => request<any>(`/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
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
  list:       (cid: string)              => request<any>(`/companies/${cid}/users`),
  invite:     (cid: string, body: any)   => request<any>(`/companies/${cid}/users/invite`, { method: 'POST', body: JSON.stringify(body) }),
  updateRole: (cid: string, uid: string, role: string) => request<any>(`/companies/${cid}/users/${uid}/role`, { method: 'PUT', body: JSON.stringify({ role }) }),
  remove:     (cid: string, uid: string) => request<any>(`/companies/${cid}/users/${uid}`, { method: 'DELETE' }),
};

// Analytics
export const analyticsApi = {
  overview: (cid: string) => request<any>(`/companies/${cid}/analytics/overview`),
  team:     (cid: string) => request<any>(`/companies/${cid}/analytics/team`),
  pipeline: (cid: string) => request<any>(`/companies/${cid}/analytics/pipeline`),
};
