/* ==========================================================================
   FitLog — shared UI helpers: icons, toasts, sheets, charts
   ========================================================================== */

const $  = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

function el(tag, attrs, html) {
  const n = document.createElement(tag);
  if (attrs) Object.entries(attrs).forEach(([k, v]) => {
    if (v == null) return;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v);
  });
  if (html != null) n.innerHTML = html;
  return n;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------- icons (Feather-style, 24x24 stroke) ---------- */
const ICONS = {
  overview:  '<path d="M3 13h4l3 8 4-16 3 8h4"/>',
  fitness:   '<path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11"/>',
  diet:      '<path d="M18 8h1a4 4 0 0 1 0 8h-1M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8zM6 1v3M10 1v3M14 1v3"/>',
  sleep:     '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  settings:  '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
  plus:      '<path d="M12 5v14M5 12h14"/>',
  minus:     '<path d="M5 12h14"/>',
  check:     '<path d="M20 6L9 17l-5-5"/>',
  x:         '<path d="M18 6L6 18M6 6l12 12"/>',
  trash:     '<path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6"/>',
  edit:      '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  search:    '<circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>',
  left:      '<path d="M15 18l-6-6 6-6"/>',
  right:     '<path d="M9 18l6-6-6-6"/>',
  calendar:  '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clock:     '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  droplet:   '<path d="M12 2.7l5.7 5.7a8 8 0 1 1-11.4 0z"/>',
  flame:     '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.13-.5-4.5 2-6 .5 2.5 2 3.6 3 4.5 1.5 1.35 2 3 2 5a6 6 0 1 1-12 0c0-1.1.17-2 .5-3 .5 1 1.5 2 3 2z"/>',
  scale:     '<path d="M12 3v18M7 7l-4 8a4 4 0 0 0 8 0l-4-8zM17 7l-4 8a4 4 0 0 0 8 0l-4-8z"/>',
  trend:     '<path d="M23 6l-9.5 9.5-5-5L1 18"/><path d="M17 6h6v6"/>',
  down:      '<path d="M23 18l-9.5-9.5-5 5L1 6"/><path d="M17 18h6v-6"/>',
  activity:  '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  save:      '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/>',
  upload:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5M12 3v12"/>',
  download:  '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/>',
  file:      '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M16 13H8M16 17H8M10 9H8"/>',
  grid:      '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  copy:      '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  info:      '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  alert:     '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  award:     '<circle cx="12" cy="8" r="7"/><path d="M8.21 13.89L7 23l5-3 5 3-1.21-9.12"/>',
  timer:     '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2 2M9 1h6"/>',
  book:      '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  moon:      '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>',
  sun:       '<circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/>',
  chevron:   '<path d="M6 9l6 6 6-6"/>',
  refresh:   '<path d="M23 4v6h-6M1 20v-6h6"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  zap:       '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>',
  layers:    '<path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>'
};

