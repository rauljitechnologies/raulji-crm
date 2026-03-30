'use client';
import { useState, useRef, useEffect } from 'react';

// ── Topbar ────────────────────────────────────────────────────
export function Topbar({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <header className="flex-shrink-0 pl-14 pr-3 md:px-6 flex items-center justify-between topbar-mobile"
      style={{ background: '#ffffff', borderBottom: '1px solid #e2eaf2', height: 56, minHeight: 56 }}>
      <div className="min-w-0 flex-1 mr-2">
        <h1 className="truncate" style={{ fontSize: 15, fontWeight: 700, color: '#192b3f', lineHeight: 1.2 }}>{title}</h1>
        {subtitle && <p className="truncate" style={{ fontSize: 11.5, color: '#7a9baf', marginTop: 2 }}>{subtitle}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">{actions}</div>
    </header>
  );
}

// ── Card ──────────────────────────────────────────────────────
export function Card({ children, className = '', style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const hasCustomPadding = /\bp-\d/.test(className);
  return (
    <div className={`rounded-xl ${hasCustomPadding ? '' : 'p-4'} ${className}`}
      style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)', ...style }}>
      {children}
    </div>
  );
}

// ── Button ────────────────────────────────────────────────────
type BtnVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface BtnProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean;
}
export function Btn({ variant = 'secondary', size = 'md', loading, children, className = '', style, ...props }: BtnProps) {
  const styles: Record<BtnVariant, React.CSSProperties> = {
    primary:   { background: '#3199d4', color: '#ffffff', border: '1px solid #3199d4' },
    secondary: { background: '#ffffff', color: '#192b3f', border: '1px solid #d4e1ec' },
    danger:    { background: '#ef4444', color: '#ffffff', border: '1px solid #ef4444' },
    ghost:     { background: 'transparent', color: '#64748b', border: '1px solid transparent' },
  };
  const sz = size === 'sm'
    ? { padding: '5px 12px', fontSize: 12 }
    : { padding: '7px 14px', fontSize: 12.5 };
  return (
    <button
      {...props}
      disabled={loading || props.disabled}
      className={`inline-flex items-center gap-1.5 font-semibold rounded-lg transition-all disabled:opacity-50 cursor-pointer hover:opacity-90 ${className}`}
      style={{ ...styles[variant], ...sz, ...style, fontFamily: 'inherit' }}>
      {loading && (
        <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".3"/>
          <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
        </svg>
      )}
      {children}
    </button>
  );
}

// ── Input ─────────────────────────────────────────────────────
export function Input({ label, error, className = '', style, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label?: string; error?: string }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>{label}</label>}
      <input
        {...props}
        className={`w-full rounded-lg transition-all ${className}`}
        style={{
          padding: '8px 12px',
          fontSize: 13,
          border: `1px solid ${error ? '#ef4444' : '#d4e1ec'}`,
          background: '#ffffff',
          color: '#192b3f',
          fontFamily: 'inherit',
          ...(style as any),
        }}
        onFocus={e => { e.target.style.borderColor = '#3199d4'; e.target.style.boxShadow = '0 0 0 3px rgba(49,153,212,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : '#d4e1ec'; e.target.style.boxShadow = 'none'; }}
      />
      {error && <span style={{ fontSize: 11, color: '#ef4444' }}>{error}</span>}
    </div>
  );
}

