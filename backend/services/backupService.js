'use strict';
// ──────────────────────────────────────────────────────────────────────────────
//  Raulji CRM — Backup Service
//  • Dumps PostgreSQL database via pg_dump
//  • Zips application code (excludes node_modules / .git / .next)
//  • Stores files in PROJECT_ROOT/backups/<stamp>/ for 30-day local access
//  • Uploads to Google Drive via rclone
//  • Saves BackupLog record to database
// ──────────────────────────────────────────────────────────────────────────────

const { spawn }  = require('child_process');
const fs         = require('fs');
const path       = require('path');
const prisma     = require('../lib/prisma');

const PROJECT_ROOT  = path.resolve(__dirname, '../../');
const BACKUPS_DIR   = path.join(PROJECT_ROOT, 'backups');
const RETENTION_DAYS = 30;

// ── Logging ───────────────────────────────────────────────────────────────────
const log  = (msg) => console.log(`[Backup] ${new Date().toISOString()} — ${msg}`);
const lerr = (msg) => console.error(`[Backup] ❌ ${msg}`);

// ── Parse DATABASE_URL ────────────────────────────────────────────────────────
function parseDbUrl(url) {
  try {
    const u = new URL(url);
    return {
      user:     u.username,
      password: decodeURIComponent(u.password || ''),
      host:     u.hostname  || 'localhost',
      port:     u.port      || '5432',
      database: u.pathname.replace(/^\//, ''),
    };
  } catch {
    throw new Error('Cannot parse DATABASE_URL — expected postgresql://user:pass@host:port/db');
  }
}

// ── Format stamp/label ────────────────────────────────────────────────────────
function makeStamps() {
  const now   = new Date();
  const pad   = (n) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  const label = now.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', hour12:true, timeZone:'Asia/Kolkata' });
  return { stamp, label };
}

// ── Run command, pipe stdout to file ─────────────────────────────────────────
function spawnToFile(cmd, args, outPath, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env } });
    const out   = fs.createWriteStream(outPath);
    child.stdout.pipe(out);
    let stderr = '';
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`));
    });
    child.on('error', e => reject(new Error(`${cmd} not found: ${e.message}`)));
  });
}

// ── Run command, collect stdout ───────────────────────────────────────────────
function spawnCmd(cmd, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { env: { ...process.env, ...env } });
    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d.toString(); });
    child.stderr.on('data', d => { stderr += d.toString(); });
    child.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${cmd} exited ${code}: ${stderr.trim()}`));
    });
    child.on('error', e => reject(new Error(`${cmd} not found: ${e.message}`)));
  });
}

// ── 1. PostgreSQL dump ────────────────────────────────────────────────────────
async function dumpDatabase(outPath) {
  const db = parseDbUrl(process.env.DATABASE_URL);
  log(`Dumping database "${db.database}" from ${db.host}:${db.port}…`);
  const args = ['-h', db.host, '-p', db.port, '-U', db.user, '--no-password', '--format=plain', '--clean', '--if-exists', '--encoding=UTF8', db.database];
  await spawnToFile('pg_dump', args, outPath, { PGPASSWORD: db.password });
  const size = fs.statSync(outPath).size;
  log(`DB dump done — ${(size / 1024).toFixed(1)} KB`);
  return size;
}

// ── 2. Code archive ───────────────────────────────────────────────────────────
async function archiveCode(outPath) {
  const archiver = require('archiver');
  log('Archiving code…');
  const EXCLUDE = [
    'node_modules/**', '**/node_modules/**', '.git/**',
    '.next/**', 'frontend/.next/**', 'prisma/generated/**',
    'backups/**', '**/*.log', '**/.DS_Store',
  ];
  return new Promise((resolve, reject) => {
    const output  = fs.createWriteStream(outPath);
    const archive = archiver('zip', { zlib: { level: 7 } });
    output.on('close', () => {
      const size = fs.statSync(outPath).size;
      log(`Code archive done — ${(size / (1024*1024)).toFixed(2)} MB`);
      resolve(size);
    });
    archive.on('error', reject);
    archive.pipe(output);
    archive.glob('**/*', { cwd: PROJECT_ROOT, ignore: EXCLUDE, dot: false });
    archive.finalize();
  });
}

