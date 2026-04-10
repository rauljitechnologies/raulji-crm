// backend/controllers/projectController.js
const prisma = require('../lib/prisma');

// Helper: add a history entry
async function addHistoryEntry(projectId, { action, description, userId, userName, metadata }) {
  return prisma.projectHistory.create({
    data: { projectId, action, description, userId: userId || null, userName: userName || null, metadata: metadata || null },
  });
}

// Helper: check if company has access to project (owner OR assigned)
async function hasAccess(projectId, companyId) {
  const project = await prisma.project.findUnique({ where: { projectId }, select: { companyId: true } });
  if (!project) return { project: null, isOwner: false };
  if (project.companyId === companyId) return { project, isOwner: true };
  const assignment = await prisma.projectAssignment.findUnique({
    where: { projectId_company_id: { projectId, company_id: companyId } },
  });
  return { project, isOwner: false, hasAssignment: !!assignment };
}

// GET /companies/:companyId/projects
async function listProjects(req, res) {
  try {
    const { companyId } = req.params;
    const { status, search } = req.query;

    // Get owned projects
    const whereOwned = { companyId };
    if (status && status !== 'ALL') whereOwned.status = status;
    if (search) whereOwned.name = { contains: search, mode: 'insensitive' };

    const ownedProjects = await prisma.project.findMany({
      where: whereOwned,
      include: {
        _count: { select: { assignments: true, documents: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Get assigned projects (via ProjectAssignment)
    const assignments = await prisma.projectAssignment.findMany({
      where: { company_id: companyId },
      include: {
        project: {
          include: {
            _count: { select: { assignments: true, documents: true } },
            company: { select: { companyId: true, name: true } },
          },
        },
      },
    });

    const assignedProjects = assignments
      .map(a => ({ ...a.project, isAssigned: true, assignedRole: a.role, ownerCompany: a.project.company }))
      .filter(p => {
        if (status && status !== 'ALL' && p.status !== status) return false;
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      });

    const owned = ownedProjects.map(p => ({ ...p, isAssigned: false, assignedRole: null }));

    res.json({ success: true, data: { owned, assigned: assignedProjects } });
  } catch (err) {
    console.error('listProjects error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// POST /companies/:companyId/projects
async function createProject(req, res) {
  try {
    const { companyId } = req.params;
    const { name, description, clientName, status, priority, startDate, endDate, budget, currency, tags, notes } = req.body;

    if (!name) return res.status(400).json({ success: false, error: { message: 'name is required' } });

    const project = await prisma.project.create({
      data: {
        companyId,
        name,
        description: description || null,
        clientName: clientName || null,
        status: status || 'ACTIVE',
        priority: priority || 'MEDIUM',
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        budget: budget ? parseFloat(budget) : null,
        currency: currency || 'INR',
        tags: tags || [],
        notes: notes || null,
        createdBy: req.user?.userId || null,
      },
    });

    await addHistoryEntry(project.projectId, {
      action: 'PROJECT_CREATED',
      description: 'Project created',
      userId: req.user?.userId,
      userName: req.user?.name,
    });

    res.status(201).json({ success: true, data: project });
  } catch (err) {
    console.error('createProject error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// GET /companies/:companyId/projects/:projectId
async function getProject(req, res) {
  try {
    const { companyId, projectId } = req.params;

    const { project: projCheck, isOwner, hasAssignment } = await hasAccess(projectId, companyId);
    if (!projCheck) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (!isOwner && !hasAssignment) return res.status(403).json({ success: false, error: { message: 'Access denied' } });

    const project = await prisma.project.findUnique({
      where: { projectId },
      include: {
        company: { select: { companyId: true, name: true } },
        documents: { orderBy: { createdAt: 'desc' } },
        credentials: {
          select: {
            credId: true, projectId: true, label: true, username: true,
            url: true, notes: true, createdAt: true, updatedAt: true,
            // password intentionally omitted — use /reveal endpoint
          },
          orderBy: { createdAt: 'desc' },
        },
        history: { orderBy: { createdAt: 'desc' }, take: 100 },
        assignments: {
          include: { company: { select: { companyId: true, name: true } } },
          orderBy: { assignedAt: 'desc' },
        },
      },
    });

    // Mask password in credentials
    const maskedCredentials = (project.credentials || []).map(c => ({ ...c, password: '••••••••' }));

    res.json({ success: true, data: { ...project, credentials: maskedCredentials, isOwner } });
  } catch (err) {
    console.error('getProject error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// PUT /companies/:companyId/projects/:projectId
async function updateProject(req, res) {
  try {
    const { companyId, projectId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can update this project' } });

    const allowedFields = ['name', 'description', 'clientName', 'status', 'priority', 'startDate', 'endDate', 'budget', 'currency', 'tags', 'notes'];
    const updateData = {};
    const changedFields = [];

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        let newVal = req.body[field];
        if (field === 'startDate' || field === 'endDate') newVal = newVal ? new Date(newVal) : null;
        if (field === 'budget') newVal = newVal !== null && newVal !== '' ? parseFloat(newVal) : null;
        updateData[field] = newVal;
        const oldVal = existing[field];
        if (String(oldVal) !== String(newVal)) changedFields.push(field);
      }
    }

    const updated = await prisma.project.update({ where: { projectId }, data: updateData });

    if (changedFields.length > 0) {
      await addHistoryEntry(projectId, {
        action: 'PROJECT_UPDATED',
        description: `Updated fields: ${changedFields.join(', ')}`,
        userId: req.user?.userId,
        userName: req.user?.name,
        metadata: { changedFields },
      });
    }

    res.json({ success: true, data: updated });
  } catch (err) {
    console.error('updateProject error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// DELETE /companies/:companyId/projects/:projectId
async function deleteProject(req, res) {
  try {
    const { companyId, projectId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can delete this project' } });

    await prisma.project.delete({ where: { projectId } });

    res.json({ success: true, data: { message: 'Project deleted' } });
  } catch (err) {
    console.error('deleteProject error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// POST /companies/:companyId/projects/:projectId/assign
async function assignCompany(req, res) {
  try {
    const { companyId, projectId } = req.params;
    const { assignedCompanyId, role } = req.body;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can manage assignments' } });

    if (!assignedCompanyId) return res.status(400).json({ success: false, error: { message: 'assignedCompanyId is required' } });
    if (assignedCompanyId === companyId) return res.status(400).json({ success: false, error: { message: 'Cannot assign to the owner company itself' } });

    // Check target company exists
    const targetCompany = await prisma.company.findUnique({ where: { companyId: assignedCompanyId }, select: { companyId: true, name: true } });
    if (!targetCompany) return res.status(404).json({ success: false, error: { message: 'Target company not found' } });

    // Check duplicate
    const dupCheck = await prisma.projectAssignment.findUnique({
      where: { projectId_company_id: { projectId, company_id: assignedCompanyId } },
    });
    if (dupCheck) return res.status(409).json({ success: false, error: { message: 'This company is already assigned to the project' } });

    const assignment = await prisma.projectAssignment.create({
      data: { projectId, company_id: assignedCompanyId, role: role || 'MEMBER' },
    });

    await addHistoryEntry(projectId, {
      action: 'COMPANY_ASSIGNED',
      description: `Company "${targetCompany.name}" assigned as ${role || 'MEMBER'}`,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: { assignedCompanyId, role: role || 'MEMBER' },
    });

    res.status(201).json({ success: true, data: { ...assignment, company: targetCompany } });
  } catch (err) {
    console.error('assignCompany error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// DELETE /companies/:companyId/projects/:projectId/assign/:assignedCompanyId
async function removeAssignment(req, res) {
  try {
    const { companyId, projectId, assignedCompanyId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can manage assignments' } });

    const assignment = await prisma.projectAssignment.findUnique({
      where: { projectId_company_id: { projectId, company_id: assignedCompanyId } },
      include: { companies: { select: { name: true } } },
    });
    if (!assignment) return res.status(404).json({ success: false, error: { message: 'Assignment not found' } });

    await prisma.projectAssignment.delete({
      where: { projectId_company_id: { projectId, company_id: assignedCompanyId } },
    });

    await addHistoryEntry(projectId, {
      action: 'COMPANY_UNASSIGNED',
      description: `Company "${assignment.companies?.name || assignedCompanyId}" removed from project`,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: { removedCompanyId: assignedCompanyId },
    });

    res.json({ success: true, data: { message: 'Assignment removed' } });
  } catch (err) {
    console.error('removeAssignment error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// POST /companies/:companyId/projects/:projectId/documents
async function addDocument(req, res) {
  try {
    const { companyId, projectId } = req.params;

    const { project: projCheck, isOwner, hasAssignment } = await hasAccess(projectId, companyId);
    if (!projCheck) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (!isOwner && !hasAssignment) return res.status(403).json({ success: false, error: { message: 'Access denied' } });

    const { name, fileUrl, fileSize, mimeType, notes } = req.body;
    if (!name) return res.status(400).json({ success: false, error: { message: 'name is required' } });

    const doc = await prisma.projectDocument.create({
      data: {
        projectId,
        name,
        fileUrl: fileUrl || null,
        fileSize: fileSize ? parseInt(fileSize) : null,
        mimeType: mimeType || null,
        notes: notes || null,
        uploadedBy: req.user?.userId || null,
      },
    });

    await addHistoryEntry(projectId, {
      action: 'DOCUMENT_ADDED',
      description: `Document added: ${name}`,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: { docId: doc.docId, name },
    });

    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    console.error('addDocument error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// DELETE /companies/:companyId/projects/:projectId/documents/:docId
async function removeDocument(req, res) {
  try {
    const { companyId, projectId, docId } = req.params;

    const { project: projCheck, isOwner, hasAssignment } = await hasAccess(projectId, companyId);
    if (!projCheck) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (!isOwner && !hasAssignment) return res.status(403).json({ success: false, error: { message: 'Access denied' } });

    const doc = await prisma.projectDocument.findUnique({ where: { docId } });
    if (!doc || doc.projectId !== projectId) return res.status(404).json({ success: false, error: { message: 'Document not found' } });

    await prisma.projectDocument.delete({ where: { docId } });

    await addHistoryEntry(projectId, {
      action: 'DOCUMENT_REMOVED',
      description: `Document removed: ${doc.name}`,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: { docId, name: doc.name },
    });

    res.json({ success: true, data: { message: 'Document removed' } });
  } catch (err) {
    console.error('removeDocument error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// POST /companies/:companyId/projects/:projectId/credentials
async function addCredential(req, res) {
  try {
    const { companyId, projectId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can manage credentials' } });

    const { label, username, password, url, notes } = req.body;
    if (!label) return res.status(400).json({ success: false, error: { message: 'label is required' } });

    const cred = await prisma.projectCredential.create({
      data: { projectId, label, username: username || null, password: password || null, url: url || null, notes: notes || null },
    });

    await addHistoryEntry(projectId, {
      action: 'CREDENTIAL_ADDED',
      description: `Credential added: ${label}`,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: { credId: cred.credId, label },
    });

    res.status(201).json({ success: true, data: { ...cred, password: '••••••••' } });
  } catch (err) {
    console.error('addCredential error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// PUT /companies/:companyId/projects/:projectId/credentials/:credId
async function updateCredential(req, res) {
  try {
    const { companyId, projectId, credId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can manage credentials' } });

    const cred = await prisma.projectCredential.findUnique({ where: { credId } });
    if (!cred || cred.projectId !== projectId) return res.status(404).json({ success: false, error: { message: 'Credential not found' } });

    const { label, username, password, url, notes } = req.body;
    const updated = await prisma.projectCredential.update({
      where: { credId },
      data: {
        label: label || cred.label,
        username: username !== undefined ? username : cred.username,
        password: password !== undefined ? password : cred.password,
        url: url !== undefined ? url : cred.url,
        notes: notes !== undefined ? notes : cred.notes,
      },
    });

    res.json({ success: true, data: { ...updated, password: '••••••••' } });
  } catch (err) {
    console.error('updateCredential error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// DELETE /companies/:companyId/projects/:projectId/credentials/:credId
async function removeCredential(req, res) {
  try {
    const { companyId, projectId, credId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can manage credentials' } });

    const cred = await prisma.projectCredential.findUnique({ where: { credId } });
    if (!cred || cred.projectId !== projectId) return res.status(404).json({ success: false, error: { message: 'Credential not found' } });

    await prisma.projectCredential.delete({ where: { credId } });

    await addHistoryEntry(projectId, {
      action: 'CREDENTIAL_REMOVED',
      description: `Credential removed: ${cred.label}`,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: { credId, label: cred.label },
    });

    res.json({ success: true, data: { message: 'Credential removed' } });
  } catch (err) {
    console.error('removeCredential error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// GET /companies/:companyId/projects/:projectId/credentials/:credId/reveal
async function getCredentialPlain(req, res) {
  try {
    const { companyId, projectId, credId } = req.params;

    const existing = await prisma.project.findUnique({ where: { projectId } });
    if (!existing) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (existing.companyId !== companyId) return res.status(403).json({ success: false, error: { message: 'Only the owner company can reveal credentials' } });

    const cred = await prisma.projectCredential.findUnique({ where: { credId } });
    if (!cred || cred.projectId !== projectId) return res.status(404).json({ success: false, error: { message: 'Credential not found' } });

    res.json({ success: true, data: { password: cred.password } });
  } catch (err) {
    console.error('getCredentialPlain error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

// POST /companies/:companyId/projects/:projectId/history
async function addHistory(req, res) {
  try {
    const { companyId, projectId } = req.params;

    const { project: projCheck, isOwner, hasAssignment } = await hasAccess(projectId, companyId);
    if (!projCheck) return res.status(404).json({ success: false, error: { message: 'Project not found' } });
    if (!isOwner && !hasAssignment) return res.status(403).json({ success: false, error: { message: 'Access denied' } });

    const { action, description, metadata } = req.body;
    if (!description) return res.status(400).json({ success: false, error: { message: 'description is required' } });

    const entry = await addHistoryEntry(projectId, {
      action: action || 'NOTE',
      description,
      userId: req.user?.userId,
      userName: req.user?.name,
      metadata: metadata || null,
    });

    res.status(201).json({ success: true, data: entry });
  } catch (err) {
    console.error('addHistory error:', err);
    res.status(500).json({ success: false, error: { message: err.message } });
  }
}

module.exports = {
  listProjects,
  createProject,
  getProject,
  updateProject,
  deleteProject,
  assignCompany,
  removeAssignment,
  addDocument,
  removeDocument,
  addCredential,
  updateCredential,
  removeCredential,
  getCredentialPlain,
  addHistory,
};
