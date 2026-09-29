/* ==========================================================================
   FitLog — device sync

   The pairing code is the whole credential. No accounts, no OAuth, no tokens
   that expire: a 128-bit random code identifies one log, and any device
   holding it reads and writes that log.

   Protocol against worker/worker.js:
     GET  /v1/log/<code>  -> { rev, updatedAt, data }
     PUT  /v1/log/<code>  <- { rev, data }   409 if rev moved on

   Every sync is pull -> merge -> push, so an offline edit on one device is
   never overwritten; it merges in on the next round.
   ========================================================================== */

const Sync = {
  state: 'idle',          // idle | syncing | ok | offline | error | unpaired
  pushTimer: null,
  pollTimer: null,
  inFlight: false,
  pendingPush: false,
  lastMessage: '',

  /* ---------- configuration ---------- */

  get endpoint() {
    const manual = (Store.s.sync.endpoint || '').trim();
    const baked = ((window.FITLOG_CONFIG || {}).syncEndpoint || '').trim();
    return (manual || baked).replace(/\/+$/, '');
  },

  get code() { return Store.s.sync.code; },

  get paired() { return !!(this.code && this.endpoint); },

  get configured() { return !!this.endpoint; },

  newCode() {
    const b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return Array.from(b).map(x => x.toString(16).padStart(2, '0')).join('');
  },

  /** 32 hex chars are unreadable; show them in blocks of four. */
  pretty(code) {
    return (code || '').replace(/(.{4})/g, '$1 ').trim().toUpperCase();
  },

  parseCode(input) {
    if (!input) return null;
    let s = String(input).trim();
    const hash = s.match(/[#&?]pair=([^&]+)/i);
    if (hash) s = decodeURIComponent(hash[1]);
    s = s.replace(/[^a-fA-F0-9]/g, '').toLowerCase();
    return /^[a-f0-9]{32}$/.test(s) ? s : null;
  },

  pairLink(code) {
    const base = location.origin + location.pathname.replace(/index\.html$/, '');
    return base + '#pair=' + (code || this.code);
  },

  /* ---------- lifecycle ---------- */

  init() {
    // A device paired by scanning a QR arrives with the code in the URL.
    const fromUrl = this.parseCode(location.hash);
    if (fromUrl) {
      history.replaceState(null, '', location.pathname + location.search);
      this.adoptCode(fromUrl);
      return;
    }

    if (!this.paired) {
      this.set(this.configured ? 'unpaired' : 'idle');
      return;
    }

    this.sync({ reason: 'startup' });

    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.paired) this.sync({ reason: 'focus', quiet: true });
    });
    window.addEventListener('online', () => { if (this.paired) this.sync({ reason: 'online', quiet: true }); });

    // Gentle background poll so a second device's changes turn up on their own.
    this.pollTimer = setInterval(() => {
      if (!document.hidden && this.paired && navigator.onLine) this.sync({ reason: 'poll', quiet: true });
    }, 90000);
  },

  set(state, message) {
    this.state = state;
    this.lastMessage = message || '';
    if (state === 'error') Store.s.sync.lastError = message || 'Sync failed';
    if (state === 'ok') { Store.s.sync.lastError = null; Store.s.sync.lastSync = new Date().toISOString(); }
    this.paintBadge();
  },

  /* ---------- pairing ---------- */

  /** Start a fresh log in the cloud from this device's data. */
  async connectNew() {
    if (!this.configured) { toast('Add your sync endpoint first', 'warn'); return false; }
    Store.s.sync.code = this.newCode();
    Store.s.sync.rev = 0;
    Store.save({ fromSync: true });
    const ok = await this.sync({ reason: 'connect', force: true });
    if (ok) toast('Sync on — this device is now the master copy', 'good');
    return ok;
  },

  /** Join a log another device already created. */
  async adoptCode(code) {
    const parsed = this.parseCode(code);
    if (!parsed) { toast('That does not look like a pairing code', 'bad'); return false; }
    if (!this.configured) { toast('Add your sync endpoint first', 'warn'); return false; }
    Store.s.sync.code = parsed;
    Store.s.sync.rev = 0;
    Store.save({ fromSync: true });
    const ok = await this.sync({ reason: 'pair', force: true });
    if (ok) {
      toast('Paired — your other device’s log is here', 'good');
      if (typeof App !== 'undefined') App.render();
    }
    return ok;
  },

  /** Stop syncing this device. Local data and the cloud copy both stay put. */
  unpair() {
    Store.s.sync.code = null;
    Store.s.sync.rev = 0;
    Store.s.sync.lastError = null;
    Store.save({ fromSync: true });
    this.set(this.configured ? 'unpaired' : 'idle');
  },

  async deleteCloud() {
    if (!this.paired) return false;
    try {
      const r = await fetch(`${this.endpoint}/v1/log/${this.code}`, { method: 'DELETE' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      this.unpair();
      return true;
    } catch (e) {
      toast('Could not reach the sync endpoint', 'bad');
      return false;
    }
  },

  /* ---------- the sync itself ---------- */

  schedulePush() {
    if (!this.paired) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.sync({ reason: 'change', quiet: true }), 2500);
  },

  async sync(opts) {
    opts = opts || {};
    if (!this.paired) return false;
    if (this.inFlight) { this.pendingPush = true; return false; }
    if (!navigator.onLine) { this.set('offline'); return false; }

    this.inFlight = true;
    this.set('syncing');

    let ok = false;
    try {
      ok = await this.roundTrip(0);
    } catch (e) {
      console.warn('FitLog sync:', e);
      const offline = !navigator.onLine || /Failed to fetch|NetworkError|Load failed/i.test(e.message || '');
      this.set(offline ? 'offline' : 'error', offline ? 'No connection' : (e.message || 'Sync failed'));
      if (!opts.quiet) toast(offline ? 'Offline — will sync when you reconnect' : 'Sync failed: ' + e.message, offline ? 'warn' : 'bad');
    } finally {
      this.inFlight = false;
    }

    if (this.pendingPush) { this.pendingPush = false; this.schedulePush(); }
    return ok;
  },

  /** pull -> merge -> push, retrying up to three times if the rev moves under us */
  async roundTrip(attempt) {
    if (attempt > 2) throw new Error('Too many conflicting writes — try again in a moment');

    const url = `${this.endpoint}/v1/log/${this.code}`;

    // Cache-bust with a query param rather than a Cache-Control header: a custom
    // header would turn this into a CORS preflight for no benefit.
    const res = await fetch(`${url}?t=${Date.now()}`, { method: 'GET', cache: 'no-store' });
    if (!res.ok) throw new Error(this.httpMessage(res.status));
    const remote = await res.json();

    const before = Merge.payload(Store.s);
    const merged = Merge.merge(before, remote.data);

    // Adopt the merge locally first, so a failed push still leaves this device
    // holding everything it just learned from the server.
    Merge.apply(merged);
    Store.save({ fromSync: true });

    // Push the state as it now exists locally, not the raw merge result:
    // apply() normalises day objects, and sending the un-normalised version
    // would make every later comparison differ and write on every poll.
    const canonical = Merge.payload(Store.s);

    const changedLocally = !Merge.same(before, canonical);
    if (changedLocally && typeof App !== 'undefined') App.render();

    // Nothing to send if the server already holds exactly this.
    if (remote.data && Merge.same(remote.data, canonical)) {
      Store.s.sync.rev = remote.rev;
      this.set('ok');
      return true;
    }

    const put = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rev: remote.rev, data: canonical })
    });

    if (put.status === 409) return this.roundTrip(attempt + 1);
    if (put.status === 413) throw new Error('Log too large for the sync store');
    if (!put.ok) throw new Error(this.httpMessage(put.status));

    const done = await put.json();
    Store.s.sync.rev = done.rev;
    Store.save({ fromSync: true });
    this.set('ok');
    return true;
  },

  httpMessage(status) {
    if (status === 404) return 'Endpoint not found — check the worker URL';
    if (status === 400) return 'The worker rejected the request';
    if (status === 500) return 'Worker error — is the KV namespace bound as FITLOG?';
    return 'HTTP ' + status;
  },

  /* ---------- status badge in the top bar ---------- */

  paintBadge() {
    const el = document.getElementById('sync-badge');
    if (!el) return;
    if (!this.configured) { el.classList.add('hide'); return; }
    el.classList.remove('hide');

    const map = {
      syncing:  { icon: 'refresh',  cls: 'spin',  title: 'Syncing…' },
      ok:       { icon: 'cloud',    cls: 'good',  title: 'Synced' + (Store.s.sync.lastSync ? ' at ' + new Date(Store.s.sync.lastSync).toLocaleTimeString() : '') },
      offline:  { icon: 'cloudoff', cls: 'warn',  title: 'Offline — changes are saved on this device' },
      error:    { icon: 'cloudoff', cls: 'bad',   title: this.lastMessage || 'Sync problem' },
      unpaired: { icon: 'cloudoff', cls: 'dim',   title: 'Not syncing — tap to pair a device' },
      idle:     { icon: 'cloudoff', cls: 'dim',   title: 'Sync not set up' }
    };
    const m = map[this.state] || map.idle;
    el.innerHTML = icon(m.icon);
    el.className = 'btn ghost icon sync-badge ' + m.cls;
    el.title = m.title;
  },

  statusLine() {
    if (!this.configured) return 'No sync endpoint set';
    if (!this.paired) return 'Not paired';
    switch (this.state) {
      case 'syncing': return 'Syncing…';
      case 'offline': return 'Offline — will catch up automatically';
      case 'error': return this.lastMessage || 'Sync problem';
      case 'ok': return 'Last synced ' + new Date(Store.s.sync.lastSync).toLocaleString();
      default: return Store.s.sync.lastSync ? 'Last synced ' + new Date(Store.s.sync.lastSync).toLocaleString() : 'Waiting for first sync';
    }
  },

  /* ---------- QR ---------- */

  qrSvg(text, px) {
    if (typeof qrcode !== 'function') return '';
    let q;
    for (let type = 6; type <= 20; type++) {
      try {
        q = qrcode(type, 'M');
        q.addData(text);
        q.make();
        break;
      } catch (e) { q = null; }
    }
    if (!q) return '';
    const n = q.getModuleCount();
    const size = px || 200;
    const cell = size / (n + 8);            // 4-module quiet zone each side
    let rects = '';
    for (let r = 0; r < n; r++) {
      let runStart = -1;
      for (let c = 0; c <= n; c++) {
        const dark = c < n && q.isDark(r, c);
        if (dark && runStart < 0) runStart = c;
        if (!dark && runStart >= 0) {
          rects += `<rect x="${round((runStart + 4) * cell, 2)}" y="${round((r + 4) * cell, 2)}" width="${round((c - runStart) * cell, 2)}" height="${round(cell, 2)}"/>`;
          runStart = -1;
        }
      }
    }
    return `<svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img" aria-label="Pairing QR code" style="display:block">
      <rect width="${size}" height="${size}" fill="#ffffff" rx="8"/>
      <g fill="#000000">${rects}</g>
    </svg>`;
  }
};
