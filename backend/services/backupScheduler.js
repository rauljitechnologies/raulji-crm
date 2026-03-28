'use strict';
// ──────────────────────────────────────────────────────────────────────────────
//  Raulji CRM — Backup Scheduler
//  Runs runBackup() every day at 05:00 AM IST (UTC+5:30)
//  In node-cron, cron expression timezone is set via options.timezone
// ──────────────────────────────────────────────────────────────────────────────

const cron      = require('node-cron');
const { runBackup } = require('./backupService');

const CRON_EXPR = '0 5 * * *';   // 05:00 every day
const TZ        = 'Asia/Kolkata';

function start() {
  if (!process.env.GOOGLE_DRIVE_BACKUP_FOLDER_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    console.warn('[BackupScheduler] ⚠️  Google Drive env vars not set — scheduler will run but uploads will be skipped.');
    console.warn('   Set GOOGLE_DRIVE_BACKUP_FOLDER_ID and GOOGLE_SERVICE_ACCOUNT_KEY in .env to enable Drive uploads.');
  }

  cron.schedule(CRON_EXPR, async () => {
    try {
      const result = await runBackup('SCHEDULED');
      if (result.driveFolder) {
        console.log(`[BackupScheduler] ✅ Backup uploaded → ${result.driveFolder}`);
      } else if (result.status === 'PARTIAL') {
        console.log(`[BackupScheduler] ⚠️  Backup saved locally only (Drive upload failed).`);
      } else {
        console.log(`[BackupScheduler] ✅ Backup complete — status: ${result.status}`);
      }
    } catch (err) {
      console.error(`[BackupScheduler] ❌ Backup failed: ${err.message}`);
    }
  }, { timezone: TZ });

  console.log(`[BackupScheduler] Scheduled daily backup at 05:00 AM IST (${CRON_EXPR} ${TZ})`);
}

module.exports = { start };
