# FitLog

A four-tab fitness log — **Overview, Fitness, Diet, Sleep** — that runs entirely in the browser.
No account, no server, no tracking. Host it on GitHub Pages and open it from any device.

Your data lives in that browser's `localStorage`. To move it between devices, export a backup
file and restore it on the other one.

---

## Deploy to GitHub Pages

1. Create a new repository on GitHub (public or private — Pages works with both on paid plans;
   public is free).
2. Upload everything in this folder to the repository root — `index.html` must sit at the top level.

   Via the web UI: **Add file → Upload files**, drag the whole contents in, commit.

   Via git:

   ```bash
   git init
   git add .
   git commit -m "FitLog"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo>.git
   git push -u origin main
   ```

3. In the repository go to **Settings → Pages**.
4. Under *Build and deployment*, set **Source: Deploy from a branch**, **Branch: `main`**, folder **`/ (root)`**. Save.
5. Wait about a minute, then open `https://<your-username>.github.io/<your-repo>/`.

The `.nojekyll` file is already included so GitHub serves every file as-is.

### Install it on your phone

Open the Pages URL in Safari or Chrome and use **Add to Home Screen** / **Install app**.
A service worker caches the whole app, so it opens and works with no connection.

After you push an update, bump `CACHE = 'fitlog-v1'` in `sw.js` to `fitlog-v2` (and so on) so
installed copies pick the new version up.

---

## The four tabs

### 1. Overview
Pick **Day**, **Week** or **4 weeks**, and FitLog averages that period and the period immediately
before it, then reports what moved.

- **Three scores out of 100** — Training, Nutrition, Recovery — plus an overall, each with the change
  against the previous period.
- **What changed** — plain-language findings: volume up or down, protein slipping, sleeping less,
  working harder for the same output, training outrunning recovery.
- **Daily score chart** across the period.
- **Full breakdown** — every metric side by side with the previous period and a percentage change,
  colour-coded by whether the direction is good. Metrics with no universally good direction
  (average RPE, bodyweight on a maintenance plan) are shown neutral.
- **Readiness** — acute:chronic workload ratio, recovery score, 14-day sleep debt.
- **Personal records** and all-time totals.

Use the ‹ › arrows to step back through earlier periods.

### 2. Fitness
Header shows the date and session time, both editable (pencil icon) — you can also move a whole
session to another date and log your bodyweight there.

Three sections: **Upper Body**, **Lower Body**, **Cardio**. Each contains muscle groups
(chest, back, shoulders, traps, biceps, triceps, forearms, core; quads, hamstrings, glutes, calves,
adductors, olympic/power; running, cycling, machines, conditioning, mobility) with around
170 exercises. You can add your own.

Logging follows the pattern used by Strong and Hevy — one row per set:

| Set | kg | Reps | RPE | ✓ |
|---|---|---|---|---|

- Tap the set number to cycle **working → warm-up → drop set → to failure**. Warm-ups are excluded
  from volume.
- Tap ✓ to mark a set done; blank fields inherit the set above, and the rest timer starts.
- Adding an exercise pre-fills the sets from the last time you did it.
- Cardio entries log duration, distance, average heart rate and intensity, with pace and calories derived.
- Each card shows volume, estimated 1RM and your standing best; the exercise menu (pencil) has history
  with an e1RM trend chart, duplicate, and notes.

### 3. Diet
- **Energy card** — calories eaten against target, calories burned in training, remaining, and net,
  with macro rings and a fibre line.
- **Water** — tap-to-add presets in ml (or fl oz), a visual glass grid and litres against target.
- **Meals** — breakfast, lunch, dinner, snacks, pre/post workout. Search ~250 foods with per-100 g
  macros, including Indian and Middle Eastern staples (roti, dal, biryani, paneer, shawarma, hummus,
  manakish, kunafa, dates, karak). Pick a serving or type grams directly.
- **Custom foods** from a label, and **quick calorie entry** for meals out.
- **Recipe calculator** — add raw ingredients and their weights, and FitLog totals the calories and
  macros, splits them per serving and per 100 g (with an optional cooked weight for water loss).
  Save it and it becomes a loggable food.
- **Copy a past day** for repeated meal prep, and a 7-day calorie and water chart.

### 4. Sleep
Enter **bed time** and **wake time** — everything else is calculated:

