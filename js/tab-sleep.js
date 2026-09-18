/* ==========================================================================
   FitLog — Sleep tab
   Bed/wake times drive every derived figure: time in bed, total sleep time,
   sleep efficiency, mid-sleep point, rolling debt and consistency.
   Users can add their own fields (caffeine, screen time, room temp, …).
   ========================================================================== */

const Sleep = {

  render(host) {
    const k = App.date;
    const day = Store.day(k);
    const t = Targets.current();
    const s = day.sleep || {};
    const m = Calc.sleepSummary(day);
    const last14 = rangeKeys(addDays(k, -13), 14);
    const debt = Calc.sleepDebt(last14, t.sleepH);
    const consistency = Calc.sleepConsistency(last14);

    host.innerHTML = `
      ${this.headerHtml(k)}

      <div class="card">
        <div class="sleep-clock">
          ${this.arcHtml(m, t.sleepH)}
        </div>
        <div class="fld-row">
          <label class="fld"><span>Went to bed</span><input type="time" id="s-bed" value="${s.bed || ''}"></label>
          <label class="fld"><span>Woke up</span><input type="time" id="s-wake" value="${s.wake || ''}"></label>
        </div>
        <div class="chips" style="margin-bottom:4px">
          <button class="chip g-sleep" data-preset="23:00|07:00">23:00 → 07:00</button>
          <button class="chip g-sleep" data-preset="23:30|07:30">23:30 → 07:30</button>
          <button class="chip g-sleep" data-preset="00:00|08:00">00:00 → 08:00</button>
          <button class="chip g-sleep" data-preset="01:00|09:00">01:00 → 09:00</button>
          ${s.bed || s.wake ? '<button class="chip" id="s-clear">Clear</button>' : ''}
        </div>
      </div>

      ${m ? this.metricsHtml(m, t) : `<div class="card"><div class="empty">${icon('moon')}
        <b>Set a bed and wake time</b><div class="small">Everything else is calculated from those two values</div></div></div>`}

      <div class="card">
        <div class="card-head"><h3>Sleep quality detail</h3></div>
        <div class="grid-2">
          <label class="fld"><span>Time to fall asleep (min)</span>
            <input type="number" inputmode="numeric" id="s-lat" value="${s.latencyMin != null ? s.latencyMin : ''}" placeholder="15"></label>
          <label class="fld"><span>Time awake in the night (min)</span>
            <input type="number" inputmode="numeric" id="s-awake" value="${s.awakeMin != null ? s.awakeMin : ''}" placeholder="0"></label>
          <label class="fld"><span>Times you woke up</span>
            <input type="number" inputmode="numeric" id="s-wakes" value="${s.awakenings != null ? s.awakenings : ''}" placeholder="0"></label>
          <label class="fld"><span>Naps today (min)</span>
            <input type="number" inputmode="numeric" id="s-nap" value="${(s.naps || []).reduce((a, n) => a + (n.min || 0), 0) || ''}" placeholder="0"></label>
        </div>
        <label class="fld"><span>How rested do you feel?</span></label>
        <div class="chips" style="margin-bottom:12px">
          ${[[1, 'Wrecked'], [2, 'Poor'], [3, 'OK'], [4, 'Good'], [5, 'Excellent']].map(([v, l]) =>
            `<button class="chip g-sleep ${s.quality === v ? 'active' : ''}" data-q="${v}">${l}</button>`).join('')}
        </div>
        <label class="fld"><span>Notes</span>
          <textarea id="s-note" rows="2" placeholder="e.g. late coffee, noisy street, woke before alarm">${esc(s.note || '')}</textarea></label>
      </div>

      ${this.customHtml(s)}

      ${this.trendHtml(k, t, debt, consistency)}
      ${this.adviceHtml(m, t, debt, consistency)}
    `;

    this.bind(host, k);
  },

  headerHtml(k) {
    const isToday = k === todayKey();
    return `<div class="date-head">
      <button class="btn ghost icon" data-nav="-1">${icon('left')}</button>
      <div class="dh-main">
        <div class="dh-d">Night before ${esc(prettyDate(k, { weekday: 'short', day: 'numeric', month: 'short' }))}
          ${isToday ? '<span class="today-badge">Today</span>' : ''}</div>
        <div class="dh-t">Log the sleep you woke up from on this date</div>
      </div>
      <button class="btn ghost icon" data-nav="1">${icon('right')}</button>
    </div>`;
  },

  arcHtml(m, targetH) {
    const hours = m ? m.totalHours : 0;
    const pct = Math.min(100, hours / targetH * 100);
    const col = !m ? CHART_COLORS.muted : hours >= targetH ? CHART_COLORS.diet : hours >= targetH - 1.5 ? CHART_COLORS.sleep : CHART_COLORS.warn;
    const r = 74, c = 2 * Math.PI * r;
    return `<div class="sleep-arc">
      <svg viewBox="0 0 168 168">
        <circle cx="84" cy="84" r="${r}" fill="none" stroke="var(--line)" stroke-width="11"/>
        <circle cx="84" cy="84" r="${r}" fill="none" stroke="${col}" stroke-width="11" stroke-linecap="round"
          stroke-dasharray="${round(c, 1)}" stroke-dashoffset="${round(c * (1 - pct / 100), 1)}"
          style="transition:stroke-dashoffset .5s ease"/>
      </svg>
      <div class="sc"><div>
        <b>${m ? fmtHours(m.totalHours) : '—'}</b>
        <span>${m ? `of ${targetH} h target` : 'no sleep logged'}</span>
      </div></div>
    </div>`;
  },

  metricsHtml(m, t) {
    const effCol = m.efficiency >= 85 ? 'var(--good)' : m.efficiency >= 75 ? 'var(--warn)' : 'var(--bad)';
    const mid = `${String(Math.floor(m.midSleep / 60)).padStart(2, '0')}:${String(Math.round(m.midSleep % 60)).padStart(2, '0')}`;
    return `<div class="card">
      <div class="card-head"><h3>Calculated</h3>
        <span class="pill">${m.bed} → ${m.wake}</span></div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Time in bed</div><div class="v">${fmtHours(m.tibMin / 60)}</div></div>
        <div class="stat"><div class="k">Asleep</div><div class="v">${fmtHours(m.tstMin / 60)}</div>
          ${m.napMin ? `<div class="d dim">+${m.napMin}m naps</div>` : ''}</div>
        <div class="stat"><div class="k">Efficiency</div><div class="v" style="color:${effCol}">${m.efficiency}<small>%</small></div>
          <div class="d dim">target ≥ 85%</div></div>
        <div class="stat"><div class="k">Mid-sleep</div><div class="v">${mid}</div>
          <div class="d dim">body-clock anchor</div></div>
        <div class="stat"><div class="k">vs target</div>
          <div class="v" style="color:${m.totalHours >= t.sleepH ? 'var(--good)' : 'var(--bad)'}">
            ${m.totalHours >= t.sleepH ? '+' : '−'}${fmtHours(Math.abs(m.totalHours - t.sleepH))}</div></div>
        ${m.awakenings ? `<div class="stat"><div class="k">Wake-ups</div><div class="v">${m.awakenings}</div></div>` : ''}
      </div>
      <div style="margin-top:12px">
        <div class="small muted" style="display:flex;justify-content:space-between;margin-bottom:5px">
          <span>Asleep</span><span>Falling asleep</span><span>Awake in bed</span></div>
        <div class="bar lg" style="display:flex">
          <i style="width:${m.tibMin ? m.tstMin / m.tibMin * 100 : 0}%;background:var(--sleep)"></i>
          <i style="width:${m.tibMin ? m.latency / m.tibMin * 100 : 0}%;background:var(--warn)"></i>
          <i style="width:${m.tibMin ? m.awake / m.tibMin * 100 : 0}%;background:var(--bad)"></i>
        </div>
      </div>
    </div>`;
  },

  customHtml(s) {
    const fields = Store.s.customSleepFields;
    return `<div class="card">
      <div class="card-head"><h3>Your own fields</h3>
        <button class="btn sm" id="s-addfield">${icon('plus')} Add field</button></div>
      ${fields.length ? `<div class="grid-2">
        ${fields.map(f => {
          const v = (s.custom || {})[f.id];
          if (f.type === 'scale') return `<label class="fld"><span>${esc(f.label)} (1–10)</span>
            <input type="number" min="1" max="10" data-cust="${f.id}" value="${v != null ? v : ''}"></label>`;
          if (f.type === 'text') return `<label class="fld"><span>${esc(f.label)}</span>
            <input type="text" data-cust="${f.id}" value="${esc(v || '')}"></label>`;
          if (f.type === 'time') return `<label class="fld"><span>${esc(f.label)}</span>
            <input type="time" data-cust="${f.id}" value="${esc(v || '')}"></label>`;
          if (f.type === 'yesno') return `<label class="fld"><span>${esc(f.label)}</span>
            <select data-cust="${f.id}"><option value="">–</option>
            <option value="yes" ${v === 'yes' ? 'selected' : ''}>Yes</option>
            <option value="no" ${v === 'no' ? 'selected' : ''}>No</option></select></label>`;
          return `<label class="fld"><span>${esc(f.label)}${f.unit ? ` (${esc(f.unit)})` : ''}</span>
            <input type="number" step="any" data-cust="${f.id}" value="${v != null ? v : ''}"></label>`;
        }).join('')}
      </div>
      <div class="chips" style="margin-top:4px">
        ${fields.map(f => `<button class="chip" data-rmfield="${f.id}">${icon('x')} ${esc(f.label)}</button>`).join('')}
      </div>`
      : `<p class="muted small" style="margin:0">Track anything else that affects your sleep — caffeine after 4pm, screen time,
         room temperature, alcohol, HRV from your watch. Added fields appear on every night and flow through to exports.</p>`}
    </div>`;
  },

  trendHtml(k, t, debt, consistency) {
    const keys = rangeKeys(addDays(k, -13), 14);
    const hours = keys.map(d => { const m = Calc.sleepSummary(Store.day(d)); return m ? m.totalHours : 0; });
    const effs = keys.map(d => { const m = Calc.sleepSummary(Store.day(d)); return m ? m.efficiency : null; });
    if (!hours.some(h => h)) return '';
    return `<div class="card">
      <div class="card-head"><h3>Last 14 nights</h3></div>
      <div class="stat-grid" style="margin-bottom:14px">
        <div class="stat"><div class="k">Sleep debt</div>
          <div class="v" style="color:${debt > 5 ? 'var(--bad)' : debt > 2 ? 'var(--warn)' : 'var(--good)'}">${debt}<small>h</small></div>
          <div class="d dim">vs ${t.sleepH}h/night</div></div>
        <div class="stat"><div class="k">Consistency</div>
          <div class="v" style="color:${scoreColor(consistency)}">${consistency == null ? '–' : consistency}</div>
          <div class="d dim">bed/wake regularity</div></div>
        <div class="stat"><div class="k">Avg duration</div>
          <div class="v">${fmtHours(hours.filter(h => h).reduce((a, b) => a + b, 0) / Math.max(1, hours.filter(h => h).length))}</div></div>
        <div class="stat"><div class="k">Avg efficiency</div>
          <div class="v">${fmtNum(effs.filter(e => e != null).reduce((a, b) => a + b, 0) / Math.max(1, effs.filter(e => e != null).length), 1)}<small>%</small></div></div>
      </div>
      ${barChart(keys.map(shortDate), hours.map(h => ({ v: h, color: h >= t.sleepH ? CHART_COLORS.sleep : h ? CHART_COLORS.warn : CHART_COLORS.muted })), { target: t.sleepH, height: 130 })}
      <div class="chart-legend"><span><i style="background:var(--sleep)"></i>Hit target</span>
        <span><i style="background:var(--warn)"></i>Short</span>
        <span><i style="background:var(--warn);opacity:.6"></i>Dashed line = ${t.sleepH}h target</span></div>
    </div>`;
  },

  adviceHtml(m, t, debt, consistency) {
    const out = [];
    if (m) {
      if (m.efficiency < 80 && m.tibMin > 0) out.push(['warn', 'Low sleep efficiency',
        `You spent ${fmtHours(m.tibMin / 60)} in bed but only ${fmtHours(m.tstMin / 60)} asleep (${m.efficiency}%). Below 85% usually means going to bed before you are actually sleepy — try shifting bedtime later by 20–30 minutes rather than earlier.`]);
      if (m.latency > 30) out.push(['warn', 'Long time to fall asleep',
        `${m.latency} minutes to drop off. Common culprits: caffeine inside 8 hours of bed, bright screens, or a warm room.`]);
      if (m.totalHours < t.sleepH - 1) out.push(['bad', 'Short night',
        `${fmtHours(t.sleepH - m.totalHours)} under target. Strength and recovery adaptations take the hit first.`]);
      if (m.totalHours >= t.sleepH && m.efficiency >= 85) out.push(['good', 'Solid night',
        'Duration and efficiency both on target — this is the night to repeat.']);
    }
    if (debt > 5) out.push(['bad', 'Sleep debt is building',
      `${debt} hours accumulated over 14 nights. Debt is repaid by adding 30–60 minutes a night over a week, not by one long lie-in.`]);
    if (consistency != null && consistency < 55) out.push(['warn', 'Irregular schedule',
      'Your mid-sleep point is moving a lot night to night. Regular timing predicts daytime alertness about as strongly as total hours do.']);
    if (!out.length) return '';
    return `<div class="card"><div class="card-head"><h3>What this means</h3></div>
      ${out.map(([kind, title, body]) => `<div class="verdict ${kind}">
        <span class="vi" style="color:${kind === 'good' ? 'var(--good)' : kind === 'bad' ? 'var(--bad)' : 'var(--warn)'}">${icon(kind === 'good' ? 'check' : 'alert')}</span>
        <div><b>${esc(title)}</b><div class="muted">${esc(body)}</div></div></div>`).join('')}
      </div>`;
  },

  /* ---------- bindings ---------- */
  bind(host, k) {
    $$('[data-nav]', host).forEach(b => b.onclick = () => App.goDate(addDays(k, +b.dataset.nav)));

    const get = () => {
      const d = Store.day(k, true);
      if (!d.sleep) d.sleep = { bed: '', wake: '', latencyMin: null, awakeMin: null, awakenings: null, quality: null, naps: [], note: '', custom: {} };
      if (!d.sleep.custom) d.sleep.custom = {};
      return d.sleep;
    };

    const bindVal = (sel, prop, num) => {
      const e = $(sel, host); if (!e) return;
      e.addEventListener('change', () => {
        const s = get();
        s[prop] = num ? (e.value === '' ? null : +e.value) : e.value;
        Store.save(); App.render();
      });
    };
    bindVal('#s-bed', 'bed');
    bindVal('#s-wake', 'wake');
    bindVal('#s-lat', 'latencyMin', true);
    bindVal('#s-awake', 'awakeMin', true);
    bindVal('#s-wakes', 'awakenings', true);
    bindVal('#s-note', 'note');

    const nap = $('#s-nap', host);
    if (nap) nap.addEventListener('change', () => {
      const s = get();
      s.naps = nap.value ? [{ min: +nap.value }] : [];
      Store.save(); App.render();
    });

    $$('[data-preset]', host).forEach(b => b.onclick = () => {
      const [bed, wake] = b.dataset.preset.split('|');
      const s = get(); s.bed = bed; s.wake = wake;
      Store.save(); App.render();
    });

    const cl = $('#s-clear', host);
    if (cl) cl.onclick = () => { const s = get(); s.bed = ''; s.wake = ''; Store.save(); App.render(); };

    $$('[data-q]', host).forEach(b => b.onclick = () => {
      const s = get();
      s.quality = s.quality === +b.dataset.q ? null : +b.dataset.q;
      Store.save(); App.render();
    });

    $$('[data-cust]', host).forEach(inp => inp.addEventListener('change', () => {
      const s = get();
      const f = Store.s.customSleepFields.find(x => x.id === inp.dataset.cust);
      const v = inp.value;
      s.custom[inp.dataset.cust] = v === '' ? null : (f && (f.type === 'number' || f.type === 'scale') ? +v : v);
      Store.save();
    }));

    const add = $('#s-addfield', host);
    if (add) add.onclick = () => this.addFieldSheet();

    $$('[data-rmfield]', host).forEach(b => b.onclick = async () => {
      const f = Store.s.customSleepFields.find(x => x.id === b.dataset.rmfield);
      const ok = await confirmSheet('Remove field', `Remove "${f.label}"? Values already logged stay in your data but stop showing.`, 'Remove', true);
      if (!ok) return;
      Store.s.customSleepFields = Store.s.customSleepFields.filter(x => x.id !== b.dataset.rmfield);
      Store.save(); App.render();
    });
  },

  addFieldSheet() {
    const s = openSheet({
      title: 'Add a sleep field',
      body: `
        <label class="fld"><span>Field name</span><input id="nf-l" placeholder="e.g. Caffeine after 4pm"></label>
        <div class="fld-row">
          <label class="fld"><span>Type</span><select id="nf-t">
            <option value="number">Number</option>
            <option value="scale">Scale 1–10</option>
            <option value="yesno">Yes / No</option>
            <option value="time">Time</option>
            <option value="text">Text</option>
          </select></label>
          <label class="fld"><span>Unit (optional)</span><input id="nf-u" placeholder="mg, °C, hrs"></label>
        </div>
        <div class="section-title">Common ones</div>
        <div class="chips">
          ${[['Caffeine', 'number', 'mg'], ['Alcohol units', 'number', 'units'], ['Screen time before bed', 'number', 'min'],
             ['Room temperature', 'number', '°C'], ['Stress level', 'scale', ''], ['Resting heart rate', 'number', 'bpm'],
             ['HRV', 'number', 'ms'], ['Trained today', 'yesno', ''], ['Last meal', 'time', ''], ['Dreams recalled', 'yesno', '']]
            .map(([l, t, u]) => `<button class="chip" data-p="${esc(l)}|${t}|${esc(u)}">${esc(l)}</button>`).join('')}
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="nf-s">Add field</button>`
    });
    $$('[data-p]', s.sheet).forEach(b => b.onclick = () => {
      const [l, t, u] = b.dataset.p.split('|');
      $('#nf-l', s.sheet).value = l; $('#nf-t', s.sheet).value = t; $('#nf-u', s.sheet).value = u;
    });
    $('#nf-s', s.sheet).onclick = () => {
      const label = $('#nf-l', s.sheet).value.trim();
      if (!label) return toast('Name the field', 'warn');
      Store.s.customSleepFields.push({
        id: 'sf' + uid(), label, type: $('#nf-t', s.sheet).value, unit: $('#nf-u', s.sheet).value.trim()
      });
      Store.save(); s.close(); App.render();
      toast('Field added', 'good');
    };
  }
};
