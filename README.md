# FitLog

A four-tab fitness log — **Overview, Fitness, Diet, Sleep** — that runs entirely in the browser.
No account, no tracking. Host it on GitHub Pages and open it from any device.

Your data lives in the browser's IndexedDB, so the app works offline and owes nothing to anyone.
Optionally, turn on sync and your phone and laptop stay in step through a Cloudflare Worker you
deploy once — still no account, nothing that expires, and a pairing code instead of a password.

---

## Deploy to GitHub Pages

1. Create a repository on GitHub.
2. Upload the **contents** of this folder — `index.html` must sit at the repository root, not inside
   a subfolder. Use **drag and drop** so the `css`, `js` and `icons` folders come with it; the
   "choose your files" picker silently skips folders.
3. If you used the web uploader, add `.nojekyll` by hand: **Add file → Create new file**, name it
   `.nojekyll`, leave it empty, commit. The uploader skips dotfiles, and without it GitHub runs
   Jekyll over your files.
4. **Settings → Pages → Deploy from a branch → `main` → `/ (root)`.**
5. Open `https://<your-username>.github.io/<your-repo>/`.

Or with git:

```bash
git init && git add . && git commit -m "FitLog"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### Install it on your phone

Open the Pages URL and use **Add to Home Screen** / **Install app**. A service worker caches the
whole app, so it opens and works with no connection.

**Install it rather than leaving it as a tab.** iOS clears a site's stored data after seven days of
not visiting it — unless the site is on the Home Screen. FitLog also asks the browser for persistent
storage on first run, which covers most other cases.

### Updating

Bump `CACHE = 'fitlog-v5'` in `sw.js` to `v6` and push. Installed copies notice the new version and
reload themselves — no hard refresh needed.

---

## The four tabs

### 1. Overview
Pick **Day**, **Week**, **4 weeks**, **3 months** or **6 months**, and FitLog averages that period
and the period immediately before it, then reports what moved.

- **Three scores out of 100** — Training, Nutrition, Recovery — plus an overall, each with the change
  against the previous period.
- **What changed** — plain-language findings: volume up or down, protein slipping, sleeping less,
  training outrunning recovery.
- **Score chart** across the period, switching to weekly means past six weeks so it stays readable.
- **Full breakdown** — every metric beside the previous period with a percentage change,
  colour-coded by whether the direction is good. Metrics with no universally good direction are
  shown neutral.
- **Readiness** — acute:chronic workload ratio, recovery score, 14-day sleep debt.
- **Browse every logged day** — a month-by-month calendar going back as far as the log does. Each
  day shows which pillars were logged; tap one to jump to it.
- **Personal records** and all-time totals.

### 2. Fitness
Editable date and session time. Three sections — **Upper Body**, **Lower Body**, **Cardio** —
holding **231 exercises** across 19 muscle groups, including the commercial machines most gyms
actually have: diverging and iso-lateral pulldowns and rows, converging chest press, abdominal
crunch and triceps extension machines, pendulum and belt squats, assisted pull-up and dip.

One row per set: **Set · kg · Reps · kcal · ✓**

- Tap the set number to cycle **working → warm-up → drop set → to failure**.
- The **kcal** column is calculated, not typed — see [Energy](#energy).
- Cardio logs duration, distance, heart rate, intensity and **the calorie figure off the machine**;
  enter it and FitLog uses it instead of its own estimate.
- **Assisted machines** are modelled properly: on an assisted pull-up the stack carries part of you,
  so it is subtracted from the load rather than added to it.
- An **Energy breakdown** card shows where the session's calories went.

#### Your own exercises

Type a name the library does not have and FitLog offers to save it. It then appears in the picker
forever after, so one movement builds one history instead of three spellings building three.

If what you typed is something FitLog already knows under another name — `INCLINED LEG PRESS`,
`seated row`, `bb squat` — it quietly matches it instead of creating a duplicate.

### 3. Diet
~250 foods with per-100 g macros, including Indian and Middle Eastern staples. Meal-by-meal log,
custom foods, quick calorie entry, a recipe calculator that totals raw ingredients and splits them
per serving, and water tracking against a target derived from bodyweight, training and climate.

### 4. Sleep
Bed and wake time drive everything: time in bed, total sleep time, efficiency, mid-sleep anchor,
14-night debt, and a consistency score from the circular standard deviation of mid-sleep times.
Add your own fields — caffeine, HRV, room temperature — and they flow into exports.

Efficiency is only shown when you have recorded how long you took to fall asleep or how long you
were awake. Without those it would arithmetically be 100%, which is an absence of data rather than a
perfect night, so FitLog says so instead of scoring it.

---

## Energy

Standard MET tables give "weight lifting" a single number regardless of what you lifted, which makes
a set of 20 kg curls cost the same as a set of 180 kg squats. FitLog costs a set from the work it
actually did:

```
work (J) = load × 9.81 × range of motion × reps × (1 + 0.35)
kcal     = work ÷ 4184 ÷ 0.22
```

The 0.35 is the lowering phase, which costs roughly a third of the lifting phase. The 0.22 is
muscular efficiency. On top sits a time term for bracing while the set runs (MET 3.5) and the rest
between sets (MET 2.5).

Bodyweight movements use a share of your body weight as the load — a push-up moves about 64% of you,
a pull-up all of it — plus anything on a belt, minus any machine assistance. Holds and carries do no
net mechanical work, so they are costed by time.

Range of motion comes from a per-movement table. A tall lifter's bench stroke is longer than a short
one's, so treat the result as a good estimate rather than a measurement.

---

## Sync across devices

Optional. Skip it and FitLog is a perfectly good local-only log.

1. Deploy the worker — see [`worker/README-worker.md`](worker/README-worker.md). Fifteen minutes in
   the Cloudflare dashboard, free tier.
2. Put its URL in `js/config.js`. Every device picks it up from the site itself.
3. On the device holding your history: **Settings → Sync → Turn on sync here**. On every other
   device, point the camera at the QR code and tap the link.

**How conflicts resolve.** Merging happens per day, not per file. Log Monday on your laptop and
Tuesday on your phone and both survive. Deletions carry a tombstone so removing a day removes it
everywhere. The only real conflict is editing the same date on two devices while one is offline, and
there the later edit wins. Every sync is pull → merge → push, so an offline edit is never lost.

**Bandwidth.** The payload is gzipped before it leaves the device — a year of logging goes from about
680 KB to 120 KB. FitLog only writes when something actually changed, so an idle app costs nothing
but reads.

**Security.** The pairing code is the credential; anyone holding it can read and write your log.
128 bits of randomness, so it is not guessable, but keep it out of group chats. **Delete cloud copy**
revokes it.

---

## Storage, and lasting for years

The log is kept in **IndexedDB**, not localStorage. That matters more than it sounds: localStorage
is capped around 5 MB per site, and a day of full logging — workout, every meal, water, sleep — runs
to roughly 4 KB. Two years overflows the cap, and the failure mode is the worst kind: the write
throws, the newest day is lost, and nothing says so. IndexedDB has no such ceiling and its writes are
transactional, so a half-written state is not one the app can ever read back.

Measured on two years of dense synthetic data (730 days, every meal and every night):

| | |
|---|---|
| Stored size | 2.8 MB |
| A single edit | 0.15 ms |
| Any tab rendering | under 25 ms |
| Six-month comparison | under 30 ms |
| Cold start | under 1 s |
| Reload integrity | byte-identical |

localStorage remains as a fallback for browsers that block IndexedDB, and the first run on this
version moves any existing localStorage copy across automatically.

**Settings → Check my data** walks everything stored and reports what does not add up — unknown
exercises, out-of-range values, calories left in a note, implausible nights — and repairs what can be
repaired without guessing. It never deletes a workout, a meal or a night.

---

## Files

```
index.html                  app shell
css/styles.css              design system, dark and light
js/config.js                your sync endpoint — the only file you edit
js/data-exercises.js        231 exercises with muscle groups, equipment, MET and range of motion
js/data-foods.js            ~250 foods with per-100 g macros
js/store.js                 state, persistence, migration, units, calculations, merge engine
js/ui.js                    icons, toasts, sheets, SVG charts
js/health.js                the data health check and repair
js/history.js               the month-by-month calendar browser
js/sync.js                  pairing, compression, pull/merge/push
js/tab-*.js                 the four tabs
js/settings.js              profile, targets, sync, backup and restore
js/exports.js               PDF, Excel and CSV reports
js/vendor/                  jsPDF, jsPDF-AutoTable, SheetJS, qrcode-generator
sw.js                       offline cache and self-update
manifest.webmanifest        installable app metadata

