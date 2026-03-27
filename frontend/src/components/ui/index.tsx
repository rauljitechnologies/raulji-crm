'use client';
import { useState, useRef } from 'react';

// ── Topbar ────────────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="bg-white border-b border-slate-200 h-14 px-6 flex items-center justify-between flex-shrink-0">
      <div>
        <h1 className="text-sm font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{actions}</div>
    </header>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const hasCustomPadding = /\bp-\d/.test(className);
  return <div className={`bg-white border border-slate-200 rounded-xl ${hasCustomPadding ? '' : 'p-4'} ${className}`}>{children}</div>;
}

// ── Button ────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean;
}
export function Btn({ variant = 'secondary', size = 'md', loading, children, className = '', ...props }: BtnProps) {
  const v = { primary: 'bg-indigo-600 text-white hover:bg-indigo-700 border-indigo-600', secondary: 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200', danger: 'bg-red-600 text-white hover:bg-red-700 border-red-600', ghost: 'bg-transparent text-slate-600 hover:bg-slate-100 border-transparent' }[variant];
  const s = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-xs';
  return (
    <button {...props} disabled={loading || props.disabled} className={`inline-flex items-center gap-1.5 font-semibold border rounded-lg transition-all disabled:opacity-50 cursor-pointer ${v} ${s} ${className}`}>
      {loading && <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/><path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/></svg>}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className = '', ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <input {...props} className={`w-full px-3 py-2 text-xs border rounded-lg bg-white text-slate-900 transition-colors focus:border-indigo-500 ${error ? 'border-red-400' : 'border-slate-200'} ${className}`} />
      {error && <span className="text-xs text-red-500">{error}</span>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
export function Sel({ label, options, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label className="text-xs font-medium text-slate-600">{label}</label>}
      <select {...props} className={`w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white text-slate-900 focus:border-indigo-500 transition-colors ${className}`}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' }) {
  if (!open) return null;
  const w = { sm: 'max-w-sm', md: 'max-w-lg', lg: 'max-w-2xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div className={`bg-white rounded-xl border border-slate-200 w-full ${w} max-h-[90vh] flex flex-col shadow-2xl`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 text-xs">✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-slate-100 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
const BADGE: Record<string, string> = {
  new: 'bg-blue-50 text-blue-700', contacted: 'bg-green-50 text-green-700', qualified: 'bg-violet-50 text-violet-700',
  won: 'bg-emerald-100 text-emerald-700', lost: 'bg-red-50 text-red-600', proposal: 'bg-orange-50 text-orange-700',
  negotiation: 'bg-amber-50 text-amber-700', paid: 'bg-emerald-100 text-emerald-700', draft: 'bg-slate-100 text-slate-500',
  sent: 'bg-blue-50 text-blue-700', overdue: 'bg-red-50 text-red-600', partial: 'bg-amber-50 text-amber-700',
  active: 'bg-green-50 text-green-700', growth: 'bg-indigo-50 text-indigo-700', starter: 'bg-slate-100 text-slate-500', enterprise: 'bg-violet-50 text-violet-700',
};
export function Badge({ status, label }: { status: string; label?: string }) {
  return <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${BADGE[status?.toLowerCase()] || 'bg-slate-100 text-slate-600'}`}>{label || status}</span>;
}

// ── ScoreBar ──────────────────────────────────────────────────
export function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span className="text-slate-300 text-xs">—</span>;
  const c = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  return (
    <div>
      <div className="text-xs font-bold" style={{ color: c }}>{score}</div>
      <div className="w-10 h-1 bg-slate-100 rounded-full mt-0.5"><div className="h-full rounded-full" style={{ width: `${score}%`, background: c }} /></div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
export function KpiCard({ label, value, change, up, color = '#6366f1' }: { label: string; value: string; change?: string; up?: boolean; color?: string }) {
  const bars = [30,45,35,60,48,72,55,80,65,88,72,95];
  const max  = Math.max(...bars);
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="text-xs font-medium text-slate-500 mb-1">{label}</div>
      <div className="text-2xl font-bold text-slate-900 leading-none mb-1">{value}</div>
      {change && <div className={`text-xs flex items-center gap-1 mb-2 ${up ? 'text-emerald-500' : 'text-red-500'}`}><span>{up ? '↑' : '↓'}</span>{change}</div>}
      <div className="flex gap-px items-end h-6 mt-2">
        {bars.map((h, i) => (
          <div key={i} className="flex-1 rounded-sm" style={{ height: `${(h/max)*100}%`, background: color, opacity: i === bars.length-1 ? 1 : 0.3 }} />
        ))}
      </div>
    </div>
  );
}

// ── Toast ─────────────────────────────────────────────────────
export function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'ok' | 'err' }[]>([]);
  const n = useRef(0);
  const toast = (msg: string, type: 'ok' | 'err' = 'ok') => {
    const id = ++n.current;
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  };
  const ToastContainer = () => (
    <div className="fixed bottom-4 right-4 flex flex-col gap-2 z-50">
      {toasts.map(t => (
        <div key={t.id} className={`flex items-center gap-2 px-4 py-3 rounded-lg text-white text-xs font-medium shadow-lg min-w-48 ${t.type === 'ok' ? 'bg-emerald-600' : 'bg-red-600'}`}>
          {t.type === 'ok' ? '✓' : '✕'} {t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastContainer };
}

// ── Empty State ───────────────────────────────────────────────
export function Empty({ icon, title, desc, action }: { icon?: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      {icon && <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-2xl">{icon}</div>}
      <div className="text-center">
        <div className="text-sm font-semibold text-slate-700">{title}</div>
        {desc && <div className="text-xs text-slate-400 mt-1">{desc}</div>}
      </div>
      {action}
    </div>
  );
}
