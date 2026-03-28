// backend/services/jobRunner.js
// Lightweight polling job runner — processes due automation jobs every 60 seconds

const { processDuePendingJobs } = require('./automationEngine');

let intervalId = null;

exports.start = () => {
  if (intervalId) return;
  console.log('[JobRunner] Started — polling every 60s');
  intervalId = setInterval(async () => {
    try { await processDuePendingJobs(); }
    catch (err) { console.error('[JobRunner] Tick error:', err.message); }
  }, 60000);
  // Run once immediately on startup (after a short delay to let DB connect)
  setTimeout(async () => {
    try { await processDuePendingJobs(); }
    catch (err) { console.error('[JobRunner] Initial run error:', err.message); }
  }, 5000);
};

exports.stop = () => {
  if (intervalId) { clearInterval(intervalId); intervalId = null; }
};
