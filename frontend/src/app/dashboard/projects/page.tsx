'use client';
import { useState, useEffect, useCallback } from 'react';
import { Topbar, Card, Btn, Input, Modal, Badge, useToast, Empty, RichTextEditor } from '@/components/ui';
import { projectApi, companyApi } from '@/lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Project {
  projectId: string;
  companyId: string;
  name: string;
  description?: string;
  clientName?: string;
  status: string;
  priority: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  currency: string;
  tags: string[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
  isAssigned?: boolean;
  assignedRole?: string;
  ownerCompany?: { companyId: string; name: string };
  company?: { companyId: string; name: string };
  _count?: { assignments: number; documents: number };
  documents?: any[];
  credentials?: any[];
  history?: any[];
  assignments?: any[];
  isOwner?: boolean;
}

const STATUS_TABS = ['ALL', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED'];

const PRIORITY_COLORS: Record<string, React.CSSProperties> = {
  LOW:      { background: '#f0f5fa', color: '#64748b' },
  MEDIUM:   { background: '#fffbeb', color: '#b45309' },
  HIGH:     { background: '#fff7ed', color: '#c2410c' },
  CRITICAL: { background: '#fef2f2', color: '#dc2626' },
};

const STATUS_BADGE_MAP: Record<string, string> = {
  ACTIVE:    'active',
  ON_HOLD:   'partial',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
};

function fmt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDt(d?: string) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtBytes(n?: number | null) {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { toast, ToastContainer } = useToast();

  // User / company context
  const [companies, setCompanies] = useState<any[]>([]);
  const [companyId, setCompanyId] = useState('');
  const [userId, setUserId] = useState('');

  // List state
  const [owned, setOwned] = useState<Project[]>([]);
  const [assigned, setAssigned] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  // Selected project detail
  const [selected, setSelected] = useState<Project | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'credentials' | 'history' | 'assigned'>('overview');

  // Create project modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', clientName: '', status: 'ACTIVE', priority: 'MEDIUM',
    startDate: '', endDate: '', budget: '', notes: '',
  });

  // Overview edit
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  // Document form
  const [showAddDoc, setShowAddDoc] = useState(false);
  const [docForm, setDocForm] = useState({ name: '', fileUrl: '', mimeType: '', notes: '' });
  const [addingDoc, setAddingDoc] = useState(false);

  // Credential form
  const [showAddCred, setShowAddCred] = useState(false);
  const [credForm, setCredForm] = useState({ label: '', username: '', password: '', url: '', notes: '' });
  const [addingCred, setAddingCred] = useState(false);
  const [editingCred, setEditingCred] = useState<any>(null);
  const [editCredForm, setEditCredForm] = useState({ label: '', username: '', password: '', url: '', notes: '' });
  const [savingCred, setSavingCred] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, string>>({});

  // History note modal
  const [showAddNote, setShowAddNote] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [addingNote, setAddingNote] = useState(false);

  // Assign company form
  const [assignCompanyId, setAssignCompanyId] = useState('');
  const [assignRole, setAssignRole] = useState('MEMBER');
  const [assigning, setAssigning] = useState(false);

  // Load companies + user from localStorage
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUserId(u?.userId || '');
    } catch {}
    companyApi.mine()
      .then((d: any) => {
        const cos = d.companies || [];
        setCompanies(cos);
        if (cos.length > 0) setCompanyId(cos[0].companyId);
      })
      .catch(() => {});
  }, []);

  // Load project list
  const loadProjects = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const params: any = {};
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;
      const data = await projectApi.list(companyId, params);
      setOwned(data.owned || []);
      setAssigned(data.assigned || []);
    } catch (e: any) {
      toast(e.message || 'Failed to load projects', 'err');
    } finally {
      setLoading(false);
    }
  }, [companyId, statusFilter, search]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Load project detail
  const loadDetail = useCallback(async (projectId: string) => {
    if (!companyId) return;
    setDetailLoading(true);
    try {
      const data = await projectApi.get(companyId, projectId);
      setSelected(data);
      setEditForm({
        name: data.name || '',
        description: data.description || '',
        clientName: data.clientName || '',
        status: data.status || 'ACTIVE',
        priority: data.priority || 'MEDIUM',
        startDate: data.startDate ? data.startDate.slice(0, 10) : '',
        endDate: data.endDate ? data.endDate.slice(0, 10) : '',
        budget: data.budget != null ? String(data.budget) : '',
        currency: data.currency || 'INR',
        notes: data.notes || '',
        tags: (data.tags || []).join(', '),
      });
      setRevealedPasswords({});
    } catch (e: any) {
      toast(e.message || 'Failed to load project', 'err');
    } finally {
      setDetailLoading(false);
    }
  }, [companyId]);

  // Create project
  const handleCreate = async () => {
    if (!createForm.name.trim()) { toast('Project name is required', 'err'); return; }
    setCreating(true);
    try {
      const body: any = {
        name: createForm.name,
        description: createForm.description || undefined,
        clientName: createForm.clientName || undefined,
        status: createForm.status,
        priority: createForm.priority,
        startDate: createForm.startDate || undefined,
        endDate: createForm.endDate || undefined,
        budget: createForm.budget ? parseFloat(createForm.budget) : undefined,
        notes: createForm.notes || undefined,
      };
      await projectApi.create(companyId, body);
      toast('Project created', 'ok');
      setShowCreate(false);
      setCreateForm({ name: '', description: '', clientName: '', status: 'ACTIVE', priority: 'MEDIUM', startDate: '', endDate: '', budget: '', notes: '' });
      loadProjects();
    } catch (e: any) {
      toast(e.message || 'Failed to create project', 'err');
    } finally {
      setCreating(false);
    }
  };

  // Update project
  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const body: any = {
        name: editForm.name,
        description: editForm.description || null,
        clientName: editForm.clientName || null,
        status: editForm.status,
        priority: editForm.priority,
        startDate: editForm.startDate || null,
        endDate: editForm.endDate || null,
        budget: editForm.budget ? parseFloat(editForm.budget) : null,
        currency: editForm.currency,
        notes: editForm.notes || null,
        tags: editForm.tags ? editForm.tags.split(',').map((t: string) => t.trim()).filter(Boolean) : [],
      };
      await projectApi.update(companyId, selected.projectId, body);
      toast('Project saved', 'ok');
      loadDetail(selected.projectId);
      loadProjects();
    } catch (e: any) {
      toast(e.message || 'Failed to save', 'err');
    } finally {
      setSaving(false);
    }
  };

  // Delete project
  const handleDelete = async () => {
    if (!selected || !selected.isOwner) return;
    if (!confirm('Delete this project? This cannot be undone.')) return;
    try {
      await projectApi.remove(companyId, selected.projectId);
      toast('Project deleted', 'ok');
      setSelected(null);
      loadProjects();
    } catch (e: any) {
      toast(e.message || 'Failed to delete', 'err');
    }
  };

  // Add document
  const handleAddDoc = async () => {
    if (!selected || !docForm.name.trim()) { toast('Document name is required', 'err'); return; }
    setAddingDoc(true);
    try {
      await projectApi.addDocument(companyId, selected.projectId, {
        name: docForm.name,
        fileUrl: docForm.fileUrl || undefined,
        mimeType: docForm.mimeType || undefined,
        notes: docForm.notes || undefined,
      });
      toast('Document added', 'ok');
      setShowAddDoc(false);
      setDocForm({ name: '', fileUrl: '', mimeType: '', notes: '' });
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to add document', 'err');
    } finally {
      setAddingDoc(false);
    }
  };

  // Remove document
  const handleRemoveDoc = async (docId: string) => {
    if (!selected || !confirm('Remove this document?')) return;
    try {
      await projectApi.removeDocument(companyId, selected.projectId, docId);
      toast('Document removed', 'ok');
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to remove document', 'err');
    }
  };

  // Add credential
  const handleAddCred = async () => {
    if (!selected || !credForm.label.trim()) { toast('Label is required', 'err'); return; }
    setAddingCred(true);
    try {
      await projectApi.addCredential(companyId, selected.projectId, {
        label: credForm.label,
        username: credForm.username || undefined,
        password: credForm.password || undefined,
        url: credForm.url || undefined,
        notes: credForm.notes || undefined,
      });
      toast('Credential added', 'ok');
      setShowAddCred(false);
      setCredForm({ label: '', username: '', password: '', url: '', notes: '' });
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to add credential', 'err');
    } finally {
      setAddingCred(false);
    }
  };

  // Save credential edit
  const handleSaveCred = async () => {
    if (!selected || !editingCred) return;
    setSavingCred(true);
    try {
      await projectApi.updateCredential(companyId, selected.projectId, editingCred.credId, {
        label: editCredForm.label,
        username: editCredForm.username || undefined,
        password: editCredForm.password || undefined,
        url: editCredForm.url || undefined,
        notes: editCredForm.notes || undefined,
      });
      toast('Credential updated', 'ok');
      setEditingCred(null);
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to update', 'err');
    } finally {
      setSavingCred(false);
    }
  };

  // Remove credential
  const handleRemoveCred = async (credId: string) => {
    if (!selected || !confirm('Remove this credential?')) return;
    try {
      await projectApi.removeCredential(companyId, selected.projectId, credId);
      toast('Credential removed', 'ok');
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to remove', 'err');
    }
  };

  // Reveal credential password
  const handleReveal = async (credId: string) => {
    if (!selected) return;
    try {
      const data = await projectApi.revealCredential(companyId, selected.projectId, credId);
      setRevealedPasswords(prev => ({ ...prev, [credId]: data.password || '' }));
    } catch (e: any) {
      toast(e.message || 'Failed to reveal', 'err');
    }
  };

  // Add history note
  const handleAddNote = async () => {
    if (!selected || !noteText.trim()) { toast('Note text is required', 'err'); return; }
    setAddingNote(true);
    try {
      await projectApi.addHistory(companyId, selected.projectId, {
        action: 'NOTE',
        description: noteText,
      });
      toast('Note added', 'ok');
      setShowAddNote(false);
      setNoteText('');
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to add note', 'err');
    } finally {
      setAddingNote(false);
    }
  };

  // Assign company
  const handleAssignCompany = async () => {
    if (!selected || !assignCompanyId.trim()) { toast('Company ID is required', 'err'); return; }
    setAssigning(true);
    try {
      await projectApi.assignCompany(companyId, selected.projectId, {
        assignedCompanyId: assignCompanyId.trim(),
        role: assignRole,
      });
      toast('Company assigned', 'ok');
      setAssignCompanyId('');
      setAssignRole('MEMBER');
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || e || 'Failed to assign', 'err');
    } finally {
      setAssigning(false);
    }
  };

  // Remove assignment
  const handleRemoveAssignment = async (assignedCid: string) => {
    if (!selected || !confirm('Remove this company from the project?')) return;
    try {
      await projectApi.removeAssignment(companyId, selected.projectId, assignedCid);
      toast('Assignment removed', 'ok');
      loadDetail(selected.projectId);
    } catch (e: any) {
      toast(e.message || 'Failed to remove', 'err');
    }
  };

  const allProjects = [
    ...owned,
    ...assigned.filter(a => !owned.find(o => o.projectId === a.projectId)),
  ];

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <Topbar
        title="Projects"
        subtitle={`${owned.length} owned · ${assigned.length} assigned`}
        actions={
          <>
            {companies.length > 1 && (
              <select
                value={companyId}
                onChange={e => { setCompanyId(e.target.value); setSelected(null); }}
                style={{ padding: '5px 10px', fontSize: 12, borderRadius: 8, border: '1px solid #d4e1ec', background: '#fff', color: '#192b3f', fontFamily: 'inherit' }}
              >
                {companies.map((c: any) => (
                  <option key={c.companyId} value={c.companyId}>{c.name}</option>
                ))}
              </select>
            )}
            <Btn variant="primary" size="sm" onClick={() => setShowCreate(true)}>
              + New Project
            </Btn>
          </>
        }
      />

      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Project List ─────────────────────────────── */}
        <div className="flex flex-col overflow-hidden" style={{ width: 380, borderRight: '1px solid #e2eaf2', background: '#f8fafc', flexShrink: 0 }}>
          {/* Search + Filters */}
          <div className="p-3 flex flex-col gap-2" style={{ borderBottom: '1px solid #e2eaf2' }}>
            <input
              placeholder="Search projects..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%', padding: '7px 12px', fontSize: 13, borderRadius: 8,
                border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit',
              }}
            />
            <div className="flex gap-1 flex-wrap">
              {STATUS_TABS.map(tab => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    background: statusFilter === tab ? '#3199d4' : '#ffffff',
                    color: statusFilter === tab ? '#ffffff' : '#7a9baf',
                    border: `1px solid ${statusFilter === tab ? '#3199d4' : '#d4e1ec'}`,
                    transition: 'all 0.15s',
                  }}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto p-2">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" style={{ color: '#3199d4' }}>
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/>
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
                </svg>
              </div>
            ) : allProjects.length === 0 ? (
              <Empty icon="📁" title="No projects" desc="Create your first project to get started" />
            ) : (
              allProjects.map(p => {
                const isSelected = selected?.projectId === p.projectId;
                return (
                  <div
                    key={p.projectId}
                    onClick={() => { setSelected(p); setActiveTab('overview'); loadDetail(p.projectId); }}
                    style={{
                      padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 4,
                      background: isSelected ? '#e8f5fd' : '#ffffff',
                      border: `1px solid ${isSelected ? '#3199d4' : '#e2eaf2'}`,
                      transition: 'all 0.12s',
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#192b3f', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </span>
                      <div className="flex gap-1 flex-shrink-0">
                        <Badge status={STATUS_BADGE_MAP[p.status] || p.status.toLowerCase()} label={p.status.replace('_', ' ')} />
                        {p.isAssigned && (
                          <span style={{ padding: '2px 8px', borderRadius: 9999, fontSize: 10, fontWeight: 700, background: '#f5f3ff', color: '#7c3aed' }}>
                            ASSIGNED
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <span style={{ ...PRIORITY_COLORS[p.priority] || {}, padding: '1px 6px', borderRadius: 9999, fontSize: 10, fontWeight: 600 }}>
                        {p.priority}
                      </span>
                      {p.clientName && (
                        <span style={{ fontSize: 11.5, color: '#7a9baf' }}>{p.clientName}</span>
                      )}
                      {p.isAssigned && p.ownerCompany && (
                        <span style={{ fontSize: 11, color: '#7a9baf' }}>Owner: {p.ownerCompany.name}</span>
                      )}
                    </div>
                    {(p.startDate || p.endDate) && (
                      <div style={{ fontSize: 11, color: '#9ab0bf', marginTop: 4 }}>
                        {p.startDate ? fmt(p.startDate) : '—'} → {p.endDate ? fmt(p.endDate) : 'Ongoing'}
                      </div>
                    )}
                    {p._count && (
                      <div style={{ fontSize: 11, color: '#9ab0bf', marginTop: 2 }}>
                        {p._count.assignments} companies · {p._count.documents} docs
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel: Detail ──────────────────────────────────── */}
        {!selected ? (
          <div className="flex-1 flex items-center justify-center">
            <Empty icon="📂" title="Select a project" desc="Click a project to view details" />
          </div>
        ) : detailLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <svg className="animate-spin w-6 h-6" viewBox="0 0 24 24" fill="none" style={{ color: '#3199d4' }}>
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity=".25"/>
              <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round"/>
            </svg>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #e2eaf2', background: '#ffffff' }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#192b3f' }}>{selected.name}</div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge status={STATUS_BADGE_MAP[selected.status] || selected.status.toLowerCase()} label={selected.status.replace('_', ' ')} />
                  <span style={{ ...PRIORITY_COLORS[selected.priority], padding: '1px 6px', borderRadius: 9999, fontSize: 10, fontWeight: 600 }}>
                    {selected.priority}
                  </span>
                  {!selected.isOwner && (
                    <span style={{ fontSize: 11, color: '#7c3aed', fontWeight: 600 }}>
                      Assigned ({selected.assignedRole || 'MEMBER'}) — Owner: {selected.company?.name}
                    </span>
                  )}
                </div>
              </div>
              {selected.isOwner && (
                <Btn variant="danger" size="sm" onClick={handleDelete}>Delete</Btn>
              )}
            </div>

            {/* Tabs */}
            <div className="flex gap-0 px-5" style={{ borderBottom: '1px solid #e2eaf2', background: '#ffffff' }}>
              {(['overview', 'documents', 'credentials', 'history', ...(selected.isOwner ? ['assigned'] : [])] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab as any)}
                  style={{
                    padding: '10px 16px', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', background: 'transparent',
                    color: activeTab === tab ? '#3199d4' : '#7a9baf',
                    borderBottom: activeTab === tab ? '2px solid #3199d4' : '2px solid transparent',
                    border: 'none', borderBottomWidth: 2, fontFamily: 'inherit',
                    transition: 'color 0.12s',
                    textTransform: 'capitalize',
                  }}
                >
                  {tab === 'assigned' ? 'Assigned Companies' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-5">

              {/* ── Overview Tab ────────────────────────────────── */}
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-4" style={{ maxWidth: 640 }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Input label="Project Name" value={editForm.name} onChange={e => setEditForm((f: any) => ({ ...f, name: e.target.value }))} disabled={!selected.isOwner} />
                    </div>
                    <div className="col-span-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Description</label>
                      <textarea
                        value={editForm.description}
                        onChange={e => setEditForm((f: any) => ({ ...f, description: e.target.value }))}
                        disabled={!selected.isOwner}
                        rows={3}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>
                    <Input label="Client Name" value={editForm.clientName} onChange={e => setEditForm((f: any) => ({ ...f, clientName: e.target.value }))} disabled={!selected.isOwner} />
                    <div className="flex flex-col gap-1">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Status</label>
                      <select value={editForm.status} onChange={e => setEditForm((f: any) => ({ ...f, status: e.target.value }))} disabled={!selected.isOwner}
                        style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}>
                        <option value="ACTIVE">Active</option>
                        <option value="ON_HOLD">On Hold</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Priority</label>
                      <select value={editForm.priority} onChange={e => setEditForm((f: any) => ({ ...f, priority: e.target.value }))} disabled={!selected.isOwner}
                        style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}>
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Currency</label>
                      <select value={editForm.currency} onChange={e => setEditForm((f: any) => ({ ...f, currency: e.target.value }))} disabled={!selected.isOwner}
                        style={{ padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}>
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                      </select>
                    </div>
                    <Input label="Budget" type="number" value={editForm.budget} onChange={e => setEditForm((f: any) => ({ ...f, budget: e.target.value }))} disabled={!selected.isOwner} />
                    <Input label="Start Date" type="date" value={editForm.startDate} onChange={e => setEditForm((f: any) => ({ ...f, startDate: e.target.value }))} disabled={!selected.isOwner} />
                    <Input label="End Date" type="date" value={editForm.endDate} onChange={e => setEditForm((f: any) => ({ ...f, endDate: e.target.value }))} disabled={!selected.isOwner} />
                    <div className="col-span-2">
                      <Input label="Tags (comma-separated)" value={editForm.tags} onChange={e => setEditForm((f: any) => ({ ...f, tags: e.target.value }))} disabled={!selected.isOwner} />
                    </div>
                    <div className="col-span-2">
                      <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Notes</label>
                      <textarea
                        value={editForm.notes}
                        onChange={e => setEditForm((f: any) => ({ ...f, notes: e.target.value }))}
                        disabled={!selected.isOwner}
                        rows={3}
                        style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                  <div style={{ fontSize: 12, color: '#9ab0bf' }}>
                    Owner: <strong>{selected.company?.name}</strong> · Created: {fmt(selected.createdAt)} · Updated: {fmt(selected.updatedAt)}
                  </div>
                  {selected.isOwner && (
                    <div className="flex gap-2">
                      <Btn variant="primary" size="sm" loading={saving} onClick={handleSave}>Save Changes</Btn>
                    </div>
                  )}
                </div>
              )}

              {/* ── Documents Tab ────────────────────────────────── */}
              {activeTab === 'documents' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#192b3f' }}>Documents ({selected.documents?.length || 0})</span>
                    <Btn variant="primary" size="sm" onClick={() => setShowAddDoc(true)}>+ Add Document</Btn>
                  </div>
                  {!selected.documents?.length ? (
                    <Empty icon="📄" title="No documents" desc="Add documents to this project" />
                  ) : (
                    selected.documents.map((doc: any) => (
                      <Card key={doc.docId} className="p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#192b3f' }}>{doc.name}</div>
                            {doc.fileUrl && (
                              <a href={doc.fileUrl} target="_blank" rel="noreferrer"
                                style={{ fontSize: 12, color: '#3199d4', wordBreak: 'break-all' }}>{doc.fileUrl}</a>
                            )}
                            <div className="flex gap-3 mt-1">
                              {doc.mimeType && <span style={{ fontSize: 11, color: '#9ab0bf' }}>{doc.mimeType}</span>}
                              {doc.fileSize && <span style={{ fontSize: 11, color: '#9ab0bf' }}>{fmtBytes(doc.fileSize)}</span>}
                              <span style={{ fontSize: 11, color: '#9ab0bf' }}>{fmt(doc.createdAt)}</span>
                            </div>
                            {doc.notes && <div style={{ fontSize: 12, color: '#7a9baf', marginTop: 4 }}>{doc.notes}</div>}
                          </div>
                          <Btn variant="danger" size="sm" onClick={() => handleRemoveDoc(doc.docId)}>Remove</Btn>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* ── Credentials Tab ──────────────────────────────── */}
              {activeTab === 'credentials' && (
                <div className="flex flex-col gap-3">
                  {/* Warning banner */}
                  <div style={{ background: '#fffbeb', border: '1px solid #f59e0b', borderRadius: 10, padding: '10px 14px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                      <strong>Security Notice:</strong> Store only non-critical credentials. Only owner company users can reveal passwords.
                    </span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#192b3f' }}>Credentials ({selected.credentials?.length || 0})</span>
                    {selected.isOwner && (
                      <Btn variant="primary" size="sm" onClick={() => setShowAddCred(true)}>+ Add Credential</Btn>
                    )}
                  </div>

                  {!selected.credentials?.length ? (
                    <Empty icon="🔑" title="No credentials" desc={selected.isOwner ? 'Click "+ Add Credential" to store a credential' : 'No credentials stored for this project'} />
                  ) : (
                    selected.credentials.map((cred: any) => (
                      <Card key={cred.credId} className="p-0">
                        {/* Card header */}
                        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid #f0f5fa' }}>
                          <div className="flex items-center gap-2">
                            <span style={{ width: 28, height: 28, borderRadius: 8, background: '#e8f5fd', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🔑</span>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#192b3f' }}>{cred.label}</span>
                          </div>
                          {selected.isOwner && (
                            <div className="flex gap-1">
                              <Btn variant="secondary" size="sm" onClick={() => {
                                setEditingCred(cred);
                                setEditCredForm({ label: cred.label, username: cred.username || '', password: '', url: cred.url || '', notes: cred.notes || '' });
                              }}>Edit</Btn>
                              <Btn variant="danger" size="sm" onClick={() => handleRemoveCred(cred.credId)}>Delete</Btn>
                            </div>
                          )}
                        </div>

                        {/* Detail rows */}
                        <div className="px-4 py-3 flex flex-col gap-2.5">
                          {/* Username */}
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf', width: 80, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Username</span>
                            {cred.username ? (
                              <div className="flex items-center gap-2 flex-1">
                                <code style={{ background: '#f0f5fa', padding: '3px 10px', borderRadius: 6, fontSize: 12.5, color: '#192b3f', flex: 1 }}>{cred.username}</code>
                                <button title="Copy" onClick={() => { navigator.clipboard.writeText(cred.username); toast('Copied!'); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a9baf', padding: 2 }}>
                                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
                                </button>
                              </div>
                            ) : <span style={{ fontSize: 12, color: '#c0d0dd', fontStyle: 'italic' }}>Not set</span>}
                          </div>

                          {/* Password */}
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf', width: 80, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Password</span>
                            <div className="flex items-center gap-2 flex-1">
                              <code style={{ background: '#f0f5fa', padding: '3px 10px', borderRadius: 6, fontSize: 12.5, color: '#192b3f', flex: 1, letterSpacing: revealedPasswords[cred.credId] !== undefined ? 'normal' : 2 }}>
                                {revealedPasswords[cred.credId] !== undefined ? (revealedPasswords[cred.credId] || '(empty)') : '••••••••'}
                              </code>
                              {selected.isOwner && (
                                revealedPasswords[cred.credId] !== undefined ? (
                                  <button title="Copy password" onClick={() => { navigator.clipboard.writeText(revealedPasswords[cred.credId]); toast('Password copied!'); }}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a9baf', padding: 2 }}>
                                    <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
                                  </button>
                                ) : (
                                  <button onClick={() => handleReveal(cred.credId)}
                                    style={{ fontSize: 11, fontWeight: 600, color: '#3199d4', cursor: 'pointer', background: '#e8f5fd', border: 'none', padding: '3px 8px', borderRadius: 6, fontFamily: 'inherit' }}>
                                    👁 Reveal
                                  </button>
                                )
                              )}
                            </div>
                          </div>

                          {/* URL */}
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf', width: 80, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em' }}>URL</span>
                            {cred.url ? (
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <a href={cred.url} target="_blank" rel="noreferrer"
                                  style={{ fontSize: 12.5, color: '#3199d4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                  {cred.url}
                                </a>
                                <button title="Copy URL" onClick={() => { navigator.clipboard.writeText(cred.url); toast('URL copied!'); }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7a9baf', padding: 2, flexShrink: 0 }}>
                                  <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 14, height: 14 }}><path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/><path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/></svg>
                                </button>
                              </div>
                            ) : <span style={{ fontSize: 12, color: '#c0d0dd', fontStyle: 'italic' }}>Not set</span>}
                          </div>

                          {/* Notes */}
                          {cred.notes && (
                            <div className="flex gap-2">
                              <span style={{ fontSize: 11, fontWeight: 600, color: '#7a9baf', width: 80, flexShrink: 0, textTransform: 'uppercase', letterSpacing: '0.04em', paddingTop: 2 }}>Notes</span>
                              <div style={{ fontSize: 12.5, color: '#4a6a85', lineHeight: 1.5, flex: 1 }}
                                dangerouslySetInnerHTML={{ __html: cred.notes }} />
                            </div>
                          )}

                          {/* Meta */}
                          <div style={{ fontSize: 11, color: '#c0d0dd', marginTop: 2 }}>
                            Added {fmt(cred.createdAt)}{cred.updatedAt !== cred.createdAt ? ` · Updated ${fmt(cred.updatedAt)}` : ''}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

              {/* ── History Tab ──────────────────────────────────── */}
              {activeTab === 'history' && (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#192b3f' }}>History ({selected.history?.length || 0})</span>
                    <Btn variant="secondary" size="sm" onClick={() => setShowAddNote(true)}>+ Add Note</Btn>
                  </div>
                  {!selected.history?.length ? (
                    <Empty icon="📋" title="No history" desc="Actions and notes will appear here" />
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <div style={{ position: 'absolute', left: 15, top: 0, bottom: 0, width: 2, background: '#e2eaf2', zIndex: 0 }} />
                      <div className="flex flex-col gap-2">
                        {selected.history.map((h: any) => (
                          <div key={h.histId} style={{ display: 'flex', gap: 12, position: 'relative', zIndex: 1 }}>
                            <div style={{
                              width: 30, height: 30, borderRadius: '50%', background: h.action === 'NOTE' ? '#f5f3ff' : '#e8f5fd',
                              color: h.action === 'NOTE' ? '#7c3aed' : '#1a72a3',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: 13, flexShrink: 0, border: '2px solid #e2eaf2',
                            }}>
                              {h.action === 'NOTE' ? '📝' : h.action === 'PROJECT_CREATED' ? '🚀' : h.action.includes('DOC') ? '📄' : h.action.includes('CRED') ? '🔑' : h.action.includes('ASSIGNED') ? '🏢' : '✏️'}
                            </div>
                            <div style={{ flex: 1, background: '#ffffff', border: '1px solid #e2eaf2', borderRadius: 10, padding: '8px 12px', marginBottom: 4 }}>
                              <div className="flex items-center justify-between">
                                <span style={{ fontSize: 12, fontWeight: 600, color: '#192b3f' }}>{h.action.replace(/_/g, ' ')}</span>
                                <span style={{ fontSize: 11, color: '#9ab0bf' }}>{fmtDt(h.createdAt)}</span>
                              </div>
                              <div style={{ fontSize: 12.5, color: '#4a6a85', marginTop: 2 }}>{h.description}</div>
                              {h.userName && <div style={{ fontSize: 11, color: '#9ab0bf', marginTop: 2 }}>by {h.userName}</div>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Assigned Companies Tab ───────────────────────── */}
              {activeTab === 'assigned' && selected.isOwner && (
                <div className="flex flex-col gap-3">
                  <span style={{ fontSize: 13, fontWeight: 600, color: '#192b3f' }}>
                    Assigned Companies ({selected.assignments?.length || 0})
                  </span>

                  {/* Assign form */}
                  <Card className="p-4">
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#192b3f', marginBottom: 10 }}>Assign a Company</div>
                    <div className="flex gap-2 flex-wrap">
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <Input
                          placeholder="Company ID"
                          value={assignCompanyId}
                          onChange={e => setAssignCompanyId(e.target.value)}
                        />
                      </div>
                      <div style={{ minWidth: 140 }}>
                        <select
                          value={assignRole}
                          onChange={e => setAssignRole(e.target.value)}
                          style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}
                        >
                          <option value="MEMBER">Member</option>
                          <option value="VIEWER">Viewer</option>
                          <option value="OWNER">Co-Owner</option>
                        </select>
                      </div>
                      <Btn variant="primary" loading={assigning} onClick={handleAssignCompany}>Assign</Btn>
                    </div>
                    <div style={{ fontSize: 11.5, color: '#9ab0bf', marginTop: 6 }}>
                      Enter the Company ID of the company you want to give project access to.
                    </div>
                  </Card>

                  {!selected.assignments?.length ? (
                    <Empty icon="🏢" title="No companies assigned" desc="Assign companies to share this project with them" />
                  ) : (
                    selected.assignments.map((a: any) => (
                      <Card key={a.id} className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: '#192b3f' }}>{a.company?.name || a.companyId}</div>
                            <div className="flex gap-2 mt-1">
                              <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 20, background: '#e8f5fd', color: '#1a72a3' }}>{a.role}</span>
                              <span style={{ fontSize: 11, color: '#9ab0bf' }}>Since {fmt(a.assignedAt)}</span>
                            </div>
                          </div>
                          <Btn variant="danger" size="sm" onClick={() => handleRemoveAssignment(a.companyId)}>Remove</Btn>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      {/* ── Create Project Modal ──────────────────────────────────── */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="New Project"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setShowCreate(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={creating} onClick={handleCreate}>Create Project</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Project Name *" placeholder="My awesome project" value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))} />
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Description</label>
            <textarea value={createForm.description} onChange={e => setCreateForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Brief project description..."
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
          <Input label="Client Name" placeholder="Client / company name" value={createForm.clientName}
            onChange={e => setCreateForm(f => ({ ...f, clientName: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Status</label>
              <select value={createForm.status} onChange={e => setCreateForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}>
                <option value="ACTIVE">Active</option>
                <option value="ON_HOLD">On Hold</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Priority</label>
              <select value={createForm.priority} onChange={e => setCreateForm(f => ({ ...f, priority: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit' }}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <Input label="Start Date" type="date" value={createForm.startDate}
              onChange={e => setCreateForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="End Date" type="date" value={createForm.endDate}
              onChange={e => setCreateForm(f => ({ ...f, endDate: e.target.value }))} />
          </div>
          <Input label="Budget" type="number" placeholder="0.00" value={createForm.budget}
            onChange={e => setCreateForm(f => ({ ...f, budget: e.target.value }))} />
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={createForm.notes} onChange={e => setCreateForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} placeholder="Additional notes..."
              style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* ── Add Document Modal ────────────────────────────────────── */}
      <Modal open={showAddDoc} onClose={() => setShowAddDoc(false)} title="Add Document"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setShowAddDoc(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={addingDoc} onClick={handleAddDoc}>Add Document</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Document Name *" placeholder="e.g. Contract.pdf" value={docForm.name}
            onChange={e => setDocForm(f => ({ ...f, name: e.target.value }))} />
          <Input label="File URL" placeholder="https://..." value={docForm.fileUrl}
            onChange={e => setDocForm(f => ({ ...f, fileUrl: e.target.value }))} />
          <Input label="MIME Type" placeholder="application/pdf" value={docForm.mimeType}
            onChange={e => setDocForm(f => ({ ...f, mimeType: e.target.value }))} />
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85', display: 'block', marginBottom: 4 }}>Notes</label>
            <textarea value={docForm.notes} onChange={e => setDocForm(f => ({ ...f, notes: e.target.value }))}
              rows={2} style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit', resize: 'vertical' }} />
          </div>
        </div>
      </Modal>

      {/* ── Add Credential Modal ──────────────────────────────────── */}
      <Modal open={showAddCred} onClose={() => setShowAddCred(false)} title="Add Credential"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setShowAddCred(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={addingCred} onClick={handleAddCred}>Add Credential</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Label *" placeholder="e.g. Production Server" value={credForm.label}
            onChange={e => setCredForm(f => ({ ...f, label: e.target.value }))} />
          <Input label="Username" placeholder="admin" value={credForm.username}
            onChange={e => setCredForm(f => ({ ...f, username: e.target.value }))} />
          <Input label="Password" type="password" placeholder="••••••••" value={credForm.password}
            onChange={e => setCredForm(f => ({ ...f, password: e.target.value }))} />
          <Input label="URL" placeholder="https://app.example.com" value={credForm.url}
            onChange={e => setCredForm(f => ({ ...f, url: e.target.value }))} />
          <RichTextEditor label="Notes" value={credForm.notes} onChange={html => setCredForm(f => ({ ...f, notes: html }))} minHeight={100} />
        </div>
      </Modal>

      {/* ── Edit Credential Modal ─────────────────────────────────── */}
      <Modal open={!!editingCred} onClose={() => setEditingCred(null)} title={`Edit — ${editingCred?.label || 'Credential'}`}
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setEditingCred(null)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={savingCred} onClick={handleSaveCred}>Save Changes</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Input label="Label *" value={editCredForm.label} placeholder="e.g. Production Server" onChange={e => setEditCredForm(f => ({ ...f, label: e.target.value }))} />
          <Input label="Username / Email" value={editCredForm.username} placeholder="admin@example.com" onChange={e => setEditCredForm(f => ({ ...f, username: e.target.value }))} />
          <div>
            <Input label="New Password" type="password" value={editCredForm.password} placeholder="Leave blank to keep existing password" onChange={e => setEditCredForm(f => ({ ...f, password: e.target.value }))} />
            <p style={{ fontSize: 11, color: '#9ab0bf', marginTop: 3 }}>Leave blank to keep the existing password unchanged.</p>
          </div>
          <Input label="URL" value={editCredForm.url} placeholder="https://app.example.com" onChange={e => setEditCredForm(f => ({ ...f, url: e.target.value }))} />
          <RichTextEditor label="Notes" value={editCredForm.notes} onChange={html => setEditCredForm(f => ({ ...f, notes: html }))} minHeight={120} />
        </div>
      </Modal>

      {/* ── Add Note Modal ────────────────────────────────────────── */}
      <Modal open={showAddNote} onClose={() => setShowAddNote(false)} title="Add Note"
        footer={
          <>
            <Btn variant="secondary" size="sm" onClick={() => setShowAddNote(false)}>Cancel</Btn>
            <Btn variant="primary" size="sm" loading={addingNote} onClick={handleAddNote}>Add Note</Btn>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <label style={{ fontSize: 12, fontWeight: 600, color: '#4a6a85' }}>Note</label>
          <textarea
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            rows={4}
            placeholder="Write your note here..."
            style={{ width: '100%', padding: '8px 12px', fontSize: 13, borderRadius: 8, border: '1px solid #d4e1ec', background: '#ffffff', color: '#192b3f', fontFamily: 'inherit', resize: 'vertical' }}
          />
        </div>
      </Modal>

      <ToastContainer />
    </div>
  );
}
