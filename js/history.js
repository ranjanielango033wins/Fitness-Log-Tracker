/* ==========================================================================
   FitLog — history browser

   A month grid per month, newest first, scrolling back as far as the log goes.
   Each day shows at a glance which of the three pillars were logged, and taps
   through to that date. Six months of history is six swipes of the thumb.
   ========================================================================== */

const History = {
  months: 6,          // how many are rendered at once; grows as you scroll

  open() {
    this.months = 6;
    const s = openSheet({ title: 'History', wide: true, body: '<div id="hist"></div>' });
    this.draw(s);
  },

  /** Month keys from the current month back, as far as data or the window goes. */
  monthList() {
    const logged = Store.loggedDays();
    const now = new Date();
    const out = [];
    const earliest = logged.length ? keyToDate(logged[0]) : now;
    for (let i = 0; i < this.months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      out.push(d);
      if (d <= new Date(earliest.getFullYear(), earliest.getMonth(), 1)) break;
    }
    return out;
  },

  hasMore() {
    const logged = Store.loggedDays();
    if (!logged.length) return false;
    const list = this.monthList();
    const last = list[list.length - 1];
    const earliest = keyToDate(logged[0]);
    return last > new Date(earliest.getFullYear(), earliest.getMonth(), 1);
  },

  draw(s) {
    const logged = Store.loggedDays();
    const months = this.monthList();
    const host = $('#hist', s.sheet);

    host.innerHTML = `
      ${this.summaryHtml(logged)}
      ${months.map(m => this.monthHtml(m)).join('')}
      ${this.hasMore()
        ? `<button class="btn block" id="hist-more">${icon('chevron')} Show six more months</button>`
        : logged.length ? `<p class="dim tiny center" style="padding:8px 0">That is the whole log — back to ${esc(prettyDate(logged[0], { day: 'numeric', month: 'long', year: 'numeric' }))}.</p>` : ''}
    `;

    $$('[data-day]', host).forEach(b => b.onclick = () => {
      const k = b.dataset.day;
      s.close();
      App.goDate(k);
      App.go(b.dataset.tab || 'fitness');
    });
    const more = $('#hist-more', host);
    if (more) more.onclick = () => { this.months += 6; this.draw(s); };
  },

  summaryHtml(logged) {
    if (!logged.length) return `<div class="empty">${icon('calendar')}<b>Nothing logged yet</b></div>`;
    const workouts = logged.filter(k => ((Store.s.days[k].workout || {}).entries || []).length).length;
    const meals = logged.filter(k => Object.values((Store.s.days[k].diet || {}).meals || {}).some(a => a.length)).length;
    const nights = logged.filter(k => Store.s.days[k].sleep).length;
    const spanDays = Math.round((keyToDate(logged[logged.length - 1]) - keyToDate(logged[0])) / DAY_MS) + 1;
    return `<div class="stat-grid" style="margin-bottom:14px">
      <div class="stat"><div class="k">Days logged</div><div class="v">${logged.length}</div>
        <div class="d dim">over ${spanDays} days</div></div>
      <div class="stat"><div class="k">Workouts</div><div class="v">${workouts}</div></div>
      <div class="stat"><div class="k">Days with food</div><div class="v">${meals}</div></div>
      <div class="stat"><div class="k">Nights</div><div class="v">${nights}</div></div>
    </div>`;
  },

  monthHtml(monthDate) {
    const y = monthDate.getFullYear(), m = monthDate.getMonth();
    const first = new Date(y, m, 1);
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7;             // Monday-first grid
    const today = todayKey();

    let cells = '';
    for (let i = 0; i < lead; i++) cells += '<div class="cal-cell empty-cell"></div>';

    let monthWorkouts = 0, monthKcal = 0, monthVol = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const k = dateKey(new Date(y, m, d));
      const day = Store.s.days[k];
      const has = day && dayHasData(day);
      const future = k > today;
      let marks = '';
      if (has) {
        const w = ((day.workout || {}).entries || []).length;
        const food = Object.values((day.diet || {}).meals || {}).some(a => a.length);
        const slept = !!day.sleep;
        if (w) { monthWorkouts++; marks += '<i class="mk mk-t"></i>'; }
        if (food) marks += '<i class="mk mk-d"></i>';
        if (slept) marks += '<i class="mk mk-s"></i>';
        const ws = Calc.workoutSummary(day, Store.s.profile.weightKg);
        monthKcal += ws.kcal; monthVol += ws.volumeKg;
      }
      cells += `<div class="cal-cell ${has ? 'has' : ''} ${k === today ? 'today' : ''} ${future ? 'future' : ''}"
          ${has || !future ? `data-day="${k}" data-tab="${has && ((day.workout || {}).entries || []).length ? 'fitness' : 'overview'}"` : ''}>
        <span class="cal-n">${d}</span>
        <span class="cal-marks">${marks}</span>
      </div>`;
    }

    const label = first.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    return `<div class="card" style="margin-bottom:12px">
      <div class="card-head" style="margin-bottom:8px">
        <h3>${esc(label)}</h3>
        ${monthWorkouts ? `<span class="pill">${monthWorkouts} session${monthWorkouts === 1 ? '' : 's'}</span>` : '<span class="pill dim">nothing logged</span>'}
      </div>
      <div class="cal-head">${['M', 'T', 'W', 'T', 'F', 'S', 'S'].map(d => `<div>${d}</div>`).join('')}</div>
      <div class="cal-grid">${cells}</div>
      ${monthWorkouts ? `<div class="chart-legend" style="margin-top:10px">
        <span>${fmtNum(Units.wOut(monthVol))} ${Units.wLabel()} lifted</span>
        <span>${fmtNum(monthKcal)} kcal trained</span>
      </div>` : ''}
    </div>`;
  }
};
