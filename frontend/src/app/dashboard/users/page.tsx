'use client';
import { useEffect, useState } from 'react';
import { companyApi, userApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast } from '@/components/ui';

const ROLE_BADGE: Record<string,string> = {
  SUPER_ADMIN: 'bg-amber-100 text-amber-700',
  ADMIN:       'bg-orange-50 text-orange-700',
  SALES_MANAGER:'bg-indigo-50 text-indigo-700',
  SALES_REP:   'bg-green-50 text-green-700',
  VIEWER:      'bg-slate-100 text-slate-500',
};

const ROLES = [
  { value:'ADMIN',         label:'Admin' },
  { value:'SALES_MANAGER', label:'Sales Manager' },
  { value:'SALES_REP',     label:'Sales Rep' },
  { value:'VIEWER',        label:'Viewer' },
];

type PermKey = 'dashboard'|'companies'|'leads'|'pipeline'|'deals'|'clients'|'quotations'|'invoices'|'analytics'|'ai'|'users'|'settings'|'api'|'whatsapp'|'campaigns'|'automation'|'templates';

const ALL_PERMS: { key: PermKey; label: string; section: string }[] = [
  { key:'dashboard',  label:'Dashboard',      section:'Main' },
  { key:'companies',  label:'Companies',      section:'Main' },
  { key:'leads',      label:'Leads',          section:'Main' },
  { key:'pipeline',   label:'Pipeline',       section:'Main' },
  { key:'deals',      label:'Deals',          section:'Main' },
  { key:'clients',    label:'Clients',        section:'Finance' },
  { key:'quotations', label:'Quotations',     section:'Finance' },
  { key:'invoices',   label:'Invoices',       section:'Finance' },
  { key:'whatsapp',   label:'WhatsApp Hub',   section:'Automation' },
  { key:'campaigns',  label:'Campaigns',      section:'Automation' },
  { key:'automation', label:'Automation',     section:'Automation' },
  { key:'templates',  label:'Templates',      section:'Automation' },
  { key:'analytics',  label:'Analytics',      section:'Insights' },
  { key:'ai',         label:'AI Insights',    section:'Insights' },
  { key:'users',      label:'Users & Roles',  section:'System' },
  { key:'settings',   label:'Settings',       section:'System' },
  { key:'api',        label:'API & Webhooks', section:'System' },
];

