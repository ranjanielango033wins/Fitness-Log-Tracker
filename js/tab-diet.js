/* ==========================================================================
   FitLog — Diet tab
   Calorie + macro rings, meal-by-meal food log, water tracker and a
   raw-ingredient recipe calculator.
   ========================================================================== */

const Diet = {

  render(host) {
    const k = App.date;
    const day = Store.day(k);
    const p = Store.s.profile;
    const w = Calc.workoutSummary(day, p.weightKg);
    const t = Targets.current(w.minutes);
    const d = Calc.dietSummary(day);

    const burned = w.kcal;
    const remaining = t.kcal + burned - d.kcal;
    const pct = t.kcal ? d.kcal / t.kcal * 100 : 0;

    host.innerHTML = `
      ${this.headerHtml(k)}

      <div class="card">
        <div class="card-head"><h2>Energy</h2>
          <span class="pill">${Store.s.settings.autoTargets ? 'Auto target' : 'Custom target'}</span></div>
        <div class="ring-row" style="margin-bottom:14px">
          ${ring(pct, pct > 110 ? CHART_COLORS.bad : CHART_COLORS.diet, fmtNum(d.kcal), 'eaten', 108)}
          <div style="flex:1;min-width:150px">
            <div class="kv"><span class="kk">Target</span><span class="vv">${fmtNum(t.kcal)} kcal</span></div>
            <div class="kv"><span class="kk">Burned in training</span><span class="vv">+${fmtNum(burned)} kcal</span></div>
            <div class="kv"><span class="kk">${remaining >= 0 ? 'Remaining' : 'Over by'}</span>
              <span class="vv" style="color:${remaining >= 0 ? 'var(--good)' : 'var(--bad)'}">${fmtNum(Math.abs(remaining))} kcal</span></div>
            <div class="kv"><span class="kk">Net (eaten − burned)</span><span class="vv">${fmtNum(d.kcal - burned)} kcal</span></div>
          </div>
        </div>
        ${macroBar(d.p, d.c, d.f)}
        <div class="macro-row" style="margin-top:12px">
          ${this.macroHtml('Protein', d.p, t.protein, 'var(--prot)')}
          ${this.macroHtml('Carbs', d.c, t.carbs, 'var(--carb)')}
          ${this.macroHtml('Fat', d.f, t.fat, 'var(--fat-c)')}
        </div>
        <div class="kv" style="margin-top:10px;border-top:1px solid var(--line-soft);padding-top:10px">
          <span class="kk">Fibre</span><span class="vv">${fmtNum(d.fib, 1)} g <span class="dim tiny">/ 30 g</span></span></div>
      </div>

      ${this.waterHtml(day, t)}

      <div class="section-title">Meals</div>
      ${MEAL_SLOTS.map(slot => this.mealHtml(slot, day, d)).join('')}

      <div class="btn-row" style="margin:14px 0">
        <button class="btn grow" id="d-recipe">${icon('layers')} Recipe calculator</button>
        <button class="btn grow" id="d-copy">${icon('copy')} Copy a past day</button>
      </div>

      ${this.weekHtml(k, t)}
    `;

    $$('[data-nav]', host).forEach(b => b.onclick = () => App.goDate(addDays(k, +b.dataset.nav)));
    $$('[data-addfood]', host).forEach(b => b.onclick = () => this.openFoodPicker(b.dataset.addfood));
    $$('[data-item]', host).forEach(b => b.onclick = () => this.editItem(b.dataset.slot, b.dataset.item));
    $$('[data-water]', host).forEach(b => b.onclick = () => this.addWater(+b.dataset.water));
    const wu = $('#w-undo', host); if (wu) wu.onclick = () => this.undoWater();
    const wc = $('#w-custom', host); if (wc) wc.onclick = () => this.customWater();
    $('#d-recipe', host).onclick = () => this.recipeSheet();
    $('#d-copy', host).onclick = () => this.copyDaySheet();
  },

  headerHtml(k) {
    const isToday = k === todayKey();
    return `<div class="date-head">
      <button class="btn ghost icon" data-nav="-1">${icon('left')}</button>
      <div class="dh-main">
        <div class="dh-d">${esc(prettyDate(k, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}
          ${isToday ? '<span class="today-badge">Today</span>' : ''}</div>
        <div class="dh-t">Nutrition log</div>
      </div>
      <button class="btn ghost icon" data-nav="1">${icon('right')}</button>
    </div>`;
  },

  macroHtml(name, val, target, color) {
    const pct = target ? Math.min(100, val / target * 100) : 0;
    return `<div class="macro">
      <div class="mh"><span>${name}</span><span class="mono">${fmtNum(val)}<span class="dim">/${fmtNum(target)}g</span></span></div>
      <div class="bar"><i style="width:${pct}%;background:${color}"></i></div>
    </div>`;
  },

  /* ---------- water ---------- */
  waterHtml(day, t) {
    const log = day.diet.waterLog || [];
    const ml = log.reduce((a, x) => a + x.ml, 0);
    const pct = t.waterMl ? ml / t.waterMl * 100 : 0;
    const unitMl = Units.imperial ? 236.588 : 250;
    const glasses = Math.ceil(t.waterMl / unitMl);
    const filled = Math.floor(ml / unitMl);
    const presets = Units.imperial ? [236, 355, 473, 591, 946] : WATER_PRESETS;

    return `<div class="card">
      <div class="card-head">
        <span style="color:var(--water)">${icon('droplet')}</span>
        <h2>Water</h2>
        <span class="pill" style="color:var(--water)">${Units.fmtVBig(ml)} / ${Units.fmtVBig(t.waterMl)}</span>
      </div>
      <div class="bar lg" style="margin-bottom:12px"><i style="width:${Math.min(100, pct)}%;background:var(--water)"></i></div>
      <div class="water-grid" style="margin-bottom:12px">
        ${Array.from({ length: Math.min(glasses, 24) }, (_, i) =>
          `<div class="glass ${i < filled ? 'full' : ''}">${icon('droplet')}</div>`).join('')}
      </div>
      <div class="chips">
        ${presets.map(v => `<button class="chip g-diet" data-water="${v}">+${Units.imperial ? round(Units.vOut(v)) + ' oz' : v + ' ml'}</button>`).join('')}
        <button class="chip" id="w-custom">${icon('plus')} Custom</button>
        ${log.length ? `<button class="chip" id="w-undo">${icon('minus')} Undo</button>` : ''}
      </div>
      ${log.length ? `<div class="dim tiny" style="margin-top:9px">${log.length} entries · last at ${esc(log[log.length - 1].t)}</div>` : ''}
    </div>`;
  },

  addWater(ml) {
    const day = Store.day(App.date, true);
    day.diet.waterLog.push({ t: nowTime(), ml });
    Store.save(); App.render();
  },

  undoWater() {
    const day = Store.day(App.date, true);
    day.diet.waterLog.pop();
    Store.save(); App.render();
  },

  customWater() {
    const s = openSheet({
      title: 'Add water',
      body: `<label class="fld"><span>Amount (${Units.vLabel()})</span>
        <input type="number" id="wv" inputmode="decimal" placeholder="${Units.imperial ? '12' : '350'}" autofocus></label>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="ws">Add</button>`
    });
    $('#ws', s.sheet).onclick = () => {
      const v = +$('#wv', s.sheet).value;
      if (!v) return;
      this.addWater(Math.round(Units.vIn(v)));
      s.close();
    };
  },

  /* ---------- meals ---------- */
  mealHtml(slot, day, dsum) {
    const items = (day.diet.meals[slot.id] || []);
    const m = dsum.byMeal[slot.id] || { kcal: 0, p: 0, c: 0, f: 0 };
    return `<div class="card flush" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:${items.length ? '1px solid var(--line-soft)' : '0'}">
        <div class="grow"><b>${esc(slot.name)}</b>
          ${items.length ? `<div class="small muted mono">${fmtNum(m.p)}P · ${fmtNum(m.c)}C · ${fmtNum(m.f)}F</div>` : '<div class="small dim">Nothing logged</div>'}</div>
        <div class="mono" style="font-weight:700">${fmtNum(m.kcal)}<span class="dim tiny"> kcal</span></div>
        <button class="btn sm primary" data-addfood="${slot.id}">${icon('plus')}</button>
      </div>
      ${items.length ? `<div class="list">
        ${items.map(it => `<div class="row click" data-item="${it.id}" data-slot="${slot.id}">
          <div class="grow"><div class="t">${esc(it.name)}${it.recipe ? '<span class="tag recipe">recipe</span>' : ''}${it.customFood ? '<span class="tag custom">custom</span>' : ''}</div>
            <div class="s mono">${fmtNum(it.grams)} g · ${fmtNum(it.p, 1)}P ${fmtNum(it.c, 1)}C ${fmtNum(it.f, 1)}F</div></div>
          <div class="rt mono"><b>${fmtNum(it.kcal)}</b><div class="s">kcal</div></div>
        </div>`).join('')}
      </div>` : ''}
    </div>`;
  },

  /* ---------- food picker ---------- */
  openFoodPicker(slotId) {
    let q = '', cat = null, tab = 'all';
    const s = openSheet({ title: 'Add food — ' + (MEAL_SLOTS.find(m => m.id === slotId) || {}).name, wide: true, body: '<div id="fp"></div>' });

    const draw = () => {
      const fp = $('#fp', s.sheet);
      const all = Store.allFoods();
      const recipes = Store.s.recipes;
      let list = [];
      if (tab === 'recipes') {
        list = recipes.map(r => this.recipeAsFood(r));
      } else if (tab === 'custom') {
        list = Store.s.customFoods;
      } else if (tab === 'recent') {
        list = this.recentFoods();
      } else {
        list = all;
        if (cat) list = list.filter(f => f.cat === cat);
      }
      if (q.trim()) {
        const t = q.trim().toLowerCase();
        const pool = tab === 'all' ? all.concat(recipes.map(r => this.recipeAsFood(r))) : list;
        list = pool.filter(f => f.name.toLowerCase().includes(t));
      }
      list = list.slice(0, 220);

      fp.innerHTML = `
        <div class="search-wrap">${icon('search')}
          <input id="fq" placeholder="Search ${all.length} foods…" value="${esc(q)}" autocomplete="off"></div>
        <div class="chips" style="margin-bottom:12px">
          ${[['all', 'All foods'], ['recent', 'Recent'], ['custom', 'My foods'], ['recipes', 'My recipes']]
            .map(([id, lbl]) => `<button class="chip g-diet ${tab === id ? 'active' : ''}" data-tab="${id}">${lbl}</button>`).join('')}
        </div>
        ${tab === 'all' && !q.trim() ? `<div class="chips" style="margin-bottom:12px">
          <button class="chip ${!cat ? 'active' : ''}" data-cat="">All categories</button>
          ${FOOD_CATS.map(c => `<button class="chip ${cat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>` : ''}
        <div class="card flush">
          ${list.length ? list.map(f => `
            <div class="food-row" data-pick="${esc(f.id)}">
              <div class="grow"><div class="fn">${esc(f.name)}${f.custom ? '<span class="tag custom">mine</span>' : ''}${f.isRecipe ? '<span class="tag recipe">recipe</span>' : ''}</div>
                <div class="fm mono">${fmtNum(f.p, 1)}P · ${fmtNum(f.c, 1)}C · ${fmtNum(f.f, 1)}F ${f.isRecipe ? '' : '<span class="dim">per 100 g</span>'}</div></div>
              <div class="fk"><b>${fmtNum(f.kcal)}</b><div class="fm">kcal/100g</div></div>
            </div>`).join('')
          : `<div class="empty">${icon('search')}<b>Nothing found</b><div class="small">Try a different word, or add it as a custom food</div></div>`}
        </div>
        <div class="btn-row" style="margin-top:12px">
          <button class="btn grow" id="fp-new">${icon('plus')} New custom food</button>
          <button class="btn grow" id="fp-quick">${icon('zap')} Quick calories</button>
        </div>`;

      const qi = $('#fq', fp);
      qi.oninput = () => { q = qi.value; const at = qi.selectionStart; draw(); const n = $('#fq', s.sheet); n.focus(); n.setSelectionRange(at, at); };
      $$('[data-tab]', fp).forEach(b => b.onclick = () => { tab = b.dataset.tab; cat = null; draw(); });
      $$('[data-cat]', fp).forEach(b => b.onclick = () => { cat = b.dataset.cat || null; draw(); });
      $$('[data-pick]', fp).forEach(b => b.onclick = () => {
        const id = b.dataset.pick;
        const food = id.startsWith('r') && Store.s.recipes.find(r => r.id === id)
          ? this.recipeAsFood(Store.s.recipes.find(r => r.id === id))
          : Store.findFood(id);
        if (food) { s.close(); this.portionSheet(food, slotId); }
      });
      $('#fp-new', fp).onclick = () => { s.close(); this.customFoodSheet(slotId); };
      $('#fp-quick', fp).onclick = () => { s.close(); this.quickCalorieSheet(slotId); };
    };
    draw();
  },

  recentFoods() {
    const seen = {}, out = [];
    Object.keys(Store.s.days).sort().reverse().slice(0, 45).forEach(k => {
      Object.values((Store.s.days[k].diet || {}).meals || {}).forEach(items => {
        items.forEach(it => {
          if (!it.foodId || seen[it.foodId] || out.length >= 30) return;
          const f = Store.findFood(it.foodId) || (Store.s.recipes.find(r => r.id === it.foodId) ? this.recipeAsFood(Store.s.recipes.find(r => r.id === it.foodId)) : null);
          if (f) { seen[it.foodId] = 1; out.push(f); }
        });
      });
    });
    return out;
  },

  recipeAsFood(r) {
    const tot = this.recipeTotals(r);
    const g = Math.max(1, tot.grams);
    return {
      id: r.id, name: r.name, cat: 'My recipes', isRecipe: true, custom: true,
      kcal: round(tot.kcal / g * 100, 1), p: round(tot.p / g * 100, 2),
      c: round(tot.c / g * 100, 2), f: round(tot.f / g * 100, 2), fib: round(tot.fib / g * 100, 2),
      servings: [
        { label: `1 serving (${round(g / (r.servings || 1))} g)`, g: round(g / (r.servings || 1)) },
        { label: `Whole recipe (${round(g)} g)`, g: round(g) },
        { label: '100 g', g: 100 }
      ]
    };
  },

  recipeTotals(r) {
    const t = { kcal: 0, p: 0, c: 0, f: 0, fib: 0, grams: 0 };
    (r.ingredients || []).forEach(ing => {
      const f = Store.findFood(ing.foodId);
      if (!f) return;
      const m = ing.grams / 100;
      t.kcal += f.kcal * m; t.p += f.p * m; t.c += f.c * m; t.f += f.f * m; t.fib += (f.fib || 0) * m;
      t.grams += ing.grams;
    });
    if (r.cookedGrams) t.grams = r.cookedGrams;
    return t;
  },

  /* ---------- portion sheet ---------- */
  portionSheet(food, slotId, existing) {
    const defServ = food.servings[0];
    let grams = existing ? existing.grams : defServ.g;
    let servIdx = 0;
    let qty = existing ? round(existing.grams / defServ.g, 2) : 1;

    const s = openSheet({
      title: food.name,
      body: `<div id="ps"></div>`,
      foot: `<button class="btn" data-close>Cancel</button>
             ${existing ? '<button class="btn danger" id="ps-del">Remove</button>' : ''}
             <button class="btn primary" id="ps-save">${existing ? 'Update' : 'Add'}</button>`
    });

    const draw = () => {
      const m = grams / 100;
      const kcal = round(food.kcal * m), P = round(food.p * m, 1), C = round(food.c * m, 1), F = round(food.f * m, 1);
      $('#ps', s.sheet).innerHTML = `
        <div class="fld-row">
          <label class="fld"><span>Quantity</span><input type="number" step="0.25" id="ps-q" value="${qty}"></label>
          <label class="fld"><span>Serving</span><select id="ps-s">
            ${food.servings.map((sv, i) => `<option value="${i}" ${i === servIdx ? 'selected' : ''}>${esc(sv.label)}</option>`).join('')}
          </select></label>
        </div>
        <label class="fld"><span>…or enter grams directly</span>
          <input type="number" id="ps-g" value="${round(grams, 1)}"></label>
        <div class="stat-grid" style="margin:14px 0 6px">
          <div class="stat"><div class="k">Calories</div><div class="v">${fmtNum(kcal)}</div></div>
          <div class="stat"><div class="k">Protein</div><div class="v">${P}<small>g</small></div></div>
          <div class="stat"><div class="k">Carbs</div><div class="v">${C}<small>g</small></div></div>
          <div class="stat"><div class="k">Fat</div><div class="v">${F}<small>g</small></div></div>
        </div>
        ${macroBar(P, C, F)}
        <div class="dim tiny" style="margin-top:8px">Per 100 g: ${food.kcal} kcal · ${food.p}P · ${food.c}C · ${food.f}F</div>`;

      $('#ps-q', s.sheet).oninput = e => {
        qty = +e.target.value || 0; grams = qty * food.servings[servIdx].g;
        $('#ps-g', s.sheet).value = round(grams, 1); redrawStats();
      };
      $('#ps-s', s.sheet).onchange = e => { servIdx = +e.target.value; grams = qty * food.servings[servIdx].g; draw(); };
      $('#ps-g', s.sheet).oninput = e => {
        grams = +e.target.value || 0; qty = round(grams / food.servings[servIdx].g, 2);
        $('#ps-q', s.sheet).value = qty; redrawStats();
      };
    };
    const redrawStats = () => {
      const m = grams / 100;
      const cells = $$('#ps .stat .v', s.sheet);
      if (cells.length === 4) {
        cells[0].textContent = fmtNum(round(food.kcal * m));
        cells[1].innerHTML = round(food.p * m, 1) + '<small>g</small>';
        cells[2].innerHTML = round(food.c * m, 1) + '<small>g</small>';
        cells[3].innerHTML = round(food.f * m, 1) + '<small>g</small>';
      }
    };
    draw();

    $('#ps-save', s.sheet).onclick = () => {
      if (!grams) return toast('Enter an amount', 'warn');
      const m = grams / 100;
      const item = {
        id: existing ? existing.id : uid(),
        foodId: food.id, name: food.name, grams: round(grams, 1),
        kcal: round(food.kcal * m), p: round(food.p * m, 1), c: round(food.c * m, 1),
        f: round(food.f * m, 1), fib: round((food.fib || 0) * m, 1),
        serving: food.servings[servIdx].label,
        customFood: !!food.custom && !food.isRecipe, recipe: !!food.isRecipe,
        t: nowTime()
      };
      const day = Store.day(App.date, true);
      const arr = day.diet.meals[slotId];
      if (existing) {
        const i = arr.findIndex(x => x.id === existing.id);
        if (i >= 0) arr[i] = item;
      } else arr.push(item);
      Store.save(); s.close(); App.render();
      toast(`${food.name} logged`, 'good');
    };
    const del = $('#ps-del', s.sheet);
    if (del) del.onclick = () => {
      const day = Store.day(App.date, true);
      day.diet.meals[slotId] = day.diet.meals[slotId].filter(x => x.id !== existing.id);
      Store.save(); s.close(); App.render();
    };
  },

  editItem(slotId, itemId) {
    const day = Store.day(App.date, true);
    const item = (day.diet.meals[slotId] || []).find(x => x.id === itemId);
    if (!item) return;
    let food = Store.findFood(item.foodId);
    if (!food) {
      const r = Store.s.recipes.find(r => r.id === item.foodId);
      food = r ? this.recipeAsFood(r) : {
        id: item.foodId || 'adhoc', name: item.name, custom: true,
        kcal: item.grams ? item.kcal / item.grams * 100 : item.kcal,
        p: item.grams ? item.p / item.grams * 100 : 0,
        c: item.grams ? item.c / item.grams * 100 : 0,
        f: item.grams ? item.f / item.grams * 100 : 0,
        fib: 0, servings: [{ label: '100 g', g: 100 }]
      };
    }
    this.portionSheet(food, slotId, item);
  },

  /* ---------- custom food ---------- */
  customFoodSheet(slotId) {
    const s = openSheet({
      title: 'New custom food',
      body: `
        <p class="muted small">Enter the values per 100 g exactly as printed on the label. Calories are recalculated from the macros if you leave them blank.</p>
        <label class="fld"><span>Name</span><input id="cf-n" placeholder="e.g. Mum's chicken curry"></label>
        <label class="fld"><span>Category</span><select id="cf-c">
          ${FOOD_CATS.map(c => `<option>${esc(c)}</option>`).join('')}</select></label>
        <div class="grid-2">
          <label class="fld"><span>Calories / 100 g</span><input type="number" id="cf-k" placeholder="auto"></label>
          <label class="fld"><span>Protein g</span><input type="number" step="0.1" id="cf-p" value="0"></label>
          <label class="fld"><span>Carbs g</span><input type="number" step="0.1" id="cf-cb" value="0"></label>
          <label class="fld"><span>Fat g</span><input type="number" step="0.1" id="cf-f" value="0"></label>
        </div>
        <label class="fld"><span>Fibre g (optional)</span><input type="number" step="0.1" id="cf-fb" value="0"></label>
        <label class="fld"><span>Typical serving size in grams (optional)</span><input type="number" id="cf-sv" placeholder="e.g. 150"></label>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="cf-s">Save food</button>`
    });
    $('#cf-s', s.sheet).onclick = () => {
      const name = $('#cf-n', s.sheet).value.trim();
      if (!name) return toast('Give the food a name', 'warn');
      const P = +$('#cf-p', s.sheet).value || 0, C = +$('#cf-cb', s.sheet).value || 0, F = +$('#cf-f', s.sheet).value || 0;
      const kcal = +$('#cf-k', s.sheet).value || round(P * 4 + C * 4 + F * 9);
      const sv = +$('#cf-sv', s.sheet).value;
      const food = {
        id: 'c' + uid(), name, cat: $('#cf-c', s.sheet).value,
        kcal, p: P, c: C, f: F, fib: +$('#cf-fb', s.sheet).value || 0,
        servings: sv ? [{ label: `1 serving (${sv} g)`, g: sv }, { label: '100 g', g: 100 }] : [{ label: '100 g', g: 100 }],
        custom: true
      };
      Store.s.customFoods.push(food);
      Store.save(); s.close();
      if (slotId) this.portionSheet(food, slotId);
      else { App.render(); toast('Food saved', 'good'); }
    };
  },

  quickCalorieSheet(slotId) {
    const s = openSheet({
      title: 'Quick entry',
      body: `<p class="muted small">For meals out where you only know the calories.</p>
        <label class="fld"><span>Description</span><input id="q-n" placeholder="e.g. Dinner at Zuma"></label>
        <div class="grid-2">
          <label class="fld"><span>Calories</span><input type="number" id="q-k" placeholder="700"></label>
          <label class="fld"><span>Protein g (optional)</span><input type="number" id="q-p" placeholder="35"></label>
          <label class="fld"><span>Carbs g (optional)</span><input type="number" id="q-c"></label>
          <label class="fld"><span>Fat g (optional)</span><input type="number" id="q-f"></label>
        </div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="q-s">Add</button>`
    });
    $('#q-s', s.sheet).onclick = () => {
      const kcal = +$('#q-k', s.sheet).value;
      if (!kcal) return toast('Enter the calories', 'warn');
      const day = Store.day(App.date, true);
      day.diet.meals[slotId].push({
        id: uid(), foodId: null, name: $('#q-n', s.sheet).value.trim() || 'Quick entry',
        grams: 0, kcal, p: +$('#q-p', s.sheet).value || 0, c: +$('#q-c', s.sheet).value || 0,
        f: +$('#q-f', s.sheet).value || 0, fib: 0, serving: 'quick entry', t: nowTime()
      });
      Store.save(); s.close(); App.render();
    };
  },

  /* ---------- recipe / raw-ingredient calculator ---------- */
  recipeSheet(editing) {
    let recipe = editing
      ? JSON.parse(JSON.stringify(editing))
      : { id: 'r' + uid(), name: '', servings: 1, ingredients: [], cookedGrams: null };

    const s = openSheet({ title: editing ? 'Edit recipe' : 'Recipe calculator', wide: true, body: '<div id="rc"></div>' });

    const draw = () => {
      const t = this.recipeTotals(recipe);
      const perServ = recipe.servings > 0 ? recipe.servings : 1;
      const rc = $('#rc', s.sheet);
      rc.innerHTML = `
        <p class="muted small">Add the raw ingredients and their weights — FitLog totals the calories and macros, then splits them per serving.</p>
        <div class="fld-row">
          <label class="fld" style="flex:2"><span>Recipe name</span>
            <input id="rc-n" value="${esc(recipe.name)}" placeholder="e.g. Chicken &amp; rice meal prep"></label>
          <label class="fld"><span>Servings</span>
            <input type="number" id="rc-sv" min="1" step="1" value="${recipe.servings}"></label>
        </div>

        <div class="section-title">Ingredients</div>
        <div class="card flush" style="margin-bottom:10px">
          ${recipe.ingredients.length ? `<div class="list">
            ${recipe.ingredients.map((ing, i) => {
              const f = Store.findFood(ing.foodId);
              if (!f) return '';
              const m = ing.grams / 100;
              return `<div class="row">
                <div class="grow"><div class="t">${esc(f.name)}</div>
                  <div class="s mono">${fmtNum(f.kcal * m)} kcal · ${fmtNum(f.p * m, 1)}P ${fmtNum(f.c * m, 1)}C ${fmtNum(f.f * m, 1)}F</div></div>
                <input type="number" style="width:82px;text-align:center" class="mono" data-ig="${i}" value="${ing.grams}">
                <span class="dim tiny">g</span>
                <button class="btn ghost icon sm" data-irm="${i}">${icon('x')}</button>
              </div>`;
            }).join('')}
          </div>` : `<div class="empty small">${icon('layers')}<b>No ingredients yet</b><div>Add the raw materials that go into this dish</div></div>`}
        </div>
        <button class="btn block" id="rc-add">${icon('plus')} Add ingredient</button>

        <div class="section-title">Result</div>
        <div class="stat-grid">
          <div class="stat"><div class="k">Total weight</div><div class="v">${fmtNum(t.grams)}<small>g</small></div></div>
          <div class="stat"><div class="k">Total calories</div><div class="v">${fmtNum(t.kcal)}<small>kcal</small></div></div>
          <div class="stat"><div class="k">Per serving</div><div class="v">${fmtNum(t.kcal / perServ)}<small>kcal</small></div></div>
          <div class="stat"><div class="k">Per 100 g</div><div class="v">${fmtNum(t.grams ? t.kcal / t.grams * 100 : 0)}<small>kcal</small></div></div>
        </div>
        <div style="margin:12px 0">${macroBar(t.p, t.c, t.f)}</div>
        <div class="kv"><span class="kk">Protein</span><span class="vv">${fmtNum(t.p, 1)} g total · ${fmtNum(t.p / perServ, 1)} g per serving</span></div>
        <div class="kv"><span class="kk">Carbohydrate</span><span class="vv">${fmtNum(t.c, 1)} g total · ${fmtNum(t.c / perServ, 1)} g per serving</span></div>
        <div class="kv"><span class="kk">Fat</span><span class="vv">${fmtNum(t.f, 1)} g total · ${fmtNum(t.f / perServ, 1)} g per serving</span></div>
        <div class="kv"><span class="kk">Fibre</span><span class="vv">${fmtNum(t.fib, 1)} g total</span></div>

        <label class="fld" style="margin-top:14px"><span>Cooked weight in grams (optional — improves per-100 g accuracy after water loss)</span>
          <input type="number" id="rc-cw" value="${recipe.cookedGrams || ''}" placeholder="${round(t.grams) || ''}"></label>

        <div class="btn-row" style="margin-top:6px">
          <button class="btn primary grow" id="rc-save">${icon('save')} Save recipe</button>
          <button class="btn grow" id="rc-log" ${recipe.ingredients.length ? '' : 'disabled'}>${icon('plus')} Log a serving now</button>
        </div>`;

      $('#rc-n', rc).oninput = e => { recipe.name = e.target.value; };
      $('#rc-sv', rc).onchange = e => { recipe.servings = Math.max(1, +e.target.value || 1); draw(); };
      $('#rc-cw', rc).onchange = e => { recipe.cookedGrams = +e.target.value || null; draw(); };
      $$('[data-ig]', rc).forEach(inp => inp.onchange = () => {
        recipe.ingredients[+inp.dataset.ig].grams = +inp.value || 0; draw();
      });
      $$('[data-irm]', rc).forEach(b => b.onclick = () => { recipe.ingredients.splice(+b.dataset.irm, 1); draw(); });
      $('#rc-add', rc).onclick = () => this.pickIngredient(food => {
        recipe.ingredients.push({ foodId: food.id, grams: food.servings[0].g });
        draw();
      });
      $('#rc-save', rc).onclick = () => {
        if (!recipe.name.trim()) return toast('Name the recipe first', 'warn');
        if (!recipe.ingredients.length) return toast('Add at least one ingredient', 'warn');
        const i = Store.s.recipes.findIndex(r => r.id === recipe.id);
        if (i >= 0) Store.s.recipes[i] = recipe; else Store.s.recipes.push(recipe);
        Store.save(); s.close(); App.render();
        toast('Recipe saved — find it under "My recipes"', 'good');
      };
      $('#rc-log', rc).onclick = () => {
        if (!recipe.name.trim()) recipe.name = 'Untitled recipe';
        const i = Store.s.recipes.findIndex(r => r.id === recipe.id);
        if (i >= 0) Store.s.recipes[i] = recipe; else Store.s.recipes.push(recipe);
        Store.save(); s.close();
        this.pickSlot(slot => this.portionSheet(this.recipeAsFood(recipe), slot));
      };
    };
    draw();
  },

  pickIngredient(cb) {
    let q = '';
    const s = openSheet({ title: 'Choose ingredient', wide: true, body: '<div id="ip"></div>' });
    const draw = () => {
      const ip = $('#ip', s.sheet);
      const t = q.trim().toLowerCase();
      const list = (t ? Store.allFoods().filter(f => f.name.toLowerCase().includes(t)) : Store.allFoods()).slice(0, 200);
      ip.innerHTML = `
        <div class="search-wrap">${icon('search')}<input id="iq" placeholder="Search raw materials…" value="${esc(q)}" autocomplete="off"></div>
        <div class="card flush">${list.map(f => `
          <div class="food-row" data-i="${f.id}">
            <div class="grow"><div class="fn">${esc(f.name)}</div><div class="fm">${esc(f.cat)}</div></div>
            <div class="fk"><b>${fmtNum(f.kcal)}</b><div class="fm">kcal/100g</div></div>
          </div>`).join('') || '<div class="empty small">Nothing found</div>'}</div>`;
      const qi = $('#iq', ip);
      qi.oninput = () => { q = qi.value; const at = qi.selectionStart; draw(); const n = $('#iq', s.sheet); n.focus(); n.setSelectionRange(at, at); };
      $$('[data-i]', ip).forEach(b => b.onclick = () => {
        const f = Store.findFood(b.dataset.i);
        if (f) { s.close(); cb(f); }
      });
    };
    draw();
  },

  pickSlot(cb) {
    const s = openSheet({
      title: 'Add to which meal?',
      body: `<div class="list">${MEAL_SLOTS.map(m =>
        `<div class="row click" data-slot="${m.id}"><div class="grow"><div class="t">${esc(m.name)}</div></div>${icon('right')}</div>`).join('')}</div>`
    });
    $$('[data-slot]', s.sheet).forEach(b => b.onclick = () => { s.close(); cb(b.dataset.slot); });
  },

  /* ---------- copy a past day ---------- */
  copyDaySheet() {
    const keys = Object.keys(Store.s.days)
      .filter(k => k !== App.date && Object.values((Store.s.days[k].diet || {}).meals || {}).some(a => a.length))
      .sort().reverse().slice(0, 20);
    if (!keys.length) return toast('No other days logged yet', 'warn');
    const s = openSheet({
      title: 'Copy a day’s food',
      body: `<div class="list">${keys.map(k => {
        const d = Calc.dietSummary(Store.s.days[k]);
        return `<div class="row click" data-cp="${k}"><div class="grow">
          <div class="t">${esc(prettyDate(k, { weekday: 'short', day: 'numeric', month: 'short' }))}</div>
          <div class="s mono">${fmtNum(d.kcal)} kcal · ${d.items} items</div></div>${icon('copy')}</div>`;
      }).join('')}</div>`
    });
    $$('[data-cp]', s.sheet).forEach(b => b.onclick = () => {
      const src = Store.s.days[b.dataset.cp];
      const day = Store.day(App.date, true);
      MEAL_SLOTS.forEach(m => {
        (src.diet.meals[m.id] || []).forEach(it => {
          day.diet.meals[m.id].push(Object.assign({}, it, { id: uid(), t: nowTime() }));
        });
      });
      Store.save(); s.close(); App.render();
      toast('Day copied', 'good');
    });
  },

  /* ---------- 7-day strip ---------- */
  weekHtml(k, t) {
    const keys = rangeKeys(addDays(k, -6), 7);
    const kcals = keys.map(d => Calc.dietSummary(Store.day(d)).kcal);
    const waters = keys.map(d => Calc.dietSummary(Store.day(d)).waterMl);
    if (!kcals.some(v => v) && !waters.some(v => v)) return '';
    return `<div class="card">
      <div class="card-head"><h3>Last 7 days</h3></div>
      <div class="small muted" style="margin-bottom:6px">Calories <span class="dim">— dashed line is your target</span></div>
      ${barChart(keys.map(shortDate), kcals, { color: CHART_COLORS.diet, target: t.kcal, height: 120 })}
      <div class="small muted" style="margin:14px 0 6px">Water (${Units.vBigLabel()})</div>
      ${barChart(keys.map(shortDate), waters.map(w => round(Units.vBig(w), 2)), { color: CHART_COLORS.water, target: round(Units.vBig(t.waterMl), 2), height: 100 })}
    </div>`;
  }
};
