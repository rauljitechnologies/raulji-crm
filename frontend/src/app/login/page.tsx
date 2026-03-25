'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

const DEMO = [
  { label: 'Super Admin',   email: 'admin@raulji.com' },
  { label: 'Company Admin', email: 'ariya@raulji.com' },
  { label: 'Sales Manager', email: 'priya@raulji.com' },
  { label: 'Sales Rep',     email: 'kiran@raulji.com' },
];

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await authApi.login(form);
      localStorage.setItem('accessToken',  data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user',         JSON.stringify(data.user));
      document.cookie = `accessToken=${data.accessToken}; path=/; max-age=3600`;
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)' }}>
      <div className="w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-3xl font-bold mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}>R</div>
          <h1 className="text-white text-2xl font-bold">Raulji CRM</h1>
          <p className="text-indigo-300 text-sm mt-1">Sign in to your workspace</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-2xl">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Email address</label>
              <input type="email" required autoFocus value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="you@company.com" />
            </div>
            <div>
              <div className="flex justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-600">Password</label>
                <a href="#" className="text-xs text-indigo-600 hover:underline">Forgot?</a>
              </div>
              <input type="password" required value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all"
                placeholder="••••••••" />
            </div>

            {error && <div className="bg-red-50 border border-red-100 text-red-600 text-xs px-3 py-2 rounded-lg">{error}</div>}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-1">
              {loading && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>}
              {loading ? 'Signing in...' : 'Sign in →'}
            </button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-xs text-slate-400 text-center font-medium uppercase tracking-wider mb-3">Demo accounts — password: Admin@123</p>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO.map(d => (
                <button key={d.email} onClick={() => setForm({ email: d.email, password: 'Admin@123' })}
                  className="flex flex-col items-start px-3 py-2 bg-slate-50 hover:bg-indigo-50 rounded-lg text-left transition-colors border border-transparent hover:border-indigo-200">
                  <span className="text-xs font-semibold text-slate-700">{d.label}</span>
                  <span className="text-xs text-slate-400 truncate w-full">{d.email}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <p className="text-center text-indigo-400 text-xs mt-6">© {new Date().getFullYear()} Raulji Technologies</p>
      </div>
    </div>
  );
}