const ROLE_DEFAULTS: Record<string, Record<PermKey, boolean>> = {
  SUPER_ADMIN:   { dashboard:true,companies:true,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,ai:true,users:true,settings:true,api:true,whatsapp:true,campaigns:true,automation:true,templates:true },
  ADMIN:         { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,ai:true,users:true,settings:true,api:true,whatsapp:true,campaigns:true,automation:true,templates:true },
  SALES_MANAGER: { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:true,analytics:true,ai:true,users:false,settings:false,api:false,whatsapp:true,campaigns:true,automation:false,templates:true },
  SALES_REP:     { dashboard:true,companies:false,leads:true,pipeline:true,deals:true,clients:true,quotations:true,invoices:false,analytics:false,ai:false,users:false,settings:false,api:false,whatsapp:true,campaigns:false,automation:false,templates:false },
  VIEWER:        { dashboard:true,companies:false,leads:true,pipeline:false,deals:false,clients:false,quotations:false,invoices:false,analytics:true,ai:false,users:false,settings:false,api:false,whatsapp:false,campaigns:false,automation:false,templates:false },
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

export default function UsersPage() {
  const [me,           setMe]          = useState<any>(null);
  const [companies,    setCompanies]   = useState<any[]>([]);
  const [users,        setUsers]       = useState<any[]>([]);
  const [loading,      setLoading]     = useState(false);
  const [search,       setSearch]      = useState('');
  const [filterCo,     setFilterCo]    = useState('');
  const [showRemoved,  setShowRemoved] = useState(false);
  const [showInvite,   setShowInvite]  = useState(false);
  const isSuperAdmin = me?.role === 'SUPER_ADMIN';
  const [saving,      setSaving]      = useState(false);
  const [inviteCo,    setInviteCo]    = useState('');
  const [form, setForm] = useState({ name:'', email:'', role:'SALES_REP', password:'' });

  // Permission editor
  const [permUser,  setPermUser]  = useState<any>(null);
  const [permState, setPermState] = useState<Record<string,boolean>>({});
  const [permSaving,setPermSaving]= useState(false);

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

  const openPermEditor = (u: any) => {
    setPermUser(u);
    setPermState(effectivePerms(u));
  };

  const savePerms = async () => {
    if (!permUser?.companyId) return;
    setPermSaving(true);
    try {
      await userApi.updatePermissions(permUser.companyId, permUser.userId, permState);
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

  const sections = groupBySection(ALL_PERMS);

  return (
    <>
      <Topbar title="Users & Roles" subtitle={`${activeUsers.length} active users across ${companies.length} companies`}
        actions={<Btn variant="primary" size="sm" onClick={() => setShowInvite(true)}>+ Add User</Btn>}
      />

      <div className="flex-1 min-h-0 overflow-y-auto p-5 flex flex-col gap-4">

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or company..."
            className="flex-1 min-w-48 border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-400 bg-white"
          />
          <select value={filterCo} onChange={e => setFilterCo(e.target.value)}
            className="border border-slate-200 rounded-xl px-3 py-2 text-xs outline-none focus:border-indigo-400 bg-white">
            <option value="">All Companies ({companies.length})</option>
            {companies.map((c: any) => (
              <option key={c.companyId} value={c.companyId}>{c.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
            <input type="checkbox" checked={showRemoved} onChange={e => setShowRemoved(e.target.checked)} className="accent-indigo-600" />
            Show removed
          </label>
        </div>

        {/* Users table */}
        <Card className="p-0">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <div className="text-xs font-bold text-slate-900">
              All Users <span className="text-slate-400 font-normal">({visible.length}{visible.length !== users.length ? ` of ${users.length}` : ''})</span>
            </div>
          </div>
          {loading ? (
            <div className="py-10 text-center text-slate-400 text-xs">Loading...</div>
          ) : visible.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    <th className="text-left px-4 py-2.5 text-slate-500 font-semibold">User</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Company</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Role</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Change Role</th>
                    <th className="text-left px-3 py-2.5 text-slate-500 font-semibold">Status</th>
                    <th className="text-right px-4 py-2.5 text-slate-500 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((u: any) => (
                    <tr key={u.userId} className={`border-b border-slate-50 last:border-none ${u.isActive ? 'hover:bg-slate-50/50' : 'opacity-50 bg-slate-50/40'}`}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${u.isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400'}`}>
                            {u.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className={`font-semibold ${u.isActive ? 'text-slate-800' : 'text-slate-400 line-through'}`}>{u.name}</div>
                            <div className="text-slate-400 text-[10px]">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <span className="text-slate-700 font-medium">{u.company?.name || <span className="text-slate-300 italic">No company</span>}</span>
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role] || 'bg-slate-100 text-slate-500'}`}>
                          {u.role.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        {u.isActive && u.role !== 'SUPER_ADMIN' ? (
                          <select value={u.role} onChange={e => changeRole(u, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 bg-white">
                            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        ) : (
                          <span className="text-slate-300 text-xs italic">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {!u.isActive ? (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-400">Removed</span>
                        ) : (
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${u.isVerified ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                            {u.isVerified ? 'Active' : 'Pending'}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {u.isActive && u.companyId && (
                            <button onClick={() => openPermEditor(u)}
                              className="text-xs text-indigo-500 hover:text-indigo-700 font-semibold transition-colors px-2 py-1 rounded hover:bg-indigo-50">
                              Edit Perms
                            </button>
                          )}
                          {u.isActive && u.role !== 'SUPER_ADMIN' && u.companyId && (
                            <button onClick={() => remove(u)}
                              className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors px-2 py-1 rounded hover:bg-red-50">
                              Remove
                            </button>
                          )}
                          {!u.isActive && isSuperAdmin && (
                            <button onClick={() => unremove(u)}
                              className="text-xs text-emerald-500 hover:text-emerald-700 font-semibold transition-colors px-2 py-1 rounded hover:bg-emerald-50">
                              Restore
                            </button>
                          )}
                          {!u.isActive && isSuperAdmin && (
                            <button onClick={() => permanentDelete(u)}
                              className="text-xs text-red-500 hover:text-red-700 font-bold transition-colors px-2 py-1 rounded hover:bg-red-50">
                              Delete
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Role defaults matrix */}
        <Card className="p-0">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="text-xs font-bold text-slate-900">Default Role Permissions</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Base permissions per role — individual overrides via "Edit Perms"</div>
          </div>
          <div className="overflow-x-auto p-4">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="text-left py-2 pr-4 text-slate-500 font-semibold w-32">Module</th>
                  {MATRIX_ROLES.map(r => (
                    <th key={r.key} className="text-center py-2 px-3 text-slate-500 font-semibold">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] ${ROLE_BADGE[r.key] || 'bg-slate-100 text-slate-500'}`}>{r.label}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMS.map(p => (
                  <tr key={p.key} className="border-b border-slate-50 last:border-none">
                    <td className="py-2 pr-4 text-slate-600 font-medium">{p.label}</td>
                    {MATRIX_ROLES.map(r => {
                      const has = ROLE_DEFAULTS[r.key]?.[p.key];
                      return (
                        <td key={r.key} className="py-2 px-3 text-center">
                          {has
                            ? <span className="text-emerald-500 font-bold text-sm">✓</span>
                            : <span className="text-slate-200 font-bold text-sm">✕</span>
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Add User Modal */}
      <Modal open={showInvite} onClose={() => { setShowInvite(false); setForm({ name:'', email:'', role:'SALES_REP', password:'' }); }} title="Add New User"
        footer={<>
          <Btn variant="secondary" onClick={() => { setShowInvite(false); setForm({ name:'', email:'', role:'SALES_REP', password:'' }); }}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={invite}>{form.password ? 'Add User' : 'Send Invite'}</Btn>
        </>}>
        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Company *</label>
            <select value={inviteCo} onChange={e => setInviteCo(e.target.value)}
              className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm outline-none focus:border-indigo-400">
              {companies.map((c: any) => <option key={c.companyId} value={c.companyId}>{c.name}</option>)}
            </select>
          </div>
          <Input label="Full name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Priya Mehta" />
          <Input label="Email *" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="priya@company.com" />
          <Sel label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} options={ROLES} />
          <Input label="Password (optional)" type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Set password directly (min 8 chars)" />
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            {form.password
              ? 'User will be created with this password and can log in immediately.'
              : 'Leave password blank to send an invite email — user sets their own password on accept.'}
          </div>
        </div>
      </Modal>

      {/* Permission Editor Modal */}
      <Modal open={!!permUser} onClose={() => setPermUser(null)} title={`Permissions — ${permUser?.name}`}
        footer={<>
          <Btn variant="secondary" onClick={resetToRole}>Reset to Role Defaults</Btn>
          <Btn variant="secondary" onClick={() => setPermUser(null)}>Cancel</Btn>
          <Btn variant="primary" loading={permSaving} onClick={savePerms}>Save Permissions</Btn>
        </>}>
        {permUser && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2 text-xs text-slate-600 flex-wrap">
              <span>Company:</span>
              <span className="font-semibold text-slate-800">{permUser.company?.name || '—'}</span>
              <span className="text-slate-300">·</span>
              <span>Role:</span>
              <span className={`font-semibold px-2 py-0.5 rounded-full text-[10px] ${ROLE_BADGE[permUser.role] || 'bg-slate-100 text-slate-500'}`}>
                {permUser.role.replace(/_/g, ' ')}
              </span>
            </div>
            {Object.entries(sections).map(([section, perms]) => (
              <div key={section}>
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">{section}</div>
                <div className="grid grid-cols-2 gap-2">
                  {perms.map(p => {
                    const checked = !!permState[p.key];
                    const roleDefault = !!(ROLE_DEFAULTS[permUser.role]?.[p.key]);
                    const isOverride = checked !== roleDefault;
                    return (
                      <label key={p.key} className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                        checked ? 'border-indigo-200 bg-indigo-50/60' : 'border-slate-100 bg-slate-50/60'
                      }`}>
                        <input type="checkbox" checked={checked}
                          onChange={e => setPermState(s => ({ ...s, [p.key]: e.target.checked }))}
                          className="w-3.5 h-3.5 accent-indigo-600" />
                        <span className={`text-xs font-medium ${checked ? 'text-indigo-700' : 'text-slate-500'}`}>{p.label}</span>
                        {isOverride && (
                          <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-600">override</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <ToastContainer />
    </>
  );
}