// ── 3. Upload via rclone ──────────────────────────────────────────────────────
async function uploadViaRclone(localDir, remoteFolderName) {
  const remote    = process.env.RCLONE_REMOTE      || 'gdrive';
  const driveRoot = process.env.RCLONE_DRIVE_ROOT  || 'RauljiCRM-Backups';
  const dest      = `${remote}:${driveRoot}/${remoteFolderName}`;
  log(`Uploading to ${dest}…`);
  await spawnCmd('rclone', ['copy', localDir, dest, '--transfers=2']);
  log(`Upload complete → ${dest}`);
  return dest;
}

// ── 4. Purge old local backups ────────────────────────────────────────────────
async function purgeOldBackups() {
  if (!fs.existsSync(BACKUPS_DIR)) return;
  const cutoff = Date.now() - RETENTION_DAYS * 86400000;
  for (const name of fs.readdirSync(BACKUPS_DIR)) {
    const dir = path.join(BACKUPS_DIR, name);
    try {
      const stat = fs.statSync(dir);
      if (stat.isDirectory() && stat.mtimeMs < cutoff) {
        fs.rmSync(dir, { recursive: true, force: true });
        log(`Purged old backup: ${name}`);
        // Null out local paths in DB so UI shows "expired"
        try {
          await prisma.backupLog.updateMany({ where: { stamp: name }, data: { dbFile: null, codeFile: null } });
        } catch (dbErr) {
          console.error(`[Backup] Failed to update log for purged backup ${name}:`, dbErr.message);
        }
      }
    } catch (fsErr) {
      console.error(`[Backup] Failed to purge ${name}:`, fsErr.message);
    }
  }
}

// ── Main runBackup ────────────────────────────────────────────────────────────
async function runBackup(trigger = 'SCHEDULED') {
  const { stamp, label } = makeStamps();
  log(`=== Backup started — ${label} (${trigger}) ===`);

  // Ensure backups directory exists
  const backupDir = path.join(BACKUPS_DIR, stamp);
  fs.mkdirSync(backupDir, { recursive: true });

  const dbFile   = path.join(backupDir, `database_${stamp}.sql`);
  const codeFile = path.join(backupDir, `code_${stamp}.zip`);

  // Create DB log entry
  const logEntry = await prisma.backupLog.create({
    data: { stamp, label, status: 'RUNNING', trigger }
  });

  try {
    // Step 1 — DB dump
    const dbSize = await dumpDatabase(dbFile);

    // Step 2 — Code archive
    const codeSize = await archiveCode(codeFile);

    // Step 3 — Upload to Drive
    let driveFolder = null;
    const folderName = `${stamp} — ${label}`;
    try {
      driveFolder = await uploadViaRclone(backupDir, folderName);
    } catch (rcloneErr) {
      lerr(`rclone upload failed: ${rcloneErr.message}`);
      // Still mark as PARTIAL — files are saved locally
    }

    const status = driveFolder ? 'SUCCESS' : 'PARTIAL';
    await prisma.backupLog.update({
      where: { id: logEntry.id },
      data: {
        status,
        dbFile,
        codeFile,
        dbSizeBytes:   dbSize,
        codeSizeBytes: codeSize,
        driveFolder,
        completedAt:   new Date(),
      }
    });

    log(`=== Backup ${status} ✅  ${driveFolder ? `→ ${driveFolder}` : '(local only)'} ===`);

    // Purge backups older than RETENTION_DAYS
    await purgeOldBackups();

    return { id: logEntry.id, stamp, label, status, dbFile, codeFile, driveFolder, dbSize, codeSize };

  } catch (err) {
    lerr(`Backup failed: ${err.message}`);
    await prisma.backupLog.update({
      where: { id: logEntry.id },
      data: { status: 'FAILED', error: err.message, completedAt: new Date() }
    });
    // Clean up empty dir on total failure
    try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {}
    throw err;
  }
}

module.exports = { runBackup, BACKUPS_DIR };
