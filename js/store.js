/* ==========================================================================
   FitLog — state store, units and persistence
   All quantities are stored INTERNALLY IN METRIC (kg, cm, km, ml, kcal).
   The unit system only affects display and input parsing.
   ========================================================================== */

const STORAGE_KEY = 'fitlog.v1';
const SCHEMA_VERSION = 1;

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
    recipes: [],
    customSleepFields: [],
    meta: { created: new Date().toISOString(), lastBackup: null }
  };
}

/* ---------- store ---------- */
const Store = {
  s: defaultState(),
  listeners: [],

  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        this.s = this.migrate(parsed);
      }
    } catch (e) {
      console.warn('FitLog: could not read saved data, starting fresh.', e);
    }
    return this.s;
  },

  migrate(obj) {
    const base = defaultState();
    const merged = Object.assign({}, base, obj);
    merged.profile = Object.assign({}, base.profile, obj.profile || {});
    merged.settings = Object.assign({}, base.settings, obj.settings || {});
    merged.settings.targets = Object.assign({}, base.settings.targets, (obj.settings || {}).targets || {});
    merged.days = obj.days || {};
    merged.customFoods = obj.customFoods || [];
    merged.recipes = obj.recipes || [];
    merged.customSleepFields = obj.customSleepFields || [];
    merged.meta = Object.assign({}, base.meta, obj.meta || {});
    merged.v = SCHEMA_VERSION;
    // ensure every day has the full shape
    Object.keys(merged.days).forEach(k => {
      merged.days[k] = Object.assign(blankDay(), merged.days[k]);
      merged.days[k].workout = Object.assign(blankDay().workout, merged.days[k].workout || {});
      merged.days[k].diet = Object.assign(blankDay().diet, merged.days[k].diet || {});
      merged.days[k].diet.meals = Object.assign(blankDay().diet.meals, merged.days[k].diet.meals || {});
    });
    return merged;
  },

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.s));
    } catch (e) {
      console.error('FitLog: save failed', e);
      if (typeof toast === 'function') toast('Storage full — export a backup and clear old data', 'warn');
    }
    this.listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  },

  onChange(fn) { this.listeners.push(fn); },

  day(k, create) {
    if (!this.s.days[k]) {
      if (!create) return blankDay();
      this.s.days[k] = blankDay();
    }
    return this.s.days[k];
  },

  hasDay(k) { return !!this.s.days[k]; },

  /** All day keys that hold any data, sorted ascending */
  loggedDays() {
    return Object.keys(this.s.days).filter(k => dayHasData(this.s.days[k])).sort();
  },

  replaceAll(newState) {
    this.s = this.migrate(newState);
    this.save();
  },

  reset() {
    this.s = defaultState();
    this.save();
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
  metKcal(met, minutes, weightKg) {
    if (!met || !minutes) return 0;
    return Math.round(met * 3.5 * weightKg / 200 * minutes);
  },

  /** Estimated minutes under tension + rest for a resistance entry */
  entryMinutes(entry) {
    if (entry.mode === 'cardio') return entry.duration || 0;
    if (entry.mode === 'time') return (entry.sets || []).reduce((m, s) => m + (s.done ? (s.sec || 0) / 60 + 1 : 0), 0);
    const sets = (entry.sets || []).filter(s => s.done).length;
    const rest = (entry.restSec || Store.s.settings.restTimerSec || 90) / 60;
    return sets * (0.7 + rest);
  },

  entryKcal(entry, weightKg) {
    return this.metKcal(entry.met || 5, this.entryMinutes(entry), weightKg);
  },

  /** Session-RPE training load = duration (min) x average RPE — Foster's method */
  entryLoad(entry) {
    const mins = this.entryMinutes(entry);
    let rpe = entry.rpe;
    if (!rpe && entry.sets && entry.sets.length) {
      const rated = entry.sets.filter(s => s.done && s.rpe);
      if (rated.length) rpe = rated.reduce((a, s) => a + s.rpe, 0) / rated.length;
    }
    if (!rpe) rpe = entry.mode === 'cardio' ? 6 : 7;
    return Math.round(mins * rpe);
  },

  /* --- Day roll-ups --- */

  workoutSummary(day, weightKg) {
    const e = (day.workout && day.workout.entries) || [];
    const sum = {
      entries: e.length, sets: 0, reps: 0, volumeKg: 0, minutes: 0, kcal: 0, load: 0,
      distanceKm: 0, bySection: { upper: 0, lower: 0, cardio: 0 }, groups: new Set(), avgRpe: 0
    };
    let rpeN = 0, rpeSum = 0;
    e.forEach(en => {
      const vol = this.entryVolume(en);
      sum.sets += this.entrySets(en);
      sum.reps += this.entryReps(en);
      sum.volumeKg += vol;
      sum.minutes += this.entryMinutes(en);
      sum.kcal += this.entryKcal(en, weightKg);
      sum.load += this.entryLoad(en);
      sum.distanceKm += en.distance || 0;
      sum.bySection[en.section] = (sum.bySection[en.section] || 0) + (en.section === 'cardio' ? this.entryMinutes(en) : vol);
      sum.groups.add(en.group);
      (en.sets || []).forEach(s => { if (s.done && s.rpe) { rpeSum += s.rpe; rpeN++; } });
      if (en.rpe) { rpeSum += en.rpe; rpeN++; }
    });
    sum.avgRpe = rpeN ? round(rpeSum / rpeN, 1) : 0;
    sum.groupCount = sum.groups.size;
    sum.minutes = Math.round(sum.minutes);
    sum.volumeKg = Math.round(sum.volumeKg);
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
    // mid-sleep clock position in minutes from midnight (for consistency scoring)
    const [bh, bm] = s.bed.split(':').map(Number);
    let bedMin = bh * 60 + bm;
    if (bedMin < 720) bedMin += 1440;                                // treat 00:30 as 24:30
    const midSleep = (bedMin + latency + tst / 2) % 1440;
    return {
      tibMin: tib, tstMin: tst, napMin: naps, totalMin: tst + naps,
      hours: round(tst / 60, 2), totalHours: round((tst + naps) / 60, 2),
      efficiency, latency, awake, awakenings: s.awakenings || 0,
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

  /** Recovery: sleep quantity, efficiency, subjective quality, hydration */
  recoveryScore(day, keys, p, targets) {
    const s = this.sleepSummary(day);
    if (!s) return null;
    const durScore = Math.min(100, Math.round(s.totalHours / targets.sleepH * 100));
    const effScore = Math.min(100, Math.round(s.efficiency / 90 * 100));
    const qualScore = s.quality ? s.quality / 5 * 100 : 70;
    const cons = this.sleepConsistency(keys);
    const consScore = cons == null ? 70 : cons;
    const wakeScore = Math.max(0, 100 - (s.awakenings || 0) * 12);
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
        acc.sleepH.push(sl.totalHours); acc.sleepEff.push(sl.efficiency);
        acc.latency.push(sl.latency); acc.awakenings.push(sl.awakenings);
        if (sl.quality) acc.sleepQual.push(sl.quality);
      }
      if (d.weightKg) acc.weights.push(d.weightKg);
      const ts = this.trainingScore(d, p); if (ts != null) acc.trainingScores.push(ts);
      const ns = this.nutritionScore(d, targets); if (ns != null) acc.nutritionScores.push(ns);
      const rs = this.recoveryScore(d, keys, p, targets); if (rs != null) acc.recoveryScores.push(rs);
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
      weight: avg(acc.weights),
      overall: avg([avg(acc.trainingScores), avg(acc.nutritionScores), avg(acc.recoveryScores)].filter(v => v != null))
    };
  },

  /** Personal records across all logged days, keyed by exercise name */
  personalRecords() {
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
    return prs;
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
