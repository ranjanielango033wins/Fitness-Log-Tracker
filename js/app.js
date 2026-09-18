/* ==========================================================================
   FitLog — application controller
   ========================================================================== */

const TABS = {
  overview: { label: 'Overview', mod: () => Overview, icon: 'overview' },
  fitness:  { label: 'Fitness',  mod: () => Fitness,  icon: 'fitness' },
  diet:     { label: 'Diet',     mod: () => Diet,     icon: 'diet' },
  sleep:    { label: 'Sleep',    mod: () => Sleep,    icon: 'sleep' }
};

const App = {
  tab: 'overview',
  date: todayKey(),
  prCache: {},
  clock: null,

  init() {
    Store.load();
    this.applyTheme();
    this.paintChrome();

    // restore the last tab within the same session only
    const last = sessionStorage.getItem('fitlog.tab');
    if (last && TABS[last]) this.tab = last;

    $$('.tab-btn').forEach(b => b.onclick = () => this.go(b.dataset.tab));
    $('#btn-settings').innerHTML = icon('settings');
    $('#btn-settings').onclick = () => Settings.open();
    $('#btn-reports').innerHTML = icon('file');
    $('#btn-reports').onclick = () => Reports.open();

    window.addEventListener('keydown', e => {
      if (e.target.matches('input, textarea, select')) return;
      const order = Object.keys(TABS);
      if (e.key >= '1' && e.key <= '4') this.go(order[+e.key - 1]);
      if (e.key === 'ArrowLeft' && e.altKey) this.goDate(addDays(this.date, -1));
      if (e.key === 'ArrowRight' && e.altKey) this.goDate(addDays(this.date, 1));
      if (e.key === 't' || e.key === 'T') this.goDate(todayKey());
    });

    // keep the "now" clock on the Fitness tab fresh
    this.clock = setInterval(() => {
      if (this.tab === 'fitness' && !sheetStack.length) {
        const d = Store.day(this.date);
        if (!d.workout.startedAt && this.date === todayKey()) this.render();
      }
    }, 30000);

    // roll the date over at midnight while the app is left open
    setInterval(() => {
      if (this.date !== todayKey() && this.wasToday) { this.date = todayKey(); this.render(); }
    }, 60000);

    window.addEventListener('beforeunload', () => Store.save());

    if (!Store.loggedDays().length && !Store.s.profile.name) {
      setTimeout(() => this.welcome(), 350);
    }

    this.render();

    if ('serviceWorker' in navigator && location.protocol.startsWith('http') && !window.FITLOG_NO_SW) {
      navigator.serviceWorker.register('sw.js').catch(() => { /* offline cache is optional */ });
    }
  },

  get wasToday() { return true; },

  applyTheme() {
    const t = Store.s.settings.theme;
    document.documentElement.setAttribute('data-theme',
      t === 'auto' ? (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : t);
  },

  paintChrome() {
    $$('.tab-btn').forEach(b => {
      const t = TABS[b.dataset.tab];
      $('.ic', b).innerHTML = icon(t.icon);
    });
  },

  go(tab) {
    if (!TABS[tab]) return;
    this.tab = tab;
    sessionStorage.setItem('fitlog.tab', tab);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
    this.render();
  },

  goDate(k) {
    this.date = k;
    this.render();
  },

  render() {
    this.prCache = Calc.personalRecords();
    $$('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === this.tab));
    const host = $('#view');
    host.className = 'app page';
    host.innerHTML = '';
    try {
      TABS[this.tab].mod().render(host);
    } catch (e) {
      console.error(e);
      host.innerHTML = `<div class="card"><div class="empty">${icon('alert')}
        <b>Something went wrong drawing this tab</b>
        <div class="small">${esc(e.message)}</div>
        <div class="btn-row" style="justify-content:center;margin-top:12px">
          <button class="btn" onclick="App.render()">Try again</button>
          <button class="btn primary" onclick="Backup.export()">Download my data</button>
        </div></div></div>`;
    }
  },

  /** light refresh used after inline edits that shouldn't steal focus */
  refreshSoft() {
    this.prCache = Calc.personalRecords();
  },

  welcome() {
    const s = openSheet({
      title: 'Welcome to FitLog',
      body: `
        <p class="muted">Three things to set up and you are logging. Everything stays in this browser — there is no account and
        nothing is uploaded. Use <b>Download backup</b> in settings to move your data to another device.</p>
        <label class="fld"><span>Your name</span><input id="w-n" placeholder="Optional — used on exported reports"></label>
        <div class="grid-2">
          <label class="fld"><span>Sex (for the BMR equation)</span>
            <select id="w-sex"><option value="male">Male</option><option value="female">Female</option></select></label>
          <label class="fld"><span>Age</span><input type="number" id="w-age" value="28"></label>
          <label class="fld"><span>Height (cm)</span><input type="number" id="w-h" value="175"></label>
          <label class="fld"><span>Weight (kg)</span><input type="number" step="0.1" id="w-w" value="75"></label>
        </div>
        <label class="fld"><span>Units</span>
          <div class="seg wide" id="w-u">
            <button data-u="metric" class="active">Metric</button>
            <button data-u="imperial">Imperial</button>
          </div></label>
        <label class="fld" style="margin-top:12px"><span>Goal</span>
          <select id="w-goal">
            <option value="cut">Fat loss</option>
            <option value="maintain" selected>Maintain</option>
            <option value="leanbulk">Lean gain</option>
            <option value="bulk">Mass gain</option>
          </select></label>`,
      foot: `<button class="btn" data-close>Skip</button><button class="btn primary" id="w-go">Start logging</button>`
    });
    let units = 'metric';
    $$('#w-u button', s.sheet).forEach(b => b.onclick = () => {
      units = b.dataset.u;
      $$('#w-u button', s.sheet).forEach(x => x.classList.toggle('active', x === b));
      $$('#w-h', s.sheet).forEach(i => i.previousElementSibling.textContent = units === 'metric' ? 'Height (cm)' : 'Height (in)');
      $$('#w-w', s.sheet).forEach(i => i.previousElementSibling.textContent = units === 'metric' ? 'Weight (kg)' : 'Weight (lb)');
    });
    $('#w-go', s.sheet).onclick = () => {
      const p = Store.s.profile;
      p.name = $('#w-n', s.sheet).value.trim();
      p.sex = $('#w-sex', s.sheet).value;
      p.age = +$('#w-age', s.sheet).value || 28;
      const h = +$('#w-h', s.sheet).value, wt = +$('#w-w', s.sheet).value;
      p.heightCm = units === 'metric' ? h : round(h * 2.54, 1);
      p.weightKg = units === 'metric' ? wt : round(wt / 2.20462, 2);
      p.goal = $('#w-goal', s.sheet).value;
      Store.s.settings.units = units;
      Store.save(); s.close(); this.render();
      toast('All set — start with the Fitness tab', 'good');
    };
  }
};

window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (Store.s.settings.theme === 'auto') App.applyTheme();
});

document.addEventListener('DOMContentLoaded', () => App.init());
