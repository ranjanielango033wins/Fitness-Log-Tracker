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

  /* ---------- compression ----------

     Two years of logging is nearly 3 MB of JSON. Pushing that on every change
     would mean tens of megabytes of upload across a single gym session, which
     is unkind to a phone on mobile data and wasteful of the store. Gzip takes
     it down by roughly a factor of ten. Browsers without CompressionStream
     simply send plain JSON, and the worker accepts either. */

  get canCompress() {
    if (!Store.s.sync || Store.s.sync.noGzip) return false;     // worker said it cannot read it
    return typeof CompressionStream === 'function';
  },

  async gzipB64(text) {
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    const buf = new Uint8Array(await new Response(stream).arrayBuffer());
    let bin = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode.apply(null, buf.subarray(i, i + CHUNK));
    }
    return btoa(bin);
  },

  async gunzipB64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    return await new Response(stream).text();
  },

  /** Unwrap whatever shape the server handed back. */
  async readRemote(remote) {
    if (!remote) return null;
    if (remote.enc === 'gzip' && remote.payload) {
      try { return JSON.parse(await this.gunzipB64(remote.payload)); }
      catch (e) { throw new Error('Could not read the stored copy'); }
    }
    return remote.data || null;
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

    // A hand-pressed sync re-tests compression, so updating the worker takes effect
    // without anyone having to know that a flag was ever set.
    if (opts.reason === 'manual' && Store.s.sync.noGzip) {
      Store.s.sync.noGzip = false;
      Store.save({ fromSync: true });
    }

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
    if (!res.ok) throw new Error(await this.httpMessage(res));
    const remote = await res.json();
    const remoteData = await this.readRemote(remote);

    const before = Merge.payload(Store.s);
    const merged = Merge.merge(before, remoteData);

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
    if (remoteData && Merge.same(remoteData, canonical)) {
      Store.s.sync.rev = remote.rev;
      this.set('ok');
      return true;
    }

    const dayCount = Object.keys(canonical.days || {}).length;
    let put = await this.sendPut(url, remote.rev, dayCount, canonical, this.canCompress);

    /* A worker still running an older worker.js knows only the plain `{rev, data}`
       shape and answers 400 to a compressed push. Rather than leave the app stuck,
       send it again uncompressed, remember that for this endpoint, and say so once. */
    if (put.status === 400 && this.canCompress) {
      const retry = await this.sendPut(url, remote.rev, dayCount, canonical, false);
      if (retry.ok || retry.status === 409) {
        Store.s.sync.noGzip = true;
        Store.save({ fromSync: true });
        toast('Synced, but your worker is an old version — redeploy worker.js to halve the data it uses', 'warn');
      }
      put = retry;
    }

    if (put.status === 409) return this.roundTrip(attempt + 1);
    if (put.status === 413) throw new Error('Log too large for the sync store');
    if (!put.ok) throw new Error(await this.httpMessage(put));

    const done = await put.json();
    Store.s.sync.rev = done.rev;
    Store.save({ fromSync: true });
    this.set('ok');
    return true;
  },

  /** One PUT, in whichever shape the worker can read. */
  async sendPut(url, rev, dayCount, canonical, compress) {
    // `dels` lets the worker tell a deliberate wipe (which carries tombstones)
    // from a device that simply failed to read the stored copy.
    const dels = Object.keys(((canonical._del || {}).days) || {}).length;
    const body = { rev: rev, days: dayCount, dels: dels };
    if (compress) {
      try {
        body.enc = 'gzip';
        body.payload = await this.gzipB64(JSON.stringify(canonical, compactReplacer));
      } catch (e) {
        delete body.enc; delete body.payload;
        body.data = canonical;
      }
    } else {
      body.data = canonical;
    }
    return fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body.payload ? JSON.stringify(body) : JSON.stringify(body, compactReplacer)
    });
  },

  /** Say what actually went wrong, including the worker's own words. */
  async httpMessage(res) {
    const status = res.status;
    let detail = '';
    try {
      const txt = (await res.text()).slice(0, 400);
      if (txt) {
        try {
          const j = JSON.parse(txt);
          detail = j.message || j.error || '';
        } catch (e) { detail = /^</.test(txt.trim()) ? '' : txt.trim(); }
      }
    } catch (e) { /* body already consumed or unreadable */ }

    const base =
      status === 400 ? 'The worker rejected the request — it is probably running an older worker.js' :
      status === 401 || status === 403 ? 'The worker refused this request' :
      status === 404 ? 'Endpoint not found — check the worker URL' :
      status === 405 ? 'Wrong URL — the worker is answering, but not on /v1/log' :
      status === 413 ? 'Log too large for the sync store' :
      status === 429 ? 'Cloudflare is rate-limiting — try again shortly' :
      status === 500 ? 'Worker error — is the KV namespace bound as FITLOG?' :
      status === 503 ? 'The worker is unavailable right now' :
      'HTTP ' + status;

    return detail && detail.toLowerCase() !== 'bad_body' ? base + ' (' + detail + ')' : base;
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

  /* ---------- reading a QR code with the camera ----------

     Two decoders, in order of preference:

       1. BarcodeDetector, built into Chrome and Android WebView. Hardware-backed,
          costs nothing to ship.
       2. jsQR, bundled locally, for Safari and anything else without it. 127 KB,
          so it is fetched only when the scanner is actually opened — and it is in
          the service worker's cache list, so it still works offline.

     The camera needs a secure context. GitHub Pages is HTTPS, so that holds in
     practice, but a page opened from a file:// path or plain http:// will not get
     a camera and is told why rather than left staring at a black rectangle. */

  get hasNativeDetector() {
    return typeof window.BarcodeDetector === 'function';
  },

  get cameraPossible() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && window.isSecureContext !== false;
  },

  loadJsQr() {
    if (window.jsQR) return Promise.resolve(window.jsQR);
    if (this._jsqrPromise) return this._jsqrPromise;
    this._jsqrPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/jsqr.min.js';
      s.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('decoder failed to load'));
      s.onerror = () => { this._jsqrPromise = null; reject(new Error('decoder failed to load')); };
      document.head.appendChild(s);
    });
    return this._jsqrPromise;
  },

  cameraError(e) {
    const n = (e && e.name) || '';
    if (!window.isSecureContext) return 'The camera only works over https. Open the site by its https:// address.';
    if (n === 'NotAllowedError' || n === 'SecurityError') {
      return 'Camera permission was declined. Allow camera access for this site in your browser settings, then try again — or type the code in by hand.';
    }
    if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera found on this device.';
    if (n === 'NotReadableError') return 'Another app is using the camera. Close it and try again.';
    return 'Could not start the camera: ' + (e && e.message ? e.message : 'unknown error');
  },

  /** Open the camera and hand back a pairing code. Resolves null if cancelled. */
  scanQr() {
    return new Promise(resolve => {
      let stream = null, raf = 0, stopped = false, settled = null;

      const s = openSheet({
        title: 'Scan the pairing code',
        body: `
          <p class="muted small">On your other device open <b>Settings → Sync</b> so its QR code is on screen, then hold
            this phone up to it.</p>
          <div class="scan-frame">
            <video id="sc-v" playsinline muted autoplay></video>
            <div class="scan-reticle"></div>
          </div>
          <div class="small" id="sc-msg" style="margin-top:10px;min-height:20px">Starting the camera…</div>
          <p class="dim tiny" style="margin-top:6px">Nothing leaves this device — the camera image is read here and
            thrown away.</p>`,
        foot: `<button class="btn" data-close>Cancel</button><button class="btn" id="sc-type">${icon('edit')} Type it instead</button>`,
        onClose: () => { stop(); resolve(settled); }
      });

      const msg = (t, cls) => {
        const m = $('#sc-msg', s.sheet);
        if (m) { m.textContent = t; m.className = 'small ' + (cls || 'muted'); }
      };

      const stop = () => {
        stopped = true;
        cancelAnimationFrame(raf);
        if (stream) stream.getTracks().forEach(t => t.stop());
        stream = null;
      };

      $('#sc-type', s.sheet).onclick = () => { settled = 'type'; s.close(); };

      const found = text => {
        const code = this.parseCode(text);
        if (!code) { msg('That is a QR code, but not a FitLog pairing code. Keep looking…', 'small warn'); return false; }
        settled = code;
        msg('Got it.', 'small good');
        setTimeout(() => s.close(), 250);
        return true;
      };

      (async () => {
        if (!this.cameraPossible) { msg(this.cameraError({}), 'small bad'); return; }
        const video = $('#sc-v', s.sheet);

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
          });
        } catch (e) {
          // Some phones refuse the rear-camera constraint; any camera is better than none.
          try { stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: true }); }
          catch (e2) { msg(this.cameraError(e2), 'small bad'); return; }
        }
        if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }

        video.srcObject = stream;
        try { await video.play(); } catch (e) { /* autoplay attribute covers it */ }
        msg('Point it at the QR code.', 'small muted');

        let detector = null, decode = null;
        if (this.hasNativeDetector) {
          try {
            detector = new window.BarcodeDetector({ formats: ['qr_code'] });
            decode = async () => {
              const hits = await detector.detect(video);
              return hits && hits.length ? hits[0].rawValue : null;
            };
          } catch (e) { detector = null; }
        }

        if (!decode) {
          let jsqr;
          try { jsqr = await this.loadJsQr(); }
          catch (e) { msg('Could not load the QR reader. Type the code in instead.', 'small bad'); return; }
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          decode = () => {
            const w = video.videoWidth, h = video.videoHeight;
            if (!w || !h) return null;
            // Downscale: a 480-pixel-wide frame decodes a held-up phone screen fine
            // and costs a quarter of the pixels of the full frame.
            const scale = Math.min(1, 480 / w);
            canvas.width = Math.round(w * scale);
            canvas.height = Math.round(h * scale);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const hit = jsqr(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' });
            return hit ? hit.data : null;
          };
        }

        let last = 0, busy = false;
        const tick = async ts => {
          if (stopped) return;
          raf = requestAnimationFrame(tick);
          if (busy || ts - last < 120) return;                   // ~8 reads a second
          last = ts; busy = true;
          try {
            const text = await decode();
            if (text && found(text)) return;
          } catch (e) { /* a dropped frame is not worth reporting */ }
          busy = false;
        };
        raf = requestAnimationFrame(tick);
      })();
    });
  },

  /* ---------- showing a QR ---------- */

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
