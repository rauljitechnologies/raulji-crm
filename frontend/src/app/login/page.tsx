'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';
import { EyeIcon, EyeOffIcon } from '@/components/ui';

const FEATURES = [
  { title: 'Pipeline that runs itself', desc: 'Leads, deals and follow-ups in one flow.' },
  { title: 'Analytics that surface what matters', desc: 'Know which sources and reps actually convert.' },
  { title: 'Finance without the spreadsheets', desc: 'Quotations, invoices and expenses in a click.' },
];

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm]       = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [showPw, setShowPw]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      const data = await authApi.login(form);
      localStorage.setItem('accessToken',  data.accessToken);
      localStorage.setItem('refreshToken', data.refreshToken);
      localStorage.setItem('user',         JSON.stringify(data.user));
      document.cookie = `accessToken=${data.accessToken}; path=/; max-age=604800`; // 7 days
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.message || 'Invalid email or password');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg)' }}>

      {/* ── Brand panel ─────────────────────────────────────── */}
      <div className="hidden lg:flex flex-col justify-between relative overflow-hidden p-12 w-[46%]"
        style={{ background: 'var(--grad-brand-deep)' }}>
        <div aria-hidden className="absolute pointer-events-none" style={{ width: 560, height: 560, right: -180, top: -260, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 65%)' }} />
        <div aria-hidden className="absolute pointer-events-none" style={{ width: 420, height: 420, left: -160, bottom: -200, borderRadius: '50%', background: 'radial-gradient(circle, rgba(20,184,166,0.28) 0%, transparent 65%)' }} />

        <div className="relative flex items-center gap-3">
          <div className="flex items-center justify-center" style={{ width: 40, height: 40, borderRadius: 13, background: 'rgba(255,255,255,0.14)', border: '1px solid rgba(255,255,255,0.22)', backdropFilter: 'blur(8px)' }}>
            <img src="https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png" alt="Raulji" width={26} height={26} style={{ borderRadius: 7, background: '#fff' }} />
          </div>
          <div>
            <div style={{ color: '#fff', fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>Raulji CRM</div>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Sales Intelligence Platform</div>
          </div>
        </div>

        <div className="relative">
          <h1 style={{ color: '#fff', fontSize: 34, fontWeight: 800, letterSpacing: '-0.03em', lineHeight: 1.15, maxWidth: 440 }}>
            Every lead, deal and rupee — one beautiful workspace.
          </h1>
          <div className="mt-8 flex flex-col gap-4">
            {FEATURES.map(f => (
              <div key={f.title} className="flex items-start gap-3">
                <div className="flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ width: 22, height: 22, borderRadius: 8, background: 'rgba(255,255,255,0.16)', color: '#fff' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m4.5 12.5 5 5 10-11"/></svg>
                </div>
                <div>
                  <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 700 }}>{f.title}</div>
                  <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12.5 }}>{f.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="relative" style={{ color: 'rgba(255,255,255,0.55)', fontSize: 11.5 }}>© {new Date().getFullYear()} Raulji Technologies</p>
      </div>

      {/* ── Form panel ──────────────────────────────────────── */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full animate-fade-in-up" style={{ maxWidth: 400 }}>

          {/* Mobile logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="mx-auto mb-3 flex items-center justify-center" style={{ width: 52, height: 52, borderRadius: 16, background: 'var(--grad-brand)', boxShadow: '0 10px 24px -8px rgba(37,99,235,0.5)' }}>
              <img src="https://www.rauljitechnologies.com/wp-content/uploads/2026/01/cropped-RAULJI-LOGO-192x192.png" alt="Raulji" width={32} height={32} style={{ borderRadius: 9, background: '#fff' }} />
            </div>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Raulji CRM</h1>
            <p style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>Sales Intelligence Platform</p>
          </div>

          <div className="p-8" style={{ background: 'var(--surface)', borderRadius: 22, border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)' }}>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>Welcome back</h2>
            <p style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3, marginBottom: 22 }}>Sign in to your workspace to continue.</p>

            <form onSubmit={submit} className="flex flex-col gap-4">
              <div>
                <label className="block mb-1.5" style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Email address</label>
                <input type="email" required autoFocus value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  className="w-full transition-all"
                  style={{ padding: '10px 14px', fontSize: 13.5, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
                  onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-ring)'; }}
                  onBlur={e => { e.target.style.borderColor = 'var(--border-strong)'; e.target.style.boxShadow = 'none'; }}
                  placeholder="you@company.com" />
              </div>
              <div>
                <div className="flex justify-between mb-1.5">
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>Password</label>
                  <a href="#" style={{ fontSize: 12, color: 'var(--primary)', fontWeight: 600 }} className="hover:underline">Forgot?</a>
                </div>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} required value={form.password}
                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                    className="w-full transition-all"
                    style={{ padding: '10px 44px 10px 14px', fontSize: 13.5, borderRadius: 12, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--text)' }}
                    onFocus={e => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-ring)'; }}
                    onBlur={e => { e.target.style.borderColor = 'var(--border-strong)'; e.target.style.boxShadow = 'none'; }}
                    placeholder="••••••••" />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(s => !s)}
                    aria-label={showPw ? 'Hide password' : 'Show password'}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex' }}>
                    {showPw ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: 'var(--danger-soft)', border: '1px solid rgba(239,68,68,0.25)', color: 'var(--danger-ink)', fontSize: 12, padding: '9px 12px', borderRadius: 10, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="lux-btn lux-btn-primary w-full flex items-center justify-center gap-2 mt-1"
                style={{ padding: '11px 0', background: 'var(--grad-brand)', color: '#fff', fontWeight: 700, fontSize: 13.5, borderRadius: 12, border: 'none', cursor: 'pointer' }}>
                {loading && <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>}
                {loading ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          </div>

          <p className="lg:hidden text-center mt-6" style={{ fontSize: 11.5, color: 'var(--text-3)' }}>© {new Date().getFullYear()} Raulji Technologies</p>
        </div>
      </div>
    </div>
  );
}