// ── Select ────────────────────────────────────────────────────
export function Sel({ label, options, className = '', ...props }: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string; options: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-col gap-1">
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>{label}</label>}
      <select
        {...props}
        className={`w-full rounded-lg transition-all ${className}`}
        style={{ padding: '8px 12px', fontSize: 13, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode; footer?: React.ReactNode; size?: 'sm' | 'md' | 'lg' | 'xl' }) {
  if (!open) return null;
  const w = { sm: 440, md: 560, lg: 720, xl: 1040 }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(25,43,63,0.45)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div className="rounded-2xl w-full max-h-[90vh] flex flex-col overflow-hidden" style={{ maxWidth: w, background: '#ffffff', boxShadow: '0 20px 60px -10px rgba(25,43,63,0.25)', border: '1px solid #e2eaf2' }} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid #f0f5fa' }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 700, color: '#192b3f' }}>{title}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:bg-slate-100"
            style={{ color: '#7a9baf', fontSize: 14 }}>✕</button>
        </div>
        <div className="flex-1 overflow-y-auto p-5">{children}</div>
        {footer && <div className="px-5 py-3 flex justify-end gap-2" style={{ borderTop: '1px solid #f0f5fa' }}>{footer}</div>}
      </div>
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────
const BADGE_STYLES: Record<string, React.CSSProperties> = {
  new:          { background: '#e8f5fd', color: '#1a72a3' },
  contacted:    { background: '#ecfdf5', color: '#059669' },
  qualified:    { background: '#f5f3ff', color: '#7c3aed' },
  won:          { background: '#d1fae5', color: '#047857' },
  lost:         { background: '#fef2f2', color: '#dc2626' },
  proposal:     { background: '#fff7ed', color: '#c2410c' },
  proposal_sent:{ background: '#fff7ed', color: '#c2410c' },
  negotiation:  { background: '#fffbeb', color: '#b45309' },
  paid:         { background: '#d1fae5', color: '#047857' },
  draft:        { background: '#f0f5fa', color: '#64748b' },
  sent:         { background: '#e8f5fd', color: '#1a72a3' },
  overdue:      { background: '#fef2f2', color: '#dc2626' },
  partial:      { background: '#fffbeb', color: '#b45309' },
  active:       { background: '#ecfdf5', color: '#059669' },
  growth:       { background: '#e8f5fd', color: '#1a72a3' },
  starter:      { background: '#f0f5fa', color: '#64748b' },
  enterprise:   { background: '#f5f3ff', color: '#7c3aed' },
  cancelled:    { background: '#fef2f2', color: '#dc2626' },
  completed:    { background: '#d1fae5', color: '#047857' },
  running:      { background: '#e8f5fd', color: '#1a72a3' },
};
export function Badge({ status, label }: { status: string; label?: string }) {
  const s = BADGE_STYLES[status?.toLowerCase()] || { background: '#f0f5fa', color: '#64748b' };
  return (
    <span style={{ ...s, display: 'inline-flex', padding: '2px 8px', borderRadius: 9999, fontSize: 11, fontWeight: 600, letterSpacing: '0.01em' }}>
      {label || status}
    </span>
  );
}

// ── ScoreBar ──────────────────────────────────────────────────
export function ScoreBar({ score }: { score: number | null }) {
  if (score == null) return <span style={{ color: '#c0d0dd', fontSize: 12 }}>—</span>;
  const c = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 700, color: c, lineHeight: 1 }}>{score}</div>
      <div style={{ width: 36, height: 3, background: '#e2eaf2', borderRadius: 9999, marginTop: 3 }}>
        <div style={{ height: '100%', width: `${score}%`, background: c, borderRadius: 9999 }} />
      </div>
    </div>
  );
}

// ── KPI Card ──────────────────────────────────────────────────
export function KpiCard({ label, value, change, up, color = '#3199d4' }: { label: string; value: string; change?: string; up?: boolean; color?: string }) {
  const bars = [30, 45, 35, 60, 48, 72, 55, 80, 65, 88, 72, 95];
  const max  = Math.max(...bars);
  return (
    <div className="rounded-xl p-4 flex flex-col gap-1 transition-all"
      style={{ background: '#ffffff', border: '1px solid #e2eaf2', boxShadow: '0 1px 3px rgba(25,43,63,0.05)' }}>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: '#7a9baf', letterSpacing: '0.03em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#192b3f', lineHeight: 1.1, letterSpacing: '-0.02em' }}>{value}</div>
      {change && (
        <div style={{ fontSize: 11.5, color: up ? '#10b981' : '#ef4444', display: 'flex', alignItems: 'center', gap: 3 }}>
          <span>{up ? '▲' : '▼'}</span>
          <span>{change}</span>
        </div>
      )}
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: 24, marginTop: 4 }}>
        {bars.map((h, i) => (
          <div key={i} style={{ flex: 1, borderRadius: 2, height: `${(h / max) * 100}%`, background: color, opacity: i === bars.length - 1 ? 1 : 0.22 }} />
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
    <div style={{ position: 'fixed', bottom: 20, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 9999 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 10,
          background: t.type === 'ok' ? '#10b981' : '#ef4444',
          color: '#ffffff', fontSize: 12.5, fontWeight: 600,
          boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 200,
        }}>
          {t.type === 'ok' ? '✓' : '✕'} {t.msg}
        </div>
      ))}
    </div>
  );
  return { toast, ToastContainer };
}

