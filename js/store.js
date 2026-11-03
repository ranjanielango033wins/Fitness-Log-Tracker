/* ==========================================================================
   FitLog — state store, units and persistence
   All quantities are stored INTERNALLY IN METRIC (kg, cm, km, ml, kcal).
   The unit system only affects display and input parsing.
   ========================================================================== */

const STORAGE_KEY = 'fitlog.v1';
const SCHEMA_VERSION = 2;

/* ==========================================================================
   Persistence

   localStorage was the original home, and it does not scale: browsers cap it
   around 5 MB per site, and a day of full logging — workout, every meal, water,
   sleep — runs to several kilobytes. Two years of that overflows, and the
   failure mode is the worst kind: the write throws, the newest day is lost, and
   nothing says so.

   IndexedDB has no such ceiling (hundreds of megabytes, and it can ask for
   more), and its writes are transactional, so a half-written state is not a
   state the app can ever read back. It is the primary store. localStorage
   stays as the fallback for browsers that block IndexedDB — private windows
   on some platforms — and as the source for the one-time migration.
   ========================================================================== */

const IDB_NAME = 'fitlog';
const IDB_STORE = 'state';
const IDB_KEY = 'main';

const Persist = {
  db: null,
  mode: 'memory',          // idb | local | memory
  lastError: null,

  async open() {
    if (this.db) return this.db;
    if (!('indexedDB' in window)) return null;
    try {
      this.db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(IDB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(IDB_STORE)) req.result.createObjectStore(IDB_STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('IndexedDB blocked'));
        // Safari in a private window can hang here rather than erroring.
        setTimeout(() => reject(new Error('IndexedDB timed out')), 4000);
      });
      this.db.onversionchange = () => { try { this.db.close(); } catch (e) {} this.db = null; };
      this.mode = 'idb';
      return this.db;
    } catch (e) {
      this.lastError = e;
      this.db = null;
      return null;
    }
  },

  async idbGet(key) {
    const db = await this.open();
    if (!db) return undefined;
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async idbPut(key, value) {
    const db = await this.open();
    if (!db) throw new Error('no IndexedDB');
    return new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('transaction aborted'));
    });
  },

  /** Load the newest copy, preferring IndexedDB and falling back to localStorage. */
  async read() {
    let fromIdb = null;
    try { fromIdb = await this.idbGet(IDB_KEY); } catch (e) { this.lastError = e; }

    let fromLocal = null;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) fromLocal = JSON.parse(raw);
    } catch (e) { /* unreadable or blocked — IndexedDB may still have it */ }

    if (fromIdb && fromLocal) {
      // Both exist: an older build wrote localStorage. Keep whichever is newer.
      const idbStamp = stateStamp(fromIdb), localStamp = stateStamp(fromLocal);
      return { data: localStamp > idbStamp ? fromLocal : fromIdb, migratedFromLocal: localStamp > idbStamp };
    }
    if (fromIdb) return { data: fromIdb, migratedFromLocal: false };
    if (fromLocal) return { data: fromLocal, migratedFromLocal: true };
    return { data: null, migratedFromLocal: false };
  },

  /** Write. IndexedDB first; localStorage only as a fallback store. */
  async write(obj) {
    if (this.mode !== 'local') {
      try {
        await this.idbPut(IDB_KEY, obj);
        this.mode = 'idb';
        this.lastError = null;
        return 'idb';
      } catch (e) {
        this.lastError = e;
        this.mode = 'local';
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(obj, compactReplacer));
      this.lastError = null;
      return 'local';
    } catch (e) {
      this.lastError = e;
      this.mode = 'memory';
      throw e;
    }
  },

  /** Drop the legacy localStorage copy once IndexedDB holds the data. */
  clearLocalMirror() {
    if (this.mode !== 'idb') return;
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* nothing to do */ }
  },

  async usage() {
    const out = { bytes: 0, quota: 0, mode: this.mode };
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        out.bytes = est.usage || 0;
        out.quota = est.quota || 0;
      }
    } catch (e) { /* unsupported */ }
    return out;
  },

  /** Ask the browser not to evict us — iOS clears unused sites after 7 days. */
  async persistRequest() {
    try {
      if (navigator.storage && navigator.storage.persist) {
        if (await navigator.storage.persisted()) return true;
        return await navigator.storage.persist();
      }
    } catch (e) { /* unsupported */ }
    return false;
  }
};

/** Rough "how recently was this written" for choosing between two copies. */
function stateStamp(s) {
  if (!s || typeof s !== 'object') return 0;
  let max = 0;
  const bump = v => { if (typeof v === 'number' && v > max) max = v; };
  bump((s.profile || {})._m);
  bump((s.settings || {})._m);
  Object.values(s.days || {}).forEach(d => bump((d || {})._m));
  return max;
}

/** Omit nulls, empty strings and empty collections — roughly halves the payload.
    Only fields whose absence rehydrates to the same meaning are dropped: a
    false that defaults to true must survive, or the setting would flip. */
function compactReplacer(key, value) {
  if (value === null || value === undefined) return undefined;
  if (value === '' && key !== 'name') return undefined;
  if (Array.isArray(value) && value.length === 0) return undefined;
  if ((key === 'customFood' || key === 'recipe' || key === 'done') && value === false) return undefined;
  return value;
}

/* ---------- date helpers ---------- */
const DAY_MS = 86400000;

function todayKey() { return dateKey(new Date()); }

