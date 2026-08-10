'use client';
import { useEffect, useMemo, useState } from 'react';
import { companyApi } from '@/lib/api';
import { Topbar, Btn, Badge, Input, Sel, Modal, useToast, Skeleton, UIIcons } from '@/components/ui';
import { NavIcon } from '@/components/layout/nav';

const TILE_GRADS = ['var(--grad-brand)', 'var(--grad-teal)', 'var(--grad-amber)', 'var(--grad-violet)', 'var(--grad-rose)', 'var(--grad-green)'];

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [role,      setRole]      = useState('');
  const [query,     setQuery]     = useState('');
  const [showAdd,   setShowAdd]   = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ name: '', domain: '', gst: '', industry: 'technology', plan: 'STARTER' });

  const [editCo,   setEditCo]   = useState<any>(null);
  const [editForm, setEditForm] = useState({ name: '', domain: '', gst: '', industry: '', plan: '', status: '' });
  const [editSaving, setEditSaving] = useState(false);

  const [deleteCo,   setDeleteCo]   = useState<any>(null);
  const [deleting,   setDeleting]   = useState(false);

  const { toast, ToastContainer } = useToast();

  const load = async () => {
    try { const d = await companyApi.list({ limit: '50' }); setCompanies(d.companies || []); }
    catch (e: any) { toast(e.message, 'err'); } finally { setLoading(false); }
  };

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setRole(u.role || '');
    load();
  }, []);

  const create = async () => {
    if (!form.name) return toast('Company name required', 'err');
    setSaving(true);
    try {
      await companyApi.create(form);
      toast('Company created!');
      setShowAdd(false);
      setForm({ name: '', domain: '', gst: '', industry: 'technology', plan: 'STARTER' });
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setSaving(false); }
  };

  const openEdit = (co: any) => {
    setEditCo(co);
    setEditForm({
      name:     co.name     || '',
      domain:   co.domain   || '',
      gst:      co.gst      || '',
      industry: co.industry || 'technology',
      plan:     co.plan     || 'STARTER',
      status:   co.status   || 'ACTIVE',
    });
  };

  const saveEdit = async () => {
    if (!editForm.name) return toast('Company name required', 'err');
    setEditSaving(true);
    try {
      await companyApi.update(editCo.companyId, editForm);
      toast('Company updated!');
      setEditCo(null);
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setEditSaving(false); }
  };

  const confirmDelete = async () => {
    if (!deleteCo) return;
    setDeleting(true);
    try {
      await companyApi.remove(deleteCo.companyId);
      toast('Company deleted.');
      setDeleteCo(null);
      load();
    } catch (e: any) { toast(e.message, 'err'); } finally { setDeleting(false); }
  };

  const isSuperAdmin = role === 'SUPER_ADMIN';

  const INDUSTRY_OPTS = [
    {value:'technology',label:'Technology'},{value:'real_estate',label:'Real Estate'},
    {value:'retail',label:'Retail'},{value:'healthcare',label:'Healthcare'},
    {value:'consulting',label:'Consulting'},{value:'digital_marketing',label:'Digital Marketing'},
  ];
  const PLAN_OPTS = [
    {value:'STARTER',label:'Starter — ₹999/mo'},{value:'GROWTH',label:'Growth — ₹2,499/mo'},
    {value:'ENTERPRISE',label:'Enterprise — ₹4,999/mo'},
  ];
  const STATUS_OPTS = [
    {value:'ACTIVE',label:'Active'},{value:'INACTIVE',label:'Inactive'},{value:'SUSPENDED',label:'Suspended'},
  ];

  // ── derived (all real data) ─────────────────────────────────
  const filtered = useMemo(() => {
    const lq = query.trim().toLowerCase();
    if (!lq) return companies;
    return companies.filter((co: any) =>
      (co.name || '').toLowerCase().includes(lq) ||
      (co.domain || '').toLowerCase().includes(lq) ||
      (co.industry || '').toLowerCase().includes(lq) ||
      (co.gst || '').toLowerCase().includes(lq)
    );
  }, [companies, query]);

  const totalLeads  = companies.reduce((a: number, c: any) => a + (c._count?.leads || 0), 0);
  const totalUsers  = companies.reduce((a: number, c: any) => a + (c._count?.users || 0), 0);
  const activeCount = companies.filter((c: any) => (c.status || 'ACTIVE') === 'ACTIVE').length;

  const SUMMARY = [
    { label: 'Companies',   value: companies.length, grad: 'var(--grad-brand)',  icon: 'companies' },
    { label: 'Active',      value: activeCount,      grad: 'var(--grad-green)',  icon: 'deals' },
    { label: 'Total leads', value: totalLeads,       grad: 'var(--grad-teal)',   icon: 'leads' },
    { label: 'Team members',value: totalUsers,       grad: 'var(--grad-violet)', icon: 'users' },
  ];

  return (
    <>
      <Topbar title="Companies" subtitle={`${companies.length} workspaces · ${activeCount} active`}
        actions={isSuperAdmin ? <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>{UIIcons.plus(13)} New Company</Btn> : undefined} />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto p-4 md:p-6 flex flex-col gap-5" style={{ maxWidth: 1440 }}>

          {/* ── Summary tiles ── */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 stagger">
            {SUMMARY.map(s => (
              <div key={s.label} className="lux-card px-4 py-3.5 flex items-center gap-3"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                <div className="flex items-center justify-center flex-shrink-0"
                  style={{ width: 38, height: 38, borderRadius: 12, background: s.grad, color: '#fff', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)' }}>
                  <NavIcon name={s.icon} size={17} />
                </div>
                <div className="min-w-0">
                  <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                    {loading ? '—' : s.value.toLocaleString('en-IN')}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)', fontWeight: 600 }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* ── Search ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative" style={{ width: 300, maxWidth: '100%' }}>
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>{UIIcons.search(14)}</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search by name, domain, industry, GST…"
                className="fld"
                style={{ paddingLeft: 34 }}
              />
            </div>
            {query && (
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                {filtered.length} of {companies.length} companies
              </span>
            )}
          </div>

          {/* ── Card grid ── */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map(i => <Skeleton key={i} h={190} r={18} />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="lux-card flex flex-col items-center justify-center gap-3 py-16"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
              <div className="flex items-center justify-center" style={{ width: 56, height: 56, borderRadius: 18, background: 'var(--primary-soft)', color: 'var(--primary)' }}>
                <NavIcon name="companies" size={24} />
              </div>
              <div className="text-center">
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
                  {query ? `Nothing matches “${query}”` : 'No companies yet'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>
                  {query ? 'Try a different search term.' : 'Create your first company workspace to get started.'}
                </div>
              </div>
              {!query && isSuperAdmin && <Btn variant="primary" size="sm" onClick={() => setShowAdd(true)}>{UIIcons.plus(13)} New Company</Btn>}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 stagger">
              {filtered.map((co: any, i: number) => {
                const initials = co.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                const industry = (co.industry || '').replace(/_/g, ' ');
                return (
                  <div key={co.companyId} className="lux-card flex flex-col overflow-hidden"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>

                    {/* Header band */}
                    <div className="flex items-start gap-3 p-5 pb-4">
                      <div className="flex items-center justify-center flex-shrink-0"
                        style={{
                          width: 46, height: 46, borderRadius: 15, color: '#fff',
                          fontSize: 15, fontWeight: 800, background: TILE_GRADS[i % TILE_GRADS.length],
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25), 0 6px 14px -6px rgba(17,24,39,0.35)',
                        }}>
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="truncate" style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em' }}>{co.name}</div>
                        {co.domain ? (
                          <a href={`https://${co.domain.replace(/^https?:\/\//, '')}`} target="_blank" rel="noreferrer"
                            className="truncate block hover:underline" style={{ fontSize: 11.5, color: 'var(--primary)', fontWeight: 500 }}>
                            {co.domain.replace(/^https?:\/\//, '')}
                          </a>
                        ) : (
                          <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>No domain</div>
                        )}
                        {industry && <div className="capitalize truncate" style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>{industry}</div>}
                      </div>
                      <Badge status={co.status?.toLowerCase()} label={co.status} />
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-2 px-5 pb-4">
                      {[
                        { label: 'Leads', value: co._count?.leads ?? 0 },
                        { label: 'Users', value: co._count?.users ?? 0 },
                        { label: 'Plan',  value: (co.plan || '—').toLowerCase(), cap: true },
                      ].map(s => (
                        <div key={s.label} className="px-2.5 py-2 text-center"
                          style={{ background: 'var(--surface-2)', borderRadius: 11, border: '1px solid var(--border)' }}>
                          <div className={`truncate ${s.cap ? 'capitalize' : ''}`} style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{s.value}</div>
                          <div style={{ fontSize: 9.5, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 1 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* GST line */}
                    {co.gst && (
                      <div className="px-5 pb-3 font-mono truncate" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>GSTIN: {co.gst}</div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 px-5 py-3 mt-auto" style={{ borderTop: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                      <Btn variant="secondary" size="sm" onClick={() => openEdit(co)}>Edit</Btn>
                      {isSuperAdmin && (
                        <Btn variant="ghost" size="sm" onClick={() => setDeleteCo(co)}
                          style={{ color: 'var(--danger-ink)' }}>Delete</Btn>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>

      {/* ── Add Company Modal ─────────────────────────────────────── */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Company"
        footer={<><Btn variant="secondary" onClick={() => setShowAdd(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={create}>Create</Btn></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Acme Corp" />
            <Input label="Website" value={form.domain} onChange={e => setForm(f => ({ ...f, domain: e.target.value }))} placeholder="acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="GST" value={form.gst} onChange={e => setForm(f => ({ ...f, gst: e.target.value }))} placeholder="27AAAA0000A1Z5" />
            <Sel label="Industry" value={form.industry} onChange={e => setForm(f => ({ ...f, industry: e.target.value }))} options={INDUSTRY_OPTS} />
          </div>
          <Sel label="Plan" value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value }))} options={PLAN_OPTS} />
        </div>
      </Modal>

      {/* ── Edit Company Modal ────────────────────────────────────── */}
      <Modal open={!!editCo} onClose={() => setEditCo(null)} title={`Edit — ${editCo?.name || ''}`}
        footer={<><Btn variant="secondary" onClick={() => setEditCo(null)}>Cancel</Btn><Btn variant="primary" loading={editSaving} onClick={saveEdit}>Save Changes</Btn></>}>
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Input label="Company name *" value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            <Input label="Website" value={editForm.domain} onChange={e => setEditForm(f => ({ ...f, domain: e.target.value }))} placeholder="acme.com" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="GST" value={editForm.gst} onChange={e => setEditForm(f => ({ ...f, gst: e.target.value }))} />
            <Sel label="Industry" value={editForm.industry} onChange={e => setEditForm(f => ({ ...f, industry: e.target.value }))} options={INDUSTRY_OPTS} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Sel label="Plan" value={editForm.plan} onChange={e => setEditForm(f => ({ ...f, plan: e.target.value }))} options={PLAN_OPTS} />
            {isSuperAdmin && (
              <Sel label="Status" value={editForm.status} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} options={STATUS_OPTS} />
            )}
          </div>
        </div>
      </Modal>

      {/* ── Delete Confirmation Modal ─────────────────────────────── */}
      <Modal open={!!deleteCo} onClose={() => setDeleteCo(null)} title="Delete Company" size="sm"
        footer={
          <>
            <Btn variant="secondary" onClick={() => setDeleteCo(null)}>Cancel</Btn>
            <Btn variant="danger" loading={deleting} onClick={confirmDelete}>Yes, Delete</Btn>
          </>
        }>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 px-4 py-3" style={{ borderRadius: 12, background: 'var(--danger-soft)', border: '1px solid var(--danger)' }}>
            <span style={{ fontSize: 22 }}>⚠️</span>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--danger-ink)' }}>This action cannot be undone</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
                All data for <strong>{deleteCo?.name}</strong> — leads, deals, invoices, users, and projects — will be permanently removed.
              </div>
            </div>
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Are you sure you want to delete <strong style={{ color: 'var(--text)' }}>{deleteCo?.name}</strong>?
          </p>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
