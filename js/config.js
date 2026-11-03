/* ==========================================================================
   FitLog configuration

   Put your Cloudflare Worker URL here after deploying worker/worker.js, then
   push. Because this ships with the site, every device picks the endpoint up
   automatically — you only ever type it once, here.

   Leave it empty and FitLog runs as a local-only log with manual backup and
   restore. Nothing else changes.
   ========================================================================== */

window.FITLOG_CONFIG = {
  syncEndpoint: 'https://fitlog-sync.ranjanielango033.workers.dev'
};
