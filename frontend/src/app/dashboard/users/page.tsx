'use client';
import { useEffect, useState } from 'react';
import { companyApi, userApi } from '@/lib/api';
import { Topbar, Btn, Input, Sel, Modal, useToast, Avatar, Skeleton, UIIcons } from '@/components/ui';
import { NavIcon } from '@/components/layout/nav';

// ── Role badge (token-driven, dark-mode aware) ────────────────
const ROLE_TONE: Record<string, { bg: string; fg: string }> = {
  SUPER_ADMIN:   { bg: 'var(--warning-soft)', fg: 'var(--warning-ink)' },
  ADMIN:         { bg: 'rgba(139,92,246,0.14)', fg: '#8B5CF6' },
  SALES_MANAGER: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  SALES_REP:     { bg: 'var(--accent-soft)',  fg: 'var(--accent)' },
  VIEWER:        { bg: 'var(--surface-2)',    fg: 'var(--text-2)' },
};
function RoleBadge({ role, small }: { role: string; small?: boolean }) {
  const t = ROLE_TONE[role] || { bg: 'var(--surface-2)', fg: 'var(--text-2)' };
  return (
    <span style={{ background: t.bg, color: t.fg, padding: small ? '2px 8px' : '3px 9px', borderRadius: 9999, fontSize: small ? 10 : 11, fontWeight: 700, whiteSpace: 'nowrap', textTransform: 'capitalize', boxShadow: 'inset 0 0 0 1px rgba(127,127,127,0.08)' }}>
      {role.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}
function StatusPill({ removed, verified }: { removed?: boolean; verified?: boolean }) {
  const t = removed ? { bg: 'var(--danger-soft)', fg: 'var(--danger-ink)', label: 'Removed' }
    : verified ? { bg: 'var(--success-soft)', fg: 'var(--success-ink)', label: 'Active' }
    : { bg: 'var(--warning-soft)', fg: 'var(--warning-ink)', label: 'Pending' };
  return (
    <span className="inline-flex items-center gap-1.5" style={{ background: t.bg, color: t.fg, padding: '2.5px 9px', borderRadius: 9999, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: t.fg }} />{t.label}
    </span>
  );
}

const ROLES = [
  { value:'ADMIN',         label:'Admin' },
  { value:'SALES_MANAGER', label:'Sales Manager' },
  { value:'SALES_REP',     label:'Sales Rep' },
  { value:'VIEWER',        label:'Viewer' },
];

type PermKey = 'dashboard'|'companies'|'leads'|'pipeline'|'deals'|'clients'|'quotations'|'invoices'|'expenses'|'finance'|'payroll'|'analytics'|'users'|'settings'|'api'|'backup';

const ALL_PERMS: { key: PermKey; label: string; section: string }[] = [
  { key:'dashboard',  label:'Dashboard',      section:'Main' },
  { key:'companies',  label:'Companies',      section:'Main' },
  { key:'leads',      label:'Leads',          section:'Main' },
  { key:'pipeline',   label:'Pipeline',       section:'Main' },
  { key:'deals',      label:'Deals',          section:'Main' },
  { key:'clients',    label:'Clients',        section:'Finance' },
  { key:'quotations', label:'Quotations',     section:'Finance' },
  { key:'invoices',   label:'Invoices',       section:'Finance' },
  { key:'expenses',   label:'Expenses',       section:'Finance' },
  { key:'finance',    label:'Finance Overview', section:'Finance' },
  { key:'payroll',    label:'Payroll & Payslips', section:'People' },
  { key:'analytics',  label:'Analytics',      section:'Insights' },
  { key:'users',      label:'Users & Roles',  section:'System' },
  { key:'settings',   label:'Settings',       section:'System' },
  { key:'api',        label:'API & Webhooks', section:'System' },
  { key:'backup',     label:'Backups',        section:'System' },
];

const ROLE_DEFAULTS: Record<string, Record<PermKey, boolean>> = {
  SUPER_ADMIN:   { dashboard:true,companies:true,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,expenses:true,finance:true,payroll:true,analytics:true,users:true,settings:true,api:true,backup:true },
  ADMIN:         { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,expenses:true,finance:true,payroll:true,analytics:true,users:true,settings:true,api:true,backup:false },
  SALES_MANAGER: { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,expenses:true,finance:false,payroll:false,analytics:true,users:false,settings:false,api:false,backup:false },
  SALES_REP:     { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:false,expenses:false,finance:false,payroll:false,analytics:false,users:false,settings:false,api:false,backup:false },
  VIEWER:        { dashboard:true,companies:false,leads:true,pipeline:false,deals:false,clients:false,quotations:false,invoices:false,expenses:false,finance:false,payroll:false,analytics:true,users:false,settings:false,api:false,backup:false },
};

function effectivePerms(user: any): Record<PermKey, boolean> {
  const base = ROLE_DEFAULTS[user.role] || ROLE_DEFAULTS.VIEWER;
  return { ...base, ...(user.permissions || {}) } as Record<PermKey, boolean>;
}

function groupBySection(perms: typeof ALL_PERMS) {
  const map: Record<string, typeof ALL_PERMS> = {};
  perms.forEach(p => { (map[p.section] ||= []).push(p); });
  return map;
}

const MATRIX_ROLES: { key: string; label: string }[] = [
  { key:'ADMIN',         label:'Admin'   },
  { key:'SALES_MANAGER', label:'Manager' },
  { key:'SALES_REP',     label:'Rep'     },
  { key:'VIEWER',        label:'Viewer'  },
];

const lbl: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 4, display: 'block' };

// ── Small action pill helper ──────────────────────────────────
function ActBtn({ tone, onClick, children }: { tone: 'primary'|'accent'|'warning'|'danger'|'success'; onClick: () => void; children: React.ReactNode }) {
  const map = {
    primary: { bg: 'var(--primary-soft)', fg: 'var(--primary)' },
    accent:  { bg: 'var(--accent-soft)',  fg: 'var(--accent)' },
    warning: { bg: 'var(--warning-soft)', fg: 'var(--warning-ink)' },
    danger:  { bg: 'var(--danger-soft)',  fg: 'var(--danger-ink)' },
    success: { bg: 'var(--success-soft)', fg: 'var(--success-ink)' },
  }[tone];
  return <button onClick={onClick} className="act-btn" style={{ background: map.bg, color: map.fg }}>{children}</button>;
}

export default function UsersPage() {
  const [me,           setMe]          = useState<any>(null);
  const [companies,    setCompanies]   = useState<any[]>([]);
  const [users,        setUsers]       = useState<any[]>([]);
  const [loading,      setLoading]     = useState(false);
  const [search,       setSearch]      = useState('');
  const [filterCo,     setFilterCo]    = useState('');
  const [showRemoved,  setShowRemoved] = useState(false);
  const [showInvite,   setShowInvite]  = useState(false);
  const [showMatrix,   setShowMatrix]  = useState(false);
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const [saving,      setSaving]      = useState(false);
  const [inviteCo,    setInviteCo]    = useState('');
  const [form, setForm] = useState({ name:'', email:'', role:'SALES_REP', password:'' });

  // Assign company modal
  const [assignUser,        setAssignUser]        = useState<any>(null);
  const [assignSelectedIds, setAssignSelectedIds] = useState<string[]>([]);
  const [assignOriginalIds, setAssignOriginalIds] = useState<string[]>([]);
  const [assignRole,        setAssignRole]        = useState('SALES_REP');
  const [assignSaving,      setAssignSaving]      = useState(false);

  // Permission editor
  const [permUser,  setPermUser]  = useState<any>(null);
  const [permState, setPermState] = useState<Record<string,boolean>>({});
  const [permSaving,setPermSaving]= useState(false);

  // Set-password modal (SUPER_ADMIN)
  const [pwUser,   setPwUser]   = useState<any>(null);
  const [pwValue,  setPwValue]  = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  const { toast, ToastContainer } = useToast();

  const load = async () => {
    setLoading(true);
    try {
      const meRaw = JSON.parse(localStorage.getItem('user') || '{}');
      setMe(meRaw);
      const [ud, cd] = await Promise.all([userApi.listAll(), companyApi.list({ limit: '100' })]);
      setUsers(ud.users || []);
      const cos = cd.companies || [];
      setCompanies(cos);
      if (!inviteCo && cos[0]) setInviteCo(cos[0].companyId);
    } catch(e: any) { toast(e.message, 'err'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  // Filtered view
  const activeUsers  = users.filter(u => u.isActive);
  const pendingCount = activeUsers.filter(u => !u.isVerified).length;
  const removedCount = users.filter(u => !u.isActive).length;
  const visible = users.filter(u => {
    if (!showRemoved && !u.isActive) return false;
    const matchCo = !filterCo || u.companyId === filterCo;
    const q = search.toLowerCase();
    const matchQ  = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.company?.name||'').toLowerCase().includes(q);
    return matchCo && matchQ;
  });

  const invite = async () => {
    if (!form.name || !form.email) return toast('Name and email required', 'err');
    if (!inviteCo) return toast('Select a company', 'err');
    if (form.password && form.password.length < 8) return toast('Password must be at least 8 characters', 'err');
    setSaving(true);
    try {
      await userApi.invite(inviteCo, form);
      toast(form.password ? 'User added!' : 'Invite sent!');
      setShowInvite(false);
      setForm({ name:'', email:'', role:'SALES_REP', password:'' });
      load();
    } catch(e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const changeRole = async (u: any, role: string) => {
    if (!u.companyId) return toast('No company for user', 'err');
    try { await userApi.updateRole(u.companyId, u.userId, role); toast('Role updated!'); load(); }
    catch(e: any) { toast(e.message, 'err'); }
  };

  const remove = async (u: any) => {
    if (!confirm(`Remove ${u.name} from ${u.company?.name || 'this company'}?`)) return;
    if (!u.companyId) return toast('No company for user', 'err');
    try { await userApi.remove(u.companyId, u.userId); toast('User removed.'); load(); }
    catch(e: any) { toast(e.message, 'err'); }
  };

  const unremove = async (u: any) => {
    if (!confirm(`Restore ${u.name}? They will become active again (without a company until re-assigned).`)) return;
    try { await userApi.unremove(u.userId); toast('User restored.'); load(); }
    catch(e: any) { toast(e.message, 'err'); }
  };

  const permanentDelete = async (u: any) => {
    if (!confirm(`PERMANENTLY DELETE ${u.name}? This cannot be undone.`)) return;
    try { await userApi.permanentDelete(u.userId); toast('User permanently deleted.'); load(); }
    catch(e: any) { toast(e.message, 'err'); }
  };

  const openAssign = (u: any) => {
    const current = (u.companies || []).map((uc: any) => uc.companyId);
    setAssignUser(u);
    setAssignSelectedIds(current);
    setAssignOriginalIds(current);
    setAssignRole(u.role === 'SUPER_ADMIN' ? 'ADMIN' : (u.role || 'SALES_REP'));
  };

  const toggleAssignCompany = (cid: string) => {
    setAssignSelectedIds(prev =>
      prev.includes(cid) ? prev.filter(x => x !== cid) : [...prev, cid]
    );
  };

  const saveAssign = async () => {
    if (assignSelectedIds.length === 0) return toast('Select at least one company', 'err');
    setAssignSaving(true);
    try {
      const toAdd    = assignSelectedIds.filter(id => !assignOriginalIds.includes(id));
      const toRemove = assignOriginalIds.filter(id => !assignSelectedIds.includes(id));
      await Promise.all([
        ...toAdd.map(cid    => userApi.assignCompany(assignUser.userId, { companyId: cid, role: assignRole })),
        ...toRemove.map(cid => userApi.removeFromCompany(assignUser.userId, cid)),
      ]);
      const added = toAdd.length, removed = toRemove.length;
      const msg = [added && `${added} added`, removed && `${removed} removed`].filter(Boolean).join(', ');
      toast(msg ? `Companies updated: ${msg}` : 'No changes made.');
      setAssignUser(null);
      load();
    } catch(e: any) { toast(e.message, 'err'); }
    finally { setAssignSaving(false); }
  };

  const removeFromCo = async (u: any, coId: string, coName: string) => {
    if (!confirm(`Remove ${u.name} from ${coName}?`)) return;
    try { await userApi.removeFromCompany(u.userId, coId); toast('Removed from company.'); load(); }
    catch(e: any) { toast(e.message, 'err'); }
  };

  const openPermEditor = (u: any) => {
    setPermUser(u);
    setPermState(effectivePerms(u));
  };

  const savePerms = async () => {
    const cid = permUser?.companyId || permUser?.companies?.[0]?.companyId;
    if (!cid) return toast('This user has no company. Assign a company first.', 'err');
    setPermSaving(true);
    try {
      await userApi.updatePermissions(cid, permUser.userId, permState);
      toast('Permissions saved!');
      setPermUser(null);
      load();
    } catch(e: any) { toast(e.message, 'err'); }
    finally { setPermSaving(false); }
  };

  const resetToRole = () => {
    if (!permUser) return;
    setPermState({ ...ROLE_DEFAULTS[permUser.role] || ROLE_DEFAULTS.VIEWER });
  };

  const savePassword = async () => {
    if (!pwUser) return;
    if (pwValue.length < 8) return toast('Password must be at least 8 characters', 'err');
    setPwSaving(true);
    try {
      await userApi.setPassword(pwUser.userId, pwValue);
      toast('Password updated!');
      setPwUser(null);
      setPwValue('');
      load();
    } catch(e: any) { toast(e.message, 'err'); }
    finally { setPwSaving(false); }
  };

  const sections = groupBySection(ALL_PERMS);

  const infoBox: React.CSSProperties = { background: 'var(--surface-2)', borderRadius: 10, padding: '8px 12px', fontSize: 12, color: 'var(--text-2)' };

  return (
    <>
      <Topbar title="Users & Roles" subtitle={`${activeUsers.length} active user${activeUsers.length !== 1 ? 's' : ''} across ${companies.length} companies`}
        actions={<>
          <Btn variant="secondary" size="sm" onClick={() => setShowMatrix(true)}>{UIIcons.command(12)} Role Matrix</Btn>
          <Btn variant="primary" size="sm" onClick={() => setShowInvite(true)}>{UIIcons.plus(13)} Add User</Btn>
        </>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto p-4 md:p-6 flex flex-col gap-4" style={{ maxWidth: 1440 }}>

          {/* Stat tiles */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {[
              { label: 'Active Users', value: activeUsers.length, grad: 'var(--grad-brand)',  icon: <NavIcon name="users" size={18} /> },
              { label: 'Pending Invites', value: pendingCount,    grad: 'var(--grad-amber)',  icon: UIIcons.bell(16) },
              { label: 'Companies',    value: companies.length,   grad: 'var(--grad-teal)',   icon: <NavIcon name="companies" size={18} /> },
              { label: 'Removed',      value: removedCount,       grad: 'var(--grad-rose)',   icon: UIIcons.trash(16) },
            ].map(s => (
              <div key={s.label} className="lux-card p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16 }}>
                <div className="flex items-center justify-center text-white flex-shrink-0" style={{ width: 40, height: 40, borderRadius: 12, background: s.grad }}>{s.icon}</div>
                <div className="min-w-0">
                  <div style={{ fontSize: 21, fontWeight: 800, color: 'var(--text)', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{s.value}</div>
                  <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text-2)' }}>{s.label}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Filters */}
          <div className="flex gap-2 flex-wrap items-center">
            <div className="relative w-full sm:w-72">
              <span className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-3)' }}>{UIIcons.search(13)}</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, email or company…" className="fld fld-xs" style={{ paddingLeft: 30 }} />
            </div>
            <select value={filterCo} onChange={e => setFilterCo(e.target.value)} className="fld fld-xs" style={{ width: 'auto', maxWidth: 220 }}>
              <option value="">All Companies ({companies.length})</option>
              {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer select-none" style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 500 }}>
              <input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
              Show removed
            </label>
          </div>

          {/* Users table */}
          <div className="lux-card p-0 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18 }}>
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)' }}>
                All Users <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>({visible.length}{visible.length !== users.length ? ` of ${users.length}` : ''})</span>
              </div>
            </div>
            <div className="table-scroll">
              <table className="w-full text-xs border-collapse" style={{ minWidth: 900 }}>
                <thead>
                  <tr style={{ background: 'var(--surface-2)', borderBottom: '1px solid var(--border)' }}>
                    {['User','Companies','Role','Change Role','Status'].map(h => <th key={h} className="tbl-th">{h}</th>)}
                    <th className="tbl-th" style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    [0,1,2,3,4].map(i => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td className="px-4 py-3"><div className="flex items-center gap-2.5"><Skeleton w={32} h={32} r={10} /><div className="flex flex-col gap-1.5"><Skeleton w={110} h={11} /><Skeleton w={140} h={9} /></div></div></td>
                        <td className="px-3 py-3"><Skeleton w={90} h={16} r={9999} /></td>
                        <td className="px-3 py-3"><Skeleton w={70} h={16} r={9999} /></td>
                        <td className="px-3 py-3"><Skeleton w={90} h={22} r={8} /></td>
                        <td className="px-3 py-3"><Skeleton w={60} h={16} r={9999} /></td>
                        <td className="px-4 py-3"><div className="flex justify-end"><Skeleton w={160} h={22} r={8} /></div></td>
                      </tr>
                    ))
                  ) : visible.length === 0 ? (
                    <tr><td colSpan={6}>
                      <div className="py-14 text-center flex flex-col items-center gap-3">
                        <div className="flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 17, background: 'var(--primary-soft)', color: 'var(--primary)' }}><NavIcon name="users" size={22} /></div>
                        <div>
                          <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)' }}>No users found</div>
                          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 3 }}>{search || filterCo ? 'Try adjusting your filters.' : 'Invite your first teammate to get started.'}</div>
                        </div>
                      </div>
                    </td></tr>
                  ) : visible.map((u: any) => (
                    <tr key={u.userId} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.12s', opacity: u.isActive ? 1 : 0.55 }}
                      onMouseEnter={e => { if (u.isActive) e.currentTarget.style.background = 'var(--surface-2)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}>
                      {/* User */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.name} size={32} />
                          <div className="min-w-0">
                            <div className="truncate" style={{ fontWeight: 600, color: 'var(--text)', fontSize: 12.5, textDecoration: u.isActive ? 'none' : 'line-through' }}>{u.name}</div>
                            <div className="truncate" style={{ fontSize: 10.5, color: 'var(--text-3)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      {/* Companies */}
                      <td className="px-3 py-3" style={{ maxWidth: 220 }}>
                        {(u.companies?.length > 0) ? (
                          <div className="flex flex-wrap gap-1">
                            {u.companies.map((uc: any) => (
                              <span key={uc.companyId} className="inline-flex items-center gap-1" style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 9999, background: 'var(--surface-2)', color: 'var(--text-2)' }}>
                                {uc.company.name}
                                {isSuperAdmin && u.isActive && (
                                  <button onClick={() => removeFromCo(u, uc.companyId, uc.company.name)} title="Remove from company"
                                    style={{ color: 'var(--text-3)', fontWeight: 700, lineHeight: 1, cursor: 'pointer', background: 'none', border: 'none', padding: 0 }}
                                    onMouseEnter={e => { e.currentTarget.style.color = 'var(--danger-ink)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-3)'; }}>×</button>
                                )}
                              </span>
                            ))}
                          </div>
                        ) : <span style={{ color: 'var(--text-3)', fontStyle: 'italic', fontSize: 11.5 }}>No company</span>}
                      </td>
                      {/* Role */}
                      <td className="px-3 py-3"><RoleBadge role={u.role} /></td>
                      {/* Change Role */}
                      <td className="px-3 py-3">
                        {u.isActive && u.role !== 'SUPER_ADMIN' ? (
                          <select value={u.role} onChange={e => changeRole(u, e.target.value)} className="fld fld-xs" style={{ width: 'auto' }}>
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : <span style={{ color: 'var(--text-3)', fontStyle: 'italic' }}>—</span>}
                      </td>
                      {/* Status */}
                      <td className="px-3 py-3"><StatusPill removed={!u.isActive} verified={u.isVerified} /></td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                          {isSuperAdmin && u.role !== 'SUPER_ADMIN' && <ActBtn tone="primary" onClick={() => openAssign(u)}>Assign</ActBtn>}
                          {u.isActive && u.companyId && <ActBtn tone="accent" onClick={() => openPermEditor(u)}>Edit Perms</ActBtn>}
                          {u.isActive && isSuperAdmin && (u.role !== 'SUPER_ADMIN' || u.userId === me?.userId) && <ActBtn tone="warning" onClick={() => { setPwUser(u); setPwValue(''); }}>Set Password</ActBtn>}
                          {u.isActive && u.role !== 'SUPER_ADMIN' && u.companyId && <ActBtn tone="danger" onClick={() => remove(u)}>Remove</ActBtn>}
                          {!u.isActive && isSuperAdmin && <ActBtn tone="success" onClick={() => unremove(u)}>Restore</ActBtn>}
                          {!u.isActive && isSuperAdmin && <ActBtn tone="danger" onClick={() => permanentDelete(u)}>Delete</ActBtn>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Add User Modal */}
      <Modal open={showInvite} onClose={() => { setShowInvite(false); setForm({ name:'', email:'', role:'SALES_REP', password:'' }); }} title="Add New User"
        footer={<>
          <Btn variant="secondary" onClick={() => { setShowInvite(false); setForm({ name:'', email:'', role:'SALES_REP', password:'' }); }}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={invite}>{form.password ? 'Add User' : 'Send Invite'}</Btn>
        </>}>
        <div className="flex flex-col gap-3">
          <div>
            <label style={lbl}>Company *</label>
            <select value={inviteCo} onChange={e => setInviteCo(e.target.value)} className="fld">
              {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Priya Mehta" />
          <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="priya@company.com" />
          <Sel label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} options={ROLES} />
          <Input label="Password (optional)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Set password directly (min 8 chars)" />
          <div style={infoBox}>
            {form.password
              ? 'User will be created with this password and can log in immediately.'
              : 'Leave password blank to send an invite email — user sets their own password on accept.'}
          </div>
        </div>
      </Modal>

      {/* Set Password Modal (SUPER_ADMIN) */}
      <Modal open={!!pwUser} onClose={() => { setPwUser(null); setPwValue(''); }} title={`Set Password — ${pwUser?.name || ''}`}
        footer={<>
          <Btn variant="secondary" onClick={() => { setPwUser(null); setPwValue(''); }}>Cancel</Btn>
          <Btn variant="primary" loading={pwSaving} onClick={savePassword}>Update Password</Btn>
        </>}>
        {pwUser && (
          <div className="flex flex-col gap-3">
            <div style={infoBox} className="flex items-center gap-2 flex-wrap">
              <span>User:</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{pwUser.email}</span>
            </div>
            <Input label="New Password" type="password" value={pwValue} onChange={e => setPwValue(e.target.value)} placeholder="Min 8 characters" />
            <p style={{ fontSize: 11, color: 'var(--text-3)' }}>Sets this user's password directly. They'll be signed out everywhere and must log in with the new password.</p>
          </div>
        )}
      </Modal>

      {/* Permission Editor Modal */}
      <Modal open={!!permUser} onClose={() => setPermUser(null)} title={`Permissions — ${permUser?.name || ''}`} size="lg"
        footer={<>
          <Btn variant="secondary" onClick={resetToRole}>Reset to Role Defaults</Btn>
          <Btn variant="secondary" onClick={() => setPermUser(null)}>Cancel</Btn>
          <Btn variant="primary" loading={permSaving} onClick={savePerms}>Save Permissions</Btn>
        </>}>
        {permUser && (
          <div className="flex flex-col gap-4">
            <div style={infoBox} className="flex items-center gap-2 flex-wrap">
              <span>Company:</span><span style={{ fontWeight: 600, color: 'var(--text)' }}>{permUser.company?.name || '—'}</span>
              <span style={{ color: 'var(--text-3)' }}>·</span>
              <span>Role:</span><RoleBadge role={permUser.role} small />
            </div>
            {Object.entries(sections).map(([section, perms]) => (
              <div key={section}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>{section}</div>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map(p => {
                    const checked = !!permState[p.key];
                    const roleDefault = !!(ROLE_DEFAULTS[permUser.role]?.[p.key]);
                    const isOverride = checked !== roleDefault;
                    return (
                      <label key={p.key} className="flex items-center gap-2.5 cursor-pointer transition-colors"
                        style={{ borderRadius: 10, padding: '8px 12px', border: `1px solid ${checked ? 'var(--primary)' : 'var(--border)'}`, background: checked ? 'var(--primary-soft)' : 'var(--surface-2)' }}>
                        <input type="checkbox" checked={checked} onChange={e => setPermState(s => ({ ...s, [p.key]: e.target.checked }))}
                          style={{ accentColor: 'var(--primary)', width: 14, height: 14 }} />
                        <span style={{ fontSize: 12, fontWeight: 600, color: checked ? 'var(--primary)' : 'var(--text-2)' }}>{p.label}</span>
                        {isOverride && <span className="ml-auto" style={{ fontSize: 9, fontWeight: 700, padding: '1px 6px', borderRadius: 6, background: 'var(--warning-soft)', color: 'var(--warning-ink)' }}>override</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* Assign Company Modal */}
      <Modal open={!!assignUser} onClose={() => setAssignUser(null)} title={`Assign Company — ${assignUser?.name || ''}`}
        footer={<>
          <Btn variant="secondary" onClick={() => setAssignUser(null)}>Cancel</Btn>
          <Btn variant="primary" loading={assignSaving} onClick={saveAssign}>Save</Btn>
        </>}>
        {assignUser && (
          <div className="flex flex-col gap-4">
            <div style={infoBox}><span style={{ fontWeight: 600, color: 'var(--text)' }}>{assignUser.email}</span></div>
            <div>
              <label style={lbl}>Companies *</label>
              <div style={{ border: '1px solid var(--border-strong)', borderRadius: 12, overflow: 'hidden' }}>
                <div className="flex flex-col max-h-52 overflow-y-auto">
                  {companies.map((c: any) => {
                    const checked = assignSelectedIds.includes(c.companyId);
                    const wasOriginal = assignOriginalIds.includes(c.companyId);
                    return (
                      <label key={c.companyId} className="flex items-center gap-3 cursor-pointer transition-colors"
                        style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', background: checked ? 'var(--primary-soft)' : 'transparent' }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleAssignCompany(c.companyId)} style={{ accentColor: 'var(--primary)', width: 14, height: 14, flexShrink: 0 }} />
                        <span className="flex-1" style={{ fontSize: 12.5, color: 'var(--text)' }}>{c.name}</span>
                        {wasOriginal && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 6, background: 'var(--accent-soft)', color: 'var(--accent)' }}>current</span>}
                      </label>
                    );
                  })}
                </div>
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 5 }}>
                {assignSelectedIds.length === 0 ? 'No companies selected' : `${assignSelectedIds.length} ${assignSelectedIds.length === 1 ? 'company' : 'companies'} selected`}
              </div>
            </div>
            <div>
              <label style={lbl}>Role (for newly assigned companies)</label>
              <select value={assignRole} onChange={e => setAssignRole(e.target.value)} className="fld">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
          </div>
        )}
      </Modal>

      {/* Role Matrix Modal */}
      <Modal open={showMatrix} onClose={() => setShowMatrix(false)} title="Default Role Permissions" size="lg"
        footer={<Btn variant="primary" onClick={() => setShowMatrix(false)}>Done</Btn>}>
        <div className="flex flex-col gap-3">
          <p style={{ fontSize: 12, color: 'var(--text-2)' }}>Base permissions granted to each role. Individual users can be overridden via <strong style={{ color: 'var(--text)' }}>Edit Perms</strong>.</p>
          <div className="table-scroll">
            <table className="w-full border-collapse" style={{ minWidth: 460 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="tbl-th" style={{ width: 150 }}>Module</th>
                  {MATRIX_ROLES.map(r => <th key={r.key} className="tbl-th" style={{ textAlign: 'center' }}><RoleBadge role={r.key} small /></th>)}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMS.map(p => (
                  <tr key={p.key} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '9px 12px', fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{p.label}</td>
                    {MATRIX_ROLES.map(r => (
                      <td key={r.key} style={{ padding: '9px 12px', textAlign: 'center' }}>
                        {ROLE_DEFAULTS[r.key]?.[p.key]
                          ? <span className="inline-flex" style={{ color: 'var(--success-ink)' }}>{UIIcons.check(15)}</span>
                          : <span style={{ color: 'var(--text-3)', opacity: 0.4 }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      <ToastContainer />
    </>
  );
}
