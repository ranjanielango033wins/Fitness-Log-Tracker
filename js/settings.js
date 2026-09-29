/* ==========================================================================
   FitLog — settings, profile, targets, backup & restore
   ========================================================================== */

const Settings = {

  open(focus) {
    const s = openSheet({ title: 'Settings', wide: true, body: '<div id="st"></div>' });
    this.draw(s);
    if (focus) {
      const anchor = $('#sec-' + focus, s.sheet);
      if (anchor) setTimeout(() => anchor.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60);
    }
  },

  draw(s) {
    const p = Store.s.profile, st = Store.s.settings;
    const auto = Calc.macroTargets(p);
    const water = Calc.waterTarget(p, 60);

    $('#st', s.sheet).innerHTML = `
      <div class="section-title">You</div>
      <label class="fld"><span>Name (used on exported reports)</span>
        <input id="p-name" value="${esc(p.name)}" placeholder="Your name"></label>
      <div class="grid-2">
        <label class="fld"><span>Sex (for the BMR equation)</span>
          <select id="p-sex">
            <option value="male" ${p.sex === 'male' ? 'selected' : ''}>Male</option>
            <option value="female" ${p.sex === 'female' ? 'selected' : ''}>Female</option>
          </select></label>
        <label class="fld"><span>Age</span><input type="number" id="p-age" value="${p.age}"></label>
        <label class="fld"><span>Height (${Units.hLabel()})</span>
          <input type="number" step="0.1" id="p-h" value="${round(Units.hOut(p.heightCm), 1)}"></label>
        <label class="fld"><span>Bodyweight (${Units.wLabel()})</span>
          <input type="number" step="0.1" id="p-w" value="${round(Units.wOut(p.weightKg), 1)}"></label>
      </div>
      <label class="fld"><span>Daily activity outside training</span>
        <select id="p-act">
          <option value="1.2" ${p.activity == 1.2 ? 'selected' : ''}>Sedentary — desk job, little walking</option>
          <option value="1.375" ${p.activity == 1.375 ? 'selected' : ''}>Lightly active — 1–3 sessions a week</option>
          <option value="1.55" ${p.activity == 1.55 ? 'selected' : ''}>Moderately active — 3–5 sessions a week</option>
          <option value="1.725" ${p.activity == 1.725 ? 'selected' : ''}>Very active — 6–7 sessions a week</option>
          <option value="1.9" ${p.activity == 1.9 ? 'selected' : ''}>Extremely active — physical job or two-a-days</option>
        </select></label>
      <label class="fld"><span>Goal</span>
        <select id="p-goal">
          <option value="cut" ${p.goal === 'cut' ? 'selected' : ''}>Fat loss — 20% deficit</option>
          <option value="lean" ${p.goal === 'lean' ? 'selected' : ''}>Slow cut — 10% deficit</option>
          <option value="maintain" ${p.goal === 'maintain' ? 'selected' : ''}>Maintain</option>
          <option value="leanbulk" ${p.goal === 'leanbulk' ? 'selected' : ''}>Lean gain — 8% surplus</option>
          <option value="bulk" ${p.goal === 'bulk' ? 'selected' : ''}>Mass gain — 15% surplus</option>
        </select></label>
      <label class="switch" style="margin-bottom:14px"><input type="checkbox" id="p-hot" ${p.hotClimate ? 'checked' : ''}>
        <span class="track"></span><span>Hot climate — adds 500 ml to the daily water target</span></label>

      <div class="card" style="background:var(--card-2)">
        <div class="kv"><span class="kk">Basal metabolic rate (Mifflin-St Jeor)</span><span class="vv">${fmtNum(Calc.bmr(p))} kcal</span></div>
        <div class="kv"><span class="kk">Maintenance (TDEE)</span><span class="vv">${fmtNum(Calc.tdee(p))} kcal</span></div>
        <div class="kv"><span class="kk">Goal calories</span><span class="vv">${fmtNum(auto.kcal)} kcal</span></div>
        <div class="kv"><span class="kk">Suggested macros</span><span class="vv">${auto.protein}P · ${auto.carbs}C · ${auto.fat}F</span></div>
        <div class="kv"><span class="kk">Water target (with 1h training)</span><span class="vv">${Units.fmtVBig(water)}</span></div>
      </div>

      <div class="section-title">Targets</div>
      <label class="switch" style="margin-bottom:12px"><input type="checkbox" id="t-auto" ${st.autoTargets ? 'checked' : ''}>
        <span class="track"></span><span>Calculate targets from my profile automatically</span></label>
      <div id="t-manual" class="${st.autoTargets ? 'hide' : ''}">
        <div class="grid-2">
          <label class="fld"><span>Calories</span><input type="number" id="t-k" value="${st.targets.kcal}"></label>
          <label class="fld"><span>Protein g</span><input type="number" id="t-p" value="${st.targets.protein}"></label>
          <label class="fld"><span>Carbs g</span><input type="number" id="t-c" value="${st.targets.carbs}"></label>
          <label class="fld"><span>Fat g</span><input type="number" id="t-f" value="${st.targets.fat}"></label>
          <label class="fld"><span>Water (${Units.vBigLabel()})</span>
            <input type="number" step="0.1" id="t-w" value="${round(Units.vBig(st.targets.waterMl), 2)}"></label>
        </div>
      </div>
      <label class="fld"><span>Sleep target (hours a night)</span>
        <input type="number" step="0.25" id="t-s" value="${st.targets.sleepH}"></label>

      <div class="section-title">Preferences</div>
      <label class="fld"><span>Units</span>
        <div class="seg wide" id="u-seg">
          <button data-u="metric" class="${st.units === 'metric' ? 'active' : ''}">Metric — kg, cm, km, L</button>
          <button data-u="imperial" class="${st.units === 'imperial' ? 'active' : ''}">Imperial — lb, in, mi, cups</button>
        </div></label>
      <label class="fld" style="margin-top:12px"><span>Theme</span>
        <div class="seg wide" id="th-seg">
          ${['auto', 'dark', 'light'].map(t => `<button data-t="${t}" class="${st.theme === t ? 'active' : ''}">${t[0].toUpperCase() + t.slice(1)}</button>`).join('')}
        </div></label>
      <label class="fld" style="margin-top:12px"><span>Estimated 1RM formula</span>
        <select id="s-1rm">
          <option value="epley" ${st.oneRm === 'epley' ? 'selected' : ''}>Epley — w × (1 + reps/30)</option>
          <option value="brzycki" ${st.oneRm === 'brzycki' ? 'selected' : ''}>Brzycki — w × 36/(37 − reps)</option>
          <option value="lombardi" ${st.oneRm === 'lombardi' ? 'selected' : ''}>Lombardi — w × reps^0.10</option>
          <option value="oconner" ${st.oneRm === 'oconner' ? 'selected' : ''}>O'Conner — w × (1 + 0.025 × reps)</option>
          <option value="wathan" ${st.oneRm === 'wathan' ? 'selected' : ''}>Wathan</option>
        </select></label>
      <label class="fld"><span>Default rest between sets (seconds)</span>
        <input type="number" step="15" id="s-rest" value="${st.restTimerSec}"></label>

      <div class="section-title" id="sec-sync">Sync across devices</div>
      ${this.syncHtml()}

      <div class="section-title">Backup &amp; restore</div>
      <p class="muted small">A backup file is the belt-and-braces copy — useful whether or not sync is on, and the only way to
        keep a snapshot of a particular moment. Restoring replaces what is in the app right now.</p>
      <div class="btn-row" style="margin-bottom:10px">
        <button class="btn primary grow" id="b-export">${icon('download')} Download backup</button>
        <button class="btn grow" id="b-import">${icon('upload')} Restore from file</button>
      </div>
      <input type="file" id="b-file" accept="application/json,.json,.fitlog" class="hide">
      <div class="kv"><span class="kk">Days stored</span><span class="vv">${Store.loggedDays().length}</span></div>
      <div class="kv"><span class="kk">Custom foods · recipes</span><span class="vv">${Store.s.customFoods.length} · ${Store.s.recipes.length}</span></div>
      <div class="kv"><span class="kk">Last backup</span>
        <span class="vv">${Store.s.meta.lastBackup ? esc(new Date(Store.s.meta.lastBackup).toLocaleString()) : 'never'}</span></div>
      <div class="kv"><span class="kk">Storage used</span><span class="vv">${this.storageSize()}</span></div>
      <div class="kv"><span class="kk">Sync</span><span class="vv">${Sync.paired ? 'on' : 'off'}</span></div>

      <div class="section-title">Danger zone</div>
      <div class="btn-row">
        <button class="btn danger grow" id="b-clearday">Clear this day</button>
        <button class="btn danger grow" id="b-wipe">Erase everything</button>
      </div>

      <p class="dim tiny" style="margin-top:18px">FitLog · data stored locally with the browser's localStorage · no account, no server.
        Calculations use Mifflin-St Jeor (BMR), the Compendium of Physical Activities MET equation (energy burn),
        Epley/Brzycki (estimated 1RM) and standard sleep-efficiency definitions. Figures are estimates for training
        decisions, not medical advice.</p>
    `;

    this.bind(s);
  },

  /* ---------- sync section ---------- */
  syncHtml() {
    const sy = Store.s.sync;

    if (!Sync.configured) {
      return `
        <p class="muted small">Log on your phone at the gym, see it on your laptop at home. FitLog syncs through a
          Cloudflare Worker you deploy once — no account, nothing that expires, and the data stays yours.</p>
        <div class="card" style="background:var(--card-2)">
          <div class="sync-step"><span class="n">1</span><span class="b">
            <b>Deploy the worker</b><span class="muted">Follow <span class="mono">worker/README-worker.md</span> in the project — about 15 minutes, free tier.</span></span></div>
          <div class="sync-step"><span class="n">2</span><span class="b">
            <b>Put the URL in <span class="mono">js/config.js</span></b><span class="muted">Then push. Every device picks it up from the site itself.</span></span></div>
          <div class="sync-step"><span class="n">3</span><span class="b">
            <b>Pair your devices</b><span class="muted">One QR scan each. No passwords, no sign-in.</span></span></div>
        </div>
        <label class="fld"><span>Or paste the worker URL just for this device</span>
          <input id="sy-ep" placeholder="https://fitlog-sync.your-name.workers.dev" value="${esc(sy.endpoint || '')}"></label>`;
    }

    if (!Sync.paired) {
      return `
        <p class="muted small">This device is not syncing yet. Start a new synced log, or join the one your other device already has.</p>
        <div class="btn-row" style="margin-bottom:12px">
          <button class="btn primary grow" id="sy-new">${icon('cloud')} Turn on sync here</button>
          <button class="btn grow" id="sy-join">${icon('qr')} Pair with another device</button>
        </div>
        <p class="dim tiny">Pick <b>Turn on sync here</b> on the device that already has your history — it becomes the
          first copy. On every other device, choose <b>Pair</b>.</p>
        <label class="fld" style="margin-top:12px"><span>Sync endpoint</span>
          <input id="sy-ep" value="${esc(sy.endpoint || '')}" placeholder="${esc((window.FITLOG_CONFIG || {}).syncEndpoint || '')}"></label>`;
    }

    const dot = { ok: 'var(--good)', syncing: 'var(--acc)', offline: 'var(--warn)', error: 'var(--bad)' }[Sync.state] || 'var(--tx-3)';
    return `
      <div class="card" style="background:var(--card-2);margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:9px;margin-bottom:8px">
          <span style="width:9px;height:9px;border-radius:50%;background:${dot};flex:none"></span>
          <b>${Sync.state === 'ok' ? 'Syncing' : Sync.state === 'syncing' ? 'Syncing now' : Sync.state === 'offline' ? 'Offline' : Sync.state === 'error' ? 'Sync problem' : 'Connected'}</b>
          <div class="grow"></div>
          <button class="btn xs" id="sy-now">${icon('refresh')} Sync now</button>
        </div>
        <div class="small muted">${esc(Sync.statusLine())}</div>
      </div>

      <div class="section-title" style="margin-top:6px">Add another device</div>
      <p class="muted small">Open the camera on the other device and point it at this code. It opens FitLog already paired —
        nothing to type.</p>
      <div class="qr-wrap" id="sy-qr">${Sync.qrSvg(Sync.pairLink(), 210) || '<div class="dim small">QR unavailable</div>'}</div>
      <div class="btn-row" style="margin-bottom:12px">
        <button class="btn grow" id="sy-copy">${icon('link')} Copy pairing link</button>
        <button class="btn grow" id="sy-reveal">${icon('eye')} Show code</button>
      </div>
      <div class="code-box masked" id="sy-code">${esc(Sync.pretty(sy.code))}</div>
      <p class="dim tiny" style="margin-top:8px">Anyone holding this code can read and write your log, so keep it off
        group chats and public screenshots. It never expires — write it down somewhere safe.</p>

      <div class="btn-row" style="margin-top:14px">
        <button class="btn grow" id="sy-unpair">Stop syncing this device</button>
        <button class="btn danger grow" id="sy-wipe">Delete cloud copy</button>
      </div>
      <label class="fld" style="margin-top:12px"><span>Sync endpoint</span>
        <input id="sy-ep" value="${esc(sy.endpoint || '')}" placeholder="${esc((window.FITLOG_CONFIG || {}).syncEndpoint || '')}"></label>`;
  },

  bindSync(s) {
    const root = s.sheet;
    const redraw = () => this.draw(s);

    const ep = $('#sy-ep', root);
    if (ep) ep.addEventListener('change', () => {
      Store.s.sync.endpoint = ep.value.trim().replace(/\/+$/, '');
      Store.save({ fromSync: true });
      Sync.paintBadge();
      redraw();
    });

    const el = id => $('#' + id, root);

    if (el('sy-new')) el('sy-new').onclick = async () => {
      const ok = await confirmSheet('Turn on sync',
        'This device becomes the first copy in the cloud. Pair your other devices to it afterwards and they will pull this history down.',
        'Turn on sync');
      if (!ok) return;
      await Sync.connectNew();
      redraw();
    };

    if (el('sy-join')) el('sy-join').onclick = () => this.joinSheet(() => redraw());

    if (el('sy-now')) el('sy-now').onclick = async () => {
      await Sync.sync({ reason: 'manual' });
      redraw();
      if (Sync.state === 'ok') toast('Up to date', 'good');
    };

    if (el('sy-copy')) el('sy-copy').onclick = async () => {
      const link = Sync.pairLink();
      try {
        await navigator.clipboard.writeText(link);
        toast('Pairing link copied', 'good');
      } catch (e) {
        const box = el('sy-code');
        box.classList.remove('masked');
        box.textContent = link;
        toast('Copy it by hand — clipboard blocked', 'warn');
      }
    };

    if (el('sy-reveal')) el('sy-reveal').onclick = () => el('sy-code').classList.toggle('masked');
    if (el('sy-code')) el('sy-code').onclick = () => el('sy-code').classList.remove('masked');

    if (el('sy-unpair')) el('sy-unpair').onclick = async () => {
      const ok = await confirmSheet('Stop syncing this device',
        'This device keeps everything it has and stops talking to the cloud. Your other devices carry on, and the cloud copy is untouched. You can pair again later with the same code.',
        'Stop syncing');
      if (!ok) return;
      Sync.unpair();
      redraw();
      toast('Sync off on this device', 'warn');
    };

    if (el('sy-wipe')) el('sy-wipe').onclick = async () => {
      const ok = await confirmSheet('Delete cloud copy',
        'Erases the synced copy from your worker and unpairs this device. Data already on your devices stays where it is, but they will stop seeing each other. This cannot be undone.',
        'Delete cloud copy', true);
      if (!ok) return;
      const done = await Sync.deleteCloud();
      redraw();
      if (done) toast('Cloud copy deleted', 'warn');
    };
  },

  joinSheet(after) {
    const s = openSheet({
      title: 'Pair with another device',
      body: `
        <p class="muted small">On the device that already has your log, open <b>Settings → Sync</b> and show its QR code.
          Scan it with this device's camera and you are done — you only need what is below if the camera is not an option.</p>
        <label class="fld"><span>Pairing code or link</span>
          <input id="jn" placeholder="A1B2 C3D4 … or the pasted link" autocomplete="off" spellcheck="false"></label>
        <p class="dim tiny">Spaces and capitals do not matter.</p>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="jn-go">Pair</button>`
    });
    const go = async () => {
      const val = $('#jn', s.sheet).value;
      if (!Sync.parseCode(val)) return toast('That code is not complete', 'warn');
      s.close();
      await Sync.adoptCode(val);
      if (after) after();
    };
    $('#jn-go', s.sheet).onclick = go;
    $('#jn', s.sheet).addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
  },

  storageSize() {
    try {
      const b = new Blob([localStorage.getItem(STORAGE_KEY) || '']).size;
      return b > 1024 * 1024 ? round(b / 1024 / 1024, 2) + ' MB' : round(b / 1024, 1) + ' KB';
    } catch (e) { return '–'; }
  },

  bind(s) {
    const root = s.sheet;
    const commit = () => { Store.save(); App.render(); };
    this.bindSync(s);

    const num = (sel, fn) => { const e = $(sel, root); if (e) e.addEventListener('change', () => { fn(e.value); commit(); }); };

    num('#p-name', v => Store.s.profile.name = v.trim());
    num('#p-sex', v => Store.s.profile.sex = v);
    num('#p-age', v => Store.s.profile.age = +v || 28);
    num('#p-h', v => Store.s.profile.heightCm = round(Units.hIn(+v), 1));
    num('#p-w', v => Store.s.profile.weightKg = round(Units.wIn(+v), 2));
    num('#p-act', v => Store.s.profile.activity = +v);
    num('#p-goal', v => Store.s.profile.goal = v);
    num('#s-1rm', v => Store.s.settings.oneRm = v);
    num('#s-rest', v => Store.s.settings.restTimerSec = +v || 90);
    num('#t-s', v => Store.s.settings.targets.sleepH = +v || 8);
    num('#t-k', v => Store.s.settings.targets.kcal = +v || 2400);
    num('#t-p', v => Store.s.settings.targets.protein = +v || 150);
    num('#t-c', v => Store.s.settings.targets.carbs = +v || 250);
    num('#t-f', v => Store.s.settings.targets.fat = +v || 70);
    num('#t-w', v => Store.s.settings.targets.waterMl = Math.round(Units.imperial ? +v * 236.588 : +v * 1000));

    $('#p-hot', root).onchange = e => { Store.s.profile.hotClimate = e.target.checked; commit(); this.draw(s); };
    $('#t-auto', root).onchange = e => {
      Store.s.settings.autoTargets = e.target.checked;
      if (e.target.checked) {
        const m = Calc.macroTargets(Store.s.profile);
        Store.s.settings.targets = Object.assign(Store.s.settings.targets, m, { waterMl: Calc.waterTarget(Store.s.profile, 60) });
      }
      commit(); this.draw(s);
    };

    $$('#u-seg button', root).forEach(b => b.onclick = () => {
      Store.s.settings.units = b.dataset.u; commit(); this.draw(s);
      toast('Units switched to ' + b.dataset.u, 'good');
    });
    $$('#th-seg button', root).forEach(b => b.onclick = () => {
      Store.s.settings.theme = b.dataset.t; Store.save(); App.applyTheme(); this.draw(s);
    });

    $('#b-export', root).onclick = () => Backup.export();
    $('#b-import', root).onclick = () => $('#b-file', root).click();
    $('#b-file', root).onchange = e => {
      const f = e.target.files[0];
      if (f) Backup.import(f, () => { s.close(); App.render(); });
      e.target.value = '';
    };

    $('#b-clearday', root).onclick = async () => {
      const ok = await confirmSheet('Clear this day', `Delete everything logged on ${prettyDate(App.date)}?`, 'Clear day', true);
      if (!ok) return;
      delete Store.s.days[App.date];
      Store.save(); s.close(); App.render();
      toast('Day cleared', 'good');
    };
    $('#b-wipe', root).onclick = async () => {
      const ok = await confirmSheet('Erase everything',
        'This deletes every workout, meal, water entry, night of sleep, custom food and recipe from this browser. Export a backup first if you might want it back.',
        'Erase everything', true);
      if (!ok) return;
      Store.reset(); s.close(); App.render();
      toast('All data erased', 'warn');
    };
  }
};