- Time in bed, total sleep time, naps
- **Sleep efficiency** = total sleep time ÷ time in bed (85% is the usual benchmark)
- Mid-sleep point (your body-clock anchor)
- 14-night **sleep debt** and a **consistency score** from the circular standard deviation of mid-sleep times
- Latency, wake-ups, time awake in the night, rested rating
- **Your own fields** — add anything: caffeine in mg, alcohol units, screen time, room temperature,
  stress, resting heart rate, HRV. They appear on every night and flow into exports.

Plus a 14-night chart and a "what this means" read of the numbers.

---

## Backup, restore and export

Everything is under the **document icon** (reports) and **gear icon** (settings) in the top bar.

- **Download backup** (JSON) — the complete log. Keep it anywhere.
- **Restore from file** — on any device, in any browser. You choose **Merge** (keep what is there and
  add the file's days) or **Replace everything**.
- **PDF report** — cover page with headline numbers, profile and targets, the full period comparison,
  a written reading of the period, personal records, and the complete daily, training, cardio,
  sleep and nutrition logs.
- **Excel workbook** — ten sheets: Summary, Comparison, Daily, Strength sets (one row per set),
  Cardio, Nutrition items, Water, Sleep, Personal records, Recipes.
- **CSV bundle** — the same data in plain text.

---

## Units

Metric by default (kg, cm, km, ml/L). Switch to imperial (lb, in, mi, fl oz/cups) in settings —
everything is stored in metric internally, so switching back and forth never changes your data.

---

## The formulas

| Quantity | Method |
|---|---|
| Basal metabolic rate | Mifflin-St Jeor: `10×kg + 6.25×cm − 5×age + 5` (male) / `− 161` (female) |
| Maintenance calories | BMR × activity factor (1.2 / 1.375 / 1.55 / 1.725 / 1.9) |
| Goal calories | −20% cut, −10% slow cut, maintain, +8% lean gain, +15% mass gain |
| Protein target | 1.8–2.2 g per kg depending on goal |
| Water target | 35 ml/kg + 600 ml per training hour + 500 ml in a hot climate |
| Training energy burn | `MET × 3.5 × kg / 200` kcal per minute (Compendium of Physical Activities) |
| Estimated 1RM | Epley `w × (1 + r/30)` by default; Brzycki, Lombardi, O'Conner and Wathan also selectable |
| Training volume | Σ weight × reps across working sets (warm-ups excluded) |
| Training load | Session RPE method: duration in minutes × average RPE |
| Acute:chronic ratio | 7-day load ÷ (28-day load ÷ 4); 0.8–1.3 is the usual sweet spot |
| Sleep efficiency | total sleep time ÷ time in bed × 100 |
| Total sleep time | time in bed − time to fall asleep − time awake in the night |
| Sleep debt | Σ (target hours − actual) over the last 14 nights |
| Consistency | circular standard deviation of mid-sleep times, mapped to 0–100 |

Scores combine those into 0–100: **Training** from volume, sets, duration and muscle-group coverage;
**Nutrition** from calorie accuracy, protein, water and fibre; **Recovery** from sleep duration,
efficiency, subjective rating, consistency and wake-ups.

These are estimates to guide training decisions, not medical advice.

---

## Files

```
index.html                  app shell
css/styles.css              design system, dark and light
js/data-exercises.js        ~170 exercises with muscle groups, equipment and MET values
js/data-foods.js            ~250 foods with per-100 g macros and serving sizes
js/store.js                 state, persistence, unit conversion, all calculations
js/ui.js                    icons, toasts, sheets, SVG charts
js/tab-overview.js          period comparison engine
js/tab-fitness.js           training log
js/tab-diet.js              nutrition, water, recipe calculator
js/tab-sleep.js             sleep log and derived metrics
js/settings.js              profile, targets, backup and restore
js/exports.js               PDF, Excel and CSV reports
js/vendor/                  jsPDF, jsPDF-AutoTable, SheetJS (MIT / Apache-2.0)
sw.js                       offline cache
manifest.webmanifest        installable app metadata
```

No build step, no npm install, no framework. Edit a file, push, done.

## Keyboard shortcuts

`1`–`4` switch tabs · `T` jumps to today · `Alt + ←/→` steps a day · `Esc` closes a sheet.

## Editing the data

Adding an exercise: append to the right group in `js/data-exercises.js`.
Adding a food permanently: append a pipe-delimited line to `js/data-foods.js` —
`name|category|kcal|protein|carbs|fat|fibre|serving:grams;serving:grams`, all per 100 g.
(For one-off foods just use **New custom food** in the app.)