function dateKey(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function keyToDate(k) {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(k, n) {
  const d = keyToDate(k); d.setDate(d.getDate() + n); return dateKey(d);
}

function prettyDate(k, opts) {
  return keyToDate(k).toLocaleDateString(undefined, opts || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function shortDate(k) {
  return keyToDate(k).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Monday-start week key for a given date key */
function weekStartKey(k) {
  const d = keyToDate(k);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - dow);
  return dateKey(d);
}

function rangeKeys(fromKey, days) {
  const out = [];
  for (let i = 0; i < days; i++) out.push(addDays(fromKey, i));
  return out;
}

/* ---------- default state ---------- */
function blankDay() {
  return {
    workout: { startedAt: null, endedAt: null, note: '', entries: [] },
    diet: { meals: { breakfast: [], lunch: [], dinner: [], snacks: [], preworkout: [] }, waterLog: [] },
    sleep: null,
    weightKg: null,
    notes: ''
  };
}

function defaultState() {
  return {
    v: SCHEMA_VERSION,
    profile: {
      name: '',
      sex: 'male',
      age: 28,
      heightCm: 175,
      weightKg: 75,
      activity: 1.55,
      goal: 'maintain',
      hotClimate: true
    },
    settings: {
      units: 'metric',
      theme: 'auto',
      oneRm: 'epley',
      autoTargets: true,
      targets: { kcal: 2400, protein: 150, carbs: 260, fat: 75, waterMl: 3000, sleepH: 8 },
      restTimerSec: 90,
      restTimerAuto: true
    },
    days: {},
    customFoods: [],
    customExercises: [],
    recipes: [],
    customSleepFields: [],
    /* tombstones so a deletion on one device propagates instead of being
       resurrected by the other device's copy */
    _del: { days: {}, customFoods: {}, recipes: {}, customSleepFields: {}, customExercises: {} },
    /* device-local, never uploaded */
    sync: {
      code: null,          // 32 hex chars — the pairing secret
      endpoint: '',        // overrides config.js if set by hand
      rev: 0,              // last revision this device saw on the server
      lastSync: null,
      lastError: null,
      deviceId: null
    },
    meta: { created: new Date().toISOString(), lastBackup: null }
  };
}

/* Parts of the state that travel between devices. `sync` is deliberately
   absent — each device keeps its own code, rev and status. */
const SYNCED_LISTS = ['customFoods', 'recipes', 'customSleepFields', 'customExercises'];

/* ==========================================================================
   Validation

   Every numeric input is clamped on the way in. The first release trusted the
   field, and a real log came back with a cardio intensity of 25 on a 1–10
   scale, nineteen times — which silently multiplied that session's training
   load by three and dragged the workload ratio with it. Nothing warned,
   because nothing checked.
   ========================================================================== */
const LIMITS = {
  weightKg:   { min: 0,   max: 1000 },
  reps:       { min: 0,   max: 500 },
  seconds:    { min: 0,   max: 7200 },
  rpe:        { min: 1,   max: 10 },
  duration:   { min: 0,   max: 600 },
  distanceKm: { min: 0,   max: 500 },
  hr:         { min: 25,  max: 250 },
  kcal:       { min: 0,   max: 20000 },
  waterMl:    { min: 0,   max: 5000 },
  latency:    { min: 0,   max: 600 },
  awakeMin:   { min: 0,   max: 900 },
  awakenings: { min: 0,   max: 50 },
  napMin:     { min: 0,   max: 900 },
  grams:      { min: 0,   max: 20000 },
  age:        { min: 10,  max: 110 },
  heightCm:   { min: 80,  max: 260 },
  bodyKg:     { min: 20,  max: 400 },
  restSec:    { min: 0,   max: 900 },
  sleepH:     { min: 3,   max: 14 },
  servings:   { min: 1,   max: 100 }
};

/** Clamp to a named range. Returns null for blank so "unset" stays unset. */
function clamp(value, kind) {
  if (value === '' || value === null || value === undefined) return null;
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(n)) return null;
  const l = LIMITS[kind];
  if (!l) return n;
  return Math.min(l.max, Math.max(l.min, n));
}

/** Clamp but keep a sensible value rather than null — for required settings. */
function clampTo(value, kind, fallback) {
  const v = clamp(value, kind);
  return v == null ? fallback : v;
}

/* ---------- store ---------- */
const Store = {
  s: defaultState(),
  listeners: [],
  repairLog: [],
  saveTimer: null,
  writeFailed: false,

  async load() {
    let migratedFromLocal = false;
    try {
      const got = await Persist.read();
      if (got.data) {
        this.s = this.migrate(got.data);
        migratedFromLocal = got.migratedFromLocal;
      }
    } catch (e) {
      console.warn('FitLog: could not read saved data, starting fresh.', e);
      this.repairLog.push('Saved data could not be read — started from an empty log.');
    }
    if (!this.s.sync.deviceId) this.s.sync.deviceId = uid() + uid();
    this.seedShadow();

    // First run on this build: move the localStorage copy into IndexedDB.
    if (migratedFromLocal) {
      try {
        await Persist.write(this.s);
        Persist.clearLocalMirror();
      } catch (e) { /* stays in localStorage, which still works */ }
    }
    Persist.persistRequest();
    return this.s;
  },

  migrate(obj) {
    const base = defaultState();
    if (!obj || typeof obj !== 'object') return base;
    const fromVersion = +obj.v || 1;
    const merged = Object.assign({}, base, obj);

    merged.profile = Object.assign({}, base.profile, obj.profile || {});
    merged.settings = Object.assign({}, base.settings, obj.settings || {});
    merged.settings.targets = Object.assign({}, base.settings.targets, (obj.settings || {}).targets || {});
    merged.days = (obj.days && typeof obj.days === 'object') ? obj.days : {};
    SYNCED_LISTS.forEach(k => { merged[k] = Array.isArray(obj[k]) ? obj[k] : []; });
    merged.meta = Object.assign({}, base.meta, obj.meta || {});
    merged.sync = Object.assign({}, base.sync, obj.sync || {});
    merged._del = Object.assign({}, base._del, obj._del || {});
    ['days'].concat(SYNCED_LISTS).forEach(k => { if (!merged._del[k]) merged._del[k] = {}; });
    merged.v = SCHEMA_VERSION;

    /* profile and settings sanity */
    merged.profile.age = clampTo(merged.profile.age, 'age', base.profile.age);
    merged.profile.heightCm = clampTo(merged.profile.heightCm, 'heightCm', base.profile.heightCm);
    merged.profile.weightKg = clampTo(merged.profile.weightKg, 'bodyKg', base.profile.weightKg);
    merged.settings.restTimerSec = clampTo(merged.settings.restTimerSec, 'restSec', 90);
    merged.settings.targets.sleepH = clampTo(merged.settings.targets.sleepH, 'sleepH', 8);

    /* days: normalise shape, repair values, drop anything unusable */
    const repairs = [];
    Object.keys(merged.days).forEach(k => {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(k) || !merged.days[k] || typeof merged.days[k] !== 'object') {
        delete merged.days[k];
        repairs.push(`Removed an entry stored under an invalid date (${String(k).slice(0, 20)}).`);
        return;
      }
      merged.days[k] = this.repairDay(merged.days[k], k, fromVersion, repairs, merged);
    });

    /* custom exercises typed before they could be saved */
    if (fromVersion < 2) this.harvestCustomExercises(merged, repairs);

    this.repairLog = repairs;
    return merged;
  },

  /** Normalise one day and clamp everything inside it. */
  repairDay(dayIn, key, fromVersion, repairs, state) {
    const blank = blankDay();
    const d = Object.assign(blank, dayIn);
    d.workout = Object.assign(blankDay().workout, dayIn.workout || {});
    d.diet = Object.assign(blankDay().diet, dayIn.diet || {});
    d.diet.meals = Object.assign(blankDay().diet.meals, (dayIn.diet || {}).meals || {});
    Object.keys(d.diet.meals).forEach(slot => {
      if (!Array.isArray(d.diet.meals[slot])) d.diet.meals[slot] = [];
    });
    if (!Array.isArray(d.diet.waterLog)) d.diet.waterLog = [];
    if (!Array.isArray(d.workout.entries)) d.workout.entries = [];
    d.weightKg = clamp(d.weightKg, 'bodyKg');

    d.workout.entries = d.workout.entries.filter(e => e && typeof e === 'object').map(e => {
      if (!e.id) e.id = uid();

      /* V2: fold typed spellings onto the canonical exercise so history merges */
      if (fromVersion < 2 && e.exercise) {
        const canonical = resolveExerciseName(e.exercise);
        if (canonical && canonical !== e.exercise) {
          repairs.push(`${key}: "${e.exercise}" matched to ${canonical}.`);
          const meta = EX_BY_NAME[canonical];
          e.exercise = canonical;
          if (meta) {
            e.section = meta.section; e.group = meta.groupId;
            e.groupName = meta.groupName; e.eq = meta.eq;
            e.mode = meta.mode; e.met = meta.met;
          }
        }
      }

      /* V2: calories typed into the note, before the field existed */
      if (fromVersion < 2 && e.mode === 'cardio' && e.kcalMachine == null && e.note) {
        const m = e.note.match(/(\d{2,5})\s*(?:k?cal|calorie)/i) || e.note.match(/^(\d{2,5})\b/);
        if (m) {
          const kc = clamp(+m[1], 'kcal');
          if (kc) {
            e.kcalMachine = kc;
            repairs.push(`${key}: read ${kc} kcal out of the note on ${e.exercise}.`);
          }
        }
      }

      e.rpe = clamp(e.rpe, 'rpe');
      e.duration = clamp(e.duration, 'duration');
      e.distance = clamp(e.distance, 'distanceKm');
      e.hr = clamp(e.hr, 'hr');
      e.kcalMachine = clamp(e.kcalMachine, 'kcal');
      e.restSec = clampTo(e.restSec, 'restSec', 90);
      if (typeof e.note !== 'string') e.note = '';

      if (Array.isArray(e.sets)) {
        e.sets = e.sets.filter(s => s && typeof s === 'object').map(s => ({
          w: clamp(s.w, 'weightKg'),
          r: clamp(s.r, 'reps'),
          sec: clamp(s.sec, 'seconds'),
          done: !!s.done,
          type: ['warmup', 'drop', 'failure'].includes(s.type) ? s.type : null
        }));
      } else if (e.mode !== 'cardio') {
        e.sets = [];
      }
      return e;
    });

    d.diet.waterLog = d.diet.waterLog
      .filter(w => w && typeof w === 'object')
      .map(w => ({ t: typeof w.t === 'string' ? w.t : '', ml: clamp(w.ml, 'waterMl') || 0 }))
      .filter(w => w.ml > 0);

    Object.keys(d.diet.meals).forEach(slot => {
      d.diet.meals[slot] = d.diet.meals[slot].filter(it => it && typeof it === 'object').map(it => {
        if (!it.id) it.id = uid();
        it.grams = clamp(it.grams, 'grams') || 0;
        it.kcal = clamp(it.kcal, 'kcal') || 0;
        ['p', 'c', 'f', 'fib'].forEach(m => { it[m] = clamp(it[m], 'grams') || 0; });
        if (typeof it.name !== 'string' || !it.name) it.name = 'Unnamed item';
        return it;
      });
    });

    if (d.sleep && typeof d.sleep === 'object') {
      const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
      if (!hhmm.test(d.sleep.bed || '')) d.sleep.bed = '';
      if (!hhmm.test(d.sleep.wake || '')) d.sleep.wake = '';
      d.sleep.latencyMin = clamp(d.sleep.latencyMin, 'latency');
      d.sleep.awakeMin = clamp(d.sleep.awakeMin, 'awakeMin');
      d.sleep.awakenings = clamp(d.sleep.awakenings, 'awakenings');
      d.sleep.quality = clamp(d.sleep.quality, 'rpe');
      if (d.sleep.quality != null) d.sleep.quality = Math.min(5, Math.max(1, Math.round(d.sleep.quality)));
      d.sleep.naps = Array.isArray(d.sleep.naps)
        ? d.sleep.naps.map(n => ({ min: clamp((n || {}).min, 'napMin') || 0 })).filter(n => n.min > 0)
        : [];
      if (!d.sleep.custom || typeof d.sleep.custom !== 'object') d.sleep.custom = {};
      if (typeof d.sleep.note !== 'string') d.sleep.note = '';
      if (!d.sleep.bed && !d.sleep.wake && !d.sleep.naps.length) d.sleep = null;
    } else {
      d.sleep = null;
    }

    if (typeof d.notes !== 'string') d.notes = '';
    return d;
  },

  /** Pull every exercise that was typed by hand into a reusable saved list. */
  harvestCustomExercises(state, repairs) {
    const known = new Set(Object.keys(EX_BY_NAME));
    const seen = new Set((state.customExercises || []).map(e => e.name));
    Object.values(state.days).forEach(d => {
      ((d.workout || {}).entries || []).forEach(e => {
        if (!e.exercise || known.has(e.exercise) || seen.has(e.exercise)) return;
        seen.add(e.exercise);
        state.customExercises.push({
          id: 'cx' + uid(),
          name: e.exercise,
          section: e.section || 'upper',
          groupId: e.group || 'core',
          groupName: e.groupName || 'Other',
          eq: e.eq || 'Other',
          mode: e.mode || 'strength',
          met: e.met || 5,
          rom: null,
          _m: 1
        });
        repairs.push(`Saved "${e.exercise}" as one of your own exercises.`);
      });
    });
  },

  /* ------------------------------------------------------------------
     Change stamping.

     Sync needs to know WHICH day or item changed and when, so a merge can
     resolve per day instead of "newest whole file wins" — which would let a
     phone erase a laptop's morning. Rather than hand-stamping at every
     mutation site (and inevitably missing one), we keep a shadow copy of each
     part's serialised form and diff against it on save. Nothing that mutates
     state can escape it.
     ------------------------------------------------------------------ */

  _shadow: null,
  _active: new Set(),
  _version: 0,

  _partStr(obj) {
    if (!obj) return '';
    const copy = Object.assign({}, obj);
    delete copy._m;
    return JSON.stringify(copy);
  },

  /** Build the shadow from state as loaded, WITHOUT marking anything changed. */
  seedShadow() {
    const sh = { days: {}, lists: {}, profile: '', settings: '' };
    Object.entries(this.s.days).forEach(([k, d]) => {
      sh.days[k] = this._partStr(d);
      if (!d._m) d._m = 1;                 // pre-sync data: oldest possible, but present
    });
    SYNCED_LISTS.forEach(name => {
      sh.lists[name] = {};
      (this.s[name] || []).forEach(it => {
        sh.lists[name][it.id] = this._partStr(it);
        if (!it._m) it._m = 1;
      });
    });
    sh.profile = this._partStr(this.s.profile);
    sh.settings = this._partStr(this.s.settings);
    if (!this.s.profile._m) this.s.profile._m = 1;
    if (!this.s.settings._m) this.s.settings._m = 1;
    this._shadow = sh;
    this._active.clear();
    this._version++;
  },

  /** Stamp whatever differs from the shadow, and tombstone whatever vanished.

      Only days the app has opened for writing are re-serialised. Diffing every
      stored day on every save meant a keystroke cost one JSON.stringify per day
      on record — fine at thirty days, several megabytes of churn at two years.
      Deletions are still caught, because comparing key sets is cheap. */
  stampChanges() {
    if (!this._shadow) { this.seedShadow(); return false; }
    const now = Date.now();
    const sh = this._shadow;
    let dirty = false;

    // days that were opened for writing since the last save
    this._active.forEach(k => {
      const d = this.s.days[k];
      if (!d) return;
      const str = this._partStr(d);
      if (sh.days[k] !== str) { d._m = now; sh.days[k] = str; dirty = true; delete this.s._del.days[k]; }
    });
    this._active.clear();

    // additions and deletions, from the key sets alone
    Object.keys(this.s.days).forEach(k => {
      if (sh.days[k] === undefined) {
        sh.days[k] = this._partStr(this.s.days[k]);
        this.s.days[k]._m = now;
        delete this.s._del.days[k];
        dirty = true;
      }
    });
    Object.keys(sh.days).forEach(k => {
      if (!this.s.days[k]) { delete sh.days[k]; this.s._del.days[k] = now; dirty = true; }
    });

    // id-keyed lists stay small enough to diff whole
    SYNCED_LISTS.forEach(name => {
      const shelf = sh.lists[name] || (sh.lists[name] = {});
      const seen = {};
      (this.s[name] || []).forEach(it => {
        seen[it.id] = true;
        const str = this._partStr(it);
        if (shelf[it.id] !== str) { it._m = now; shelf[it.id] = str; dirty = true; delete this.s._del[name][it.id]; }
      });
      Object.keys(shelf).forEach(id => {
        if (!seen[id]) { delete shelf[id]; this.s._del[name][id] = now; dirty = true; }
      });
    });

    // whole-object parts
    const pStr = this._partStr(this.s.profile);
    if (sh.profile !== pStr) { this.s.profile._m = now; sh.profile = pStr; dirty = true; }
    const sStr = this._partStr(this.s.settings);
    if (sh.settings !== sStr) { this.s.settings._m = now; sh.settings = sStr; dirty = true; }

    if (dirty) this._version++;
    return dirty;
  },

  save(opts) {
    const dirty = this.stampChanges();
    this._version++;                      // any save invalidates derived caches

    // Write off the critical path; the in-memory state is what the UI reads.
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 120);

    this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
    if (dirty && !(opts && opts.fromSync) && typeof Sync !== 'undefined') Sync.schedulePush();
    return dirty;
  },

  /** Push the in-memory state to disk. Safe to call at any time. */
  async flush() {
    clearTimeout(this.saveTimer);
    this.saveTimer = null;
    try {
      await Persist.write(this.s);
      if (this.writeFailed) {
        this.writeFailed = false;
        if (typeof toast === 'function') toast('Saving again — storage recovered', 'good');
      }
    } catch (e) {
      console.error('FitLog: save failed', e);
      if (!this.writeFailed) {
        this.writeFailed = true;
        if (typeof toast === 'function') {
          toast('Storage is full — export a backup now', 'bad');
        }
      }
    }
  },

  onChange(fn) { this.listeners.push(fn); },

  day(k, create) {
    if (!this.s.days[k]) {
      if (!create) return blankDay();
      this.s.days[k] = blankDay();
    }
    // Opened for writing: remember it so the next save only diffs what moved.
    if (create) this._active.add(k);
    return this.s.days[k];
  },

  hasDay(k) { return !!this.s.days[k]; },

  /** All day keys that hold any data, sorted ascending */
  loggedDays() {
    return Object.keys(this.s.days).filter(k => dayHasData(this.s.days[k])).sort();
  },

  /** The exercise library plus anything the user has added. */
  allExercises() {
    const custom = (this.s.customExercises || []).map(c => ({
      section: c.section, sectionLabel: (EX_LIB[c.section] || {}).label || 'Other',
      groupId: c.groupId, groupName: c.groupName,
      name: c.name, eq: c.eq, mode: c.mode, met: c.met,
      assist: !!c.assist, custom: true, rom: c.rom || null
    }));
    return EX_FLAT.concat(custom);
  },

  findExercise(name) {
    const custom = (this.s.customExercises || []).find(c => c.name === name);
    if (custom) {
      return {
        section: custom.section, groupId: custom.groupId, groupName: custom.groupName,
        name: custom.name, eq: custom.eq, mode: custom.mode, met: custom.met,
        assist: !!custom.assist, custom: true, rom: custom.rom || null
      };
    }
    return EX_BY_NAME[name] || null;
  },

  /** Restore from a backup or a merge. `restamp` makes the incoming copy win
      over anything already in the cloud; otherwise its own timestamps decide. */
  replaceAll(newState, opts) {
    const keepSync = this.s.sync;
    this.s = this.migrate(newState);
    this.s.sync = Object.assign({}, keepSync, { lastError: null });   // pairing is per-device
    if (opts && opts.restamp) {
      const now = Date.now();
      Object.values(this.s.days).forEach(d => d._m = now);
      SYNCED_LISTS.forEach(n => (this.s[n] || []).forEach(it => it._m = now));
      this.s.profile._m = now; this.s.settings._m = now;
    }
    this._shadow = null;
    this.seedShadow();
    this.save(opts);
  },

  /** Wipe this device. Deliberately unpairs rather than pushing a mass delete —
      erasing the cloud copy is a separate, explicit action. */
  reset() {
    this.s = defaultState();
    this.s.sync.deviceId = uid() + uid();
    this._shadow = null;
    this.seedShadow();
    this.save({ fromSync: true });
  },

  allFoods() {
    return FOOD_DB.concat(this.s.customFoods);
  },

  findFood(id) {
    return this.allFoods().find(f => f.id === id) || null;
  }
};

function dayHasData(d) {
  if (!d) return false;
  if (d.workout && d.workout.entries && d.workout.entries.length) return true;
  if (d.diet) {
    if ((d.diet.waterLog || []).length) return true;
    if (Object.values(d.diet.meals || {}).some(a => a.length)) return true;
  }
  if (d.sleep && (d.sleep.bed || d.sleep.wake)) return true;
  if (d.weightKg) return true;
  if (d.notes) return true;
  return false;
}

/* ==========================================================================
   Units
   ========================================================================== */
const Units = {
  get sys() { return Store.s.settings.units; },
  get imperial() { return this.sys === 'imperial'; },

  wLabel() { return this.imperial ? 'lb' : 'kg'; },
  dLabel() { return this.imperial ? 'mi' : 'km'; },
  hLabel() { return this.imperial ? 'in' : 'cm'; },
  vLabel() { return this.imperial ? 'fl oz' : 'ml'; },
  vBigLabel() { return this.imperial ? 'cups' : 'L'; },

  // kg <-> display weight
  wOut(kg) { if (kg == null) return null; return this.imperial ? kg * 2.20462 : kg; },
  wIn(v) { if (v == null || v === '') return null; return this.imperial ? v / 2.20462 : +v; },

  // km <-> display distance
  dOut(km) { if (km == null) return null; return this.imperial ? km * 0.621371 : km; },
  dIn(v) { if (v == null || v === '') return null; return this.imperial ? v / 0.621371 : +v; },

  // cm <-> display height
  hOut(cm) { if (cm == null) return null; return this.imperial ? cm / 2.54 : cm; },
  hIn(v) { if (v == null || v === '') return null; return this.imperial ? v * 2.54 : +v; },

  // ml <-> display volume
  vOut(ml) { if (ml == null) return null; return this.imperial ? ml / 29.5735 : ml; },
  vIn(v) { if (v == null || v === '') return null; return this.imperial ? v * 29.5735 : +v; },

  // ml -> big unit (L or cups)
  vBig(ml) { return this.imperial ? ml / 236.588 : ml / 1000; },

  fmtW(kg, dp) { const v = this.wOut(kg); return v == null ? '–' : round(v, dp == null ? 1 : dp) + ' ' + this.wLabel(); },
  fmtD(km, dp) { const v = this.dOut(km); return v == null ? '–' : round(v, dp == null ? 2 : dp) + ' ' + this.dLabel(); },
  fmtVBig(ml) { return round(this.vBig(ml), 2) + ' ' + this.vBigLabel(); }
};

function round(n, dp) {
  if (n == null || isNaN(n)) return 0;
  const m = Math.pow(10, dp == null ? 0 : dp);
  return Math.round(n * m) / m;
}

function fmtNum(n, dp) {
  const r = round(n, dp);
  return r.toLocaleString(undefined, { maximumFractionDigits: dp == null ? 0 : dp });
}

/* ==========================================================================
   Calculations
   ========================================================================== */
const Calc = {

  /* --- Body & energy --- */

  /** Mifflin-St Jeor basal metabolic rate (kcal/day) */
  bmr(p) {
    const base = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age;
    return Math.round(p.sex === 'female' ? base - 161 : base + 5);
  },

  /** Total daily energy expenditure = BMR x activity factor */
  tdee(p) { return Math.round(this.bmr(p) * (p.activity || 1.55)); },

  /** Goal-adjusted calorie target */
  calorieTarget(p) {
    const t = this.tdee(p);
    if (p.goal === 'cut') return Math.round(t * 0.80);       // ~20 % deficit
    if (p.goal === 'lean') return Math.round(t * 0.90);      // slow cut
    if (p.goal === 'bulk') return Math.round(t * 1.15);      // ~15 % surplus
    if (p.goal === 'leanbulk') return Math.round(t * 1.08);
    return t;
  },

  /** Macro split derived from bodyweight and goal */
  macroTargets(p) {
    const kcal = this.calorieTarget(p);
    const proteinPerKg = p.goal === 'cut' ? 2.2 : p.goal === 'lean' ? 2.0 : 1.8;
    const protein = Math.round(p.weightKg * proteinPerKg);
    const fat = Math.round(p.weightKg * (p.goal === 'cut' ? 0.8 : 1.0));
    const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4));
    return { kcal, protein, carbs, fat };
  },

  /** Water target: 35 ml/kg baseline, + exercise, + hot climate */
  waterTarget(p, exerciseMin) {
    let ml = p.weightKg * 35;
    ml += (exerciseMin || 0) / 60 * 600;      // ~600 ml per training hour
    if (p.hotClimate) ml += 500;
    return Math.round(ml / 50) * 50;
  },

  /* --- Strength --- */

  /** Estimated one-rep max */
  e1rm(weight, reps, formula) {
    if (!weight || !reps) return 0;
    if (reps === 1) return weight;
    if (reps > 15) formula = 'lombardi';
    switch (formula || Store.s.settings.oneRm) {
      case 'brzycki': return reps < 37 ? weight * 36 / (37 - reps) : weight;
      case 'lombardi': return weight * Math.pow(reps, 0.10);
      case 'oconner': return weight * (1 + 0.025 * reps);
      case 'wathan': return weight / (0.4880 + 0.538 * Math.exp(-0.075 * reps));
      case 'epley':
      default: return weight * (1 + reps / 30);
    }
  },

  /** Working sets only, weight x reps summed */
  entryVolume(entry) {
    if (!entry.sets) return 0;
    return entry.sets.reduce((sum, s) => {
      if (!s.done) return sum;
      if (s.type === 'warmup') return sum;
      const w = s.w || 0, r = s.r || 0;
      return sum + w * r;
    }, 0);
  },

  entryBestE1rm(entry) {
    if (!entry.sets) return 0;
    return entry.sets.reduce((best, s) => {
      if (!s.done || s.type === 'warmup') return best;
      return Math.max(best, this.e1rm(s.w || 0, s.r || 0));
    }, 0);
  },

  entryReps(entry) {
    if (!entry.sets) return 0;
    return entry.sets.reduce((n, s) => n + (s.done && s.type !== 'warmup' ? (s.r || 0) : 0), 0);
  },

  entrySets(entry) {
    if (!entry.sets) return 0;
    return entry.sets.filter(s => s.done && s.type !== 'warmup').length;
  },

  /** kcal/min = MET x 3.5 x kg / 200  (Compendium standard) */
  metKcalRaw(met, minutes, weightKg) {
    if (!met || !minutes) return 0;
    return met * 3.5 * weightKg / 200 * minutes;
  },

  metKcal(met, minutes, weightKg) {
    return Math.round(this.metKcalRaw(met, minutes, weightKg));
  },

  /* ------------------------------------------------------------------
     Resistance-training energy

     MET tables treat "weight lifting" as one number regardless of what you
     actually lifted, which makes a set of 20 kg curls cost the same as a set
     of 180 kg squats. That is useless for a log. So a set is costed from the
     physical work it took:

       work (J) = load x 9.81 x range of motion x reps x (1 + eccentric)

     The lowering phase costs roughly a third of the lifting phase, and human
     muscle converts chemical energy to mechanical work at about 22%
     efficiency, so the metabolic cost is the work divided by that. On top
     sits a small time term for bracing and stabilising while the set runs,
     and the rest between sets is costed separately at a recovery rate.

     It remains an estimate — range of motion varies with limb length, and
     none of this captures the afterburn — but it responds correctly to the
     things that actually drive the cost: how heavy, how many, how far.
     ------------------------------------------------------------------ */

  ENERGY: {
    g: 9.80665,
    efficiency: 0.22,     // mechanical work -> metabolic cost
    eccentric: 0.35,      // lowering phase, as a share of the lifting phase
    secPerRep: 3,         // time under tension per rep
    metUnderLoad: 3.5,    // bracing and stabilising while a set runs
    metRest: 2.5,         // standing recovery between sets
    metIsometric: 4.0     // planks, holds, carries
  },

  /** What the set actually moved, in kg — bodyweight movements included.
      On an assisted machine the stack carries part of you, so it is subtracted
      rather than added; logging 27 kg of assistance is not a 27 kg pull-up. */
  setLoadKg(entry, set, bodyweightKg) {
    const stack = set.w || 0;
    if (entry.mode !== 'bodyweight') return stack;
    const share = bodyweightKg * bodyweightFraction(entry.exercise);
    if (isAssisted(entry.exercise)) return Math.max(bodyweightKg * 0.15, share - stack);
    return share + stack;
  },

  /** Range of motion for an entry, honouring a value set on a custom exercise. */
  romFor(entry) {
    const custom = (Store.s.customExercises || []).find(c => c.name === entry.exercise);
    if (custom && custom.rom) return custom.rom;
    return exerciseRom(entry.exercise, entry.group);
  },

  /** Energy cost of one completed set, in kcal. */
  setKcal(entry, set, bodyweightKg) {
    if (!set || !set.done) return 0;
    const E = this.ENERGY;
    const bw = bodyweightKg || Store.s.profile.weightKg || 75;

    // Holds and carries do no net mechanical work — cost them by time.
    if (entry.mode === 'time') {
      return this.metKcalRaw(entry.met || E.metIsometric, (set.sec || 0) / 60, bw);
    }

    const reps = set.r || 0;
    if (!reps) return 0;

    const load = this.setLoadKg(entry, set, bw);
    const rom = this.romFor(entry);

    const workJ = load * E.g * rom * reps * (1 + E.eccentric);
    const kcalWork = workJ / 4184 / E.efficiency;

    const tutMin = reps * E.secPerRep / 60;
    const kcalTension = this.metKcalRaw(E.metUnderLoad, tutMin, bw);

    return kcalWork + kcalTension;
  },

  /** Rest between the completed sets of an entry, in minutes. */
  entryRestMinutes(entry) {
    const done = (entry.sets || []).filter(s => s.done).length;
    if (done < 2) return 0;
    return (done - 1) * (entry.restSec || Store.s.settings.restTimerSec || 90) / 60;
  },

  /** Estimated minutes under tension + rest for a resistance entry */
  entryMinutes(entry) {
    if (entry.mode === 'cardio') return entry.duration || 0;
    if (entry.mode === 'time') {
      return (entry.sets || []).reduce((m, s) => m + (s.done ? (s.sec || 0) / 60 : 0), 0) + this.entryRestMinutes(entry);
    }
    const tut = (entry.sets || []).reduce((m, s) => m + (s.done ? (s.r || 0) * this.ENERGY.secPerRep / 60 : 0), 0);
    return tut + this.entryRestMinutes(entry);
  },

  /** Energy for a whole exercise: its sets plus the recovery between them. */
  entryKcalRaw(entry, weightKg) {
    const bw = weightKg || Store.s.profile.weightKg || 75;
    if (entry.mode === 'cardio') {
      // A machine-recorded figure beats any estimate, so prefer it when given.
      if (entry.kcalMachine != null && entry.kcalMachine !== '') return +entry.kcalMachine;
      return this.metKcalRaw(entry.met || 7, entry.duration || 0, bw);
    }
    const sets = (entry.sets || []).reduce((a, s) => a + this.setKcal(entry, s, bw), 0);
    const rest = this.metKcalRaw(this.ENERGY.metRest, this.entryRestMinutes(entry), bw);
    return sets + rest;
  },

  entryKcal(entry, weightKg) {
    return Math.round(this.entryKcalRaw(entry, weightKg));
  },

  /** True when a cardio entry's calories came off the machine rather than a model. */
  entryKcalMeasured(entry) {
    return entry.mode === 'cardio' && entry.kcalMachine != null && entry.kcalMachine !== '';
  },

  /** Per-set energy rows for an exercise, used by the breakdown UI and exports. */
  entryEnergyRows(entry, weightKg) {
    const bw = weightKg || Store.s.profile.weightKg || 75;
    return (entry.sets || []).map((s, i) => ({
      index: i + 1,
      done: !!s.done,
      type: s.type || 'working',
      kcal: this.setKcal(entry, s, bw),
      loadKg: this.setLoadKg(entry, s, bw),
      reps: s.r || 0,
      sec: s.sec || 0
    }));
  },

  /** Session-RPE training load = duration (min) x intensity — Foster's method.
      Cardio carries its own intensity rating; resistance work uses a fixed
      moderate value now that sets are not rated individually. */
  entryLoad(entry) {
    const mins = this.entryMinutes(entry);
    let rpe = entry.rpe;
    if (!rpe) rpe = entry.mode === 'cardio' ? 6 : 7.5;
    return Math.round(mins * rpe);
  },

  /* --- Day roll-ups --- */

  workoutSummary(day, weightKg) {
    const e = (day.workout && day.workout.entries) || [];
    const sum = {
      entries: e.length, sets: 0, reps: 0, volumeKg: 0, minutes: 0, kcal: 0, load: 0,
      distanceKm: 0, bySection: { upper: 0, lower: 0, cardio: 0 }, groups: new Set(), avgRpe: 0,
      byExercise: [], measuredKcal: 0, estimatedKcal: 0
    };
    let rpeN = 0, rpeSum = 0;
    e.forEach(en => {
      const vol = this.entryVolume(en);
      const kcal = this.entryKcalRaw(en, weightKg);
      sum.sets += this.entrySets(en);
      sum.reps += this.entryReps(en);
      sum.volumeKg += vol;
      sum.minutes += this.entryMinutes(en);
      sum.kcal += kcal;
      if (this.entryKcalMeasured(en)) sum.measuredKcal += kcal; else sum.estimatedKcal += kcal;
      sum.byExercise.push({
        id: en.id, name: en.exercise, group: en.groupName, section: en.section,
        kcal: kcal, measured: this.entryKcalMeasured(en)
      });
      sum.load += this.entryLoad(en);
      sum.distanceKm += en.distance || 0;
      sum.bySection[en.section] = (sum.bySection[en.section] || 0) + (en.section === 'cardio' ? this.entryMinutes(en) : vol);
      sum.groups.add(en.group);
      // Only cardio carries an intensity rating now that sets are not rated.
      if (en.rpe) { rpeSum += en.rpe; rpeN++; }
    });
    sum.avgRpe = rpeN ? round(rpeSum / rpeN, 1) : 0;
    sum.groupCount = sum.groups.size;
    sum.minutes = Math.round(sum.minutes);
    sum.volumeKg = Math.round(sum.volumeKg);
    sum.byExercise.sort((a, b) => b.kcal - a.kcal);
    sum.kcal = Math.round(sum.kcal);
    sum.measuredKcal = Math.round(sum.measuredKcal);
    sum.estimatedKcal = Math.round(sum.estimatedKcal);
    return sum;
  },

  dietSummary(day) {
    const sum = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, items: 0, waterMl: 0, byMeal: {} };
    Object.entries((day.diet && day.diet.meals) || {}).forEach(([slot, items]) => {
      const m = { kcal: 0, p: 0, c: 0, f: 0 };
      items.forEach(it => {
        m.kcal += it.kcal; m.p += it.p; m.c += it.c; m.f += it.f;
        sum.fib += it.fib || 0; sum.items++;
      });
      sum.byMeal[slot] = m;
      sum.kcal += m.kcal; sum.p += m.p; sum.c += m.c; sum.f += m.f;
    });
    sum.waterMl = ((day.diet && day.diet.waterLog) || []).reduce((a, w) => a + w.ml, 0);
    ['kcal', 'p', 'c', 'f', 'fib'].forEach(k => sum[k] = round(sum[k], k === 'kcal' ? 0 : 1));
    return sum;
  },

  /** Minutes between two HH:MM strings, crossing midnight if needed */
  minutesBetween(bed, wake) {
    if (!bed || !wake) return 0;
    const [bh, bm] = bed.split(':').map(Number);
    const [wh, wm] = wake.split(':').map(Number);
    let mins = (wh * 60 + wm) - (bh * 60 + bm);
    if (mins <= 0) mins += 1440;
    return mins;
  },

  sleepSummary(day) {
    const s = day.sleep;
    if (!s || !s.bed || !s.wake) return null;
    const tib = this.minutesBetween(s.bed, s.wake);                 // time in bed
    const latency = s.latencyMin || 0;
    const awake = s.awakeMin || 0;                                   // WASO
    const naps = (s.naps || []).reduce((a, n) => a + (n.min || 0), 0);
    const tst = Math.max(0, tib - latency - awake);                  // total sleep time
    const efficiency = tib > 0 ? round(tst / tib * 100, 1) : 0;
    /* With neither a time-to-sleep nor a time-awake recorded, efficiency is
       arithmetically 100% and means nothing. Saying so is more useful than
       printing a perfect score nobody earned. */
    const efficiencyKnown = s.latencyMin != null || s.awakeMin != null;
    // mid-sleep clock position in minutes from midnight (for consistency scoring)
    const [bh, bm] = s.bed.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    if (bedMin < 720) bedMin += 1440;                                // treat 00:30 as 24:30
    const midSleep = (bedMin + latency + tst / 2) % 1440;
    return {
      tibMin: tib, tstMin: tst, napMin: naps, totalMin: tst + naps,
      hours: round(tst / 60, 2), totalHours: round((tst + naps) / 60, 2),
      efficiency, efficiencyKnown, latency, awake, awakenings: s.awakenings || 0,
      quality: s.quality || null, midSleep,
      bed: s.bed, wake: s.wake
    };
  },

  /** Cumulative sleep debt (hours) over the given day keys */
  sleepDebt(keys, targetH) {
    let debt = 0;
    keys.forEach(k => {
      const d = Store.s.days[k];
      const s = d ? this.sleepSummary(d) : null;
      if (s) debt += (targetH - s.totalHours);
    });
    return round(Math.max(0, debt), 1);
  },

  /** Standard deviation of mid-sleep times -> consistency 0-100 */
  sleepConsistency(keys) {
    const mids = [];
    keys.forEach(k => {
      const d = Store.s.days[k];
      const s = d ? this.sleepSummary(d) : null;
      if (s) mids.push(s.midSleep);
    });
    if (mids.length < 3) return null;
    // circular mean to handle wrap-around at midnight
    const rad = mids.map(m => m / 1440 * 2 * Math.PI);
    const mx = rad.reduce((a, r) => a + Math.cos(r), 0) / rad.length;
    const my = rad.reduce((a, r) => a + Math.sin(r), 0) / rad.length;
    const R = Math.sqrt(mx * mx + my * my);
    const circSdMin = Math.sqrt(-2 * Math.log(Math.max(R, 1e-6))) / (2 * Math.PI) * 1440;
    // 0 min sd -> 100 ; 90 min sd -> 0
    return Math.max(0, Math.min(100, Math.round(100 - circSdMin / 90 * 100)));
  },

  /* --- Scores (0-100) --- */

  /** Training efficiency: did the session do useful work, with good coverage? */
  trainingScore(day, p) {
    const w = this.workoutSummary(day, p.weightKg);
    if (!w.entries) return null;
    const volScore = Math.min(100, w.volumeKg / (p.weightKg * 90) * 100);   // ~90x bodyweight = strong session
    const setScore = Math.min(100, w.sets / 20 * 100);
    const timeScore = Math.min(100, w.minutes / 70 * 100);
    const varietyScore = Math.min(100, w.groupCount / 4 * 100);
    return Math.round(volScore * 0.35 + setScore * 0.25 + timeScore * 0.2 + varietyScore * 0.2);
  },

  /** Nutrition adherence: how close to target on calories, protein and water */
  nutritionScore(day, targets) {
    const d = this.dietSummary(day);
    if (!d.items && !d.waterMl) return null;
    const near = (actual, target, tol) => {
      if (!target) return 50;
      const err = Math.abs(actual - target) / target;
      return Math.max(0, Math.min(100, Math.round(100 - err / tol * 100)));
    };
    const kcalScore = near(d.kcal, targets.kcal, 0.25);
    const protScore = Math.min(100, Math.round(d.p / Math.max(1, targets.protein) * 100));
    const waterScore = Math.min(100, Math.round(d.waterMl / Math.max(1, targets.waterMl) * 100));
    const fibScore = Math.min(100, Math.round(d.fib / 30 * 100));
    return Math.round(kcalScore * 0.35 + protScore * 0.35 + waterScore * 0.2 + fibScore * 0.1);
  },

  /** Recovery: sleep quantity, efficiency, subjective quality, hydration.
      `consistency` is passed in rather than recomputed: working it out inside
      this function made period aggregation O(n squared), which showed up as a
      visible stall the moment a range covered a few months. */
  recoveryScore(day, keys, p, targets, consistency) {
    const s = this.sleepSummary(day);
    if (!s) return null;
    const durScore = Math.min(100, Math.round(s.totalHours / targets.sleepH * 100));
    const qualScore = s.quality ? s.quality / 5 * 100 : 70;
    const cons = consistency === undefined ? this.sleepConsistency(keys) : consistency;
    const consScore = cons == null ? 70 : cons;
    const wakeScore = Math.max(0, 100 - (s.awakenings || 0) * 12);

    if (!s.efficiencyKnown) {
      // No efficiency to judge; spread its weight over what was actually recorded.
      return Math.round(durScore * 0.47 + qualScore * 0.25 + consScore * 0.18 + wakeScore * 0.10);
    }
    const effScore = Math.min(100, Math.round(s.efficiency / 90 * 100));
    return Math.round(durScore * 0.35 + effScore * 0.22 + qualScore * 0.18 + consScore * 0.15 + wakeScore * 0.10);
  },

  /** Acute:chronic workload ratio — injury-risk / readiness proxy */
  acwr(endKey) {
    const load = k => {
      const d = Store.s.days[k];
      return d ? this.workoutSummary(d, Store.s.profile.weightKg).load : 0;
    };
    let acute = 0, chronic = 0;
    for (let i = 0; i < 7; i++) acute += load(addDays(endKey, -i));
    for (let i = 0; i < 28; i++) chronic += load(addDays(endKey, -i));
    const chronicWeekly = chronic / 4;
    if (!chronicWeekly) return null;
    return round(acute / chronicWeekly, 2);
  },

  /* --- Period aggregation, used by the Overview tab --- */
  aggregate(keys) {
    const p = Store.s.profile;
    const targets = Targets.current();
    const consistency = this.sleepConsistency(keys);   // once for the whole period
    const acc = {
      days: keys.length, daysLogged: 0, workoutDays: 0, dietDays: 0, sleepDays: 0,
      volumeKg: 0, sets: 0, reps: 0, trainMin: 0, trainKcal: 0, load: 0, distanceKm: 0, avgRpe: [],
      kcal: [], protein: [], carbs: [], fat: [], fibre: [], water: [],
      sleepH: [], sleepEff: [], sleepQual: [], latency: [], awakenings: [],
      trainingScores: [], nutritionScores: [], recoveryScores: [], weights: []
    };
    keys.forEach(k => {
      const d = Store.s.days[k];
      if (!d || !dayHasData(d)) return;
      acc.daysLogged++;
      const w = this.workoutSummary(d, p.weightKg);
      if (w.entries) {
        acc.workoutDays++;
        acc.volumeKg += w.volumeKg; acc.sets += w.sets; acc.reps += w.reps;
        acc.trainMin += w.minutes; acc.trainKcal += w.kcal; acc.load += w.load;
        acc.distanceKm += w.distanceKm;
        if (w.avgRpe) acc.avgRpe.push(w.avgRpe);
      }
      const dt = this.dietSummary(d);
      if (dt.items) {
        acc.dietDays++;
        acc.kcal.push(dt.kcal); acc.protein.push(dt.p); acc.carbs.push(dt.c);
        acc.fat.push(dt.f); acc.fibre.push(dt.fib);
      }
      if (dt.waterMl) acc.water.push(dt.waterMl);
      const sl = this.sleepSummary(d);
      if (sl) {
        acc.sleepDays++;
        acc.sleepH.push(sl.totalHours);
        if (sl.efficiencyKnown) acc.sleepEff.push(sl.efficiency);
        if (sl.latency != null && d.sleep.latencyMin != null) acc.latency.push(sl.latency);
        acc.awakenings.push(sl.awakenings);
        if (sl.quality) acc.sleepQual.push(sl.quality);
      }
      if (d.weightKg) acc.weights.push(d.weightKg);
      const ts = this.trainingScore(d, p); if (ts != null) acc.trainingScores.push(ts);
      const ns = this.nutritionScore(d, targets); if (ns != null) acc.nutritionScores.push(ns);
      const rs = this.recoveryScore(d, keys, p, targets, consistency); if (rs != null) acc.recoveryScores.push(rs);
    });
    const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
    return {
      raw: acc,
      daysLogged: acc.daysLogged,
      workoutDays: acc.workoutDays,
      volumeKg: acc.volumeKg,
      volumePerSession: acc.workoutDays ? Math.round(acc.volumeKg / acc.workoutDays) : null,
      sets: acc.sets, reps: acc.reps,
      trainMin: Math.round(acc.trainMin),
      trainKcal: acc.trainKcal,
      load: acc.load,
      distanceKm: round(acc.distanceKm, 2),
      avgRpe: avg(acc.avgRpe),
      kcal: avg(acc.kcal), protein: avg(acc.protein), carbs: avg(acc.carbs),
      fat: avg(acc.fat), fibre: avg(acc.fibre), water: avg(acc.water),
      sleepH: avg(acc.sleepH), sleepEff: avg(acc.sleepEff), sleepQual: avg(acc.sleepQual),
      latency: avg(acc.latency), awakenings: avg(acc.awakenings),
      training: avg(acc.trainingScores), nutrition: avg(acc.nutritionScores),
      recovery: avg(acc.recoveryScores),
      consistency,
      weight: avg(acc.weights),
      overall: avg([avg(acc.trainingScores), avg(acc.nutritionScores), avg(acc.recoveryScores)].filter(v => v != null))
    };
  },

  /** Personal records across all logged days, keyed by exercise name.

      Memoised against the store's version counter: this walks every set ever
      logged, and it used to run on every single render. */
  _prCache: null,
  _prVersion: -1,

  personalRecords() {
    if (this._prCache && this._prVersion === Store._version) return this._prCache;
    const prs = {};
    Object.entries(Store.s.days).forEach(([k, d]) => {
      ((d.workout && d.workout.entries) || []).forEach(en => {
        if (en.mode === 'cardio') return;
        (en.sets || []).forEach(s => {
          if (!s.done || s.type === 'warmup' || !s.w || !s.r) return;
          const e1 = this.e1rm(s.w, s.r);
          const cur = prs[en.exercise];
          if (!cur || e1 > cur.e1rm) {
            prs[en.exercise] = { exercise: en.exercise, group: en.groupName || en.group, e1rm: round(e1, 1), w: s.w, r: s.r, date: k };
          }
          const hv = prs[en.exercise];
          if (!hv.heaviest || s.w > hv.heaviest) { hv.heaviest = s.w; hv.heaviestReps = s.r; hv.heaviestDate = k; }
        });
      });
    });
    this._prCache = prs;
    this._prVersion = Store._version;
    return prs;
  }
};