function icon(name, cls) {
  return `<svg class="${cls || ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
}

/* ---------- toast ---------- */
function toast(msg, kind) {
  let box = $('#toasts');
  if (!box) { box = el('div', { id: 'toasts' }); document.body.appendChild(box); }
  const t = el('div', { class: 'toast ' + (kind || '') }, esc(msg));
  box.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transition = 'opacity .25s'; }, 2200);
  setTimeout(() => t.remove(), 2550);
}

/* ---------- sheet / modal ---------- */
let sheetStack = [];

function openSheet({ title, body, foot, onClose, wide }) {
  const scrim = el('div', { class: 'scrim' });
  const sheet = el('div', { class: 'sheet' });
  sheet.style.maxWidth = wide ? '760px' : '';
  sheet.innerHTML = `
    <div class="grab"></div>
    <div class="sheet-head">
      <h2>${esc(title)}</h2>
      <button class="btn ghost icon" data-close>${icon('x')}</button>
    </div>
    <div class="sheet-body"></div>`;
  const bodyEl = $('.sheet-body', sheet);
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  if (foot) {
    const f = el('div', { class: 'sheet-foot' });
    if (typeof foot === 'string') f.innerHTML = foot; else f.appendChild(foot);
    sheet.appendChild(f);
  }
  scrim.appendChild(sheet);
  document.body.appendChild(scrim);
  document.body.style.overflow = 'hidden';

  const close = () => {
    scrim.remove();
    sheetStack = sheetStack.filter(s => s.scrim !== scrim);
    if (!sheetStack.length) document.body.style.overflow = '';
    if (onClose) onClose();
  };
  scrim.addEventListener('click', e => { if (e.target === scrim) close(); });
  $$('[data-close]', sheet).forEach(b => b.addEventListener('click', close));
  const ref = { scrim, sheet, body: bodyEl, close };
  sheetStack.push(ref);
  return ref;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && sheetStack.length) sheetStack[sheetStack.length - 1].close();
});

function confirmSheet(title, message, confirmLabel, danger) {
  return new Promise(resolve => {
    let done = false;
    const s = openSheet({
      title,
      body: `<p class="muted">${esc(message)}</p>`,
      foot: `<button class="btn" data-no>Cancel</button><button class="btn ${danger ? 'danger' : 'primary'}" data-yes>${esc(confirmLabel || 'Confirm')}</button>`,
      onClose: () => { if (!done) resolve(false); }
    });
    $('[data-no]', s.sheet).onclick = () => { done = true; s.close(); resolve(false); };
    $('[data-yes]', s.sheet).onclick = () => { done = true; s.close(); resolve(true); };
  });
}

/* ---------- charts (dependency-free SVG) ---------- */
const CHART_COLORS = {
  train: '#4f8cff', diet: '#23c98b', sleep: '#a27bff', water: '#38bdf8',
  warn: '#f5a524', bad: '#f4525d', muted: '#6b7489'
};

/** Line / area chart. series = [{label, color, values:[n|null]}] */
function lineChart(labels, series, opts) {
  opts = opts || {};
  const W = 600, H = opts.height || 150, pad = { t: 10, r: 8, b: 20, l: 34 };
  const all = series.flatMap(s => s.values).filter(v => v != null && !isNaN(v));
  if (!all.length) return `<div class="empty small">No data for this range</div>`;
  let min = opts.min != null ? opts.min : Math.min(...all);
  let max = opts.max != null ? opts.max : Math.max(...all);
  if (min === max) { min -= 1; max += 1; }
  if (opts.zero) min = Math.min(0, min);
  // breathing room only where the caller did not pin the scale
  const pace = (max - min) * 0.12;
  if (opts.min == null) min -= pace;
  if (opts.max == null) max += pace;
  const x = i => pad.l + i * (W - pad.l - pad.r) / Math.max(1, labels.length - 1);
  const y = v => pad.t + (1 - (v - min) / (max - min)) * (H - pad.t - pad.b);

  let g = '';
  // gridlines
  for (let i = 0; i <= 3; i++) {
    const v = min + (max - min) * i / 3;
    const yy = y(v);
    g += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="var(--line-soft)" stroke-width="1"/>`;
    g += `<text x="${pad.l - 6}" y="${yy + 3.5}" text-anchor="end" font-size="9" fill="var(--tx-3)">${fmtNum(v, max - min < 6 ? 1 : 0)}</text>`;
  }
  series.forEach((s, si) => {
    const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]).filter(Boolean);
    if (!pts.length) return;
    const d = pts.map((p, i) => (i ? 'L' : 'M') + round(p[0], 1) + ' ' + round(p[1], 1)).join(' ');
    if (opts.area && si === 0) {
      g += `<path d="${d} L ${pts[pts.length - 1][0]} ${H - pad.b} L ${pts[0][0]} ${H - pad.b} Z" fill="${s.color}" opacity=".12"/>`;
    }
    g += `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(p => { g += `<circle cx="${round(p[0], 1)}" cy="${round(p[1], 1)}" r="2.6" fill="${s.color}"/>`; });
  });
  // x labels (first, middle, last)
  const idxs = labels.length <= 8 ? labels.map((_, i) => i) : [0, Math.floor(labels.length / 2), labels.length - 1];
  idxs.forEach(i => {
    g += `<text x="${x(i)}" y="${H - 5}" text-anchor="middle" font-size="9" fill="var(--tx-3)">${esc(labels[i])}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}</svg>`;
}

/** Vertical bar chart. values may be numbers or {v, color} */
function barChart(labels, values, opts) {
  opts = opts || {};
  const W = 600, H = opts.height || 140, pad = { t: 10, r: 8, b: 20, l: 34 };
  const nums = values.map(v => (typeof v === 'object' ? v.v : v) || 0);
  // keep the target line inside the plot area, even when no bar reaches it
  const max = opts.max != null ? opts.max : Math.max(...nums, (opts.target || 0) * 1.08, 1);
  if (!nums.some(n => n > 0)) return `<div class="empty small">No data for this range</div>`;
  const iw = (W - pad.l - pad.r) / values.length;
  const bw = Math.min(iw * 0.66, 42);
  let g = '';
  for (let i = 0; i <= 2; i++) {
    const yy = pad.t + (1 - i / 2) * (H - pad.t - pad.b);
    g += `<line x1="${pad.l}" y1="${yy}" x2="${W - pad.r}" y2="${yy}" stroke="var(--line-soft)"/>`;
    g += `<text x="${pad.l - 6}" y="${yy + 3.5}" text-anchor="end" font-size="9" fill="var(--tx-3)">${fmtNum(max * i / 2, max < 6 ? 1 : 0)}</text>`;
  }
  if (opts.target) {
    const ty = pad.t + (1 - opts.target / max) * (H - pad.t - pad.b);
    if (ty > pad.t) g += `<line x1="${pad.l}" y1="${ty}" x2="${W - pad.r}" y2="${ty}" stroke="${opts.targetColor || CHART_COLORS.warn}" stroke-width="1.4" stroke-dasharray="4 3"/>`;
  }
  values.forEach((v, i) => {
    const n = typeof v === 'object' ? v.v : v;
    const col = (typeof v === 'object' && v.color) || opts.color || CHART_COLORS.train;
    const h = Math.max(0, (n / max) * (H - pad.t - pad.b));
    const cx = pad.l + i * iw + iw / 2;
    g += `<rect x="${round(cx - bw / 2, 1)}" y="${round(H - pad.b - h, 1)}" width="${round(bw, 1)}" height="${round(h, 1)}" rx="3" fill="${col}" opacity="${n ? 1 : .25}"/>`;
  });
  const step = labels.length > 10 ? Math.ceil(labels.length / 7) : 1;
  labels.forEach((l, i) => {
    if (i % step) return;
    g += `<text x="${pad.l + i * iw + iw / 2}" y="${H - 5}" text-anchor="middle" font-size="9" fill="var(--tx-3)">${esc(l)}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="height:${H}px">${g}</svg>`;
}

/** Progress ring */
function ring(pct, color, big, sub, size) {
  const s = size || 92, r = s / 2 - 7, c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct || 0));
  return `<div class="ring" style="width:${s}px;height:${s}px">
    <svg viewBox="0 0 ${s} ${s}">
      <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="7"/>
      <circle cx="${s / 2}" cy="${s / 2}" r="${r}" fill="none" stroke="${color}" stroke-width="7"
        stroke-linecap="round" stroke-dasharray="${round(c, 1)}"
        stroke-dashoffset="${round(c * (1 - p / 100), 1)}" style="transition:stroke-dashoffset .5s ease"/>
    </svg>
    <div class="rlabel"><div><b>${big}</b><span>${esc(sub || '')}</span></div></div>
  </div>`;
}

/** Horizontal stacked bar for macros */
function macroBar(p, c, f) {
  const kp = p * 4, kc = c * 4, kf = f * 9, tot = kp + kc + kf;
  if (!tot) return `<div class="bar"></div>`;
  const pc = v => round(v / tot * 100, 1);
  return `<div class="bar lg" style="display:flex">
    <i style="width:${pc(kp)}%;background:var(--prot);border-radius:4px 0 0 4px"></i>
    <i style="width:${pc(kc)}%;background:var(--carb);border-radius:0"></i>
    <i style="width:${pc(kf)}%;background:var(--fat-c);border-radius:0 4px 4px 0"></i>
  </div>`;
}

/** Delta formatting: returns {html, dir} */
function delta(now, before, opts) {
  opts = opts || {};
  if (now == null || before == null || !isFinite(now) || !isFinite(before)) {
    return { html: '<span class="delta-flat">—</span>', dir: 0, pct: null };
  }
  const diff = now - before;
  const improved = opts.lowerIsBetter ? diff < 0 : diff > 0;

  // Some metrics have no universally "good" direction (RPE, bodyweight on a
  // maintenance plan) — show the movement without a verdict colour.
  if (opts.neutral) {
    const p0 = before ? diff / Math.abs(before) * 100 : null;
    const txt = opts.abs || p0 == null
      ? (diff > 0 ? '+' : '') + fmtNum(diff, opts.dp == null ? 1 : opts.dp)
      : (p0 > 0 ? '+' : '') + fmtNum(p0, 1) + '%';
    return { html: `<span class="delta-flat">${diff > 0 ? '▲' : diff < 0 ? '▼' : '→'} ${txt}</span>`, dir: 0, pct: p0 };
  }

  // No baseline to compare against — a percentage here would be meaningless
  // (a first session against zero is not "+1,900%").
  if (!before) {
    if (!diff) return { html: '<span class="delta-flat">—</span>', dir: 0, pct: null };
    return { html: `<span class="${improved ? 'delta-up' : 'delta-down'}">new</span>`, dir: improved ? 1 : -1, pct: null };
  }

  const pct = diff / Math.abs(before) * 100;
  const flat = Math.abs(pct) < 2;
  const cls = flat ? 'delta-flat' : improved ? 'delta-up' : 'delta-down';
  const arrow = flat ? '→' : diff > 0 ? '▲' : '▼';
  const capped = Math.abs(pct) > 999;
  const txt = opts.abs
    ? (diff > 0 ? '+' : '') + fmtNum(diff, opts.dp == null ? 0 : opts.dp)
    : capped ? (pct > 0 ? '>' : '<−') + '999%'
      : (pct > 0 ? '+' : '') + fmtNum(pct, 1) + '%';
  return { html: `<span class="${cls}">${arrow} ${txt}</span>`, dir: flat ? 0 : improved ? 1 : -1, pct };
}

/* ---------- misc ---------- */
function uid() { return Math.random().toString(36).slice(2, 10); }

function nowTime() {
  const d = new Date();
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

function fmtMin(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}

function fmtHours(h) {
  if (h == null) return '–';
  const hh = Math.floor(h), mm = Math.round((h - hh) * 60);
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
}

function scoreColor(v) {
  if (v == null) return CHART_COLORS.muted;
  if (v >= 80) return CHART_COLORS.diet;
  if (v >= 60) return CHART_COLORS.train;
  if (v >= 40) return CHART_COLORS.warn;
  return CHART_COLORS.bad;
}

function download(filename, content, mime) {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
