// backend/controllers/backupController.js
'use strict';

const fs    = require('fs');
const path  = require('path');
const prisma = require('../lib/prisma');

// ── List backup history ───────────────────────────────────────────────────────
exports.listBackups = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const [logs, total] = await Promise.all([
      prisma.backupLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * +limit,
        take: +limit,
      }),
      prisma.backupLog.count(),
    ]);
    return res.json({ success: true, data: { logs, total, page: +page, pages: Math.ceil(total / limit) } });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ── Trigger manual backup ─────────────────────────────────────────────────────
exports.triggerBackup = async (req, res) => {
  try {
    const { runBackup } = require('../services/backupService');
    // Respond immediately — backup runs async
    res.json({ success: true, message: 'Backup started. Check the history in a few moments.' });
    runBackup('MANUAL').catch(err => console.error('[BackupController] Manual backup failed:', err.message));
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ── Download a backup file ────────────────────────────────────────────────────
// type = 'db' | 'code'
exports.downloadBackup = async (req, res) => {
  try {
    const { id, type } = req.params;
    if (!['db', 'code'].includes(type))
      return res.status(400).json({ success: false, error: { message: 'type must be "db" or "code".' } });

    const log = await prisma.backupLog.findUnique({ where: { id } });
    if (!log) return res.status(404).json({ success: false, error: { message: 'Backup not found.' } });

    const filePath = type === 'db' ? log.dbFile : log.codeFile;
    if (!filePath || !fs.existsSync(filePath))
      return res.status(410).json({ success: false, error: { message: 'File no longer available locally. Download from Google Drive.' } });

    // Validate path is inside the backups directory (prevent path traversal)
    const { BACKUPS_DIR } = require('../services/backupService');
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(path.resolve(BACKUPS_DIR)))
      return res.status(403).json({ success: false, error: { message: 'Access denied.' } });

    const filename = path.basename(filePath);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', type === 'db' ? 'application/sql' : 'application/zip');
    res.setHeader('Content-Length', fs.statSync(filePath).size);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};

// ── Delete a backup log (and local files) ─────────────────────────────────────
exports.deleteBackup = async (req, res) => {
  try {
    const log = await prisma.backupLog.findUnique({ where: { id: req.params.id } });
    if (!log) return res.status(404).json({ success: false, error: { message: 'Backup not found.' } });

    // Remove local directory for this stamp
    const { BACKUPS_DIR } = require('../services/backupService');
    const backupDir = path.join(BACKUPS_DIR, log.stamp);
    if (fs.existsSync(backupDir)) {
      fs.rmSync(backupDir, { recursive: true, force: true });
    }

    await prisma.backupLog.delete({ where: { id: req.params.id } });
    return res.json({ success: true, message: 'Backup deleted.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: { message: err.message } });
  }
};
