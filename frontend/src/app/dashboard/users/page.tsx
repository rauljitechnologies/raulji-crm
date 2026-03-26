'use client';
import { useEffect, useState } from 'react';
import { companyApi, userApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, Sel, Modal, useToast } from '@/components/ui';

const ROLE_BADGE: Record<string,string> = { SUPER_ADMIN:'bg-amber-100 text-amber-700', ADMIN:'bg-orange-50 text-orange-700', SALES_MANAGER:'bg-indigo-50 text-indigo-700', SALES_REP:'bg-green-50 text-green-700', VIEWER:'bg-slate-100 text-slate-500' };
const ROLES = [{value:'ADMIN',label:'Admin'},{value:'SALES_MANAGER',label:'Sales Manager'},{value:'SALES_REP',label:'Sales Rep'},{value:'VIEWER',label:'Viewer'}];

export default function UsersPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [users,     setUsers]     = useState<any[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [showInvite,setShowInvite]= useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({ name:'', email:'', role:'SALES_REP' });
  const { toast, ToastContainer } = useToast();

  const loadCos = async () => { try { const d=await companyApi.list({limit:'20'}); const cos=d.companies||[]; setCompanies(cos); if(cos[0]) setCompanyId(cos[0].companyId); } catch {} };
  useEffect(() => { loadCos(); }, []);

  const load = async () => { if(!companyId) return; setLoading(true); try { const d=await userApi.list(companyId); setUsers(d.users||[]); } catch(e:any){toast(e.message,'err');} finally{setLoading(false);} };
  useEffect(() => { load(); }, [companyId]);

  const invite = async () => {
    if (!form.name||!form.email) return toast('Name and email required','err');
    setSaving(true);
    try { await userApi.invite(companyId, form); toast('Invite sent!'); setShowInvite(false); setForm({name:'',email:'',role:'SALES_REP'}); load(); }
    catch(e:any){toast(e.message,'err');} finally{setSaving(false);}
  };

  const changeRole = async (uid: string, role: string) => {
    try { await userApi.updateRole(companyId, uid, role); toast('Role updated!'); load(); }
    catch(e:any){toast(e.message,'err');}
  };

  const remove = async (uid: string, name: string) => {
    if (!confirm(`Remove ${name} from this company?`)) return;
    try { await userApi.remove(companyId, uid); toast('User removed.'); load(); }
    catch(e:any){toast(e.message,'err');}
  };

  return (
    <>
      <Topbar title="Users & Roles" subtitle="Manage team members and permissions"
        actions={<>
          <select value={companyId} onChange={e=>setCompanyId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500">
            {companies.map((c:any)=><option key={c.companyId} value={c.companyId}>{c.name}</option>)}
          </select>
          <Btn variant="primary" size="sm" onClick={() => setShowInvite(true)}>+ Invite User</Btn>
        </>}
      />

      <div className="flex-1 overflow-y-auto p-5 grid grid-cols-[1.4fr_1fr] gap-4 items-start">
        <Card>
          <div className="text-xs font-bold text-slate-900 mb-3">Team Members ({users.length})</div>
          {loading ? <div className="py-8 text-center text-slate-400 text-xs">Loading...</div>
          : users.length===0 ? <div className="py-8 text-center text-slate-400 text-xs">No users yet. Invite your team!</div>
          : users.map((u:any) => (
            <div key={u.userId} className="flex items-center gap-3 py-3 border-b border-slate-50 last:border-none">
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
          ))}
        </Card>

        <Card>
          <div className="text-xs font-bold text-slate-900 mb-3">Role Permissions</div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b border-slate-100">
                <th className="text-left py-2 text-slate-500 font-medium">Permission</th>
                {['Admin','Manager','Rep','Viewer'].map(r=><th key={r} className="text-center py-2 text-slate-500 font-medium">{r}</th>)}
              </tr></thead>
              <tbody>
                {[
                  ['View Leads',      '✓','✓','✓','✓'],
                  ['Create Leads',    '✓','✓','✓','✗'],
                  ['Delete Leads',    '✓','✗','✗','✗'],
                  ['View Deals',      '✓','✓','✓','✓'],
                  ['Quotations',      '✓','✓','✓','✗'],
                  ['Invoices',        '✓','View','✗','✗'],
                  ['Analytics',       '✓','✓','✗','✗'],
                  ['Manage Users',    '✓','✗','✗','✗'],
                  ['API Keys',        '✓','✗','✗','✗'],
                ].map(([perm,...vals])=>(
                  <tr key={perm} className="border-b border-slate-50">
                    <td className="py-2 text-slate-600">{perm}</td>
                    {(vals as string[]).map((v,i)=>(
                      <td key={i} className={`py-2 text-center font-bold ${v==='✓'?'text-emerald-500':v==='✗'?'text-slate-200':'text-amber-500'}`}>{v}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite User"
        footer={<><Btn variant="secondary" onClick={() => setShowInvite(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={invite}>Send Invite</Btn></>}>
        <div className="flex flex-col gap-3">
          <Input label="Full name *"  value={form.name}  onChange={e=>setForm(f=>({...f,name:e.target.value}))}  placeholder="Priya Mehta" />
          <Input label="Email *" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="priya@company.com" />
          <Sel label="Role" value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} options={ROLES} />
          <div className="bg-slate-50 rounded-lg p-3 text-xs text-slate-500">An invite email will be sent. They set their own password when they accept.</div>
        </div>
      </Modal>
      <ToastContainer />
    </>
  );
}