/* ==========================================================================
   Backup & restore
   ========================================================================== */
const Backup = {

  filename() {
    const n = (Store.s.profile.name || 'fitlog').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `${n || 'fitlog'}-backup-${todayKey()}.json`;
  },

  export() {
    const payload = {
      app: 'FitLog',
      schema: SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      days: Object.keys(Store.s.days).length,
      data: Store.s
    };
    download(this.filename(), JSON.stringify(payload, null, 2), 'application/json');
    Store.s.meta.lastBackup = new Date().toISOString();
    Store.save();
    toast('Backup downloaded', 'good');
  },

  import(file, done) {
    const r = new FileReader();
    r.onload = async () => {
      let parsed;
      try { parsed = JSON.parse(r.result); }
      catch (e) { return toast('That file is not a valid FitLog backup', 'bad'); }

      const data = parsed && parsed.data ? parsed.data : parsed;
      if (!data || typeof data !== 'object' || !data.days) return toast('No FitLog data found in that file', 'bad');

      const incomingDays = Object.keys(data.days).length;
      const existingDays = Store.loggedDays().length;

      const choice = await this.restoreChoice(incomingDays, existingDays, parsed.exportedAt);
      if (!choice) return;

      if (choice === 'replace') {
        // restamp so a deliberate restore also wins over whatever is in the cloud
        Store.replaceAll(data, { restamp: true });
        toast(`Restored ${incomingDays} days`, 'good');
      } else {
        // merge: incoming days win on conflict, everything else is unioned
        const merged = JSON.parse(JSON.stringify(Store.s));
        Object.entries(data.days).forEach(([k, v]) => { merged.days[k] = v; });
        const ids = new Set(merged.customFoods.map(f => f.id));
        (data.customFoods || []).forEach(f => { if (!ids.has(f.id)) merged.customFoods.push(f); });
        const rids = new Set(merged.recipes.map(x => x.id));
        (data.recipes || []).forEach(x => { if (!rids.has(x.id)) merged.recipes.push(x); });
        const sids = new Set(merged.customSleepFields.map(x => x.id));
        (data.customSleepFields || []).forEach(x => { if (!sids.has(x.id)) merged.customSleepFields.push(x); });
        Store.replaceAll(merged, { restamp: true });
        toast(`Merged ${incomingDays} days into your log`, 'good');
      }
      if (done) done();
    };
    r.readAsText(file);
  },

  restoreChoice(incoming, existing, exportedAt) {
    return new Promise(resolve => {
      let answered = false;
      const s = openSheet({
        title: 'Restore backup',
        body: `
          <div class="kv"><span class="kk">Days in the file</span><span class="vv">${incoming}</span></div>
          <div class="kv"><span class="kk">Days already in this browser</span><span class="vv">${existing}</span></div>
          ${exportedAt ? `<div class="kv"><span class="kk">Backup taken</span><span class="vv">${esc(new Date(exportedAt).toLocaleString())}</span></div>` : ''}
          <div class="section-title">How should it be applied?</div>
          <div class="list">
            <div class="row click" data-c="merge"><div class="grow">
              <div class="t">Merge</div><div class="s">Keep what is here and add the file's days. Same-date days are taken from the file.</div>
            </div>${icon('layers')}</div>
            <div class="row click" data-c="replace"><div class="grow">
              <div class="t">Replace everything</div><div class="s">Wipe this browser's log and use the file exactly as it is.</div>
            </div>${icon('refresh')}</div>
          </div>`,
        onClose: () => { if (!answered) resolve(null); }
      });
      $$('[data-c]', s.sheet).forEach(b => b.onclick = () => { answered = true; s.close(); resolve(b.dataset.c); });
    });
  }
};
