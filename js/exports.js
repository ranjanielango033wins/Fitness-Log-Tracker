/* ==========================================================================
   FitLog — reports: PDF (jsPDF + autoTable) and Excel (SheetJS)
   Both degrade gracefully: PDF falls back to the browser's print dialog,
   Excel falls back to a CSV bundle, so the app still works offline.
   ========================================================================== */

const Reports = {
  range: 30,

  open() {
    const s = openSheet({ title: 'Reports & export', wide: true, body: '<div id="rp"></div>' });
    this.draw(s);
  },

  keys() {
    if (this.range === 'all') {
      const logged = Store.loggedDays();
      if (!logged.length) return [todayKey()];
      const from = logged[0], to = logged[logged.length - 1];
      const n = Math.round((keyToDate(to) - keyToDate(from)) / DAY_MS) + 1;
      return rangeKeys(from, Math.min(n, 800));
    }
    return rangeKeys(addDays(todayKey(), -(this.range - 1)), this.range);
  },

  draw(s) {
    const keys = this.keys();
    const agg = Calc.aggregate(keys);
    $('#rp', s.sheet).innerHTML = `
      <div class="section-title">Period</div>
      <div class="chips" style="margin-bottom:14px">
        ${[[7, 'Last 7 days'], [14, 'Last 14 days'], [30, 'Last 30 days'], [90, 'Last 90 days'], ['all', 'Everything']]
          .map(([v, l]) => `<button class="chip ${this.range == v ? 'active' : ''}" data-r="${v}">${l}</button>`).join('')}
      </div>
      <div class="card" style="background:var(--card-2)">
        <div class="kv"><span class="kk">Range</span><span class="vv">${esc(shortDate(keys[0]))} – ${esc(shortDate(keys[keys.length - 1]))}</span></div>
        <div class="kv"><span class="kk">Days with data</span><span class="vv">${agg.daysLogged} of ${keys.length}</span></div>
        <div class="kv"><span class="kk">Workouts</span><span class="vv">${agg.workoutDays}</span></div>
        <div class="kv"><span class="kk">Total volume</span><span class="vv">${fmtNum(Units.wOut(agg.volumeKg))} ${Units.wLabel()}</span></div>
        <div class="kv"><span class="kk">Avg calories</span><span class="vv">${agg.kcal == null ? '–' : fmtNum(agg.kcal) + ' kcal'}</span></div>
        <div class="kv"><span class="kk">Avg sleep</span><span class="vv">${agg.sleepH == null ? '–' : fmtHours(agg.sleepH)}</span></div>
      </div>

      <div class="section-title">Export</div>
      <div class="list card flush">
        <div class="row click" id="x-pdf">
          <span style="color:var(--bad)">${icon('file')}</span>
          <div class="grow"><div class="t">Comprehensive PDF report</div>
            <div class="s">Summary, period comparison, training, nutrition, sleep, PRs and the full daily log</div></div>
          ${icon('download')}</div>
        <div class="row click" id="x-xls">
          <span style="color:var(--good)">${icon('grid')}</span>
          <div class="grow"><div class="t">Excel workbook</div>
            <div class="s">Nine sheets — every set, every food item, every night, ready to pivot</div></div>
          ${icon('download')}</div>
        <div class="row click" id="x-csv">
          <span style="color:var(--acc)">${icon('file')}</span>
          <div class="grow"><div class="t">CSV bundle</div>
            <div class="s">Plain text, opens anywhere</div></div>
          ${icon('download')}</div>
        <div class="row click" id="x-json">
          <span style="color:var(--sleep)">${icon('save')}</span>
          <div class="grow"><div class="t">Full backup (JSON)</div>
            <div class="s">Everything, restorable on any device</div></div>
          ${icon('download')}</div>
      </div>
      <p class="dim tiny" style="margin-top:12px">Everything is generated inside your browser — no upload, no server, and it
        works with the Wi-Fi off. If a library ever fails to load, FitLog falls back to the print dialog and CSV.</p>`;

    $$('[data-r]', s.sheet).forEach(b => b.onclick = () => {
      this.range = b.dataset.r === 'all' ? 'all' : +b.dataset.r;
      this.draw(s);
    });
    $('#x-pdf', s.sheet).onclick = () => this.pdf();
    $('#x-xls', s.sheet).onclick = () => this.excel();
    $('#x-csv', s.sheet).onclick = () => this.csv();
    $('#x-json', s.sheet).onclick = () => Backup.export();
  },

  /* ---------- shared data shaping ---------- */
  build() {
    const keys = this.keys();
    const p = Store.s.profile;
    const t = Targets.current();
    const cur = Calc.aggregate(keys);
    const span = keys.length;
    const prevKeys = rangeKeys(addDays(keys[0], -span), span);
    const prev = Calc.aggregate(prevKeys);

    const sets = [], cardio = [], foods = [], daily = [], sleep = [], water = [];

    keys.forEach(k => {
      const d = Store.s.days[k];
      if (!d) return;
      const wsum = Calc.workoutSummary(d, p.weightKg);
      const dsum = Calc.dietSummary(d);
      const ssum = Calc.sleepSummary(d);

      ((d.workout || {}).entries || []).forEach(e => {
        if (e.mode === 'cardio') {
          cardio.push({
            Date: k, Exercise: e.exercise, Group: e.groupName,
            Minutes: e.duration || 0,
            [`Distance (${Units.dLabel()})`]: e.distance ? round(Units.dOut(e.distance), 2) : '',
            'Avg HR': e.hr || '', RPE: e.rpe || '',
            Calories: Calc.entryKcal(e, p.weightKg), Load: Calc.entryLoad(e)
          });
        } else {
          (e.sets || []).forEach((st, i) => {
            if (!st.done) return;
            sets.push({
              Date: k, Section: EX_LIB[e.section] ? EX_LIB[e.section].label : e.section,
              'Muscle group': e.groupName, Exercise: e.exercise, Equipment: e.eq,
              Set: i + 1, Type: st.type || 'working',
              [`Weight (${Units.wLabel()})`]: st.w != null ? round(Units.wOut(st.w), 2) : '',
              Reps: st.r || (st.sec ? '' : 0),
              'Seconds': st.sec || '',
              RPE: st.rpe || '',
              [`Volume (${Units.wLabel()})`]: round(Units.wOut((st.w || 0) * (st.r || 0)), 1),
              [`Est. 1RM (${Units.wLabel()})`]: st.w && st.r ? round(Units.wOut(Calc.e1rm(st.w, st.r)), 1) : ''
            });
          });
        }
      });

      Object.entries((d.diet || {}).meals || {}).forEach(([slot, items]) => {
        const slotName = (MEAL_SLOTS.find(m => m.id === slot) || {}).name || slot;
        items.forEach(it => foods.push({
          Date: k, Meal: slotName, Food: it.name, 'Grams': it.grams || '',
          Serving: it.serving || '', Calories: it.kcal,
          'Protein (g)': it.p, 'Carbs (g)': it.c, 'Fat (g)': it.f, 'Fibre (g)': it.fib || 0
        }));
      });

      ((d.diet || {}).waterLog || []).forEach(w => water.push({
        Date: k, Time: w.t, [`Amount (${Units.vLabel()})`]: round(Units.vOut(w.ml), 1)
      }));

      if (ssum) {
        const row = {
          Date: k, 'Bed time': ssum.bed, 'Wake time': ssum.wake,
          'Time in bed (h)': round(ssum.tibMin / 60, 2),
          'Asleep (h)': round(ssum.tstMin / 60, 2),
          'Naps (min)': ssum.napMin, 'Total sleep (h)': ssum.totalHours,
          'Efficiency (%)': ssum.efficiency, 'Latency (min)': ssum.latency,
          'Awake in night (min)': ssum.awake, 'Wake-ups': ssum.awakenings,
          'Rested (1-5)': ssum.quality || '',
          'Notes': (d.sleep && d.sleep.note) || ''
        };
        Store.s.customSleepFields.forEach(f => {
          row[f.label + (f.unit ? ` (${f.unit})` : '')] = ((d.sleep || {}).custom || {})[f.id] ?? '';
        });
        sleep.push(row);
      }

      if (dayHasData(d)) daily.push({
        Date: k,
        Day: keyToDate(k).toLocaleDateString(undefined, { weekday: 'short' }),
        Exercises: wsum.entries, Sets: wsum.sets, Reps: wsum.reps,
        [`Volume (${Units.wLabel()})`]: round(Units.wOut(wsum.volumeKg)),
        'Train min': wsum.minutes, 'Train kcal': wsum.kcal, 'Load': wsum.load,
        'Avg RPE': wsum.avgRpe || '',
        'Calories in': dsum.kcal, 'Protein (g)': dsum.p, 'Carbs (g)': dsum.c, 'Fat (g)': dsum.f, 'Fibre (g)': dsum.fib,
        [`Water (${Units.vBigLabel()})`]: round(Units.vBig(dsum.waterMl), 2),
        'Sleep (h)': ssum ? ssum.totalHours : '',
        'Sleep eff (%)': ssum ? ssum.efficiency : '',
        [`Bodyweight (${Units.wLabel()})`]: d.weightKg ? round(Units.wOut(d.weightKg), 1) : '',
        'Training score': Calc.trainingScore(d, p) ?? '',
        'Nutrition score': Calc.nutritionScore(d, t) ?? '',
        'Recovery score': Calc.recoveryScore(d, keys, p, t) ?? ''
      });
    });

    const prs = Object.values(Calc.personalRecords()).sort((a, b) => b.e1rm - a.e1rm).map(r => ({
      Exercise: r.exercise, 'Muscle group': r.group,
      [`Best est. 1RM (${Units.wLabel()})`]: round(Units.wOut(r.e1rm), 1),
      [`From (${Units.wLabel()})`]: round(Units.wOut(r.w), 1), Reps: r.r, Date: r.date,
      [`Heaviest set (${Units.wLabel()})`]: round(Units.wOut(r.heaviest || r.w), 1),
      'Heaviest reps': r.heaviestReps || r.r
    }));

    return { keys, prevKeys, cur, prev, p, t, sets, cardio, foods, daily, sleep, water, prs };
  },

  comparisonRows(b) {
    const { cur, prev } = b;
    const pct = (a, x) => {
      if (a == null || x == null) return '';
      if (!x) return a ? 'new' : '';
      const v = (a - x) / Math.abs(x) * 100;
      return (Math.abs(v) > 999 ? (v > 0 ? '>999' : '<-999') : v.toFixed(1)) + '%';
    };
    const n = (v, dp) => v == null ? '' : round(v, dp == null ? 0 : dp);
    return [
      ['TRAINING', '', '', ''],
      ['Sessions', n(cur.workoutDays), n(prev.workoutDays), pct(cur.workoutDays, prev.workoutDays)],
      [`Total volume (${Units.wLabel()})`, n(Units.wOut(cur.volumeKg)), n(Units.wOut(prev.volumeKg)), pct(cur.volumeKg, prev.volumeKg)],
      [`Volume per session (${Units.wLabel()})`, n(Units.wOut(cur.volumePerSession)), n(Units.wOut(prev.volumePerSession)), pct(cur.volumePerSession, prev.volumePerSession)],
      ['Working sets', n(cur.sets), n(prev.sets), pct(cur.sets, prev.sets)],
      ['Reps', n(cur.reps), n(prev.reps), pct(cur.reps, prev.reps)],
      ['Minutes training', n(cur.trainMin), n(prev.trainMin), pct(cur.trainMin, prev.trainMin)],
      ['Training load (sRPE)', n(cur.load), n(prev.load), pct(cur.load, prev.load)],
      ['Average RPE', n(cur.avgRpe, 1), n(prev.avgRpe, 1), pct(cur.avgRpe, prev.avgRpe)],
      [`Cardio distance (${Units.dLabel()})`, n(Units.dOut(cur.distanceKm), 2), n(Units.dOut(prev.distanceKm), 2), pct(cur.distanceKm, prev.distanceKm)],
      ['Training score', n(cur.training), n(prev.training), pct(cur.training, prev.training)],
      ['NUTRITION', '', '', ''],
      ['Calories / day', n(cur.kcal), n(prev.kcal), pct(cur.kcal, prev.kcal)],
      ['Protein / day (g)', n(cur.protein), n(prev.protein), pct(cur.protein, prev.protein)],
      ['Carbs / day (g)', n(cur.carbs), n(prev.carbs), pct(cur.carbs, prev.carbs)],
      ['Fat / day (g)', n(cur.fat), n(prev.fat), pct(cur.fat, prev.fat)],
      ['Fibre / day (g)', n(cur.fibre, 1), n(prev.fibre, 1), pct(cur.fibre, prev.fibre)],
      [`Water / day (${Units.vBigLabel()})`, n(Units.vBig(cur.water || 0), 2), n(Units.vBig(prev.water || 0), 2), pct(cur.water, prev.water)],
      ['Nutrition score', n(cur.nutrition), n(prev.nutrition), pct(cur.nutrition, prev.nutrition)],
      ['RECOVERY', '', '', ''],
      ['Sleep / night (h)', n(cur.sleepH, 2), n(prev.sleepH, 2), pct(cur.sleepH, prev.sleepH)],
      ['Sleep efficiency (%)', n(cur.sleepEff, 1), n(prev.sleepEff, 1), pct(cur.sleepEff, prev.sleepEff)],
      ['Latency (min)', n(cur.latency), n(prev.latency), pct(cur.latency, prev.latency)],
      ['Wake-ups / night', n(cur.awakenings, 1), n(prev.awakenings, 1), pct(cur.awakenings, prev.awakenings)],
      ['Rested rating (1-5)', n(cur.sleepQual, 1), n(prev.sleepQual, 1), pct(cur.sleepQual, prev.sleepQual)],
      ['Recovery score', n(cur.recovery), n(prev.recovery), pct(cur.recovery, prev.recovery)],
      ['OVERALL', n(cur.overall), n(prev.overall), pct(cur.overall, prev.overall)]
    ];
  },

  /* ---------- PDF ---------- */
  pdf() {
    const jsPDFns = window.jspdf || window.jsPDF;
    if (!jsPDFns || !jsPDFns.jsPDF) {
      toast('PDF library unavailable offline — opening the print view instead', 'warn');
      return this.printReport();
    }
    const { jsPDF } = jsPDFns;
    const b = this.build();
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const W = doc.internal.pageSize.getWidth();
    const M = 40;
    let y = 0;

    const title = (txt, size, color) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size || 16);
      doc.setTextColor(color || '#111827');
      doc.text(txt, M, y); y += (size || 16) + 6;
    };
    const para = (txt, size) => {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(size || 10);
      doc.setTextColor('#4b5563');
      const lines = doc.splitTextToSize(txt, W - M * 2);
      doc.text(lines, M, y); y += lines.length * (size || 10) * 1.35 + 6;
    };
    const table = (head, body, opts) => {
      doc.autoTable(Object.assign({
        startY: y, head: head ? [head] : undefined, body,
        margin: { left: M, right: M },
        styles: { fontSize: 8, cellPadding: 3.5, lineColor: '#e5e7eb', lineWidth: .4 },
        headStyles: { fillColor: [79, 140, 255], textColor: 255, fontStyle: 'bold', fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] }
      }, opts || {}));
      y = doc.lastAutoTable.finalY + 18;
    };
    const pageBreak = (need) => {
      if (y + (need || 90) > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 50; }
    };

    /* --- cover --- */
    doc.setFillColor(11, 13, 18); doc.rect(0, 0, W, 150, 'F');
    doc.setFillColor(79, 140, 255); doc.roundedRect(M, 36, 30, 30, 8, 8, 'F');
    doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
    doc.text('F', M + 11, 57);
    doc.setFontSize(24); doc.text('FitLog Report', M + 42, 58);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#9aa4bb');
    doc.text(`${b.p.name || 'Athlete'}  ·  ${prettyDate(b.keys[0], { day: 'numeric', month: 'short', year: 'numeric' })} – ${prettyDate(b.keys[b.keys.length - 1], { day: 'numeric', month: 'short', year: 'numeric' })}`, M + 42, 74);
    doc.text(`Generated ${new Date().toLocaleString()}`, M + 42, 88);

    // headline numbers on the dark band
    const heads = [
      ['Days logged', `${b.cur.daysLogged}/${b.keys.length}`],
      ['Workouts', String(b.cur.workoutDays)],
      ['Volume', `${fmtNum(Units.wOut(b.cur.volumeKg))} ${Units.wLabel()}`],
      ['Avg sleep', b.cur.sleepH == null ? '–' : fmtHours(b.cur.sleepH)],
      ['Overall', b.cur.overall == null ? '–' : Math.round(b.cur.overall) + '/100']
    ];
    heads.forEach((h, i) => {
      const x = M + i * ((W - M * 2) / heads.length);
      doc.setTextColor('#6b7489'); doc.setFontSize(7.5); doc.text(h[0].toUpperCase(), x, 116);
      doc.setTextColor('#ffffff'); doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.text(h[1], x, 132);
      doc.setFont('helvetica', 'normal');
    });

    y = 182;

    /* --- profile & targets --- */
    title('Profile and targets', 14);
    table(null, [
      ['Name', b.p.name || '—'],
      ['Age / sex', `${b.p.age} · ${b.p.sex}`],
      ['Height', `${round(Units.hOut(b.p.heightCm), 1)} ${Units.hLabel()}`],
      ['Bodyweight', `${round(Units.wOut(b.p.weightKg), 1)} ${Units.wLabel()}`],
      ['Goal', b.p.goal],
      ['BMR (Mifflin-St Jeor)', `${fmtNum(Calc.bmr(b.p))} kcal`],
      ['Maintenance (TDEE)', `${fmtNum(Calc.tdee(b.p))} kcal`],
      ['Calorie target', `${fmtNum(b.t.kcal)} kcal`],
      ['Macro target', `${b.t.protein} g protein · ${b.t.carbs} g carbs · ${b.t.fat} g fat`],
      ['Water target', Units.fmtVBig(b.t.waterMl)],
      ['Sleep target', `${b.t.sleepH} h`]
    ], { theme: 'plain', styles: { fontSize: 9, cellPadding: 3 }, columnStyles: { 0: { fontStyle: 'bold', cellWidth: 170, textColor: '#374151' } } });

    /* --- comparison --- */
    pageBreak(200);
    title('Period comparison', 14);
    para(`This report covers ${b.keys.length} days against the ${b.keys.length} days immediately before it (${shortDate(b.prevKeys[0])} – ${shortDate(b.prevKeys[b.prevKeys.length - 1])}). Percentages show the direction of travel, not a pass or fail.`);
    const rows = this.comparisonRows(b);
    table(['Metric', 'This period', 'Previous', 'Change'], rows, {
      columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
      didParseCell: d => {
        if (d.section === 'body' && ['TRAINING', 'NUTRITION', 'RECOVERY', 'OVERALL'].includes(d.row.raw[0])) {
          d.cell.styles.fillColor = [232, 238, 250];
          d.cell.styles.fontStyle = 'bold';
          d.cell.styles.textColor = [31, 41, 55];
        }
        if (d.section === 'body' && d.column.index === 3 && typeof d.cell.raw === 'string' && d.cell.raw.endsWith('%')) {
          const v = parseFloat(d.cell.raw);
          if (!isNaN(v) && Math.abs(v) >= 2) d.cell.styles.textColor = v > 0 ? [16, 150, 100] : [200, 50, 60];
        }
      }
    });

    /* --- narrative --- */
    pageBreak(140);
    title('Reading of the period', 14);
    this.narrative(b).forEach(n => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor('#111827');
      doc.text('• ' + n.title, M, y); y += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#4b5563');
      const lines = doc.splitTextToSize(n.body, W - M * 2 - 12);
      doc.text(lines, M + 12, y); y += lines.length * 11 + 8;
      pageBreak(60);
    });

    /* --- personal records --- */
    if (b.prs.length) {
      pageBreak(160);
      title('Personal records', 14);
      table(Object.keys(b.prs[0]), b.prs.slice(0, 40).map(r => Object.values(r)));
    }

    /* --- daily log --- */
    if (b.daily.length) {
      doc.addPage('a4', 'landscape'); y = 50;
      title('Daily log', 14);
      const cols = Object.keys(b.daily[0]);
      table(cols, b.daily.map(r => cols.map(c => r[c])), {
        margin: { left: 30, right: 30 },
        styles: { fontSize: 6.2, cellPadding: 2.2 },
        headStyles: { fillColor: [79, 140, 255], textColor: 255, fontSize: 6.2 }
      });
    }

    /* --- training detail --- */
    if (b.sets.length) {
      doc.addPage('a4', 'landscape'); y = 50;
      title('Training log — every working set', 14);
      const cols = Object.keys(b.sets[0]);
      table(cols, b.sets.map(r => cols.map(c => r[c])), {
        margin: { left: 30, right: 30 }, styles: { fontSize: 6.4, cellPadding: 2.2 },
        headStyles: { fillColor: [79, 140, 255], textColor: 255, fontSize: 6.4 }
      });
    }
    if (b.cardio.length) {
      pageBreak(150);
      title('Cardio log', 13);
      const cols = Object.keys(b.cardio[0]);
      table(cols, b.cardio.map(r => cols.map(c => r[c])), { margin: { left: 30, right: 30 }, styles: { fontSize: 7 } });
    }

    /* --- sleep detail --- */
    if (b.sleep.length) {
      doc.addPage('a4', 'landscape'); y = 50;
      title('Sleep log', 14);
      const cols = Object.keys(b.sleep[0]);
      table(cols, b.sleep.map(r => cols.map(c => r[c])), {
        margin: { left: 30, right: 30 }, styles: { fontSize: 6.6, cellPadding: 2.2 },
        headStyles: { fillColor: [162, 123, 255], textColor: 255, fontSize: 6.6 }
      });
    }

    /* --- nutrition detail --- */
    if (b.foods.length) {
      doc.addPage('a4', 'landscape'); y = 50;
      title('Nutrition log — every item', 14);
      const cols = Object.keys(b.foods[0]);
      table(cols, b.foods.map(r => cols.map(c => r[c])), {
        margin: { left: 30, right: 30 }, styles: { fontSize: 6.4, cellPadding: 2.2 },
        headStyles: { fillColor: [35, 201, 139], textColor: 255, fontSize: 6.4 }
      });
    }

    /* --- footers --- */
    const pages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      doc.setPage(i);
      doc.setFontSize(7.5); doc.setTextColor('#9ca3af'); doc.setFont('helvetica', 'normal');
      doc.text('FitLog report — estimates for training decisions, not medical advice', M, doc.internal.pageSize.getHeight() - 22);
      doc.text(`${i} / ${pages}`, doc.internal.pageSize.getWidth() - M, doc.internal.pageSize.getHeight() - 22, { align: 'right' });
    }

    doc.save(`fitlog-report-${todayKey()}.pdf`);
    toast('PDF report downloaded', 'good');
  },

  narrative(b) {
    const out = [];
    const { cur, prev, t } = b;
    const pc = (a, x) => (a == null || x == null || !x) ? null : (a - x) / Math.abs(x) * 100;

    const volPc = pc(cur.volumePerSession, prev.volumePerSession);
    if (volPc != null) out.push({
      title: volPc > 3 ? 'Training volume is trending up' : volPc < -3 ? 'Training volume is trending down' : 'Training volume is holding steady',
      body: `Volume per session averaged ${fmtNum(Units.wOut(cur.volumePerSession))} ${Units.wLabel()} against ${fmtNum(Units.wOut(prev.volumePerSession))} ${Units.wLabel()} in the previous period (${volPc > 0 ? '+' : ''}${volPc.toFixed(1)}%). Volume is the clearest proxy for how much work the muscle actually did, so a sustained rise here is the single best sign that the programme is progressing.`
    });

    if (cur.kcal != null) out.push({
      title: 'Energy balance',
      body: `Intake averaged ${fmtNum(cur.kcal)} kcal a day against a ${fmtNum(t.kcal)} kcal target (${(cur.kcal - t.kcal > 0 ? '+' : '') + fmtNum(cur.kcal - t.kcal)} kcal). Training added roughly ${fmtNum(cur.trainKcal / Math.max(1, cur.daysLogged))} kcal a day of expenditure. Protein came in at ${fmtNum(cur.protein)} g/day against a ${t.protein} g target — protein is the macro worth defending when the rest slips.`
    });

    if (cur.sleepH != null) out.push({
      title: 'Sleep and recovery',
      body: `You averaged ${fmtHours(cur.sleepH)} a night at ${fmtNum(cur.sleepEff, 1)}% efficiency${prev.sleepH != null ? `, versus ${fmtHours(prev.sleepH)} before` : ''}. Sleep efficiency above 85% is the usual benchmark; below that, time in bed is being spent awake rather than asleep. Recovery scored ${cur.recovery == null ? '–' : Math.round(cur.recovery)}/100 across the period.`
    });

    const acwr = Calc.acwr(b.keys[b.keys.length - 1]);
    if (acwr != null) out.push({
      title: `Workload ratio ${acwr}`,
      body: acwr < 0.8
        ? 'Acute (7-day) load sits well below the 4-week average. That is a deload if intended, and lost ground if not.'
        : acwr <= 1.3
          ? 'Acute load sits inside the 0.8–1.3 band where the training stimulus is high relative to what the body has already adapted to, without the spike associated with injury.'
          : 'Acute load is running well ahead of the 4-week average. Holding or trimming volume for a week lets adaptation catch up.'
    });

    if (cur.training != null && cur.recovery != null && cur.training > 70 && cur.recovery < 55) out.push({
      title: 'Training is outpacing recovery',
      body: 'High output on low recovery is the pattern that precedes plateaus and soft-tissue problems. The cheapest correction is an extra hour of sleep a night; the second cheapest is one fewer hard session a week.'
    });

    if (!out.length) out.push({ title: 'Not enough data yet', body: 'Log a few more days and this section fills in with a read of what changed and why.' });
    return out;
  },

  printReport() {
    const b = this.build();
    const rows = this.comparisonRows(b);
    const w = window.open('', '_blank');
    if (!w) return toast('Allow pop-ups to use the print report', 'warn');
    w.document.write(`<!DOCTYPE html><html><head><title>FitLog report ${todayKey()}</title>
      <style>
        body{font:13px -apple-system,Segoe UI,Roboto,sans-serif;color:#111;margin:32px;}
        h1{font-size:22px;margin:0 0 4px} h2{font-size:15px;margin:22px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
        table{width:100%;border-collapse:collapse;font-size:11px;margin-bottom:14px}
        th{background:#4f8cff;color:#fff;text-align:left;padding:5px 6px;font-size:10px}
        td{padding:4px 6px;border-bottom:1px solid #eee} td:not(:first-child){text-align:right}
        tr.g td{background:#eef2fb;font-weight:700}
        .muted{color:#666}
      </style></head><body>
      <h1>FitLog Report</h1>
      <div class="muted">${esc(b.p.name || 'Athlete')} · ${esc(shortDate(b.keys[0]))} – ${esc(shortDate(b.keys[b.keys.length - 1]))} · generated ${new Date().toLocaleString()}</div>
      <h2>Period comparison</h2>
      <table><tr><th>Metric</th><th>This period</th><th>Previous</th><th>Change</th></tr>
      ${rows.map(r => `<tr class="${['TRAINING', 'NUTRITION', 'RECOVERY', 'OVERALL'].includes(r[0]) ? 'g' : ''}">${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}
      </table>
      <h2>Daily log</h2>
      ${b.daily.length ? `<table><tr>${Object.keys(b.daily[0]).map(c => `<th>${esc(c)}</th>`).join('')}</tr>
        ${b.daily.map(r => `<tr>${Object.values(r).map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</table>` : '<p class="muted">No days logged.</p>'}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  },

  /* ---------- Excel ---------- */
  excel() {
    if (!window.XLSX) {
      toast('Excel library unavailable offline — exporting CSV instead', 'warn');
      return this.csv();
    }
    const b = this.build();
    const wb = XLSX.utils.book_new();

    const add = (name, rows, cols) => {
      if (!rows || !rows.length) return;
      const ws = XLSX.utils.json_to_sheet(rows);
      ws['!cols'] = (cols || Object.keys(rows[0])).map(c => ({ wch: Math.min(26, Math.max(10, String(c).length + 3)) }));
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };
      XLSX.utils.book_append_sheet(wb, ws, name.slice(0, 31));
    };

    /* Summary sheet */
    const sum = [
      { Field: 'Report generated', Value: new Date().toLocaleString() },
      { Field: 'Athlete', Value: b.p.name || '—' },
      { Field: 'Period', Value: `${b.keys[0]} to ${b.keys[b.keys.length - 1]}` },
      { Field: 'Compared with', Value: `${b.prevKeys[0]} to ${b.prevKeys[b.prevKeys.length - 1]}` },
      { Field: 'Units', Value: Store.s.settings.units },
      { Field: '', Value: '' },
      { Field: 'Age', Value: b.p.age },
      { Field: 'Sex', Value: b.p.sex },
      { Field: `Height (${Units.hLabel()})`, Value: round(Units.hOut(b.p.heightCm), 1) },
      { Field: `Bodyweight (${Units.wLabel()})`, Value: round(Units.wOut(b.p.weightKg), 1) },
      { Field: 'Goal', Value: b.p.goal },
      { Field: 'BMR (kcal)', Value: Calc.bmr(b.p) },
      { Field: 'TDEE (kcal)', Value: Calc.tdee(b.p) },
      { Field: 'Calorie target', Value: b.t.kcal },
      { Field: 'Protein target (g)', Value: b.t.protein },
      { Field: 'Carb target (g)', Value: b.t.carbs },
      { Field: 'Fat target (g)', Value: b.t.fat },
      { Field: `Water target (${Units.vBigLabel()})`, Value: round(Units.vBig(b.t.waterMl), 2) },
      { Field: 'Sleep target (h)', Value: b.t.sleepH }
    ];
    add('Summary', sum);

    add('Comparison', this.comparisonRows(b).map(r => ({
      Metric: r[0], 'This period': r[1], 'Previous period': r[2], 'Change': r[3]
    })));

    add('Daily', b.daily);
    add('Strength sets', b.sets);
    add('Cardio', b.cardio);
    add('Nutrition items', b.foods);
    add('Water', b.water);
    add('Sleep', b.sleep);
    add('Personal records', b.prs);

    if (Store.s.recipes.length) {
      add('Recipes', Store.s.recipes.flatMap(r => {
        const t = Diet.recipeTotals(r);
        return (r.ingredients || []).map(ing => {
          const f = Store.findFood(ing.foodId);
          return {
            Recipe: r.name, Servings: r.servings,
            Ingredient: f ? f.name : '(missing)', Grams: ing.grams,
            Calories: f ? round(f.kcal * ing.grams / 100) : '',
            'Protein (g)': f ? round(f.p * ing.grams / 100, 1) : '',
            'Carbs (g)': f ? round(f.c * ing.grams / 100, 1) : '',
            'Fat (g)': f ? round(f.f * ing.grams / 100, 1) : '',
            'Recipe total kcal': round(t.kcal), 'Per serving kcal': round(t.kcal / (r.servings || 1))
          };
        });
      }));
    }
    if (Store.s.customFoods.length) {
      add('My foods', Store.s.customFoods.map(f => ({
        Name: f.name, Category: f.cat, 'Calories /100g': f.kcal,
        'Protein /100g': f.p, 'Carbs /100g': f.c, 'Fat /100g': f.f, 'Fibre /100g': f.fib
      })));
    }

    XLSX.writeFile(wb, `fitlog-report-${todayKey()}.xlsx`);
    toast('Excel workbook downloaded', 'good');
  },

  /* ---------- CSV bundle ---------- */
  csv() {
    const b = this.build();
    const toCsv = rows => {
      if (!rows.length) return '';
      const cols = Object.keys(rows[0]);
      const cell = v => {
        const s = v == null ? '' : String(v);
        return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      return [cols.join(','), ...rows.map(r => cols.map(c => cell(r[c])).join(','))].join('\n');
    };
    const parts = [
      `FitLog export,${new Date().toLocaleString()}`,
      `Athlete,${b.p.name || ''}`,
      `Period,${b.keys[0]} to ${b.keys[b.keys.length - 1]}`,
      `Units,${Store.s.settings.units}`,
      '',
      '## PERIOD COMPARISON',
      'Metric,This period,Previous period,Change',
      ...this.comparisonRows(b).map(r => r.join(',')),
      '', '## DAILY LOG', toCsv(b.daily),
      '', '## STRENGTH SETS', toCsv(b.sets),
      '', '## CARDIO', toCsv(b.cardio),
      '', '## NUTRITION ITEMS', toCsv(b.foods),
      '', '## WATER', toCsv(b.water),
      '', '## SLEEP', toCsv(b.sleep),
      '', '## PERSONAL RECORDS', toCsv(b.prs)
    ];
    download(`fitlog-export-${todayKey()}.csv`, parts.join('\n'), 'text/csv;charset=utf-8');
    toast('CSV downloaded', 'good');
  }
};
