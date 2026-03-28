#!/usr/bin/env node
'use strict';
// ──────────────────────────────────────────────────────────────────────────────
//  Manual backup trigger
//  Usage:  node backend/scripts/runBackup.js
//      or: npm run backup
// ──────────────────────────────────────────────────────────────────────────────

require('dotenv').config();
const { runBackup } = require('../services/backupService');

(async () => {
  try {
    const result = await runBackup();
    console.log('\n────────────────────────────────────────');
    console.log('Backup Result:');
    if (result.uploaded) {
      console.log(`  Status    : ✅ Uploaded to Google Drive`);
      console.log(`  Folder    : ${result.folderName}`);
      console.log(`  Link      : ${result.folderLink}`);
      console.log(`  DB file   : ${result.dbUpload?.name}  (${(result.dbUpload?.localSize / 1024).toFixed(1)} KB)`);
      console.log(`  Code file : ${result.codeUpload?.name}  (${(result.codeUpload?.localSize / (1024*1024)).toFixed(2)} MB)`);
    } else if (result.localOnly) {
      console.log(`  Status    : ⚠️  Saved locally (Drive not configured)`);
      console.log(`  DB file   : ${result.dbFile}`);
      console.log(`  Code file : ${result.codeFile}`);
    }
    console.log('────────────────────────────────────────\n');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Backup failed:', err.message);
    process.exit(1);
  }
})();
