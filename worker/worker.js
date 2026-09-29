/* ==========================================================================
   FitLog sync worker — Cloudflare Workers + KV

   One endpoint, one secret: the pairing code IS the credential. There are no
   accounts, no tokens and nothing that expires.

     GET    /v1/log/<code>   -> { rev, updatedAt, data }   (rev 0, data null if new)
     PUT    /v1/log/<code>   <- { rev, data }              (rev must match, else 409)
     DELETE /v1/log/<code>   -> { ok: true }               (erases the cloud copy)
     GET    /                -> a plain health page

   The rev is optimistic concurrency control: a client sends the revision it
   last saw, and the write is refused if the stored copy has moved on. On 409
   the client merges the returned data and retries, so a write is never
   silently lost.

   Deploy: see README-worker.md next to this file.
   ========================================================================== */

const CODE_RE = /^[a-f0-9]{32}$/;
const MAX_BYTES = 4 * 1024 * 1024;   // KV allows 25 MB; 4 is far beyond a lifetime of logs

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Cache-Control, Pragma',
  'Access-Control-Max-Age': '86400'
};

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

    const url = new URL(request.url);

    if (url.pathname === '/' || url.pathname === '/health') {
      return new Response(
        'FitLog sync worker is running.\n\nThis endpoint stores nothing you can read without a pairing code.\n',
        { status: 200, headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8' } }
      );
    }

    if (!env.FITLOG) {
      return json({ error: 'kv_not_bound', message: 'Bind a KV namespace called FITLOG to this worker.' }, 500);
    }

    const match = url.pathname.match(/^\/v1\/log\/([^/]+)$/);
    if (!match) return json({ error: 'not_found' }, 404);

    const code = match[1].toLowerCase();
    if (!CODE_RE.test(code)) return json({ error: 'bad_code', message: 'Pairing code must be 32 hex characters.' }, 400);

    const key = 'log:' + code;

    /* ---------- read ---------- */
    if (request.method === 'GET') {
      const stored = await env.FITLOG.get(key);
      if (!stored) return json({ rev: 0, updatedAt: null, data: null });
      return new Response(stored, {
        status: 200,
        headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
      });
    }

    /* ---------- write ---------- */
    if (request.method === 'PUT') {
      let body;
      try { body = await request.json(); }
      catch (e) { return json({ error: 'bad_json' }, 400); }

      if (!body || typeof body !== 'object' || typeof body.data !== 'object' || body.data === null) {
        return json({ error: 'bad_body', message: 'Expected { rev: number, data: object }.' }, 400);
      }

      const current = await env.FITLOG.get(key, 'json');
      const currentRev = current && typeof current.rev === 'number' ? current.rev : 0;

      if (body.rev !== currentRev) {
        // Someone else moved the record on. Hand back the live copy so the
        // client can merge and try again.
        return json({
          error: 'conflict',
          rev: currentRev,
          updatedAt: current ? current.updatedAt : null,
          data: current ? current.data : null
        }, 409);
      }

      const record = {
        rev: currentRev + 1,
        updatedAt: new Date().toISOString(),
        data: body.data
      };
      const serialised = JSON.stringify(record);

      if (serialised.length > MAX_BYTES) {
        return json({ error: 'too_large', limit: MAX_BYTES }, 413);
      }

      await env.FITLOG.put(key, serialised);
      return json({ rev: record.rev, updatedAt: record.updatedAt });
    }

    /* ---------- erase ---------- */
    if (request.method === 'DELETE') {
      await env.FITLOG.delete(key);
      return json({ ok: true });
    }

    return json({ error: 'method_not_allowed' }, 405);
  }
};