/* ==========================================================================
   Merge — reconciles this device's copy with the cloud copy.

   Resolution is per day and per item, not per file. Log Monday on a laptop and
   Tuesday on a phone and both survive, because they are different keys. The
   only real conflict is editing the SAME date on two devices while one is
   offline, and there the later edit wins.
   ========================================================================== */
const TOMBSTONE_TTL = 120 * DAY_MS;

const Merge = {
  /** Fallback when two copies claim the same instant (or both predate sync). */
  weight(o) { try { return JSON.stringify(o).length; } catch (e) { return 0; } },

  pick(a, b) {
    if (!a) return b;
    if (!b) return a;
    const am = a._m || 0, bm = b._m || 0;
    if (am !== bm) return am > bm ? a : b;
    return this.weight(a) >= this.weight(b) ? a : b;
  },

  /** Everything that travels between devices, stripped of device-local state. */
  payload(s) {
    const out = { v: s.v, days: s.days, profile: s.profile, settings: s.settings, _del: s._del, meta: s.meta };
    SYNCED_LISTS.forEach(n => out[n] = s[n]);
    return JSON.parse(JSON.stringify(out));
  },

  merge(local, remote) {
    if (!remote) return this.payload(local);
    const now = Date.now();
    const out = {
      v: SCHEMA_VERSION,
      days: {},
      profile: this.pick(local.profile, remote.profile),
      settings: this.pick(local.settings, remote.settings),
      _del: {},
      meta: Object.assign({}, remote.meta, local.meta)
    };
    if (local.meta && remote.meta && remote.meta.created && local.meta.created) {
      out.meta.created = local.meta.created < remote.meta.created ? local.meta.created : remote.meta.created;
    }

    // tombstones: union, latest wins, expired ones dropped
    ['days'].concat(SYNCED_LISTS).forEach(part => {
      const t = {};
      const add = src => Object.entries(((src || {})._del || {})[part] || {})
        .forEach(([k, ts]) => { if ((!t[k] || ts > t[k]) && now - ts < TOMBSTONE_TTL) t[k] = ts; });
      add(local); add(remote);
      out._del[part] = t;
    });

    const buried = (part, key, winner) => {
      const ts = out._del[part][key];
      return ts != null && ts > (winner._m || 0);
    };

    // days — sorted so both devices build an identically ordered result
    const dayKeys = Array.from(new Set(Object.keys(local.days || {}).concat(Object.keys(remote.days || {})))).sort();
    dayKeys.forEach(k => {
      const winner = this.pick((local.days || {})[k], (remote.days || {})[k]);
      if (!winner || buried('days', k, winner)) return;
      out.days[k] = winner;
    });

    // id-keyed lists — likewise sorted, since array order is significant
    SYNCED_LISTS.forEach(name => {
      const byId = {};
      (local[name] || []).forEach(it => { if (it && it.id) byId[it.id] = it; });
      (remote[name] || []).forEach(it => { if (it && it.id) byId[it.id] = this.pick(byId[it.id], it); });
      out[name] = Object.keys(byId).sort()
        .map(id => byId[id])
        .filter(it => !buried(name, it.id, it));
    });

    return out;
  },

  /** Write a merged payload into the live store without re-stamping it. */
  apply(merged) {
    const s = Store.s;
    s.days = merged.days || {};
    s.profile = merged.profile || s.profile;
    s.settings = merged.settings || s.settings;
    s._del = merged._del || s._del;
    s.meta = merged.meta || s.meta;
    SYNCED_LISTS.forEach(n => s[n] = merged[n] || []);
    // days arriving from another device may predate a schema change
    Object.keys(s.days).forEach(k => {
      const m = s.days[k]._m;
      s.days[k] = Object.assign(blankDay(), s.days[k]);
      s.days[k].workout = Object.assign(blankDay().workout, s.days[k].workout || {});
      s.days[k].diet = Object.assign(blankDay().diet, s.days[k].diet || {});
      s.days[k].diet.meals = Object.assign(blankDay().diet.meals, s.days[k].diet.meals || {});
      s.days[k]._m = m;
    });
    Store._shadow = null;
    Store.seedShadow();
  },

  /** Order-independent serialisation.

      Two devices can hold the same log with object keys in a different order —
      whichever side merged first puts its own keys first. Comparing raw
      JSON.stringify output would call that a difference, and the two devices
      would overwrite each other on every poll forever. Sorting keys makes the
      comparison mean what it should: same data, regardless of order. */
  canon(value) {
    const walk = v => {
      if (v === null || typeof v !== 'object') return v;
      if (Array.isArray(v)) return v.map(walk);
      const out = {};
      Object.keys(v).sort().forEach(k => {
        const x = v[k];
        // Match the compact wire format: a field that is absent and a field
        // that is null mean the same thing, so they must compare equal.
        if (x === null || x === undefined) return;
        if (x === '' && k !== 'name') return;
        if (Array.isArray(x) && x.length === 0) return;
        if ((k === 'customFood' || k === 'recipe' || k === 'done') && x === false) return;
        out[k] = walk(x);
      });
      return out;
    };
    try { return JSON.stringify(walk(value)); } catch (e) { return ''; }
  },

  /** True when the two payloads would produce identical logs. */
  same(a, b) {
    return this.canon(a) === this.canon(b);
  }
};

/* ==========================================================================
   Targets — either auto-derived from the profile or user-pinned
   ========================================================================== */
const Targets = {
  current(exerciseMin) {
    const st = Store.s.settings, p = Store.s.profile;
    if (!st.autoTargets) return Object.assign({}, st.targets);
    const m = Calc.macroTargets(p);
    return {
      kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat,
      waterMl: Calc.waterTarget(p, exerciseMin),
      sleepH: st.targets.sleepH || 8
    };
  }
};
