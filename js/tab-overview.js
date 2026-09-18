/* ==========================================================================
   FitLog — Overview tab
   Picks a period (day / week / month), averages it, averages the period
   immediately before it, and reports what improved and what slipped across
   training, nutrition and recovery.
   ========================================================================== */

const PERIODS = {
  day:   { label: 'Day',     days: 1,  prevLabel: 'Yesterday' },
  week:  { label: 'Week',    days: 7,  prevLabel: 'Previous week' },
  month: { label: '4 weeks', days: 28, prevLabel: 'Previous 4 weeks' }
};

const Overview = {
  period: 'week',
  offset: 0,          // 0 = current period, 1 = one period back, …

  render(host) {
    const P = PERIODS[this.period];
    const endKey = addDays(App.date, -P.days * this.offset);
    const curKeys = rangeKeys(addDays(endKey, -(P.days - 1)), P.days);
    const prevKeys = rangeKeys(addDays(endKey, -(P.days * 2 - 1)), P.days);

    const cur = Calc.aggregate(curKeys);
    const prev = Calc.aggregate(prevKeys);
    const t = Targets.current();

    host.innerHTML = `
      ${this.pickerHtml(P, curKeys, prevKeys)}
      ${cur.daysLogged || prev.daysLogged ? `
        ${this.scoresHtml(cur, prev)}
        ${this.verdictHtml(cur, prev, P)}
        ${this.trendHtml(curKeys)}
        ${this.tableHtml(cur, prev, P)}
        ${this.readinessHtml(endKey, cur, t)}
        ${this.prHtml()}
        ${this.streakHtml()}
      ` : `<div class="card"><div class="empty">${icon('overview')}
          <b>Nothing logged in this period yet</b>
          <div class="small">Log a workout, a meal or a night of sleep and the comparison builds itself</div>
          <div class="btn-row" style="justify-content:center;margin-top:14px">
            <button class="btn primary" data-jump="fitness">Log a workout</button>
            <button class="btn" data-jump="diet">Log food</button>
          </div></div></div>`}
    `;

    $$('#ov-seg button', host).forEach(b => b.onclick = () => { this.period = b.dataset.p; this.offset = 0; App.render(); });
    $$('[data-off]', host).forEach(b => b.onclick = () => {
      this.offset = Math.max(0, this.offset + +b.dataset.off);
      App.render();
    });
    $$('[data-jump]', host).forEach(b => b.onclick = () => App.go(b.dataset.jump));
  },

  /* ---------- period picker ---------- */
  pickerHtml(P, curKeys, prevKeys) {
    const rangeTxt = P.days === 1
      ? prettyDate(curKeys[0], { weekday: 'long', day: 'numeric', month: 'long' })
      : `${shortDate(curKeys[0])} – ${shortDate(curKeys[curKeys.length - 1])}`;
    const prevTxt = P.days === 1
      ? prettyDate(prevKeys[0], { weekday: 'short', day: 'numeric', month: 'short' })
      : `${shortDate(prevKeys[0])} – ${shortDate(prevKeys[prevKeys.length - 1])}`;
    return `
      <div class="card">
        <div class="card-head" style="margin-bottom:10px">
          <h2>Compare</h2>
          <select id="ov-per" style="width:auto;padding:6px 30px 6px 10px;font-size:13px;font-weight:600">
            ${Object.entries(PERIODS).map(([id, p]) =>
              `<option value="${id}" ${this.period === id ? 'selected' : ''}>${p.label}</option>`).join('')}
          </select>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <button class="btn ghost icon" data-off="1" title="Earlier">${icon('left')}</button>
          <div class="grow center">
            <div style="font-weight:700">${esc(rangeTxt)}${this.offset === 0 ? ' <span class="today-badge">Current</span>' : ''}</div>
            <div class="small muted">compared with ${esc(prevTxt)}</div>
          </div>
          <button class="btn ghost icon" data-off="-1" title="Later" ${this.offset === 0 ? 'disabled' : ''}>${icon('right')}</button>
        </div>
      </div>
      <div class="seg wide hide" id="ov-seg">
        ${Object.entries(PERIODS).map(([id, p]) =>
          `<button data-p="${id}" class="${this.period === id ? 'active' : ''}">${p.label}</button>`).join('')}
      </div>`;
  },

  /* ---------- score rings ---------- */
  scoresHtml(cur, prev) {
    const item = (label, now, before, color) => {
      const d = delta(now, before, { abs: true, dp: 0 });
      return `<div style="text-align:center">
        ${ring(now || 0, color, now == null ? '–' : Math.round(now), label, 96)}
        <div class="small" style="margin-top:6px">${d.html} <span class="dim">vs ${before == null ? '–' : Math.round(before)}</span></div>
      </div>`;
    };
    const overallD = delta(cur.overall, prev.overall, { abs: true, dp: 0 });
    return `<div class="card">
      <div class="card-head"><h2>Scores</h2>
        <span class="pill">${cur.daysLogged} day${cur.daysLogged === 1 ? '' : 's'} logged</span></div>
      <div class="ring-row" style="margin-bottom:14px">
        ${item('Training', cur.training, prev.training, CHART_COLORS.train)}
        ${item('Nutrition', cur.nutrition, prev.nutrition, CHART_COLORS.diet)}
        ${item('Recovery', cur.recovery, prev.recovery, CHART_COLORS.sleep)}
      </div>
      <div class="verdict ${overallD.dir > 0 ? 'good' : overallD.dir < 0 ? 'bad' : ''}" style="margin:0">
        <span class="vi" style="color:${overallD.dir > 0 ? 'var(--good)' : overallD.dir < 0 ? 'var(--bad)' : 'var(--tx-3)'}">${icon(overallD.dir >= 0 ? 'trend' : 'down')}</span>
        <div><b>Overall ${cur.overall == null ? '–' : Math.round(cur.overall)} / 100</b> ${overallD.html}
          <div class="muted small">${this.overallSentence(cur, prev)}</div></div>
      </div>
    </div>`;
  },

  overallSentence(cur, prev) {
    if (cur.overall == null) return 'Not enough logged to score this period yet.';
    if (prev.overall == null) return 'No comparable period before this one — this becomes your baseline.';
    const diff = cur.overall - prev.overall;
    if (Math.abs(diff) < 2) return 'Essentially flat. You are holding the line rather than gaining or losing ground.';
    if (diff > 8) return 'A clear step up across the board — whatever changed this period is worth keeping.';
    if (diff > 0) return 'Modest improvement. The direction is right even if the size is small.';
    if (diff < -8) return 'A meaningful drop. Look at the breakdown below to see which pillar pulled it down.';
    return 'Slight decline. Usually one weak pillar rather than everything at once.';
  },

  /* ---------- verdicts ---------- */
  verdictHtml(cur, prev, P) {
    const v = [];
    const push = (kind, title, body) => v.push({ kind, title, body });

    /* efficiency — training */
    const volD = delta(cur.volumePerSession, prev.volumePerSession);
    if (cur.volumePerSession && prev.volumePerSession) {
      if (volD.pct > 5) push('good', 'Training volume up',
        `${fmtNum(Units.wOut(cur.volumePerSession))} ${Units.wLabel()} per session vs ${fmtNum(Units.wOut(prev.volumePerSession))} before — ${fmtNum(Math.abs(volD.pct), 1)}% more work done per visit.`);
      else if (volD.pct < -8) push('warn', 'Training volume down',
        `${fmtNum(Math.abs(volD.pct), 1)}% less work per session. Fine if it is a deload; worth checking if it is not intentional.`);
    }
    if (cur.workoutDays != null && prev.workoutDays != null && P.days > 1) {
      if (cur.workoutDays > prev.workoutDays) push('good', 'More sessions',
        `${cur.workoutDays} session${cur.workoutDays === 1 ? '' : 's'} this period vs ${prev.workoutDays}. Frequency is the single biggest driver of progress.`);
      else if (cur.workoutDays < prev.workoutDays) push('warn', 'Fewer sessions',
        `${cur.workoutDays} vs ${prev.workoutDays}. Consistency dropped, which usually shows up in volume before it shows up in strength.`);
    }
    if (cur.avgRpe && prev.avgRpe && cur.avgRpe - prev.avgRpe > 0.7 && volD.pct < 2) {
      push('warn', 'Working harder for the same output',
        `Average RPE rose from ${round(prev.avgRpe, 1)} to ${round(cur.avgRpe, 1)} without more volume. That is the classic fatigue signature — check sleep and calories.`);
    }

    /* nutrition */
    const protD = delta(cur.protein, prev.protein);
    if (cur.protein && prev.protein) {
      if (protD.pct > 6) push('good', 'Protein intake up',
        `${fmtNum(cur.protein)} g/day vs ${fmtNum(prev.protein)} g — better raw material for recovery.`);
      else if (protD.pct < -8) push('warn', 'Protein intake down',
        `${fmtNum(cur.protein)} g/day vs ${fmtNum(prev.protein)} g. Protein is the macro that protects muscle when everything else slips.`);
    }
    const t = Targets.current();
    if (cur.kcal && Math.abs(cur.kcal - t.kcal) / t.kcal > 0.18) {
      push(cur.kcal > t.kcal ? 'warn' : 'warn', cur.kcal > t.kcal ? 'Eating above target' : 'Eating below target',
        `Averaging ${fmtNum(cur.kcal)} kcal against a ${fmtNum(t.kcal)} kcal target. ${cur.kcal > t.kcal ? 'A surplus this size adds fat as well as muscle.' : 'A deficit this size will cost you strength if it runs for long.'}`);
    }
    if (cur.water && prev.water) {
      const wd = delta(cur.water, prev.water);
      if (wd.pct < -12) push('warn', 'Hydration slipped', `${Units.fmtVBig(cur.water)}/day vs ${Units.fmtVBig(prev.water)} before.`);
    }

    /* recovery */
    const slD = delta(cur.sleepH, prev.sleepH);
    if (cur.sleepH && prev.sleepH) {
      if (slD.pct > 4) push('good', 'Sleeping more',
        `${fmtHours(cur.sleepH)} a night vs ${fmtHours(prev.sleepH)}. Recovery capacity followed it up.`);
      else if (slD.pct < -5) push('bad', 'Sleeping less',
        `${fmtHours(cur.sleepH)} a night vs ${fmtHours(prev.sleepH)}. This is usually the first domino in a bad block.`);
    }
    if (cur.sleepEff && prev.sleepEff && cur.sleepEff - prev.sleepEff < -4) {
      push('warn', 'Sleep quality down',
        `Efficiency fell from ${fmtNum(prev.sleepEff, 1)}% to ${fmtNum(cur.sleepEff, 1)}% — more time in bed awake.`);
    }

    /* cross-pillar reading */
    if (cur.training != null && cur.recovery != null) {
      if (cur.training > 70 && cur.recovery < 55) push('bad', 'Training is outrunning recovery',
        'High training output on low recovery. Either pull volume back for a week or add an hour of sleep a night — running both at once is where injuries and plateaus come from.');
      else if (cur.training > 65 && cur.recovery > 70 && cur.nutrition > 65) push('good', 'All three pillars aligned',
        'Training, food and sleep are all in a good place at the same time. This is the window where progress is cheapest — push here.');
    }

    if (!v.length) return '';
    v.sort((a, b) => ({ bad: 0, warn: 1, good: 2 }[a.kind] - { bad: 0, warn: 1, good: 2 }[b.kind]));
    return `<div class="card"><div class="card-head"><h2>What changed</h2></div>
      ${v.map(x => `<div class="verdict ${x.kind}">
        <span class="vi" style="color:${x.kind === 'good' ? 'var(--good)' : x.kind === 'bad' ? 'var(--bad)' : 'var(--warn)'}">
          ${icon(x.kind === 'good' ? 'trend' : x.kind === 'bad' ? 'down' : 'alert')}</span>
        <div><b>${esc(x.title)}</b><div class="muted">${esc(x.body)}</div></div></div>`).join('')}</div>`;
  },

  /* ---------- trend chart ---------- */
  trendHtml(keys) {
    const p = Store.s.profile, t = Targets.current();
    const tr = [], nu = [], re = [];
    keys.forEach(k => {
      const d = Store.day(k);
      tr.push(Calc.trainingScore(d, p));
      nu.push(Calc.nutritionScore(d, t));
      re.push(Calc.recoveryScore(d, keys, p, t));
    });
    if (![...tr, ...nu, ...re].some(v => v != null)) return '';
    const labels = keys.map(shortDate);
    return `<div class="card">
      <div class="card-head"><h3>Daily scores through the period</h3></div>
      ${lineChart(labels, [
        { label: 'Training', color: CHART_COLORS.train, values: tr },
        { label: 'Nutrition', color: CHART_COLORS.diet, values: nu },
        { label: 'Recovery', color: CHART_COLORS.sleep, values: re }
      ], { min: 0, max: 100, height: 160 })}
      <div class="chart-legend">
        <span><i style="background:var(--train)"></i>Training</span>
        <span><i style="background:var(--diet)"></i>Nutrition</span>
        <span><i style="background:var(--sleep)"></i>Recovery</span>
      </div>
    </div>`;
  },

  /* ---------- comparison table ---------- */
  tableHtml(cur, prev, P) {
    const row = (label, now, before, opts) => {
      opts = opts || {};
      const f = opts.fmt || (v => v == null ? '–' : fmtNum(v, opts.dp == null ? 0 : opts.dp) + (opts.unit ? ' ' + opts.unit : ''));
      const d = delta(now, before, { lowerIsBetter: opts.lowerIsBetter, neutral: opts.neutral, dp: opts.dp });
      return `<tr><td>${esc(label)}</td><td class="mono">${f(now)}</td><td class="mono dim">${f(before)}</td><td>${d.html}</td></tr>`;
    };
    const grp = label => `<tr class="grp"><td colspan="4">${label}</td></tr>`;

    return `<div class="card flush">
      <div class="card-head" style="padding:15px 16px 6px;margin:0"><h2>Full breakdown</h2></div>
      <div style="overflow-x:auto;padding:0 16px 16px">
      <table class="cmp-table">
        <thead><tr><th>Metric</th><th>This ${P.label.toLowerCase()}</th><th>${esc(P.prevLabel)}</th><th>Change</th></tr></thead>
        <tbody>
          ${grp('Training — efficiency')}
          ${row('Sessions', cur.workoutDays, prev.workoutDays)}
          ${row('Total volume', Units.wOut(cur.volumeKg), Units.wOut(prev.volumeKg), { unit: Units.wLabel() })}
          ${row('Volume per session', Units.wOut(cur.volumePerSession), Units.wOut(prev.volumePerSession), { unit: Units.wLabel() })}
          ${row('Working sets', cur.sets, prev.sets)}
          ${row('Reps', cur.reps, prev.reps)}
          ${row('Time training', cur.trainMin, prev.trainMin, { fmt: v => v == null ? '–' : fmtMin(v) })}
          ${row('Training load (sRPE)', cur.load, prev.load)}
          ${row('Average RPE', cur.avgRpe, prev.avgRpe, { dp: 1, neutral: true })}
          ${cur.distanceKm || prev.distanceKm ? row('Cardio distance', Units.dOut(cur.distanceKm), Units.dOut(prev.distanceKm), { dp: 2, unit: Units.dLabel() }) : ''}
          ${row('Training calories', cur.trainKcal, prev.trainKcal, { unit: 'kcal' })}
          ${row('Training score', cur.training, prev.training, { dp: 0 })}

          ${grp('Nutrition')}
          ${row('Calories / day', cur.kcal, prev.kcal, { unit: 'kcal' })}
          ${row('Protein / day', cur.protein, prev.protein, { unit: 'g' })}
          ${row('Carbs / day', cur.carbs, prev.carbs, { unit: 'g' })}
          ${row('Fat / day', cur.fat, prev.fat, { unit: 'g' })}
          ${row('Fibre / day', cur.fibre, prev.fibre, { dp: 1, unit: 'g' })}
          ${row('Water / day', cur.water, prev.water, { fmt: v => v == null ? '–' : Units.fmtVBig(v) })}
          ${row('Nutrition score', cur.nutrition, prev.nutrition, { dp: 0 })}

          ${grp('Recovery')}
          ${row('Sleep / night', cur.sleepH, prev.sleepH, { fmt: v => v == null ? '–' : fmtHours(v) })}
          ${row('Sleep efficiency', cur.sleepEff, prev.sleepEff, { dp: 1, unit: '%' })}
          ${row('Time to fall asleep', cur.latency, prev.latency, { unit: 'min', lowerIsBetter: true })}
          ${row('Wake-ups / night', cur.awakenings, prev.awakenings, { dp: 1, lowerIsBetter: true })}
          ${row('Rested rating', cur.sleepQual, prev.sleepQual, { dp: 1 })}
          ${row('Recovery score', cur.recovery, prev.recovery, { dp: 0 })}

          ${cur.weight || prev.weight ? `${grp('Body')}
          ${row('Bodyweight', Units.wOut(cur.weight), Units.wOut(prev.weight), Object.assign(
              { dp: 1, unit: Units.wLabel() },
              // whether gaining or losing is "good" depends on the goal
              ['cut', 'lean'].includes(Store.s.profile.goal) ? { lowerIsBetter: true }
                : ['bulk', 'leanbulk'].includes(Store.s.profile.goal) ? {} : { neutral: true }))}` : ''}
        </tbody>
      </table></div>
    </div>`;
  },

  /* ---------- readiness ---------- */
  readinessHtml(endKey, cur, t) {
    const acwr = Calc.acwr(endKey);
    if (acwr == null && cur.recovery == null) return '';
    let band = '', tone = '', note = '';
    if (acwr != null) {
      if (acwr < 0.8) { band = 'Undertraining'; tone = 'warn'; note = 'This week is well below your 4-week norm. Fine for a deload, otherwise you are leaving progress on the table.'; }
      else if (acwr <= 1.3) { band = 'Sweet spot'; tone = 'good'; note = 'This week sits inside the 0.8–1.3 range where fitness gains outpace injury risk.'; }
      else if (acwr <= 1.5) { band = 'Ramping fast'; tone = 'warn'; note = 'Load is climbing quicker than your body has adapted to. Hold here rather than adding more.'; }
      else { band = 'Spike'; tone = 'bad'; note = 'A jump this size is the pattern most associated with soft-tissue injury. Back off for a few days.'; }
    }
    return `<div class="card">
      <div class="card-head"><h3>Readiness</h3></div>
      <div class="stat-grid" style="margin-bottom:${acwr != null ? '12px' : '0'}">
        ${acwr != null ? `<div class="stat"><div class="k">Acute : chronic load</div>
          <div class="v" style="color:${tone === 'good' ? 'var(--good)' : tone === 'bad' ? 'var(--bad)' : 'var(--warn)'}">${acwr}</div>
          <div class="d dim">${band}</div></div>` : ''}
        ${cur.recovery != null ? `<div class="stat"><div class="k">Recovery score</div>
          <div class="v" style="color:${scoreColor(cur.recovery)}">${Math.round(cur.recovery)}</div></div>` : ''}
        ${cur.sleepH != null ? `<div class="stat"><div class="k">Sleep debt (14d)</div>
          <div class="v">${Calc.sleepDebt(rangeKeys(addDays(endKey, -13), 14), t.sleepH)}<small>h</small></div></div>` : ''}
        ${cur.avgRpe ? `<div class="stat"><div class="k">Avg session RPE</div><div class="v">${round(cur.avgRpe, 1)}</div></div>` : ''}
      </div>
      ${acwr != null ? `<p class="muted small" style="margin:0">${esc(note)}</p>` : ''}
    </div>`;
  },

  /* ---------- PRs ---------- */
  prHtml() {
    const prs = Object.values(App.prCache || {});
    if (!prs.length) return '';
    prs.sort((a, b) => b.date.localeCompare(a.date));
    const recent = prs.slice(0, 6);
    return `<div class="card flush">
      <div class="card-head" style="padding:15px 16px 6px;margin:0">
        <h3>Personal records</h3><span class="pill">${prs.length} lifts tracked</span></div>
      <div class="list">
        ${recent.map(p => `<div class="row">
          <span style="color:var(--warn)">${icon('award')}</span>
          <div class="grow"><div class="t">${esc(p.exercise)}</div>
            <div class="s">${esc(p.group)} · ${esc(shortDate(p.date))}</div></div>
          <div class="rt mono"><b>${fmtNum(Units.wOut(p.e1rm), 1)} ${Units.wLabel()}</b>
            <div class="s">${fmtNum(Units.wOut(p.w), 1)} × ${p.r}</div></div>
        </div>`).join('')}
      </div>
      ${prs.length > 6 ? `<div style="padding:10px 16px"><button class="btn block sm" onclick="Overview.allPrs()">See all ${prs.length}</button></div>` : ''}
    </div>`;
  },

  allPrs() {
    const prs = Object.values(App.prCache || {}).sort((a, b) => b.e1rm - a.e1rm);
    openSheet({
      title: 'All personal records', wide: true,
      body: `<div class="card flush"><div class="list">
        ${prs.map(p => `<div class="row">
          <div class="grow"><div class="t">${esc(p.exercise)}</div><div class="s">${esc(p.group)}</div></div>
          <div class="rt mono"><b>${fmtNum(Units.wOut(p.e1rm), 1)} ${Units.wLabel()}</b>
            <div class="s">${fmtNum(Units.wOut(p.heaviest || p.w), 1)} × ${p.heaviestReps || p.r} · ${esc(shortDate(p.date))}</div></div>
        </div>`).join('')}</div></div>`
    });
  },

  /* ---------- streaks ---------- */
  streakHtml() {
    const logged = Store.loggedDays();
    if (!logged.length) return '';
    let streak = 0, k = todayKey();
    if (!Store.hasDay(k) || !dayHasData(Store.s.days[k])) k = addDays(k, -1);
    while (Store.s.days[k] && dayHasData(Store.s.days[k])) { streak++; k = addDays(k, -1); }
    const first = logged[0];
    const totalWorkouts = logged.filter(d => ((Store.s.days[d].workout || {}).entries || []).length).length;
    const totalVolume = logged.reduce((a, d) => a + Calc.workoutSummary(Store.s.days[d], Store.s.profile.weightKg).volumeKg, 0);
    return `<div class="card">
      <div class="card-head"><h3>All time</h3></div>
      <div class="stat-grid">
        <div class="stat"><div class="k">Current streak</div><div class="v">${streak}<small>days</small></div></div>
        <div class="stat"><div class="k">Days logged</div><div class="v">${logged.length}</div></div>
        <div class="stat"><div class="k">Workouts</div><div class="v">${totalWorkouts}</div></div>
        <div class="stat"><div class="k">Lifetime volume</div><div class="v">${fmtNum(Units.wOut(totalVolume) / 1000, 1)}<small>k ${Units.wLabel()}</small></div></div>
        <div class="stat"><div class="k">Logging since</div><div class="v" style="font-size:15px">${esc(shortDate(first))}</div></div>
      </div>
    </div>`;
  }
};

/* period <select> binding (the segmented control is kept hidden as a fallback) */
document.addEventListener('change', e => {
  if (e.target && e.target.id === 'ov-per') {
    Overview.period = e.target.value;
    Overview.offset = 0;
    App.render();
  }
});
