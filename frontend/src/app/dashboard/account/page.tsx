'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { Topbar, Card, Btn, Input, useToast } from '@/components/ui';

export default function AccountPage() {
  const router = useRouter();
  const { toast, ToastContainer } = useToast();
  const [user, setUser]     = useState<any>(null);
  const [tab,  setTab]      = useState<'profile'|'password'>('profile');
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState({ name: '', phone: '', avatar: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });

  useEffect(() => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    setUser(u);
    setProfile({ name: u.name || '', phone: u.phone || '', avatar: u.avatar || '' });
  }, []);

  const saveProfile = async () => {
    if (!profile.name.trim()) return toast('Name is required', 'err');
    setSaving(true);
    try {
      const updated = await authApi.updateMe({ name: profile.name.trim(), phone: profile.phone, avatar: profile.avatar });
      const stored = JSON.parse(localStorage.getItem('user') || '{}');
      const merged = { ...stored, ...updated };
      localStorage.setItem('user', JSON.stringify(merged));
      setUser(merged);
      toast('Profile updated!');
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const savePassword = async () => {
    if (!pwd.currentPassword || !pwd.newPassword) return toast('All fields required', 'err');
    if (pwd.newPassword !== pwd.confirmPassword) return toast('Passwords do not match', 'err');
    if (pwd.newPassword.length < 8) return toast('Password must be at least 8 characters', 'err');
    setSaving(true);
    try {
      await authApi.changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
      toast('Password changed! You may need to log in again on other devices.');
      setPwd({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e: any) { toast(e.message, 'err'); }
    finally { setSaving(false); }
  };

  const logout = () => {
    const rt = localStorage.getItem('refreshToken');
    authApi.logout({ refreshToken: rt }).catch(() => {});
    localStorage.clear();
    document.cookie = 'accessToken=; max-age=0; path=/';
    router.push('/login');
  };

  const initials = user?.name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() || 'U';
  const roleFmt  = user?.role?.replace(/_/g, ' ') || '';

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <Topbar title="My Account" subtitle="Manage your profile and security" />
      <ToastContainer />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">

          {/* Avatar card */}
          <Card>
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #3199d4, #1a72a3)' }}>
                {user?.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full rounded-full object-cover" />
                  : initials}
              </div>
              <div>
                <div className="font-bold text-slate-900 text-base">{user?.name || '—'}</div>
                <div className="text-xs text-slate-500 mt-0.5">{user?.email}</div>
                <div className="mt-1">
                  <span style={{ background: '#e8f5fd', color: '#1a72a3', fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 9999 }}>
                    {roleFmt}
                  </span>
                </div>
              </div>
              <button onClick={logout}
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all hover:bg-red-50"
                style={{ color: '#ef4444', border: '1px solid #fecaca' }}>
                <svg viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                  <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd"/>
                </svg>
                Sign out
              </button>
            </div>
          </Card>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-slate-200">
            {(['profile', 'password'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className="px-4 py-2 text-xs font-semibold capitalize transition-all"
                style={{ borderBottom: tab === t ? '2px solid #3199d4' : '2px solid transparent', color: tab === t ? '#3199d4' : '#7a9baf' }}>
                {t === 'profile' ? 'Profile' : 'Change Password'}
              </button>
            ))}
          </div>

          {/* Profile tab */}
          {tab === 'profile' && (
            <Card>
              <div className="flex flex-col gap-4">
                <Input label="Full Name" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                <Input label="Phone" value={profile.phone} onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))} placeholder="+91 98765 43210" />
                <Input label="Avatar URL" value={profile.avatar} onChange={e => setProfile(p => ({ ...p, avatar: e.target.value }))} placeholder="https://example.com/photo.jpg" />
                <div className="flex justify-end">
                  <Btn variant="primary" loading={saving} onClick={saveProfile}>Save Changes</Btn>
                </div>
              </div>
            </Card>
          )}

          {/* Password tab */}
          {tab === 'password' && (
            <Card>
              <div className="flex flex-col gap-4">
                <Input label="Current Password" type="password" value={pwd.currentPassword} onChange={e => setPwd(p => ({ ...p, currentPassword: e.target.value }))} placeholder="Enter current password" />
                <Input label="New Password" type="password" value={pwd.newPassword} onChange={e => setPwd(p => ({ ...p, newPassword: e.target.value }))} placeholder="Min 8 characters" />
                <Input label="Confirm New Password" type="password" value={pwd.confirmPassword} onChange={e => setPwd(p => ({ ...p, confirmPassword: e.target.value }))} placeholder="Repeat new password" />
                <div className="flex justify-end">
                  <Btn variant="primary" loading={saving} onClick={savePassword}>Change Password</Btn>
                </div>
              </div>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}