worker/worker.js            the Cloudflare Worker — deploy this for sync
worker/README-worker.md     step-by-step deployment
```

No build step, no npm install, no framework. Edit a file, push, done.

## Keyboard shortcuts

`1`–`4` switch tabs · `T` jumps to today · `Alt + ←/→` steps a day · `Esc` closes a sheet.

## The formulas

| Quantity | Method |
|---|---|
| Basal metabolic rate | Mifflin-St Jeor |
| Maintenance calories | BMR × activity factor (1.2–1.9) |
| Protein target | 1.8–2.2 g per kg depending on goal |
| Water target | 35 ml/kg + 600 ml per training hour + 500 ml in a hot climate |
| Cardio energy | The machine's figure when entered; otherwise `MET × 3.5 × kg / 200` per minute |
| Resistance energy | Mechanical work ÷ 4184 ÷ 0.22, plus tension and rest terms |
| Estimated 1RM | Epley by default; Brzycki, Lombardi, O'Conner and Wathan also selectable |
| Training volume | Σ weight × reps across working sets |
| Training load | Session RPE: duration × intensity |
| Acute:chronic ratio | 7-day load ÷ (28-day load ÷ 4); 0.8–1.3 is the usual sweet spot |
| Sleep efficiency | total sleep time ÷ time in bed |
| Sleep debt | Σ (target − actual) over 14 nights |
| Consistency | circular standard deviation of mid-sleep times, mapped to 0–100 |

Estimates to guide training decisions, not medical advice.
