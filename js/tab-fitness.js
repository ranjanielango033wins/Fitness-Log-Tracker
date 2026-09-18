/* ==========================================================================
   FitLog — Fitness tab
   Date/time header (editable) -> Upper / Lower / Cardio sections ->
   muscle groups -> exercises -> set-by-set logging.
   ========================================================================== */

const Fitness = {
  section: 'upper',
  restTimer: null,

  render(host) {
    const k = App.date;
    const day = Store.day(k);
    const p = Store.s.profile;
    const w = Calc.workoutSummary(day, p.weightKg);
    const entries = day.workout.entries || [];
    const secEntries = entries.filter(e => e.section === this.section);

    host.innerHTML = `
      ${this.headerHtml(k, day)}
      ${this.summaryHtml(w, entries.length)}

      <div class="seg wide" id="sec-seg" style="margin-bottom:14px">
        ${Object.values(EX_LIB).map(s => `
          <button data-sec="${s.id}" class="${this.section === s.id ? 'active' : ''}">
            ${s.label}${entries.filter(e => e.section === s.id).length ? ` <span class="mono" style="opacity:.7">${entries.filter(e => e.section === s.id).length}</span>` : ''}
          </button>`).join('')}
      </div>

      <div id="ex-list">
        ${secEntries.length
          ? secEntries.map(e => this.entryHtml(e, day)).join('')
          : `<div class="card"><div class="empty">
               ${icon('fitness')}
               <b>No ${EX_LIB[this.section].label.toLowerCase()} logged yet</b>
               <div class="small">${esc(EX_LIB[this.section].blurb)}</div>
               <div style="margin-top:14px"><button class="btn primary" data-add>${icon('plus')} Add exercise</button></div>
             </div></div>`}
      </div>

      ${secEntries.length ? `<button class="btn block" data-add style="margin-bottom:14px">${icon('plus')} Add ${EX_LIB[this.section].label} exercise</button>` : ''}

      ${entries.length ? this.notesHtml(day) : ''}
      ${this.recentHtml(k)}
    `;

    $$('#sec-seg button', host).forEach(b => b.onclick = () => { this.section = b.dataset.sec; App.render(); });
    $$('[data-add]', host).forEach(b => b.onclick = () => this.openPicker());
    this.bindHeader(host, k, day);
    this.bindEntries(host, k);
  },

  /* ---------- header ---------- */
  headerHtml(k, day) {
    const isToday = k === todayKey();
    const started = day.workout.startedAt;
    const timeTxt = started
      ? `Session started ${esc(started)}`
      : (isToday ? `Now ${nowTime()}` : 'No session time set');
    return `
      <div class="date-head">
        <button class="btn ghost icon" data-nav="-1" title="Previous day">${icon('left')}</button>
        <div class="dh-main">
          <div class="dh-d">${esc(prettyDate(k, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}
            ${isToday ? '<span class="today-badge">Today</span>' : ''}</div>
          <div class="dh-t">${icon('clock', 'inline-ic')} ${timeTxt}</div>
        </div>
        <button class="btn ghost icon" data-edit-head title="Edit date &amp; time">${icon('edit')}</button>
        <button class="btn ghost icon" data-nav="1" title="Next day">${icon('right')}</button>
      </div>`;
  },

  bindHeader(host, k, day) {
    $$('[data-nav]', host).forEach(b => b.onclick = () => App.goDate(addDays(k, +b.dataset.nav)));
    const ed = $('[data-edit-head]', host);
    if (ed) ed.onclick = () => this.editHeader(k, day);
  },

  editHeader(k, day) {
    const s = openSheet({
      title: 'Session date & time',
      body: `
        <label class="fld"><span>Date</span><input type="date" id="f-date" value="${k}"></label>
        <div class="fld-row">
          <label class="fld"><span>Start time</span><input type="time" id="f-start" value="${day.workout.startedAt || ''}"></label>
          <label class="fld"><span>End time</span><input type="time" id="f-end" value="${day.workout.endedAt || ''}"></label>
        </div>
        <div class="btn-row" style="margin-bottom:12px">
          <button class="btn sm" id="f-now-start">Start = now</button>
          <button class="btn sm" id="f-now-end">End = now</button>
          <button class="btn sm" id="f-clear-times">Clear times</button>
        </div>
        <label class="fld"><span>Session note (how it felt, injuries, PBs)</span>
          <textarea id="f-note" rows="3" placeholder="e.g. Felt strong, bumped bench to 82.5 kg">${esc(day.workout.note || '')}</textarea></label>
        <label class="fld"><span>Bodyweight today (${Units.wLabel()}) — optional</span>
          <input type="number" step="0.1" id="f-bw" value="${day.weightKg ? round(Units.wOut(day.weightKg), 1) : ''}" placeholder="${round(Units.wOut(Store.s.profile.weightKg), 1)}"></label>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="f-save">Save</button>`
    });
    $('#f-now-start', s.sheet).onclick = () => { $('#f-start', s.sheet).value = nowTime(); };
    $('#f-now-end', s.sheet).onclick = () => { $('#f-end', s.sheet).value = nowTime(); };
    $('#f-clear-times', s.sheet).onclick = () => { $('#f-start', s.sheet).value = ''; $('#f-end', s.sheet).value = ''; };
    $('#f-save', s.sheet).onclick = () => {
      const newKey = $('#f-date', s.sheet).value || k;
      const d = Store.day(k, true);
      d.workout.startedAt = $('#f-start', s.sheet).value || null;
      d.workout.endedAt = $('#f-end', s.sheet).value || null;
      d.workout.note = $('#f-note', s.sheet).value.trim();
      const bw = $('#f-bw', s.sheet).value;
      d.weightKg = bw ? round(Units.wIn(+bw), 2) : null;
      if (newKey !== k) {
        // move the whole day's workout to the new date
        const target = Store.day(newKey, true);
        target.workout = d.workout;
        d.workout = blankDay().workout;
        App.date = newKey;
      }
      Store.save();
      s.close();
      App.render();
      toast('Session updated', 'good');
    };
  },

  /* ---------- summary ---------- */
  summaryHtml(w, total) {
    if (!total) return '';
    const p = Store.s.profile;
    return `<div class="card">
      <div class="card-head"><h2>Session total</h2>
        <span class="pill">${w.entries} exercise${w.entries === 1 ? '' : 's'}</span></div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Volume</div><div class="v">${fmtNum(Units.wOut(w.volumeKg))}<small>${Units.wLabel()}</small></div></div>
        <div class="stat"><div class="k">Sets</div><div class="v">${w.sets}</div><div class="d dim">${w.reps} reps</div></div>
        <div class="stat"><div class="k">Time</div><div class="v">${fmtMin(w.minutes)}</div></div>
        <div class="stat"><div class="k">Energy</div><div class="v">${fmtNum(w.kcal)}<small>kcal</small></div></div>
        <div class="stat"><div class="k">Load</div><div class="v">${fmtNum(w.load)}</div><div class="d dim">sRPE units</div></div>
        ${w.avgRpe ? `<div class="stat"><div class="k">Avg RPE</div><div class="v">${w.avgRpe}</div></div>` : ''}
        ${w.distanceKm ? `<div class="stat"><div class="k">Distance</div><div class="v">${fmtNum(Units.dOut(w.distanceKm), 2)}<small>${Units.dLabel()}</small></div></div>` : ''}
      </div>
    </div>`;
  },

  notesHtml(day) {
    if (!day.workout.note) return '';
    return `<div class="card"><div class="card-head"><h3>Session note</h3></div>
      <p class="muted" style="margin:0">${esc(day.workout.note)}</p></div>`;
  },

  /* ---------- entry card ---------- */
  entryHtml(e, day) {
    const prs = App.prCache || {};
    const pr = prs[e.exercise];
    const best = Calc.entryBestE1rm(e);
    const isPrToday = pr && best && round(best, 1) >= round(pr.e1rm, 1) && pr.date === App.date;

    if (e.mode === 'cardio') return this.cardioEntryHtml(e, isPrToday);

    const isTime = e.mode === 'time';
    const rows = (e.sets || []).map((s, i) => `
      <tr class="${s.done ? 'done' : ''}" data-set="${i}">
        <td><div class="set-no ${s.type || ''}" data-settype="${i}" title="Tap to change set type">${s.type === 'warmup' ? 'W' : s.type === 'drop' ? 'D' : s.type === 'failure' ? 'F' : (i + 1)}</div></td>
        ${isTime
          ? `<td><input type="number" inputmode="numeric" data-f="sec" value="${s.sec || ''}" placeholder="60"></td>`
          : `<td><input type="number" inputmode="decimal" step="0.5" data-f="w" value="${s.w != null ? round(Units.wOut(s.w), 2) : ''}" placeholder="0"></td>`}
        <td><input type="number" inputmode="numeric" data-f="r" value="${s.r || ''}" placeholder="${isTime ? '–' : '0'}" ${isTime ? 'disabled' : ''}></td>
        <td><input type="number" inputmode="decimal" step="0.5" min="1" max="10" data-f="rpe" value="${s.rpe || ''}" placeholder="–"></td>
        <td><div class="chk ${s.done ? 'on' : ''}" data-done="${i}">${s.done ? icon('check') : ''}</div></td>
      </tr>`).join('');

    return `
    <div class="ex-card" data-entry="${e.id}">
      <div class="ex-head">
        <div class="grow">
          <div class="nm">${esc(e.exercise)}${isPrToday ? ' <span class="pill pr">PR</span>' : ''}</div>
          <div class="mg">${esc(e.groupName)} · ${esc(e.eq || '')}</div>
        </div>
        <button class="btn ghost icon sm" data-menu="${e.id}">${icon('edit')}</button>
      </div>
      <div class="ex-body">
        <table class="set-table">
          <thead><tr>
            <th>Set</th>
            <th>${isTime ? 'Sec' : Units.wLabel()}</th>
            <th>Reps</th>
            <th>RPE</th>
            <th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="btn-row" style="margin-top:9px">
          <button class="btn sm" data-addset="${e.id}">${icon('plus')} Set</button>
          ${(e.sets || []).length > 1 ? `<button class="btn sm ghost" data-delset="${e.id}">${icon('minus')} Set</button>` : ''}
          <button class="btn sm ghost" data-rest="${e.id}">${icon('timer')} Rest ${e.restSec || Store.s.settings.restTimerSec}s</button>
        </div>
      </div>
      <div class="ex-foot">
        <span class="pill">Vol ${fmtNum(Units.wOut(Calc.entryVolume(e)))} ${Units.wLabel()}</span>
        ${best ? `<span class="pill">e1RM ${fmtNum(Units.wOut(best), 1)} ${Units.wLabel()}</span>` : ''}
        <span class="pill">${Calc.entrySets(e)} × ${Calc.entryReps(e)} reps</span>
        ${pr && !isPrToday ? `<span class="dim tiny nowrap">Best ${fmtNum(Units.wOut(pr.e1rm), 1)} ${Units.wLabel()} · ${shortDate(pr.date)}</span>` : ''}
      </div>
    </div>`;
  },

  cardioEntryHtml(e) {
    const p = Store.s.profile;
    const kcal = Calc.entryKcal(e, p.weightKg);
    const pace = (e.distance && e.duration) ? round(e.duration / Units.dOut(e.distance), 2) : null;
    return `
    <div class="ex-card" data-entry="${e.id}">
      <div class="ex-head">
        <div class="grow">
          <div class="nm">${esc(e.exercise)}</div>
          <div class="mg">${esc(e.groupName)} · MET ${e.met}</div>
        </div>
        <button class="btn ghost icon sm" data-menu="${e.id}">${icon('edit')}</button>
      </div>
      <div class="ex-body">
        <div class="grid-2">
          <label class="fld"><span>Duration (min)</span>
            <input type="number" inputmode="numeric" data-cf="duration" value="${e.duration || ''}" placeholder="30"></label>
          <label class="fld"><span>Distance (${Units.dLabel()})</span>
            <input type="number" inputmode="decimal" step="0.01" data-cf="distance" value="${e.distance != null ? round(Units.dOut(e.distance), 2) : ''}" placeholder="5"></label>
          <label class="fld"><span>Avg heart rate (bpm)</span>
            <input type="number" inputmode="numeric" data-cf="hr" value="${e.hr || ''}" placeholder="140"></label>
          <label class="fld"><span>Intensity / RPE (1–10)</span>
            <input type="number" inputmode="decimal" step="0.5" min="1" max="10" data-cf="rpe" value="${e.rpe || ''}" placeholder="6"></label>
        </div>
      </div>
      <div class="ex-foot">
        <span class="pill">${fmtMin(e.duration || 0)}</span>
        ${e.distance ? `<span class="pill">${fmtNum(Units.dOut(e.distance), 2)} ${Units.dLabel()}</span>` : ''}
        ${pace ? `<span class="pill">${pace} min/${Units.dLabel()}</span>` : ''}
        <span class="pill">${fmtNum(kcal)} kcal</span>
        <span class="pill">Load ${Calc.entryLoad(e)}</span>
      </div>
    </div>`;
  },

  /* ---------- entry interactions ---------- */
  bindEntries(host, k) {
    const day = Store.day(k, false);
    const findEntry = id => (Store.day(k, true).workout.entries || []).find(e => e.id === id);

    $$('[data-entry]', host).forEach(card => {
      const id = card.dataset.entry;

      // set field edits
      $$('.set-table input', card).forEach(inp => {
        inp.addEventListener('change', () => {
          const e = findEntry(id); if (!e) return;
          const i = +inp.closest('tr').dataset.set;
          const f = inp.dataset.f;
          const raw = inp.value === '' ? null : +inp.value;
          if (f === 'w') e.sets[i].w = raw == null ? null : round(Units.wIn(raw), 3);
          else e.sets[i][f] = raw;
          if (raw != null && !e.sets[i].done && (f === 'w' || f === 'r' || f === 'sec')) {
            const s = e.sets[i];
            if ((s.w != null && s.r) || s.sec) { /* leave for explicit tick */ }
          }
          Store.save(); App.refreshSoft();
        });
      });

      // tick a set done
      $$('[data-done]', card).forEach(btn => btn.onclick = () => {
        const e = findEntry(id); if (!e) return;
        const i = +btn.dataset.done;
        const s = e.sets[i];
        s.done = !s.done;
        if (s.done) {
          // carry forward last values if blank
          if (e.mode !== 'time' && s.w == null && i > 0) s.w = e.sets[i - 1].w;
          if (e.mode !== 'time' && !s.r && i > 0) s.r = e.sets[i - 1].r;
          if (e.mode === 'time' && !s.sec && i > 0) s.sec = e.sets[i - 1].sec;
          if (Store.s.settings.restTimerAuto) Fitness.startRest(e.restSec || Store.s.settings.restTimerSec);
        }
        Store.save(); App.render();
      });

      // set type cycling
      $$('[data-settype]', card).forEach(btn => btn.onclick = () => {
        const e = findEntry(id); if (!e) return;
        const i = +btn.dataset.settype;
        const cycle = [null, 'warmup', 'drop', 'failure'];
        const cur = cycle.indexOf(e.sets[i].type || null);
        e.sets[i].type = cycle[(cur + 1) % cycle.length];
        Store.save(); App.render();
      });

      // cardio fields
      $$('[data-cf]', card).forEach(inp => inp.addEventListener('change', () => {
        const e = findEntry(id); if (!e) return;
        const f = inp.dataset.cf;
        const raw = inp.value === '' ? null : +inp.value;
        e[f] = f === 'distance' ? (raw == null ? null : round(Units.dIn(raw), 3)) : raw;
        Store.save(); App.render();
      }));

      const addSet = $(`[data-addset="${id}"]`, card);
      if (addSet) addSet.onclick = () => {
        const e = findEntry(id); if (!e) return;
        const last = e.sets[e.sets.length - 1] || {};
        e.sets.push({ w: last.w ?? null, r: last.r ?? null, sec: last.sec ?? null, rpe: null, done: false, type: null });
        Store.save(); App.render();
      };

      const delSet = $(`[data-delset="${id}"]`, card);
      if (delSet) delSet.onclick = () => {
        const e = findEntry(id); if (!e || e.sets.length < 2) return;
        e.sets.pop(); Store.save(); App.render();
      };

      const rest = $(`[data-rest="${id}"]`, card);
      if (rest) rest.onclick = () => this.restSheet(findEntry(id));

      const menu = $(`[data-menu="${id}"]`, card);
      if (menu) menu.onclick = () => this.entryMenu(findEntry(id), k);
    });
  },

  entryMenu(e, k) {
    if (!e) return;
    const s = openSheet({
      title: e.exercise,
      body: `
        <div class="list">
          <div class="row click" id="m-dup">${icon('copy')}<div><div class="t">Duplicate exercise</div><div class="s">Add another block of the same movement</div></div></div>
          <div class="row click" id="m-prev">${icon('trend')}<div><div class="t">History &amp; progress</div><div class="s">Every logged session for this exercise</div></div></div>
          <div class="row click" id="m-note">${icon('edit')}<div><div class="t">Exercise note</div><div class="s">${e.note ? esc(e.note) : 'Add a cue or setup reminder'}</div></div></div>
          <div class="row click" id="m-del" style="color:var(--bad)">${icon('trash')}<div><div class="t">Remove from session</div></div></div>
        </div>`
    });
    $('#m-dup', s.sheet).onclick = () => {
      const day = Store.day(k, true);
      const copy = JSON.parse(JSON.stringify(e));
      copy.id = uid();
      copy.sets = copy.sets.map(x => Object.assign({}, x, { done: false }));
      day.workout.entries.push(copy);
      Store.save(); s.close(); App.render();
    };
    $('#m-prev', s.sheet).onclick = () => { s.close(); this.historySheet(e.exercise); };
    $('#m-note', s.sheet).onclick = () => {
      s.close();
      const n = openSheet({
        title: 'Exercise note',
        body: `<label class="fld"><span>Note</span><textarea id="en" rows="3" placeholder="e.g. pause 1s on chest, feet tucked">${esc(e.note || '')}</textarea></label>`,
        foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="ens">Save</button>`
      });
      $('#ens', n.sheet).onclick = () => { e.note = $('#en', n.sheet).value.trim(); Store.save(); n.close(); App.render(); };
    };
    $('#m-del', s.sheet).onclick = async () => {
      s.close();
      const ok = await confirmSheet('Remove exercise', `Remove ${e.exercise} from this session?`, 'Remove', true);
      if (!ok) return;
      const day = Store.day(k, true);
      day.workout.entries = day.workout.entries.filter(x => x.id !== e.id);
      Store.save(); App.render();
    };
  },

  historySheet(name) {
    const rows = [];
    Object.keys(Store.s.days).sort().reverse().forEach(k => {
      ((Store.s.days[k].workout || {}).entries || []).forEach(e => {
        if (e.exercise !== name) return;
        rows.push({ k, e });
      });
    });
    const meta = EX_BY_NAME[name];
    const chartVals = rows.slice(0, 14).reverse().map(r => round(Units.wOut(Calc.entryBestE1rm(r.e)), 1));
    const chartLabels = rows.slice(0, 14).reverse().map(r => shortDate(r.k));
    openSheet({
      title: name,
      wide: true,
      body: `
        ${rows.length > 2 && meta && meta.mode !== 'cardio' ? `<div class="card"><div class="card-head"><h3>Estimated 1RM trend</h3></div>
          ${lineChart(chartLabels, [{ label: 'e1RM', color: CHART_COLORS.train, values: chartVals }], { area: true })}</div>` : ''}
        ${rows.length ? `<div class="card flush"><div class="list">
          ${rows.slice(0, 40).map(r => {
            const e = r.e;
            const detail = e.mode === 'cardio'
              ? `${fmtMin(e.duration || 0)}${e.distance ? ' · ' + fmtNum(Units.dOut(e.distance), 2) + ' ' + Units.dLabel() : ''}`
              : (e.sets || []).filter(s => s.done).map(s => e.mode === 'time' ? `${s.sec}s` : `${round(Units.wOut(s.w || 0), 1)}×${s.r || 0}`).join(', ');
            return `<div class="row"><div class="grow">
              <div class="t">${esc(prettyDate(r.k, { day: 'numeric', month: 'short', year: 'numeric' }))}</div>
              <div class="s mono">${esc(detail || '—')}</div></div>
              <div class="rt"><div class="t mono">${fmtNum(Units.wOut(Calc.entryVolume(e)))} ${Units.wLabel()}</div>
              <div class="s">${e.mode === 'cardio' ? '' : 'e1RM ' + fmtNum(Units.wOut(Calc.entryBestE1rm(e)), 1)}</div></div></div>`;
          }).join('')}
        </div></div>` : `<div class="empty">${icon('book')}<b>No history yet</b><div class="small">Log this exercise a few times to see progress</div></div>`}`
    });
  },

  /* ---------- rest timer ---------- */
  restSheet(e) {
    if (!e) return;
    const cur = e.restSec || Store.s.settings.restTimerSec;
    const s = openSheet({
      title: 'Rest timer',
      body: `
        <label class="fld"><span>Rest between sets (seconds)</span>
          <input type="number" id="rs" value="${cur}" step="15"></label>
        <div class="chips" style="margin-bottom:14px">
          ${[45, 60, 90, 120, 150, 180, 240].map(v => `<button class="chip" data-rs="${v}">${v}s</button>`).join('')}
        </div>
        <label class="switch"><input type="checkbox" id="rauto" ${Store.s.settings.restTimerAuto ? 'checked' : ''}><span class="track"></span>
          <span>Start automatically when a set is ticked</span></label>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="rsave">Save &amp; start</button>`
    });
    $$('[data-rs]', s.sheet).forEach(b => b.onclick = () => { $('#rs', s.sheet).value = b.dataset.rs; });
    $('#rsave', s.sheet).onclick = () => {
      e.restSec = +$('#rs', s.sheet).value || 90;
      Store.s.settings.restTimerAuto = $('#rauto', s.sheet).checked;
      Store.save(); s.close(); App.render();
      this.startRest(e.restSec);
    };
  },

  startRest(sec) {
    this.stopRest();
    let left = sec;
    const bar = el('div', { class: 'card', id: 'rest-bar' });
    bar.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--tabbar-h) + 14px + env(safe-area-inset-bottom,0px));z-index:60;margin:0;padding:10px 14px;display:flex;align-items:center;gap:12px;box-shadow:var(--shadow);width:max-content;max-width:92vw';
    bar.innerHTML = `<span style="color:var(--acc)">${icon('timer')}</span>
      <b class="mono" id="rest-n" style="font-size:19px">${left}s</b>
      <button class="btn xs" id="rest-plus">+30s</button>
      <button class="btn xs ghost" id="rest-x">Skip</button>`;
    document.body.appendChild(bar);
    $('#rest-plus', bar).onclick = () => { left += 30; $('#rest-n', bar).textContent = left + 's'; };
    $('#rest-x', bar).onclick = () => this.stopRest();
    this.restTimer = setInterval(() => {
      left--;
      const n = $('#rest-n');
      if (n) n.textContent = left + 's';
      if (left <= 0) {
        this.stopRest();
        toast('Rest done — next set', 'good');
        try {
          const ctx = new (window.AudioContext || window.webkitAudioContext)();
          const o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = 880; g.gain.value = 0.08;
          o.start(); setTimeout(() => { o.stop(); ctx.close(); }, 180);
        } catch (err) { /* audio blocked — silent */ }
        if (navigator.vibrate) navigator.vibrate(200);
      }
    }, 1000);
  },

  stopRest() {
    if (this.restTimer) clearInterval(this.restTimer);
    this.restTimer = null;
    const b = $('#rest-bar'); if (b) b.remove();
  },

  /* ---------- exercise picker ---------- */
  openPicker() {
    const sec = EX_LIB[this.section];
    let group = null, q = '';
    const s = openSheet({ title: `Add ${sec.label} exercise`, wide: true, body: '<div id="pk"></div>' });

    const draw = () => {
      const pk = $('#pk', s.sheet);
      let list;
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        list = EX_FLAT.filter(e => e.name.toLowerCase().includes(t) || e.groupName.toLowerCase().includes(t));
      } else {
        list = EX_FLAT.filter(e => e.section === sec.id && (!group || e.groupId === group));
      }
      const recent = this.recentExercises(sec.id);
      pk.innerHTML = `
        <div class="search-wrap">${icon('search')}
          <input id="pq" placeholder="Search all exercises…" value="${esc(q)}" autocomplete="off"></div>
        ${q.trim() ? '' : `
          <div class="section-title">Muscle group</div>
          <div class="chips" style="margin-bottom:14px">
            <button class="chip ${!group ? 'active' : ''}" data-g="">All</button>
            ${sec.groups.map(g => `<button class="chip ${group === g.id ? 'active' : ''}" data-g="${g.id}">${esc(g.name)}</button>`).join('')}
          </div>
          ${recent.length && !group ? `<div class="section-title">Recent</div>
            <div class="chips" style="margin-bottom:6px">
              ${recent.map(n => `<button class="chip" data-quick="${esc(n)}">${esc(n)}</button>`).join('')}
            </div>` : ''}`}
        <div class="section-title">${q.trim() ? `${list.length} match${list.length === 1 ? '' : 'es'}` : 'Exercises'}</div>
        <div class="card flush"><div class="list">
          ${list.map(e => `<div class="row click" data-pick="${esc(e.name)}">
            <div class="grow"><div class="t">${esc(e.name)}</div>
            <div class="s">${esc(e.groupName)} · ${esc(e.eq)}${q.trim() ? ' · ' + esc(e.sectionLabel) : ''}</div></div>
            ${icon('plus')}</div>`).join('') || '<div class="empty small">Nothing matched</div>'}
        </div></div>
        <button class="btn block ghost" id="pk-custom" style="margin-top:12px">${icon('plus')} Add a custom exercise</button>`;

      const qi = $('#pq', pk);
      qi.oninput = () => { q = qi.value; const at = qi.selectionStart; draw(); const n = $('#pq', s.sheet); n.focus(); n.setSelectionRange(at, at); };
      $$('[data-g]', pk).forEach(b => b.onclick = () => { group = b.dataset.g || null; draw(); });
      $$('[data-pick]', pk).forEach(b => b.onclick = () => { this.addExercise(b.dataset.pick); s.close(); });
      $$('[data-quick]', pk).forEach(b => b.onclick = () => { this.addExercise(b.dataset.quick); s.close(); });
      $('#pk-custom', pk).onclick = () => { s.close(); this.customExerciseSheet(); };
    };
    draw();
  },

  recentExercises(section) {
    const seen = [];
    Object.keys(Store.s.days).sort().reverse().slice(0, 40).forEach(k => {
      ((Store.s.days[k].workout || {}).entries || []).forEach(e => {
        if (e.section === section && !seen.includes(e.exercise) && seen.length < 8) seen.push(e.exercise);
      });
    });
    return seen;
  },

  customExerciseSheet() {
    const sec = EX_LIB[this.section];
    const s = openSheet({
      title: 'Custom exercise',
      body: `
        <label class="fld"><span>Exercise name</span><input id="cx-n" placeholder="e.g. Reverse Nordic Curl"></label>
        <label class="fld"><span>Muscle group</span><select id="cx-g">
          ${sec.groups.map(g => `<option value="${g.id}">${esc(g.name)}</option>`).join('')}</select></label>
        <div class="fld-row">
          <label class="fld"><span>Logging type</span><select id="cx-m">
            <option value="strength">Weight × reps</option>
            <option value="bodyweight">Reps only</option>
            <option value="time">Time held</option>
            ${sec.id === 'cardio' ? '<option value="cardio" selected>Duration / distance</option>' : ''}
          </select></label>
          <label class="fld"><span>Equipment</span><input id="cx-e" placeholder="Barbell" value="Other"></label>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="cx-s">Add</button>`
    });
    $('#cx-s', s.sheet).onclick = () => {
      const name = $('#cx-n', s.sheet).value.trim();
      if (!name) return toast('Give the exercise a name', 'warn');
      const gid = $('#cx-g', s.sheet).value;
      const g = sec.groups.find(x => x.id === gid);
      const mode = $('#cx-m', s.sheet).value;
      this.addExercise(name, {
        section: sec.id, groupId: gid, groupName: g.name, mode,
        eq: $('#cx-e', s.sheet).value.trim() || 'Other',
        met: mode === 'cardio' ? 7 : 5
      });
      s.close();
    };
  },

  addExercise(name, override) {
    const meta = override || EX_BY_NAME[name];
    if (!meta) return toast('Exercise not found', 'bad');
    const day = Store.day(App.date, true);
    if (!day.workout.startedAt && App.date === todayKey()) day.workout.startedAt = nowTime();

    // pre-fill from the most recent time this exercise was logged
    const prev = this.lastEntryFor(name);
    const entry = {
      id: uid(),
      section: meta.section, group: meta.groupId, groupName: meta.groupName,
      exercise: name, eq: meta.eq, mode: meta.mode, met: meta.met,
      note: '', restSec: Store.s.settings.restTimerSec
    };
    if (meta.mode === 'cardio') {
      entry.duration = null; entry.distance = null; entry.hr = null; entry.rpe = null;
    } else {
      entry.sets = prev && prev.sets
        ? prev.sets.map(s => ({ w: s.w, r: s.r, sec: s.sec, rpe: null, done: false, type: s.type || null }))
        : [0, 1, 2].map(() => ({ w: null, r: null, sec: null, rpe: null, done: false, type: null }));
    }
    day.workout.entries.push(entry);
    this.section = meta.section;
    Store.save(); App.render();
    toast(prev ? `${name} added — last session pre-filled` : `${name} added`, 'good');
  },

  lastEntryFor(name) {
    const keys = Object.keys(Store.s.days).sort().reverse();
    for (const k of keys) {
      if (k === App.date) continue;
      const hit = ((Store.s.days[k].workout || {}).entries || []).find(e => e.exercise === name);
      if (hit) return hit;
    }
    return null;
  },

  /* ---------- recent sessions ---------- */
  recentHtml(k) {
    const keys = Object.keys(Store.s.days)
      .filter(d => d !== k && ((Store.s.days[d].workout || {}).entries || []).length)
      .sort().reverse().slice(0, 5);
    if (!keys.length) return '';
    return `<div class="card flush">
      <div class="card-head" style="padding:14px 16px 4px;margin:0"><h3>Recent sessions</h3></div>
      <div class="list">
        ${keys.map(d => {
          const w = Calc.workoutSummary(Store.s.days[d], Store.s.profile.weightKg);
          const groups = [...new Set((Store.s.days[d].workout.entries || []).map(e => e.groupName))].slice(0, 3).join(', ');
          return `<div class="row click" data-go="${d}">
            <div class="grow"><div class="t">${esc(prettyDate(d, { weekday: 'short', day: 'numeric', month: 'short' }))}</div>
            <div class="s">${esc(groups)}</div></div>
            <div class="rt"><div class="t mono">${fmtNum(Units.wOut(w.volumeKg))} ${Units.wLabel()}</div>
            <div class="s">${w.sets} sets · ${fmtMin(w.minutes)}</div></div></div>`;
        }).join('')}
      </div></div>`;
  }
};

/* delegate recent-session navigation */
document.addEventListener('click', e => {
  const r = e.target.closest('[data-go]');
  if (r && typeof App !== 'undefined') App.goDate(r.dataset.go);
});
