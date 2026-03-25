'use client';
import { useEffect, useState } from 'react';
import { companyApi, userApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast } from '@/components/ui';

const ROLE_BADGE: Record<string,string> = { SUPER_ADMIN:'bg-amber-100 text-amber-700', ADMIN:'bg-orange-50 text-orange-700', SALES_MANAGER:'bg-indigo-50 text-indigo-700', SALES_REP:'bg-green-50 text-green-700', VIEWER:'bg-slate-100 text-slate-500' };
const ROLES = [{value:'ADMIN',label:'Admin'},{value:'SALES_MANAGER',label:'Sales Manager'},{value:'SALES_REP',label:'Sales Rep'},{value:'VIEWER',label:'Viewer'}];

export default function UsersPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [form, setForm] = useState({ name:'', email:'', role:'SALES_REP', companyIds: [] as string[] });
  const { toast, ToastContainer } = useToast();

  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  useEffect(() => {
    try { setCurrentUser(JSON.parse(localStorage.getItem('user') || '{}')); } catch {}
  }, []);

  const loadCos = async () => {
    try {
      const d = await companyApi.list({ limit:'50' });
      const cos = d.companies || [];
      setCompanies(cos);
      if (cos[0]) setCompanyId(prev => prev || cos[0].companyId);
    } catch {}
  };
  useEffect(() => { loadCos(); }, []);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const d = await userApi.list(companyId);
      setUsers(d.users || []);
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, [companyId]);

  const openInvite = () => {
    setForm({ name:'', email:'', role:'SALES_REP', companyIds: companyId ? [companyId] : [] });
    setShowInvite(true);
  };

  const toggleCompany = (id: string) => {
    setForm(f => ({
      ...f,
      companyIds: f.companyIds.includes(id) ? f.companyIds.filter(cid => cid !== id) : [...f.companyIds, id],
    }));
  };

  const invite = async () => {
    if (!form.name || !form.email) return toast('Name and email required', 'err');
    if (!form.companyIds.length) return toast('Select at least one company', 'err');
    setSaving(true);
    try {
      await userApi.invite(companyId, form);
      toast('User company access saved!');
      setShowInvite(false);
      setForm({ name:'', email:'', role:'SALES_REP', companyIds: [] });
      load();
    } catch (e: any) {
      toast(e.message, 'err');
    } finally {
      setSaving(false);
    }
  };

  const changeRole = async (uid: string, role: string) => {
    try {
      await userApi.updateRole(companyId, uid, role);
      toast('Role updated!');
      load();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };

  const remove = async (uid: string, name: string) => {
    if (!confirm(`Remove ${name} from this company?`)) return;
    try {
      await userApi.remove(companyId, uid);
      toast('Company access updated.');
      load();
    } catch (e: any) {
      toast(e.message, 'err');
    }
  };

  return (
    <>
      <Topbar title="Users & Roles" subtitle="Manage team members company-wise"
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={openInvite}>+ Add User</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-[1.4fr_1fr] gap-4 items-start">
        <Card>
          <div className="text-xs font-bold text-slate-900 mb-3">Team Members ({users.length})</div>
          {loading ? <div className="py-8 text-center text-slate-400 text-xs">Loading...</div>
          : users.length===0 ? <div className="py-8 text-center text-slate-400 text-xs">No users yet. Add a user for this company.</div>
          : users.map((u:any) => {
            const assignedCompanies = companies.filter((co:any) => (u.companyIds || []).includes(co.companyId));
            return (
              <div key={u.userId} className="py-3 border-b border-slate-50 last:border-none">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs flex-shrink-0">
                    {u.name.split(' ').map((n:string)=>n[0]).join('').slice(0,2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800">{u.name}</div>
                    <div className="text-xs text-slate-400 truncate">{u.email}</div>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ROLE_BADGE[u.role]||'bg-slate-100 text-slate-500'}`}>{u.role.replace('_',' ')}</span>
                  <select value={u.role} onChange={e=>changeRole(u.userId, e.target.value)} className="text-xs border border-slate-200 rounded-lg px-2 py-1 outline-none focus:border-indigo-500">
                    {ROLES.map(r=><option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <button onClick={()=>remove(u.userId, u.name)} className="text-xs text-red-400 hover:text-red-600 font-medium transition-colors">Remove</button>
                </div>
                <div className="mt-2 ml-12 flex flex-wrap gap-1.5">
                  {assignedCompanies.map((co:any) => (
                    <span key={co.companyId} className={`text-[11px] px-2 py-1 rounded-full ${co.companyId === companyId ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>
                      {co.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </Card>

        <Card>
          <div className="text-xs font-bold text-slate-900 mb-3">Access Rules</div>
          <div className="flex flex-col gap-3 text-xs text-slate-500">
            <div className="rounded-xl bg-slate-50 p-3">
              Super admin can create companies and assign one user to one or many companies.
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              Users can only open data for companies they are assigned to.
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              Removing a user here removes access only for the selected company, unless it was their last company.
            </div>
          </div>
        </Card>
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Add User Access"
        footer={<><Btn variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={invite}>Save User</Btn></>}>
        <div className="flex flex-col gap-3">
          <Input label="Full name *" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Priya Mehta" />
          <Input label="Email *" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="priya@company.com" />
          <Sel label="Role" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} options={ROLES} />
          <div className="flex flex-col gap-2">
            <label className="text-xs font-medium text-slate-600">Company Access</label>
            <div className="grid grid-cols-1 gap-2">
              {companies.map((co:any) => {
                const checked = form.companyIds.includes(co.companyId);
                const disabled = !isSuperAdmin && co.companyId !== companyId;
                return (
                  <label key={co.companyId} className={`flex items-center gap-3 rounded-xl border px-3 py-2 text-xs ${checked ? 'border-indigo-300 bg-indigo-50' : 'border-slate-200 bg-white'} ${disabled ? 'opacity-50' : ''}`}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => toggleCompany(co.companyId)}
                    />
                    <span className="font-medium text-slate-700">{co.name}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">
            {isSuperAdmin ? 'Select multiple companies to give this user access to all selected companies.' : 'This user will be added only to the currently selected company.'}
          </div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
