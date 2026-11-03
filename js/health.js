/* ==========================================================================
   FitLog — data health

   A log that is meant to last years needs a way to look at itself. This walks
   everything stored and reports what does not add up, in the user's terms
   rather than the schema's — then fixes what can be fixed without guessing.
   ========================================================================== */

const DataHealth = {

  exerciseCount() {
    const names = new Set();
    Object.values(Store.s.days).forEach(d =>
      ((d.workout || {}).entries || []).forEach(e => names.add(e.exercise)));
    return names.size;
  },

  /** Everything suspect, as a flat list. Read-only. */
  scan() {
    const out = [];
    const push = (severity, title, detail) => out.push({ severity, title, detail });
    const bw = Store.s.profile.weightKg || 75;

    Object.entries(Store.s.days).forEach(([k, d]) => {
      if (!d || typeof d !== 'object') {
        push('bad', `${k} is unreadable`, 'The stored day is not a valid record.');
        return;
      }

      ((d.workout || {}).entries || []).forEach(e => {
        if (!e.exercise) {
          push('bad', `${k}: an exercise with no name`, 'It will not appear in history or records.');
          return;
        }
        if (!Store.findExercise(e.exercise)) {
          const canonical = resolveExerciseName(e.exercise);
          push('warn', `${k}: "${e.exercise}" is not in your exercise list`,
            canonical ? `Looks like ${canonical} — repairing will merge them.`
                      : 'Repairing will save it as one of your own exercises.');
        }
        if (e.rpe != null && (e.rpe < LIMITS.rpe.min || e.rpe > LIMITS.rpe.max)) {
          push('warn', `${k}: ${e.exercise} intensity is ${e.rpe}`,
            `The scale is ${LIMITS.rpe.min}–${LIMITS.rpe.max}; this inflates training load.`);
        }
        if (e.duration != null && e.duration > LIMITS.duration.max) {
          push('warn', `${k}: ${e.exercise} ran ${e.duration} minutes`, 'Longer than any plausible session.');
        }
        if (e.hr != null && (e.hr < LIMITS.hr.min || e.hr > LIMITS.hr.max)) {
          push('warn', `${k}: heart rate ${e.hr}`, 'Outside a believable range.');
        }
        if (e.mode === 'cardio' && e.kcalMachine == null && e.note && /\d{2,5}\s*(k?cal|calorie)/i.test(e.note)) {
          push('warn', `${k}: calories are in the note on ${e.exercise}`, 'Repairing moves them into the calories field.');
        }
        (e.sets || []).forEach((s, i) => {
          if (s.w != null && s.w > LIMITS.weightKg.max) push('warn', `${k}: ${e.exercise} set ${i + 1} is ${s.w} kg`, 'Beyond the maximum FitLog stores.');
          if (s.r != null && s.r > LIMITS.reps.max) push('warn', `${k}: ${e.exercise} set ${i + 1} has ${s.r} reps`, 'Beyond the maximum FitLog stores.');
          if (e.mode === 'bodyweight' && !isAssisted(e.exercise) && s.w != null && s.w > bw) {
            push('warn', `${k}: ${e.exercise} with ${s.w} kg added`,
              'More than your bodyweight added — if that was an assisted machine, pick the assisted version so the maths works.');
          }
        });
      });

      const sl = Calc.sleepSummary(d);
      if (sl && sl.tibMin > 14 * 60) {
        push('warn', `${k}: ${fmtHours(sl.tibMin / 60)} in bed`, `${sl.bed} to ${sl.wake} — likely an am/pm slip.`);
      }

      Object.values((d.diet || {}).meals || {}).forEach(items => items.forEach(it => {
        if (it.kcal > LIMITS.kcal.max) push('warn', `${k}: ${it.name} at ${it.kcal} kcal`, 'Implausible for one item.');
      }));
    });

    // orphaned recipe ingredients
    (Store.s.recipes || []).forEach(r => {
      (r.ingredients || []).forEach(ing => {
        if (!Store.findFood(ing.foodId)) {
          push('warn', `Recipe "${r.name}" refers to a food that no longer exists`,
            'Its calories are left out of the total.');
        }
      });
    });

    return out;
  },

  /** Apply the fixes the scan described. Returns how many it made. */
  repair() {
    let n = 0;
    const bw = Store.s.profile.weightKg || 75;

    Object.entries(Store.s.days).forEach(([k, d]) => {
      if (!d || typeof d !== 'object') return;
      let touched = false;

      ((d.workout || {}).entries || []).forEach(e => {
        if (e.exercise && !Store.findExercise(e.exercise)) {
          const canonical = resolveExerciseName(e.exercise);
          if (canonical) {
            const meta = EX_BY_NAME[canonical];
            e.exercise = canonical;
            if (meta) {
              e.section = meta.section; e.group = meta.groupId; e.groupName = meta.groupName;
              e.eq = meta.eq; e.mode = meta.mode; e.met = meta.met;
            }
          } else {
            Store.s.customExercises.push({
              id: 'cx' + uid(), name: e.exercise,
              section: e.section || 'upper', groupId: e.group || 'core',
              groupName: e.groupName || 'Other', eq: e.eq || 'Other',
              mode: e.mode || 'strength', met: e.met || 5, rom: null
            });
          }
          n++; touched = true;
        }

        const clampField = (field, kind) => {
          const before = e[field];
          const after = clamp(before, kind);
          if (before != null && after !== before) { e[field] = after; n++; touched = true; }
        };
        clampField('rpe', 'rpe');
        clampField('duration', 'duration');
        clampField('hr', 'hr');
        clampField('kcalMachine', 'kcal');
        clampField('distance', 'distanceKm');

        if (e.mode === 'cardio' && e.kcalMachine == null && e.note) {
          const m = e.note.match(/(\d{2,5})\s*(?:k?cal|calorie)/i);
          if (m) {
            const kc = clamp(+m[1], 'kcal');
            if (kc) { e.kcalMachine = kc; n++; touched = true; }
          }
        }

        (e.sets || []).forEach(s => {
          const w = clamp(s.w, 'weightKg'); if (s.w != null && w !== s.w) { s.w = w; n++; touched = true; }
          const r = clamp(s.r, 'reps');     if (s.r != null && r !== s.r) { s.r = r; n++; touched = true; }
          const sec = clamp(s.sec, 'seconds'); if (s.sec != null && sec !== s.sec) { s.sec = sec; n++; touched = true; }
        });
      });

      if (touched) Store.day(k, true);     // mark it so the change is stamped and synced
    });

    if (n) Store.save();
    return n;
  }
};