// ── RichTextEditor ────────────────────────────────────────────
export function RichTextEditor({
  value, onChange, label, minHeight = 120,
}: {
  value: string;
  onChange: (html: string) => void;
  label?: string;
  minHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);
  const [fmts, setFmts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!focused && editorRef.current && editorRef.current.innerHTML !== (value || '')) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value, focused]);

  const exec = (cmd: string, val?: string) => {
    document.execCommand(cmd, false, val);
    editorRef.current?.focus();
    refresh();
    emit();
  };

  const refresh = () => {
    const s = new Set<string>();
    if (document.queryCommandState('bold')) s.add('bold');
    if (document.queryCommandState('italic')) s.add('italic');
    if (document.queryCommandState('underline')) s.add('underline');
    setFmts(s);
  };

  const emit = () => { if (editorRef.current) onChange(editorRef.current.innerHTML); };

  const tbBtn = (active: boolean): React.CSSProperties => ({
    padding: '3px 8px', border: `1px solid ${active ? '#3199d4' : '#d4e1ec'}`,
    borderRadius: 6, background: active ? '#e8f5fd' : '#ffffff',
    color: active ? '#1a72a3' : '#4a6a85', cursor: 'pointer',
    fontSize: 12, fontWeight: 600, lineHeight: 1, minWidth: 28,
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  });

  return (
    <div className="flex flex-col gap-1">
      {label && <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>{label}</label>}
      <div style={{ border: `1px solid ${focused ? '#3199d4' : '#d4e1ec'}`, borderRadius: 8, overflow: 'hidden', boxShadow: focused ? '0 0 0 3px rgba(49,153,212,0.12)' : 'none', transition: 'border-color 0.15s, box-shadow 0.15s' }}>
        {/* Toolbar */}
        <div style={{ display: 'flex', gap: 4, padding: '5px 8px', borderBottom: '1px solid #e2eaf2', background: '#f8fbfd', flexWrap: 'wrap', alignItems: 'center' }}>
          <button type="button" style={tbBtn(fmts.has('bold'))} onMouseDown={e => { e.preventDefault(); exec('bold'); }}><b>B</b></button>
          <button type="button" style={tbBtn(fmts.has('italic'))} onMouseDown={e => { e.preventDefault(); exec('italic'); }}><i>I</i></button>
          <button type="button" style={tbBtn(fmts.has('underline'))} onMouseDown={e => { e.preventDefault(); exec('underline'); }}><u>U</u></button>
          <div style={{ width: 1, height: 18, background: '#d4e1ec', margin: '0 2px' }} />
          <select
            value=""
            onChange={e => { if (e.target.value) { exec('fontSize', e.target.value); (e.target as HTMLSelectElement).value = ''; } }}
            onMouseDown={e => e.stopPropagation()}
            style={{ padding: '3px 6px', border: '1px solid #d4e1ec', borderRadius: 6, fontSize: 11.5, background: '#ffffff', color: '#4a6a85', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <option value="" disabled>Size</option>
            <option value="1">Small</option>
            <option value="3">Normal</option>
            <option value="5">Large</option>
            <option value="7">X-Large</option>
          </select>
          <div style={{ width: 1, height: 18, background: '#d4e1ec', margin: '0 2px' }} />
          <button type="button" style={tbBtn(false)} onMouseDown={e => { e.preventDefault(); exec('insertUnorderedList'); }}>• List</button>
          <button type="button" style={tbBtn(false)} onMouseDown={e => { e.preventDefault(); exec('insertOrderedList'); }}>1. List</button>
          <div style={{ width: 1, height: 18, background: '#d4e1ec', margin: '0 2px' }} />
          <button type="button" style={{ ...tbBtn(false), fontSize: 10 }} onMouseDown={e => { e.preventDefault(); exec('removeFormat'); }}>✕ Clear</button>
        </div>
        {/* Editable area */}
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => { setFocused(true); refresh(); }}
          onBlur={() => { setFocused(false); emit(); }}
          onInput={() => { refresh(); emit(); }}
          onKeyUp={refresh}
          onMouseUp={refresh}
          style={{ minHeight, padding: '10px 12px', fontSize: 13, color: '#192b3f', outline: 'none', lineHeight: 1.6, fontFamily: 'inherit' }}
        />
      </div>
    </div>
  );
}

// ── Empty State ───────────────────────────────────────────────
export function Empty({ icon, title, desc, action }: { icon?: string; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 24px', gap: 12 }}>
      {icon && (
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#e8f5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>
          {icon}
        </div>
      )}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#192b3f' }}>{title}</div>
        {desc && <div style={{ fontSize: 12.5, color: '#7a9baf', marginTop: 4 }}>{desc}</div>}
      </div>
      {action}
    </div>
  );
}
