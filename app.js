import { SITES, SYMPTOM_SCALES, SYMPTOM_FLAGS, EVIDENCE, KIND_LABEL, ACTIONS, BP_ACTIONS, PLAIN, METAB_ACTIONS } from './data.js';
import * as E from './engine.js';
import * as X from './extra.js';
import * as PH from './photos.js';

const { DAY, COMPOUNDS, MARKERS, byId, markerById, fmtDate, fmtDT, fmtIn, round } = E;
let S = E.load();
S.workouts ||= []; S.measures ||= [];
const commit = () => E.save(S);

/* ---------- утилиты ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const localInput = (t) => { const d = new Date(t); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const dayKey = (t) => new Date(t).toDateString();
const normText = (m) => (m.lo != null && m.hi != null ? `${m.lo}–${m.hi}` : m.hi != null ? `до ${m.hi}` : m.lo != null ? `от ${m.lo}` : '—');

const P = {
  today: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  syringe: '<path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5M9 11l4 4M5 19l-3 3M14 4l6 6"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  flask: '<path d="M10 2v7.5L4.6 18.4A2.4 2.4 0 0 0 6.7 22h10.6a2.4 2.4 0 0 0 2.1-3.6L14 9.5V2M8.5 2h7M7 16h10"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  up: '<path d="M7 17 17 7M8 7h9v9"/>',
  down: '<path d="M7 7l10 10M17 8v9H8"/>',
  flat: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  good: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  warning: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',
  serious: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0ZM12 9v4M12 17h.01"/>',
  critical: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6M12 16.5h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5h.01"/>',
  cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  doc: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
  db: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5M3 12c0 1.7 4 3 9 3s9-1.3 9-3"/>',
  save: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  restore: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  pct: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5"/>',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
  drop: '<path d="M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0Z"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.4 2.4 0 0 1 0-3.4l2.6-2.6a2.4 2.4 0 0 1 3.4 0ZM14.5 12.5l2-2M11.5 9.5l2-2M8.5 6.5l2-2M17.5 15.5l2-2"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3Z"/><circle cx="12" cy="13" r="3"/>',
  pill: '<path d="m10.5 20.5 10-10a5 5 0 0 0-7-7l-10 10a5 5 0 0 0 7 7ZM8.5 8.5l7 7"/>',
};
const ic = (n, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || ''}</svg>`;
const ST_LABEL = { good: 'Норма', warning: 'Внимание', serious: 'Высокий риск', critical: 'Критично', info: 'Инфо' };
const badge = (st, label) => `<span class="badge st-${st}">${ic(st)}${esc(label || ST_LABEL[st])}</span>`;
const evTag = (ev) => ev ? `<span class="ev"><span class="dot ${ev}"></span>${EVIDENCE[ev].label}</span>` : '';
const alertBox = (a, extra = '') => `<div class="alert"><span class="ic st-${a.st}">${ic(a.st, 'ic')}</span><div class="grow"><div class="t">${esc(a.title)}</div><div class="x">${esc(a.text)}</div>${evTag(a.ev)}${extra}</div></div>`;

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove('on'), 1800);
}

/* ---------- шторка ---------- */
function sheet(html, mount) {
  closeSheet(true);
  const scrim = document.createElement('div'); scrim.className = 'scrim';
  const el = document.createElement('div'); el.className = 'sheet'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
  el.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(scrim, el);
  requestAnimationFrame(() => { scrim.classList.add('on'); el.classList.add('on'); });
  scrim.onclick = () => closeSheet();
  $$('[data-close]', el).forEach((b) => (b.onclick = () => closeSheet()));
  mount?.(el);
  return el;
}
function closeSheet(instant) {
  $$('.sheet, .scrim').forEach((n) => {
    if (instant) return n.remove();
    n.classList.remove('on'); setTimeout(() => n.remove(), 260);
  });
}
const segBind = (root, cb) => $$('.seg', root).forEach((seg) => seg.addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  $$('button', seg).forEach((x) => x.setAttribute('aria-pressed', x === b)); cb?.(seg, b.dataset.v);
}));

/* ---------- навигация ---------- */
const TABS = [
  ['today', 'Сегодня', 'today'], ['doses', 'Уколы', 'syringe'], ['feel', 'Дневник', 'heart'], ['health', 'Здоровье', 'flask'], ['more', 'Ещё', 'more'],
];
let tab = 'today';
let sub = null; // { kind, id }
let range = 21;

function go(t, s = null) { tab = t; sub = s; render(); window.scrollTo(0, 0); }

function renderTabbar() {
  $('#tabbar').innerHTML = `<nav>${TABS.map(([id, label, icon]) => `<button data-tab="${id}" ${tab === id ? 'aria-current="page"' : ''}>${ic(icon)}<span>${label}</span></button>`).join('')}</nav>`;
  $$('#tabbar button').forEach((b) => (b.onclick = () => go(b.dataset.tab)));
}

function render() {
  renderTabbar();
  const v = $('#view');
  if (sub?.kind === 'compound') v.innerHTML = viewCompound(sub.id);
  else if (sub?.kind === 'marker') v.innerHTML = viewMarker(sub.id);
  else if (sub?.kind === 'db') v.innerHTML = viewDb();
  else v.innerHTML = { today: viewToday, doses: viewDoses, feel: viewFeel, health: viewHealth, more: viewMore }[tab]();
  bind(v);
}

/* ---------- график ---------- */
function lineChart(el, { series, from, to, band, labs = [], doses = [], unit, color = 'var(--series-1)', h = 200, minV = 0 }) {
  const W = Math.max(280, el.clientWidth || 340), H = h;
  const pl = 34, pr = 10, pt = 12, pb = 24;
  const now = Date.now();
  const maxV = Math.max(...series.map((p) => p.v), ...labs.map((l) => l.v), band ? band[1] : 0, 1);
  const y0 = minV > 0 ? (maxV - minV > 100 ? Math.floor(minV / 100) * 100 : Math.floor(minV)) : 0;
  const step = y0 ? niceMax(((maxV - y0) * 1.06) / 4) : niceMax((maxV * 1.08) / 4);
  const yMax = y0 + step * 4;
  const x = (t) => pl + ((t - from) / (to - from)) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - y0) / (yMax - y0)) * (H - pt - pb);
  const ticks = [0, 1, 2, 3, 4].map((i) => y0 + ((yMax - y0) * i) / 4);
  const path = (pts) => pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const past = series.filter((p) => p.t <= now), fut = series.filter((p) => p.t >= now - 3600000);
  const dayStep = (to - from) / DAY > 45 ? 14 : (to - from) / DAY > 20 ? 7 : 3;
  const xt = [];
  const start = new Date(from); start.setHours(0, 0, 0, 0);
  for (let t = start.getTime() + DAY; t < to; t += DAY) { const d = Math.round((t - start.getTime()) / DAY); if (d % dayStep === 0) xt.push(t); }
  el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="График: оценочный уровень, ${unit}">
    ${band ? `<rect x="${pl}" y="${y(band[1])}" width="${W - pl - pr}" height="${y(band[0]) - y(band[1])}" fill="var(--band)"/>` : ''}
    ${ticks.map((v) => `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" stroke="var(--grid)" stroke-width="1"/><text x="${pl - 6}" y="${y(v) + 4}" text-anchor="end">${yMax - y0 < 8 ? round(v, 1) : Math.round(v)}</text>`).join('')}
    ${xt.map((t) => `<text x="${x(t)}" y="${H - 6}" text-anchor="middle">${fmtDate(t)}</text>`).join('')}
    ${now > from && now < to ? `<line x1="${x(now)}" x2="${x(now)}" y1="${pt}" y2="${H - pb}" stroke="var(--text-3)" stroke-width="1"/><text x="${x(now) > W - 60 ? x(now) - 4 : x(now) + 4}" y="${pt + 10}" text-anchor="${x(now) > W - 60 ? 'end' : 'start'}" style="fill:var(--text-2)">сейчас</text>` : ''}
    <path d="${path(past)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>
    <path d="${path(fut)}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" opacity="0.45"/>
    ${doses.filter((d) => d.t > from && d.t < to).map((d) => `<line x1="${x(d.t)}" x2="${x(d.t)}" y1="${H - pb}" y2="${H - pb - 6}" stroke="${color}" stroke-width="2" opacity="${d.planned ? 0.45 : 1}"/>`).join('')}
    ${labs.filter((l) => l.t > from && l.t < to).map((l) => `<circle cx="${x(l.t)}" cy="${y(l.v)}" r="${labs.length > 20 ? 3 : 5}" fill="var(--s1)" stroke="var(--text)" stroke-width="2"/>`).join('')}
    <line class="xh" x1="0" x2="0" y1="${pt}" y2="${H - pb}" stroke="var(--text-2)" stroke-width="1" opacity="0"/>
    <circle class="xd" r="5" fill="${color}" stroke="var(--s1)" stroke-width="2" opacity="0"/>
  </svg><div class="tip"></div>`;
  const svg = $('svg', el), tip = $('.tip', el), xh = $('.xh', el), xd = $('.xd', el);
  const show = (ev) => {
    const r = svg.getBoundingClientRect();
    const px = ((ev.clientX - r.left) / r.width) * W;
    const t = from + ((px - pl) / (W - pl - pr)) * (to - from);
    const p = series.reduce((b, q) => (Math.abs(q.t - t) < Math.abs(b.t - t) ? q : b), series[0]);
    if (!p) return;
    const cx = x(p.t);
    xh.setAttribute('x1', cx); xh.setAttribute('x2', cx); xh.setAttribute('opacity', 1);
    xd.setAttribute('cx', cx); xd.setAttribute('cy', y(p.v)); xd.setAttribute('opacity', 1);
    tip.innerHTML = `${fmtDT(p.t)} · <b>${round(p.v, 0)}</b> ${unit}${p.t > now ? ' · прогноз' : ''}`;
    tip.style.left = `${Math.min(Math.max((cx / W) * r.width, 90), r.width - 90)}px`;
    tip.style.top = `-30px`; tip.style.opacity = 1;
  };
  const hide = () => { tip.style.opacity = 0; xh.setAttribute('opacity', 0); xd.setAttribute('opacity', 0); };
  svg.addEventListener('pointermove', show);
  svg.addEventListener('pointerdown', show);
  svg.addEventListener('pointerleave', hide);
  svg.addEventListener('pointerup', (e) => { if (e.pointerType !== 'mouse') setTimeout(hide, 1500); });
}
function niceMax(v) {
  const p = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p;
  return 10 * p;
}

/* ---------- дашборд ---------- */
function spark(pts, color = 'var(--series-1)') {
  if (!pts || pts.length < 2) return '';
  const W = 120, H = 30, vs = pts.map((p) => p.v), mn = Math.min(...vs), mx = Math.max(...vs), r = mx - mn || 1;
  const x = (i) => (i / (pts.length - 1)) * W, y = (v) => H - 3 - ((v - mn) / r) * (H - 6);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts.map((p, i) => `${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
}
function tile({ go, label, value, unit = '', sub = '', st = null, stLabel = '', sp = '' }) {
  const bad = st && st !== 'good';
  return `<button class="tile" data-tile="${go}"><div class="row between"><span class="k">${label}</span>${bad ? `<span class="st-${st}">${ic(st, 'tic')}</span>` : ''}</div>
    <div class="v">${value}${unit ? `<small>${unit}</small>` : ''}</div>
    ${sp}<div class="d ${bad ? `st-${st}` : ''}">${esc(stLabel || sub)}</div></button>`;
}
function dashboard() {
  const now = Date.now();
  const lv = E.latestValues(S);
  const M = E.metabolism(S);
  const tiles = [];
  const bp = [...S.bp].sort((a, b) => a.t - b.t);
  const week = bp.filter((b) => now - b.t < 7 * DAY);
  let bpHtml;
  if (week.length) {
    const sys = Math.round(week.reduce((a, b) => a + b.sys, 0) / week.length), dia = Math.round(week.reduce((a, b) => a + b.dia, 0) / week.length);
    const st = E.bpStatus(sys, dia), last = bp.at(-1);
    bpHtml = `<div class="tile wide"><div class="row between"><span class="k">Давление · 7 дней</span>${badge(st.st, st.label)}</div>
      <div class="row between" style="align-items:flex-end"><div><div class="v">${sys}/${dia}<small>мм рт. ст.</small></div><div class="d">последнее ${last.sys}/${last.dia} · ${fmtDT(last.t)}</div></div>
      ${spark(bp.slice(-14).map((b) => ({ v: b.sys })), st.st === 'good' ? 'var(--series-1)' : `var(--${st.st})`)}</div>
      <div class="row" style="margin-top:12px"><button class="btn sm grow" data-act="add-bp">${ic('plus')}Измерить</button>${st.st !== 'good' ? '<button class="btn sm soft grow" data-act="bp-actions">Что делать</button>' : ''}</div></div>`;
  } else {
    bpHtml = `<div class="tile wide"><div class="row between"><span class="k">Давление</span>${bp.length ? badge('warning', 'неделю не мерил') : ''}</div>
      <div class="d" style="margin:6px 0 12px">${bp.length ? `Последнее ${bp.at(-1).sys}/${bp.at(-1).dia} — ${fmtDate(bp.at(-1).t)}` : 'На курсе мерь 2–3 раза в неделю: утром, сидя, после 5 минут покоя.'}</div>
      <button class="btn sm block" data-act="add-bp">${ic('plus')}Измерить</button></div>`;
  }
  if (M.cur) tiles.push(tile({ go: 'feel', label: 'Расход', value: Math.round(M.cur.tdee / 10) * 10, unit: 'ккал', st: M.status?.st, stLabel: M.status && M.status.st !== 'good' ? M.status.label : `${M.cur.weekRate >= 0 ? '+' : '−'}${round(Math.abs(M.cur.weekRate), 2)} кг/нед`, sp: spark(M.hist.map((h) => ({ v: h.tdee }))) }));
  if (M.weight) {
    const wk = M.trend.length > 7 ? M.weight - M.trend.at(-8).v : null;
    tiles.push(tile({ go: 'feel', label: 'Вес (тренд)', value: round(M.weight, 1), unit: 'кг', sub: wk != null ? `${wk >= 0 ? '+' : '−'}${round(Math.abs(wk), 1)} кг за неделю` : '', sp: spark(M.trend.slice(-30)) }));
  }
  const e2e = X.e2Estimate(S);
  if (e2e) tiles.push(tile({ go: 'marker:e2', label: 'E2 сейчас · оценка', value: round(e2e.now.v, 0), unit: 'пг/мл', st: e2e.now.st, stLabel: `${e2e.n ? 'по твоим анализам' : 'грубо, без анализа'}${e2e.peak ? ` · пик ≈ ${round(e2e.peak.v, 0)}` : ''}` }));
  const hf = X.hctForecast(S);
  for (const id of ['hct', 'e2', 'hdl', 'tsh']) {
    if (!lv[id]) continue;
    const m = markerById(id), st = E.markerStatus(m, lv[id].v);
    const pts = S.labs.filter((l) => l.values[id] != null).sort((a, b) => a.t - b.t).map((l) => ({ v: l.values[id] }));
    const dir = lv[id].v > (m.hi ?? Infinity) ? 'выше нормы' : 'ниже нормы';
    const fc = id === 'hct' && hf?.at54 ? `к 54% ≈ ${fmtDate(hf.at54)}` : null;
    tiles.push(tile({ go: `marker:${id}`, label: id === 'e2' ? 'E2 · анализ' : m.name, value: round(lv[id].v, id === 'hdl' ? 2 : 1), unit: m.base, st, stLabel: fc || (st && st !== 'good' ? dir : `${fmtDate(lv[id].t)} · норма`), sp: spark(pts) }));
  }
  const sym = S.symptoms.filter((x) => now - x.t < 7 * DAY);
  if (sym.length) {
    const lib = sym.reduce((a, x) => a + (x.libido || 3), 0) / sym.length;
    const st = lib <= 2.5 ? 'warning' : null;
    tiles.push(tile({ go: 'feel', label: 'Либидо, 7 дней', value: round(lib, 1), unit: 'из 5', st, stLabel: st ? 'просело' : lib >= 4 ? 'хорошо' : 'обычно', sp: spark([...S.symptoms].sort((a, b) => a.t - b.t).slice(-14).map((x) => ({ v: x.libido || 3 }))) }));
    if (M.sleepH != null) tiles.push(tile({ go: 'feel', label: 'Сон, 2 недели', value: round(M.sleepH, 1), unit: 'ч', st: M.sleepH < 7 ? 'warning' : null, stLabel: M.sleepH < 7 ? 'мало' : 'норм' }));
  }
  const lab = E.lastLabDate(S);
  const days = lab ? Math.floor((now - lab) / DAY) : null;
  tiles.push(tile({ go: 'health', label: 'Анализы', value: days == null ? '—' : days, unit: days == null ? '' : 'дн. назад', st: days == null || days > 56 ? 'warning' : null, stLabel: days == null ? 'ещё не сдавал' : days > 56 ? 'пора сдать' : 'свежие' }));
  if (tiles.length % 2) tiles.push('<div class="tile ghost-tile" aria-hidden="true"></div>');
  return `${bpHtml}<div class="tiles">${tiles.join('')}</div>`;
}

/* ---------- Сегодня ---------- */
function viewToday() {
  const now = Date.now();
  const sum = E.testoSummary(S);
  const cal = E.calibration(S);
  const load = E.weeklyLoad(S);
  const rem = [...E.reminders(S).filter((x) => x.action !== 'bp' && x.action !== 'labs'), ...E.symptomHints(S)];
  const todos = X.todayTodos(S);
  const risks = E.checkStack(S).filter((r) => r.st === 'critical' || r.st === 'serious');
  const others = E.activeHormones(S).filter((h) => h !== 'testosterone');
  const d = new Date();
  let hero = '';
  if (sum) {
    const pctCycle = sum.interval && sum.dayInCycle != null ? Math.min(100, (sum.dayInCycle / sum.interval) * 100) : 0;
    const trendTxt = { up: ['up', 'растёт'], down: ['down', 'снижается'], flat: ['flat', 'стабильно'] }[sum.trend];
    hero = `<div class="card hero">
      <div class="row between"><span class="label">Тестостерон сейчас</span><span class="trend">${ic(trendTxt[0])}${trendTxt[1]}</span></div>
      <div class="big">≈ ${round(sum.cur, 0)}<small>нмоль/л</small></div>
      <div class="xs muted">≈ ${Math.round(sum.cur * 28.84 / 10) * 10} нг/дл. ${sum.cur > 29 ? `Это в ${round(sum.cur / 29, 1)} раза выше верхней границы нормы (29). ` : ''}${cal.n ? `Откалибровано по анализам: ${cal.n}` : 'Грубая оценка — внеси анализ тестостерона, чтобы уточнить'}</div>
      ${sum.interval ? `<div class="progress" aria-hidden="true"><i style="width:${pctCycle}%"></i></div>
      <div class="row between sm"><span>${sum.dayInCycle >= sum.interval - 0.5 ? 'Укол сегодня' : `День ${Math.floor(sum.dayInCycle) + 1} из ${round(sum.interval, 0)}`}</span>
      <span class="muted">${sum.next ? `Укол через ${fmtIn(sum.next.t - now)}` : ''}</span></div>` : ''}
      <button class="btn block" style="margin-top:14px" data-act="log-dose">${ic('syringe')}Отметить укол</button>
    </div>`;
  } else {
    hero = `<div class="card"><h3>Добавь схему</h3><p class="sm muted">Укажи препарат, дозу и дату последнего укола — построю кривую и прогноз.</p><button class="btn block" data-act="add-protocol">${ic('plus')}Добавить препарат</button></div>`;
  }
  const stats = sum && sum.peak ? `<div class="stats">
      <div class="stat"><div class="k">Пик</div><div class="v">${round(sum.peak, 0)}</div></div>
      <div class="stat"><div class="k">Минимум</div><div class="v">${round(sum.trough, 0)}</div></div>
      <div class="stat"><div class="k">Колебание</div><div class="v">×${round(sum.peak / Math.max(sum.trough, 0.1), 1)}</div></div>
    </div>` : '';
  const trough = sum?.nextTrough ? `<div class="alert"><span class="ic st-info">${ic('info', 'ic')}</span><div><div class="t">Ближайший минимум — ${fmtDT(sum.nextTrough.t)}</div><div class="x">≈ ${round(sum.nextTrough.v, 0)} нмоль/л перед следующим уколом. В этот момент удобно сдавать анализы: минимум точнее всего калибрует модель.</div></div></div>` : '';
  return `<div class="top"><div><h1>Сегодня</h1><div class="sub">${d.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</div></div></div>
    ${hero}
    ${todos.length ? `<h2 class="sec">На сегодня</h2><div class="card tight">${todos.map((t) => `<button class="li" data-todo="${t.act}"><span class="st-${t.st}">${ic(t.icon)}</span><div class="grow"><div class="t">${esc(t.title)}</div><div class="d">${esc(t.text)}</div></div>${ic('chev', 'chev')}</button>`).join('')}</div>` : ''}
    ${E.needsSince(S) ? `<div class="alert"><span class="ic st-warning">${ic('warning', 'ic')}</span><div class="grow"><div class="t">Кривая начинается с нуля</div><div class="x">Модель видит только записанные уколы и думает, что ты только начал. Если колешь давно — укажи дату начала, и кривая станет реальной.</div><div style="margin-top:10px"><button class="btn sm soft" data-edit-protocol="${E.needsSince(S).id}">Указать дату</button></div></div></div>` : ''}
    <h2 class="sec">Показатели</h2>
    ${dashboard()}
    ${sum ? `<h2 class="sec">Тестостерон</h2><div class="card"><div class="row between"><h3>Кривая</h3></div>
      <div class="seg" style="margin:10px 0 14px">${[[14, '2 нед'], [21, '3 нед'], [45, '6 нед'], [90, '3 мес']].map(([v, l]) => `<button data-range="${v}" aria-pressed="${range === v}">${l}</button>`).join('')}</div>
      <div class="chart" id="ch-test"></div>
      <div class="legend"><span><i style="background:var(--series-1)"></i>Оценка</span><span><i style="background:var(--series-1);opacity:.45"></i>Прогноз</span><span><i class="band"></i>Норма 8,6–29</span><span><i class="ring"></i>Анализ</span></div>
    </div>` : ''}
    ${stats}
    ${trough}
    ${others.map((h) => `<div class="card"><h3>${esc(hormoneName(h))}</h3><div class="xs muted">Высвобождение, мг/сут — форма кривой, не уровень в крови</div><div class="chart" data-hormone="${h}"></div></div>`).join('')}
    ${rem.length || risks.length ? `<h2 class="sec">Важно</h2>${[...risks, ...rem].map((a) => alertBox(a, a.action ? `<div style="margin-top:10px"><button class="btn sm soft" data-goto="${a.action}">Открыть</button></div>` : '')).join('')}` : ''}
    ${load.level ? `<h2 class="sec">Нагрузка схемы</h2><div class="card">${loadCard(load)}</div>` : ''}
    <p class="disclaimer" style="margin:20px 4px">Кривая — модель по периодам полураспада эфиров. Реальный уровень показывает только анализ крови. Приложение не заменяет врача.</p>`;
}
function hormoneName(h) { return { drostanolone: 'Дростанолон (мастерон)', boldenone: 'Болденон', nandrolone: 'Нандролон', oxandrolone: 'Оксандролон', methandienone: 'Метандиенон' }[h] || h; }
function loadCard(load) {
  const idx = { good: 1, warning: 2, serious: 3, critical: 4 }[load.level.st];
  return `<div class="row between"><div><div class="xs muted">Суммарно в неделю</div><div style="font-size:24px;font-weight:700">${round(load.mg, 0)} мг</div></div>${badge(load.level.st, load.level.label)}</div>
    <div class="meter" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= idx ? `on ${load.level.st}` : ''}"></i>`).join('')}</div>
    <div class="sm muted">${esc(load.level.text)}</div>
    ${load.parts.length > 1 ? `<div class="xs muted" style="margin-top:8px">${load.parts.map((p) => `${esc(p.c.short)}: ${round(p.w, 0)} мг`).join(' · ')}</div>` : ''}`;
}

/* ---------- Уколы ---------- */
function viewDoses() {
  const active = S.protocol;
  const checks = E.checkStack(S);
  const log = [...S.doses].sort((a, b) => b.t - a.t).slice(0, 15);
  const sites = E.siteUsage(S, SITES);
  const suggest = [...sites].sort((a, b) => a.last - b.last)[0];
  return `<div class="top"><div><h1>Уколы</h1><div class="sub">Схема, журнал, места и запас</div></div><button class="icon-btn" aria-label="Отметить укол" data-act="log-dose">${ic('plus')}</button></div>
    <h2 class="sec">Схема</h2>
    <div class="card tight">${active.length ? active.map((p) => {
      const c = byId(p.compoundId);
      const next = E.futureDoses(S, 60 * DAY).find((d) => d.compoundId === p.compoundId);
      return `<button class="li" data-edit-protocol="${p.id}"><div class="grow"><div class="t">${esc(c?.name)}</div><div class="d">${round(p.dose, 1)} мг · каждые ${round(p.interval, 1)} д${p.active ? '' : ' · на паузе'}</div></div><div class="end sm">${next && p.active ? `<div>${fmtDate(next.t)}</div><div class="d">через ${fmtIn(next.t - Date.now())}</div>` : ''}</div>${ic('chev', 'chev')}</button>`;
    }).join('') : '<div class="empty">Пока пусто</div>'}
      <div style="padding:8px 18px 12px"><button class="btn sm soft" data-act="add-protocol">${ic('plus')}Добавить препарат</button></div></div>
    ${checks.length ? `<h2 class="sec">Проверка сочетаний</h2>${checks.map((a) => alertBox(a)).join('')}` : ''}
    <h2 class="sec">Места уколов</h2>
    <div class="card"><div class="sites">${sites.map((x) => `<div class="site ${x.id === suggest.id ? 'suggest' : ''}"><div class="n">${esc(x.name)}</div><div class="d">${x.last ? `${Math.floor((Date.now() - x.last) / DAY)} д назад` : 'ещё не было'}</div></div>`).join('')}</div>
      <div class="xs muted" style="margin-top:10px">Подсказка — место, которое отдыхало дольше всех.</div></div>
    <h2 class="sec">Запас</h2>
    <div class="card tight">${S.vials.length ? S.vials.map((v) => {
      const c = byId(v.compoundId), st = E.vialState(S, v);
      return `<button class="li" data-vial="${v.id}"><div class="grow"><div class="t">${esc(c?.short)} · ${v.conc} мг/мл</div><div class="d">открыт ${fmtDate(v.t)}</div></div><div class="end"><div class="t">${round(st.left, 1)} мл</div><div class="d">${st.daysLeft != null ? `≈ ${Math.floor(st.daysLeft)} д` : ''}</div></div></button>`;
    }).join('') : '<div class="empty">Добавь флакон — посчитаю, на сколько хватит</div>'}
      <div style="padding:8px 18px 12px"><button class="btn sm soft" data-act="add-vial">${ic('plus')}Флакон</button></div></div>
    <h2 class="sec">Журнал</h2>
    <div class="card tight">${log.length ? log.map((d) => {
      const c = byId(d.compoundId);
      return `<button class="li" data-dose="${d.id}"><div class="grow"><div class="t">${esc(c?.short)} · ${round(d.dose, 1)} мг${d.ml ? ` · ${round(d.ml, 2)} мл` : ''}</div><div class="d">${esc(SITES.find((x) => x.id === d.site)?.name || '')}</div></div><div class="end sm muted">${fmtDT(d.t)}</div></button>`;
    }).join('') : '<div class="empty">Записей нет</div>'}</div>`;
}

function compoundOptions(sel, filter = () => true) {
  const groups = {};
  for (const c of COMPOUNDS.filter(filter)) (groups[c.kind] ||= []).push(c);
  return Object.entries(groups).map(([k, cs]) => `<optgroup label="${KIND_LABEL[k]}">${cs.map((c) => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</optgroup>`).join('');
}

function protocolSheet(p) {
  const isNew = !p;
  p ||= { id: E.uid(), compoundId: 'test-e', dose: 250, interval: 7, active: true, start: Date.now() };
  sheet(`<h2>${isNew ? 'Препарат в схему' : 'Изменить'}</h2>
    <label class="field"><span>Препарат</span><select class="input" name="c">${compoundOptions(p.compoundId)}</select></label>
    <div class="two"><label class="field"><span>Доза, мг</span><input class="input" name="dose" inputmode="decimal" value="${p.dose}"></label>
    <label class="field"><span>Каждые, дней</span><input class="input" name="int" inputmode="decimal" value="${p.interval}"></label></div>
    <label class="field"><span>Колю по этой схеме с</span><input class="input" type="date" name="since" value="${p.since ? localInput(p.since).slice(0, 10) : ''}"><div class="help">Если колешь давно — укажи дату начала. Иначе модель решит, что ты только начал, и кривая стартует с нуля.</div></label>
    ${isNew ? `<label class="field"><span>Последний приём</span><input class="input" type="datetime-local" name="last" value="${localInput(Date.now())}"><div class="help">Отмечу его в журнале — с него начнётся кривая. Оставь пустым, если ещё не начинал.</div></label>` : ''}
    <div id="chk"></div>
    <div class="actions"><button class="btn block" data-save>Сохранить</button>
    ${isNew ? '' : `<button class="btn block ghost" data-toggle>${p.active ? 'Поставить на паузу' : 'Возобновить'}</button><button class="btn block danger" data-del>Удалить из схемы</button>`}
    <button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    const sel = $('[name=c]', el);
    const upd = () => {
      const others = S.protocol.filter((x) => x.id !== p.id && x.active).map((x) => x.compoundId);
      const tmp = { ...S, protocol: S.protocol.filter((x) => x.id !== p.id).map((x) => ({ ...x })) };
      const res = E.checkStack({ ...tmp, protocol: tmp.protocol.filter((x) => others.includes(x.compoundId)) }, [sel.value]);
      $('#chk', el).innerHTML = res.length ? `<div class="field"><span>Проверка с текущей схемой</span></div>${res.map((a) => alertBox(a)).join('')}` : '';
    };
    sel.onchange = upd; upd();
    $('[data-save]', el).onclick = () => {
      const dose = num($('[name=dose]', el).value), interval = num($('[name=int]', el).value);
      if (!dose || !interval || interval <= 0) return toast('Проверь дозу и интервал');
      const sinceV = $('[name=since]', el).value;
      if (!isNew && (p.dose !== dose || p.interval !== interval || p.compoundId !== sel.value)) p.changedAt = Date.now();
      Object.assign(p, { compoundId: sel.value, dose, interval, since: sinceV ? new Date(`${sinceV}T09:00`).getTime() : null });
      if (isNew) {
        S.protocol.push(p);
        const last = $('[name=last]', el).value;
        if (last) S.doses.push({ id: E.uid(), compoundId: p.compoundId, dose, t: new Date(last).getTime(), site: null });
      }
      commit(); closeSheet(); render(); toast('Сохранено');
    };
    $('[data-toggle]', el)?.addEventListener('click', () => { p.active = !p.active; commit(); closeSheet(); render(); });
    $('[data-del]', el)?.addEventListener('click', () => { if (!confirm('Удалить препарат из схемы? Журнал уколов останется.')) return; S.protocol = S.protocol.filter((x) => x.id !== p.id); commit(); closeSheet(); render(); });
  });
}

function doseSheet(d) {
  const isNew = !d;
  const sites = E.siteUsage(S, SITES);
  const suggest = [...sites].sort((a, b) => a.last - b.last)[0];
  const first = S.protocol.find((x) => x.active) || { compoundId: 'test-e', dose: 250 };
  d ||= { id: E.uid(), compoundId: first.compoundId, dose: first.dose, t: Date.now(), site: suggest.id };
  const vial = () => S.vials.find((v) => v.compoundId === $('[name=c]').value);
  sheet(`<h2>${isNew ? 'Отметить приём' : 'Запись'}</h2>
    <label class="field"><span>Препарат</span><select class="input" name="c">${compoundOptions(d.compoundId)}</select></label>
    <div class="two"><label class="field"><span>Доза, мг</span><input class="input" name="dose" inputmode="decimal" value="${d.dose}"></label>
    <label class="field"><span>Когда</span><input class="input" type="datetime-local" name="t" value="${localInput(d.t)}"></label></div>
    <div class="field" id="ml"></div>
    <div class="field" id="site-f"><span>Место</span><div class="sites">${sites.map((x) => `<button class="site ${x.id === suggest.id && isNew ? 'suggest' : ''}" data-site="${x.id}" aria-pressed="${d.site === x.id}"><div class="n">${esc(x.name)}</div><div class="d">${x.last ? `${Math.floor((Date.now() - x.last) / DAY)} д назад` : '—'}</div></button>`).join('')}</div></div>
    <div class="actions"><button class="btn block" data-save>Сохранить</button>${isNew ? '' : '<button class="btn block danger" data-del>Удалить запись</button>'}<button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    let site = d.site;
    const sync = () => {
      const c = byId($('[name=c]', el).value);
      const v = vial(), dose = num($('[name=dose]', el).value);
      const conc = v?.conc || c.defaultConc;
      $('#ml', el).innerHTML = conc && dose ? `<span>Объём</span><div class="sm" style="margin:0 4px">${round(dose / conc, 2)} мл при ${conc} мг/мл${v ? '' : ' (типичная концентрация — добавь флакон для точности)'}</div>` : '';
      $('#site-f', el).style.display = c.kind === 'aas' ? '' : 'none';
    };
    $('[name=c]', el).onchange = () => {
      const p = S.protocol.find((x) => x.compoundId === $('[name=c]', el).value);
      if (p) $('[name=dose]', el).value = p.dose;
      sync();
    };
    $('[name=dose]', el).oninput = sync; sync();
    $$('[data-site]', el).forEach((b) => (b.onclick = () => { site = b.dataset.site; $$('[data-site]', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
    $('[data-save]', el).onclick = () => {
      const c = byId($('[name=c]', el).value), dose = num($('[name=dose]', el).value);
      const t = new Date($('[name=t]', el).value).getTime();
      if (!dose || !Number.isFinite(t)) return toast('Проверь дозу и время');
      const conc = vial()?.conc || c.defaultConc;
      Object.assign(d, { compoundId: c.id, dose, t, site: c.kind === 'aas' ? site : null, ml: conc ? dose / conc : null });
      if (isNew) S.doses.push(d);
      commit(); closeSheet(); render(); toast('Записано');
    };
    $('[data-del]', el)?.addEventListener('click', () => { if (!confirm('Удалить запись?')) return; S.doses = S.doses.filter((x) => x.id !== d.id); commit(); closeSheet(); render(); });
  });
}

function vialSheet(v) {
  const isNew = !v;
  v ||= { id: E.uid(), compoundId: 'test-e', conc: 250, ml: 10, t: Date.now() };
  sheet(`<h2>${isNew ? 'Новый флакон' : 'Флакон'}</h2>
    <label class="field"><span>Препарат</span><select class="input" name="c">${compoundOptions(v.compoundId, (c) => c.kind === 'aas')}</select></label>
    <div class="two"><label class="field"><span>Концентрация, мг/мл</span><input class="input" name="conc" inputmode="decimal" value="${v.conc}"></label>
    <label class="field"><span>Объём, мл</span><input class="input" name="ml" inputmode="decimal" value="${v.ml}"></label></div>
    <label class="field"><span>Открыт</span><input class="input" type="datetime-local" name="t" value="${localInput(v.t)}"><div class="help">Расход считаю по уколам после этой даты.</div></label>
    <div class="actions"><button class="btn block" data-save>Сохранить</button>${isNew ? '' : '<button class="btn block danger" data-del>Удалить</button>'}<button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    $('[data-save]', el).onclick = () => {
      const conc = num($('[name=conc]', el).value), ml = num($('[name=ml]', el).value);
      if (!conc || !ml) return toast('Проверь концентрацию и объём');
      Object.assign(v, { compoundId: $('[name=c]', el).value, conc, ml, t: new Date($('[name=t]', el).value).getTime() });
      if (isNew) { S.vials = S.vials.filter((x) => x.compoundId !== v.compoundId); S.vials.push(v); }
      commit(); closeSheet(); render();
    };
    $('[data-del]', el)?.addEventListener('click', () => { S.vials = S.vials.filter((x) => x.id !== v.id); commit(); closeSheet(); render(); });
  });
}

/* ---------- Дневник: тело + самочувствие ---------- */
let feelTab = 'day';
function viewFeel() {
  const seg = `<div class="seg" style="margin:0 0 16px">${[['day', 'День'], ['body', 'Тело'], ['gym', 'Зал']].map(([v, l]) => `<button data-feel="${v}" aria-pressed="${feelTab === v}">${l}</button>`).join('')}</div>`;
  const sub = { day: 'Самочувствие и что на что влияет', body: 'Метаболизм, замеры, фото', gym: 'Силовые на фоне курса' }[feelTab];
  const head = `<div class="top"><div><h1>Дневник</h1><div class="sub">${sub}</div></div></div>${seg}`;
  if (feelTab === 'body') return head + viewBody();
  if (feelTab === 'gym') return head + viewGym();
  return head + viewDay();
}

function viewDay() {
  const today = S.symptoms.find((x) => dayKey(x.t) === dayKey(Date.now()));
  const hints = E.symptomHints(S);
  const byDay = E.libidoByCycleDay(S);
  const hist = [...S.symptoms].sort((a, b) => b.t - a.t).slice(0, 14);
  const enough = byDay.reduce((a, x) => a + x.n, 0) >= 8;
  const C = X.correlations(S);
  const todayLine = today ? [today.weight && `${round(today.weight, 1)} кг`, today.kcal && `${today.kcal} ккал`, today.steps && `${today.steps} шагов`, `либидо ${today.libido}`].filter(Boolean).join(' · ') : '';
  return `<div class="card"><div class="row between"><h3>${today ? 'Сегодня отмечено' : 'Как ты сегодня?'}</h3>${today ? badge('good', 'готово') : ''}</div>
      <div class="sm muted" style="margin:4px 0 12px">${today ? esc(todayLine) : 'Вес утром, калории, шаги, сон, либидо и симптомы'}</div>
      <button class="btn block ${today ? 'ghost' : ''}" data-act="checkin">${today ? 'Изменить' : 'Отметить'}</button></div>
    ${hints.length ? `<h2 class="sec">Подсказки</h2>${hints.map((h) => alertBox(h, h.labs ? `<div class="xs muted" style="margin-top:6px">Сдать: ${h.labs.map((id) => markerById(id).name).join(', ')}</div>` : '')).join('')}` : ''}
    <h2 class="sec">Что на что влияет</h2>
    <div class="card ${C.items.length ? 'tight' : ''}">${C.items.length ? C.items.map((c) => `<div class="li"><span class="${c.good ? 'st-good' : 'st-warning'}">${ic(c.good ? 'up' : 'down')}</span><div class="grow sm">${esc(c.text)}</div></div>`).join('') + '<div class="xs muted" style="padding:10px 18px 14px">Это закономерности в твоих данных, а не доказанная причина. Чем больше дней в дневнике, тем точнее.</div>' : `<div class="sm muted">Нужно хотя бы 10–14 дней дневника со сном, шагами и самочувствием (сейчас ${C.days}). Тогда покажу, например: «когда спишь 7+ ч, либидо выше на 1 балл».</div>`}</div>
    <h2 class="sec">Либидо по дням после укола</h2>
    <div class="card">${enough ? `<div class="bars" role="img" aria-label="Среднее либидо по дням цикла">${byDay.map((b) => `<div class="b" title="День ${b.day + 1}: ${round(b.v, 1)} из 5"><span>${round(b.v, 1)}</span><i style="height:${(b.v / 5) * 70}px"></i><span>д${b.day + 1}</span></div>`).join('')}</div><div class="xs muted" style="margin-top:8px">Среднее по шкале 1–5. Если провал всегда в одни и те же дни — это связано с фазой кривой.</div>` : `<div class="empty">Нужно 8+ отметок — тогда покажу, в какие дни цикла либидо проседает</div>`}</div>
    <h2 class="sec">История</h2>
    <div class="card tight">${hist.length ? hist.map((x) => `<button class="li" data-sym="${x.id}"><div class="grow"><div class="t">${fmtDate(x.t)}${x.weight ? ` · ${round(x.weight, 1)} кг` : ''}</div><div class="d">${[x.kcal && `${x.kcal} ккал`, `Либидо ${x.libido}`, `Эрекция ${x.erection}`, ...(x.flags || []).map((f) => SYMPTOM_FLAGS.find((y) => y.id === f)?.name)].filter(Boolean).join(' · ')}</div></div>${ic('chev', 'chev')}</button>`).join('') : '<div class="empty">Отметок пока нет</div>'}</div>`;
}

function viewBody() {
  const M = E.metabolism(S);
  const ms = X.measureSummary(S);
  const delta = (k) => {
    if (!ms?.ref || ms.last[k] == null || ms.ref[k] == null) return '';
    const d = ms.last[k] - ms.ref[k];
    if (Math.abs(d) < 0.05) return 'без изменений';
    return `${d > 0 ? '+' : '−'}${round(Math.abs(d), 1)} ${k === 'bf' ? '%' : 'см'} с ${fmtDate(ms.ref.t)}`;
  };
  return `<h2 class="sec">Метаболизм</h2>
    ${metabCard(M)}
    ${M.why.length ? `<h2 class="sec">Почему замедляется</h2>${M.why.map((w) => alertBox(w, w.fix ? `<div style="margin-top:10px"><button class="btn sm soft" data-metab="${w.fix}">Что делать</button></div>` : w.labs ? `<div style="margin-top:10px"><button class="btn sm soft" data-marker-go="tsh">Подробнее</button></div>` : '')).join('')}` : ''}
    <div class="card tight"><button class="li" data-act="metab-actions">${ic('up')}<div class="grow"><div class="t">Как разогнать обмен</div><div class="d">Что реально работает — в цифрах</div></div>${ic('chev', 'chev')}</button></div>
    <h2 class="sec">Замеры</h2>
    <div class="card">${ms ? `<div class="xs muted" style="margin-bottom:10px">Последние: ${fmtDate(ms.last.t)}</div><div class="mgrid">${X.MEASURES.filter(([k]) => ms.last[k] != null).map(([k, l]) => `<div class="m"><div class="k">${l}</div><div class="v">${round(ms.last[k], 1)}<small>${k === 'bf' ? '%' : 'см'}</small></div><div class="d">${delta(k)}</div></div>`).join('')}</div>` : '<div class="sm muted">Раз в неделю, утром, в одном месте: талия на уровне пупка, грудь, бицепс, бедро. Вес может стоять, а талия уходить — это и есть прогресс.</div>'}
      <button class="btn sm soft" style="margin-top:12px" data-act="measure">${ic('plus')}Замер</button></div>
    <h2 class="sec">Фото прогресса</h2>
    <div class="card"><div class="photos" id="photos"><div class="sm muted">Загрузка…</div></div>
      <div class="row" style="margin-top:12px"><button class="btn sm soft grow" data-act="add-photo">${ic('camera')}Добавить фото</button></div>
      <div class="xs muted" style="margin-top:8px">Фото хранятся только на этом телефоне и не попадают в копию данных. Снимай раз в неделю: тот же свет, поза и время.</div></div>`;
}

function viewGym() {
  const list = X.strength(S);
  return `<div class="card"><h3>Силовые</h3><p class="sm muted" style="margin:6px 0 12px">Записывай лучший рабочий подход по базовым упражнениям. Посчитаю примерный максимум на 1 раз — делать его на самом деле не нужно.</p>
      <button class="btn block" data-act="add-set">${ic('plus')}Записать подход</button></div>
    ${list.length ? list.map((x) => `<div class="card"><div class="row between"><h3>${esc(x.ex)}</h3>${x.change != null ? badge(x.change >= 0.01 ? 'good' : x.change <= -0.03 ? 'warning' : 'info', `${x.change >= 0 ? '+' : '−'}${round(Math.abs(x.change * 100), 0)}% за 4 нед`) : ''}</div>
      <div class="row between" style="margin-top:6px"><div><div style="font-size:28px;font-weight:700">≈ ${round(x.last.e, 0)}<small class="sm muted"> кг на 1 раз</small></div><div class="xs muted">последний: ${round(x.last.w, 1)} кг × ${x.last.reps} · ${fmtDate(x.last.t)} · рекорд ≈ ${round(x.best, 0)}</div></div></div>
      ${x.arr.length >= 2 ? `<div class="chart" data-ex-chart="${esc(x.ex)}" style="margin-top:10px"></div>` : ''}</div>`).join('')
      : '<div class="empty">Пока нет записей. Начни с жима, приседа и становой.</div>'}
    ${(S.workouts || []).length ? `<h2 class="sec">Последние подходы</h2><div class="card tight">${[...S.workouts].sort((a, b) => b.t - a.t).slice(0, 10).map((w) => `<button class="li" data-set="${w.id}"><div class="grow"><div class="t">${esc(w.ex)} · ${round(w.w, 1)} кг × ${w.reps}</div><div class="d">${fmtDate(w.t)}</div></div>${ic('chev', 'chev')}</button>`).join('')}</div>` : ''}`;
}

function setSheet(w) {
  const isNew = !w;
  const lastEx = [...(S.workouts || [])].sort((a, b) => b.t - a.t)[0]?.ex || X.EXERCISES[0];
  w ||= { id: E.uid(), t: Date.now(), ex: lastEx, w: '', reps: '' };
  const opts = [...new Set([...X.EXERCISES, ...(S.workouts || []).map((x) => x.ex)])];
  sheet(`<h2>${isNew ? 'Подход' : 'Изменить подход'}</h2>
    <label class="field"><span>Упражнение</span><select class="input" name="ex">${opts.map((o) => `<option ${o === w.ex ? 'selected' : ''}>${esc(o)}</option>`).join('')}<option value="__new">Другое…</option></select></label>
    <label class="field" id="exnew" style="display:none"><span>Название</span><input class="input" name="exn"></label>
    <div class="two"><label class="field"><span>Вес, кг</span><input class="input" name="w" inputmode="decimal" value="${w.w}"></label>
    <label class="field"><span>Повторений</span><input class="input" name="reps" inputmode="numeric" value="${w.reps}"></label></div>
    <label class="field"><span>Дата</span><input class="input" type="date" name="d" value="${localInput(w.t).slice(0, 10)}"></label>
    <div class="actions"><button class="btn block" data-save>Сохранить</button>${isNew ? '' : '<button class="btn block danger" data-del>Удалить</button>'}<button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    const sel = $('[name=ex]', el);
    sel.onchange = () => ($('#exnew', el).style.display = sel.value === '__new' ? '' : 'none');
    $('[data-save]', el).onclick = () => {
      const ex = sel.value === '__new' ? $('[name=exn]', el).value.trim() : sel.value;
      const wt = num($('[name=w]', el).value), reps = num($('[name=reps]', el).value);
      if (!ex || !wt || !reps || reps > 50) return toast('Проверь упражнение, вес и повторы');
      Object.assign(w, { ex, w: wt, reps: Math.round(reps), t: new Date(`${$('[name=d]', el).value}T18:00`).getTime() });
      S.workouts ||= [];
      if (isNew) S.workouts.push(w);
      commit(); closeSheet(); render(); toast(`≈ ${round(X.e1rm(wt, reps), 0)} кг на 1 раз`);
    };
    $('[data-del]', el)?.addEventListener('click', () => { S.workouts = S.workouts.filter((x) => x.id !== w.id); commit(); closeSheet(); render(); });
  });
}

function measureSheet() {
  const prev = X.measureSummary(S)?.last || {};
  const m = { id: E.uid(), t: Date.now() };
  sheet(`<h2>Замеры</h2>
    <div class="two">${X.MEASURES.map(([k, l]) => `<label class="field"><span>${l}${k === 'bf' ? '' : ', см'}</span><input class="input" name="${k}" inputmode="decimal" placeholder="${prev[k] != null ? round(prev[k], 1) : '—'}"></label>`).join('')}</div>
    <label class="field"><span>Дата</span><input class="input" type="date" name="d" value="${localInput(Date.now()).slice(0, 10)}"></label>
    <div class="xs muted" style="margin:0 4px 12px">Серым — прошлый замер. Пустые поля можно пропустить.</div>
    <div class="actions"><button class="btn block" data-save>Сохранить</button><button class="btn block ghost" data-photo>${ic('camera')}Сохранить и добавить фото</button><button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    const save = () => {
      let any = false;
      for (const [k] of X.MEASURES) { const v = num($(`[name=${k}]`, el).value); if (v != null) { m[k] = v; any = true; } }
      m.t = new Date(`${$('[name=d]', el).value}T09:00`).getTime();
      if (!any) { toast('Введи хотя бы один замер'); return false; }
      S.measures ||= []; S.measures.push(m); commit(); return true;
    };
    $('[data-save]', el).onclick = () => { if (save()) { closeSheet(); render(); toast('Сохранено'); } };
    $('[data-photo]', el).onclick = () => { if (save()) { closeSheet(); render(); pickPhoto(); } };
  });
}

function pickPhoto() {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    try {
      const blob = await PH.compress(f);
      await PH.addPhoto({ id: E.uid(), t: Date.now(), blob });
      toast('Фото сохранено'); render();
    } catch { toast('Не удалось сохранить фото'); }
  };
  inp.click();
}

let photoUrls = [];
async function fillPhotos(el) {
  photoUrls.forEach((u) => URL.revokeObjectURL(u)); photoUrls = [];
  let list = [];
  try { list = await PH.listPhotos(); } catch { el.innerHTML = '<div class="sm muted">Фото недоступны в этом режиме браузера.</div>'; return; }
  if (!list.length) { el.innerHTML = '<div class="sm muted">Фото пока нет.</div>'; return; }
  el.innerHTML = list.map((p) => { const u = URL.createObjectURL(p.blob); photoUrls.push(u); return `<button class="ph" data-ph="${p.id}"><img src="${u}" alt="Фото ${fmtDate(p.t)}" loading="lazy"><span>${fmtDate(p.t)}</span></button>`; }).join('');
  $$('[data-ph]', el).forEach((b) => (b.onclick = () => photoSheet(list, b.dataset.ph)));
}

function photoSheet(list, id) {
  const p = list.find((x) => x.id === id), first = list.at(-1);
  const u = URL.createObjectURL(p.blob), u0 = first !== p ? URL.createObjectURL(first.blob) : null;
  sheet(`<h2>Фото · ${fmtDate(p.t)}</h2>
    ${u0 ? `<div class="seg" style="margin-bottom:12px"><button data-v="one" aria-pressed="true">Это фото</button><button data-v="cmp" aria-pressed="false">Сравнить с первым</button></div>` : ''}
    <div id="phv"><img class="ph-full" src="${u}" alt=""></div>
    <div class="actions"><button class="btn block danger" data-del>Удалить фото</button><button class="btn block ghost" data-close>Закрыть</button></div>`, (el) => {
    segBind(el, (seg, v) => {
      $('#phv', el).innerHTML = v === 'cmp' ? `<div class="cmp"><figure><img src="${u0}" alt=""><figcaption>${fmtDate(first.t)}</figcaption></figure><figure><img src="${u}" alt=""><figcaption>${fmtDate(p.t)}</figcaption></figure></div>` : `<img class="ph-full" src="${u}" alt="">`;
    });
    $('[data-del]', el).onclick = async () => { if (!confirm('Удалить фото?')) return; await PH.deletePhoto(p.id); closeSheet(); render(); };
  });
}

function hctCard() {
  const f = X.hctForecast(S);
  if (!f) return '';
  if (f.slope == null) return `<div class="alert"><span class="ic st-info">${ic('info', 'ic')}</span><div class="x">Для прогноза нужен ещё один анализ хотя бы через 2 недели — тогда покажу, куда идёт гематокрит.</div></div>`;
  const rate = `${f.perMonth >= 0 ? '+' : '−'}${round(Math.abs(f.perMonth), 1)}% в месяц`;
  let main, st;
  if (f.slope <= 0) { main = 'Гематокрит не растёт — хорошо.'; st = 'good'; }
  else if (f.at54) { main = `При таком темпе до 54% (опасная зона) дойдёшь примерно к ${fmtDate(f.at54)}. Сдай ОАК за неделю до этого и обсуди с врачом донацию.`; st = f.at54 - Date.now() < 30 * DAY ? 'serious' : 'warning'; }
  else if (f.at52) { main = `До 52% — примерно к ${fmtDate(f.at52)}.`; st = 'warning'; }
  else { main = 'В ближайшие 4 месяца в опасную зону не выходит.'; st = 'good'; }
  return `<h2 class="sec">Прогноз</h2><div class="alert"><span class="ic st-${st}">${ic(st, 'ic')}</span><div class="grow"><div class="t">${rate}</div><div class="x">${main}</div><div class="ev"><span class="dot yellow"></span>Точность ${f.conf}: ${f.n} анализа. Обычно рост замедляется через 3–6 месяцев.</div></div></div>`;
}

function e2Card() {
  const e = X.e2Estimate(S);
  if (!e) return '';
  const lab = e.n ? `по твоим анализам (${e.n})` : 'грубо, по средним данным — сдай E2 вместе с тестом, и оценка станет твоей';
  return `<h2 class="sec">Оценка сейчас</h2><div class="card"><div class="row between"><div><div class="xs muted">E2 по модели</div><div style="font-size:30px;font-weight:700">≈ ${round(e.now.v, 0)} <small class="sm muted">пг/мл</small></div></div>${e.now.st ? badge(e.now.st) : ''}</div>
    <div class="stats" style="margin:12px 0 0"><div class="stat" style="background:var(--s2)"><div class="k">На пике</div><div class="v">${e.peak ? round(e.peak.v, 0) : '—'}</div></div><div class="stat" style="background:var(--s2)"><div class="k">Перед уколом</div><div class="v">${e.trough ? round(e.trough.v, 0) : '—'}</div></div><div class="stat" style="background:var(--s2)"><div class="k">E2 на 1 нмоль теста</div><div class="v">${round(e.k, 2)}</div></div></div>
    <div class="xs muted" style="margin-top:10px">Считаю ${lab}.${e.hasAI ? ' Учитывает текущую дозу анастрозола — если её изменишь, нужен новый анализ.' : ''}</div></div>`;
}

function planHtml() {
  const P = X.labPlan(S);
  const v = P.visit;
  const dd = (t) => { const d = Math.round((t - Date.now()) / DAY); return d < -1 ? `просрочено на ${-d} дн.` : d <= 0 ? 'сейчас' : `через ${d} дн.`; };
  return `<h2 class="sec">План анализов</h2>
    <div class="card"><div class="row between"><div><div class="xs muted">Следующая сдача</div><div style="font-size:24px;font-weight:700">${fmtDate(v.t)}</div></div>${badge(v.t < Date.now() ? 'serious' : v.t - Date.now() < 3 * DAY ? 'warning' : 'info', dd(v.t))}</div>
      <div class="sm" style="margin-top:6px">${v.beforeInjection ? 'Утром, натощак, до укола — так модель калибруется точнее всего.' : 'Утром, натощак.'} Без тренировки накануне.</div>
      <div class="chips" style="margin-top:12px">${v.items.map((i) => `<span class="chip">${esc(i.name)}</span>`).join('')}</div>
      <button class="btn sm soft" style="margin-top:12px" data-act="ics">${ic('cal')}В календарь</button></div>
    <div class="card tight">${P.items.map((i) => `<div class="li"><div class="grow"><div class="t">${esc(i.name)}</div><div class="d">${esc(i.reason || i.why)} · раз в ${Math.round(i.every / 7)} нед.</div></div><div class="end"><div class="sm">${i.last ? fmtDate(i.due) : 'ещё не сдавал'}</div>${i.overdue || !i.last ? badge('warning', i.last ? 'пора' : 'сдать') : `<div class="d">${dd(i.due)}</div>`}</div></div>`).join('')}</div>`;
}

function metabCard(M) {
  const p = S.profile || {};
  const noProfile = !p.bodyFat && !(p.height && p.birthYear);
  if (!M.cur) {
    const kd = M.need.kcalDays, wd = M.need.weightDays;
    return `<div class="card"><h3>Считаю твой реальный расход</h3>
      <p class="sm muted" style="margin:6px 0 12px">Взвешивайся утром после туалета и записывай калории за день. Через 2 недели покажу, сколько ты реально тратишь, и тормозит ли обмен.</p>
      <div class="stats" style="margin:0"><div class="stat" style="background:var(--s2)"><div class="k">Дней с весом</div><div class="v">${wd}<small>/14</small></div></div><div class="stat" style="background:var(--s2)"><div class="k">Дней с калориями</div><div class="v">${kd}<small>/10</small></div></div><div class="stat" style="background:var(--s2)"><div class="k">Профиль</div><div class="v" style="font-size:15px;margin-top:6px">${noProfile ? 'нет' : 'есть'}</div></div></div>
      <button class="btn sm soft" style="margin-top:12px" data-act="profile">${noProfile ? 'Заполнить профиль' : 'Профиль'}</button></div>
      ${M.trend.length > 2 ? `<div class="card"><h3>Вес</h3><div class="chart" id="ch-weight"></div><div class="legend"><span><i style="background:var(--series-1)"></i>Тренд</span><span><i class="ring"></i>Взвешивание</span></div></div>` : ''}`;
  }
  const c = M.cur;
  const rateTxt = Math.abs(c.weekRate) < 0.05 ? 'вес стоит' : `${c.weekRate > 0 ? '+' : '−'}${round(Math.abs(c.weekRate), 2)} кг в неделю`;
  const plan = (target) => Math.round((c.tdee + (target * KCAL) / 7) / 50) * 50;
  return `<div class="card hero">
      <div class="row between"><span class="label">Ты тратишь в день</span>${M.status ? badge(M.status.st, M.status.label) : ''}</div>
      <div class="big">≈ ${Math.round(c.tdee / 10) * 10}<small>ккал</small></div>
      <div class="xs muted">По факту за ${Math.round(c.span)} дней: ешь ≈ ${Math.round(c.avgKcal)} ккал, ${rateTxt}</div>
      ${M.expected ? `<div class="sm" style="margin-top:12px">${M.adapt < -0.1 ? `Это на <b>${Math.round(-M.adapt * 100)}%</b> меньше, чем должно быть по твоему весу и активности (≈ ${Math.round(M.expected / 10) * 10}). Обмен подтормаживает — причины ниже.` : M.adapt > 0.05 ? `Это на ${Math.round(M.adapt * 100)}% больше нормы для твоих данных (≈ ${Math.round(M.expected / 10) * 10}) — мышцы и курс работают на тебя.` : `Совпадает с нормой для твоего веса и активности (≈ ${Math.round(M.expected / 10) * 10}). Обмен работает как надо.`}</div>` : `<button class="btn sm soft" style="margin-top:12px" data-act="profile">Заполнить профиль — сравню с нормой</button>`}
    </div>
    <div class="stats"><div class="stat"><div class="k">Сушка −0,5 кг/нед</div><div class="v">${plan(-0.5)}</div></div><div class="stat"><div class="k">Поддержка</div><div class="v">${plan(0)}</div></div><div class="stat"><div class="k">Масса +0,25</div><div class="v">${plan(0.25)}</div></div></div>
    ${M.hist.length >= 2 ? `<div class="card"><h3>Расход по неделям</h3><div class="xs muted">Если линия идёт вниз — обмен замедляется</div><div class="chart" id="ch-tdee"></div></div>` : ''}
    <div class="card"><div class="row between"><h3>Вес</h3><button class="btn sm ghost" data-act="profile">Профиль</button></div><div class="chart" id="ch-weight"></div><div class="legend"><span><i style="background:var(--series-1)"></i>Тренд</span><span><i class="ring"></i>Взвешивание</span></div></div>`;
}
const KCAL = 7700;

function profileSheet() {
  const p = S.profile || {};
  sheet(`<h2>Профиль</h2>
    <p class="sm muted" style="margin-top:-6px">Нужен, чтобы сравнить твой реальный расход с нормой. Хватит роста и года рождения; если знаешь % жира — точнее.</p>
    <div class="two"><label class="field"><span>Рост, см</span><input class="input" name="h" inputmode="numeric" value="${p.height || ''}"></label>
    <label class="field"><span>Год рождения</span><input class="input" name="y" inputmode="numeric" value="${p.birthYear || ''}"></label></div>
    <label class="field"><span>% жира (если знаешь)</span><input class="input" name="bf" inputmode="decimal" value="${p.bodyFat || ''}" placeholder="—"></label>
    <div class="field"><span>Активность</span><div class="stack" id="act">${E.ACTIVITY.map(([v, l]) => `<button class="chip" style="width:100%;text-align:left;border-radius:12px;min-height:44px" data-a="${v}" aria-pressed="${(p.activity || 1.45) === v}">${l}</button>`).join('')}</div></div>
    <div class="actions"><button class="btn block" data-save>Сохранить</button><button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    let a = p.activity || 1.45;
    $$('[data-a]', el).forEach((b) => (b.onclick = () => { a = +b.dataset.a; $$('[data-a]', el).forEach((x) => x.setAttribute('aria-pressed', x === b)); }));
    $('[data-save]', el).onclick = () => {
      S.profile = { height: num($('[name=h]', el).value), birthYear: num($('[name=y]', el).value), bodyFat: num($('[name=bf]', el).value), activity: a };
      commit(); closeSheet(); render(); toast('Сохранено');
    };
  });
}

function metabActionsSheet(focus) {
  const items = focus ? [...METAB_ACTIONS].sort((x, y) => (y.id === focus) - (x.id === focus)) : METAB_ACTIONS;
  sheet(`<h2>Как разогнать обмен</h2>${actionsHtml({ items, note: 'Обмен нельзя «разогнать» таблеткой без вреда. Работают движение, белок, сон, мышцы и перерывы в диете.' })}<div class="actions"><button class="btn block ghost" data-close>Закрыть</button></div>`);
}

function checkinSheet(x) {
  x ||= S.symptoms.find((y) => dayKey(y.t) === dayKey(Date.now())) || null;
  const exists = !!x;
  const prev = [...S.symptoms].sort((a, b) => b.t - a.t)[0];
  x ||= { id: E.uid(), t: Date.now(), libido: 3, erection: 3, mood: 3, energy: 3, sleep: 3, flags: [], note: '' };
  const f = (n, label, ph, mode = 'decimal') => `<label class="field"><span>${label}</span><input class="input" name="${n}" inputmode="${mode}" value="${x[n] ?? ''}" placeholder="${ph}"></label>`;
  sheet(`<h2>Дневник · ${fmtDate(x.t)}</h2>
    <div class="xs muted" style="margin:0 4px 8px;font-weight:600">ТЕЛО</div>
    <div class="two">${f('weight', 'Вес утром, кг', prev?.weight ? round(prev.weight, 1) : 'напр. 92,4')}${f('kcal', 'Калории за день', 'напр. 2600', 'numeric')}</div>
    <div class="three">${f('protein', 'Белок, г', '—', 'numeric')}${f('steps', 'Шаги', '—', 'numeric')}${f('sleepH', 'Сон, ч', '—')}</div>
    <div class="xs muted" style="margin:4px 4px 14px">Всё необязательно. Вес — утром после туалета, до еды. Калории можно вписать вечером.</div>
    <div class="xs muted" style="margin:8px 4px 8px;font-weight:600">САМОЧУВСТВИЕ</div>
    ${SYMPTOM_SCALES.map((s) => `<div class="field"><span>${s.name}</span><div class="seg scale" data-k="${s.id}">${[1, 2, 3, 4, 5].map((n) => `<button data-v="${n}" aria-pressed="${x[s.id] === n}">${n}</button>`).join('')}</div></div>`).join('')}
    <div class="xs muted" style="margin:-6px 4px 14px">1 — очень плохо, 3 — обычно, 5 — отлично</div>
    <div class="field"><span>Симптомы</span><div class="chips">${SYMPTOM_FLAGS.map((g) => `<button class="chip" data-flag="${g.id}" aria-pressed="${x.flags.includes(g.id)}">${g.name}</button>`).join('')}</div></div>
    <label class="field"><span>Заметка</span><textarea class="input" name="note" placeholder="Необязательно">${esc(x.note)}</textarea></label>
    <div class="actions"><button class="btn block" data-save>Сохранить</button>${exists ? '<button class="btn block danger" data-del>Удалить</button>' : ''}<button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    const vals = { ...x }, flags = new Set(x.flags);
    segBind(el, (seg, v) => (vals[seg.dataset.k] = +v));
    $$('[data-flag]', el).forEach((b) => (b.onclick = () => { const g = b.dataset.flag; flags.has(g) ? flags.delete(g) : flags.add(g); b.setAttribute('aria-pressed', flags.has(g)); }));
    $('[data-save]', el).onclick = () => {
      const body = {};
      for (const k of ['weight', 'kcal', 'protein', 'steps', 'sleepH']) body[k] = num($(`[name=${k}]`, el).value);
      if (body.weight && (body.weight < 35 || body.weight > 250)) return toast('Проверь вес');
      if (body.kcal && (body.kcal < 500 || body.kcal > 10000)) return toast('Проверь калории');
      Object.assign(x, vals, body, { flags: [...flags], note: $('[name=note]', el).value });
      if (!S.symptoms.includes(x)) S.symptoms.push(x);
      commit(); closeSheet(); render(); toast('Сохранено');
    };
    $('[data-del]', el)?.addEventListener('click', () => { S.symptoms = S.symptoms.filter((y) => y.id !== x.id); commit(); closeSheet(); render(); });
  });
}

/* ---------- Здоровье ---------- */
function viewHealth() {
  const lv = E.latestValues(S);
  const groups = {};
  for (const m of MARKERS) (groups[m.group] ||= []).push(m);
  const bp = [...S.bp].sort((a, b) => b.t - a.t);
  const week = bp.filter((b) => Date.now() - b.t < 7 * DAY);
  const avg = week.length ? { sys: week.reduce((a, b) => a + b.sys, 0) / week.length, dia: week.reduce((a, b) => a + b.dia, 0) / week.length } : null;
  const avgSt = avg ? E.bpStatus(avg.sys, avg.dia) : null;
  const lastDon = S.donations.reduce((m, d) => Math.max(m, d.t), 0);
  const hasAny = Object.keys(lv).length;
  return `<div class="top"><div><h1>Здоровье</h1><div class="sub">Анализы, давление, донации</div></div><button class="icon-btn" aria-label="Добавить анализы" data-act="add-lab">${ic('plus')}</button></div>
    ${planHtml()}
    <h2 class="sec">Давление</h2>
    <div class="card">${avg ? `<div class="row between"><div><div class="xs muted">Среднее за 7 дней · ${week.length} изм.</div><div style="font-size:28px;font-weight:700;font-variant-numeric:tabular-nums">${Math.round(avg.sys)}/${Math.round(avg.dia)}</div></div>${badge(avgSt.st, avgSt.label)}</div>` : '<div class="sm muted">Измерений за неделю нет. Мерь утром, сидя, после 5 минут покоя.</div>'}
      <div class="row" style="margin-top:14px"><button class="btn sm grow" data-act="add-bp">${ic('plus')}Измерение</button>${avgSt && avgSt.st !== 'good' ? `<button class="btn sm soft grow" data-act="bp-actions">Что делать</button>` : ''}</div></div>
    ${bp.length ? `<div class="card tight">${bp.slice(0, 5).map((b) => { const st = E.bpStatus(b.sys, b.dia); return `<button class="li" data-bp="${b.id}"><div class="grow"><div class="t">${b.sys}/${b.dia}${b.pulse ? ` · пульс ${b.pulse}` : ''}</div><div class="d">${fmtDT(b.t)}</div></div>${badge(st.st, st.label)}</button>`; }).join('')}</div>` : ''}
    <h2 class="sec">Анализы</h2>
    ${hasAny ? '' : `<div class="card"><h3>Анализов пока нет</h3><p class="sm muted">Базовый набор на курсе: тест общий, E2, пролактин, ОАК (гематокрит, гемоглобин), липидограмма, АЛТ/АСТ, ПСА, креатинин, витамин D. Утром, натощак, перед уколом, через 48 ч после тренировки.</p><button class="btn block" data-act="add-lab">${ic('plus')}Внести результаты</button></div>`}
    ${hasAny ? Object.entries(groups).map(([g, ms]) => {
      const rows = ms.filter((m) => lv[m.id]);
      if (!rows.length) return '';
      return `<div class="xs muted" style="margin:14px 6px 6px;font-weight:600">${g}</div><div class="card tight">${rows.map((m) => {
        const { v, t } = lv[m.id]; const st = E.markerStatus(m, v);
        return `<button class="li" data-marker="${m.id}"><div class="grow"><div class="t">${m.name}</div><div class="d">${fmtDate(t)}${m.lo != null || m.hi != null ? ` · норма ${normText(m)}` : ''}</div></div><div class="end"><div class="t">${round(v, 2)} <span class="xs muted">${m.base}</span></div>${st && st !== 'good' ? badge(st) : ''}</div>${ic('chev', 'chev')}</button>`;
      }).join('')}</div>`;
    }).join('') : ''}
    ${S.labs.length ? `<h2 class="sec">Сдачи</h2><div class="card tight">${[...S.labs].sort((a, b) => b.t - a.t).map((l) => `<button class="li" data-lab="${l.id}"><div class="grow"><div class="t">${fmtDT(l.t)}</div><div class="d">${Object.keys(l.values).length} показателей</div></div>${ic('chev', 'chev')}</button>`).join('')}</div>` : ''}
    <h2 class="sec">Донации крови</h2>
    <div class="card"><div class="sm">${lastDon ? `Последняя: ${fmtDate(lastDon)} · следующая не раньше ${fmtDate(lastDon + 56 * DAY)}` : 'Записей нет'}</div>
      <div class="xs muted" style="margin-top:6px">При высоком гематокрите донация — основной способ его снизить. Решение — с врачом.</div>
      <button class="btn sm soft" style="margin-top:12px" data-act="add-don">${ic('drop')}Отметить донацию</button></div>`;
}

function labSheet(l) {
  const isNew = !l;
  l ||= { id: E.uid(), t: Date.now(), values: {} };
  const groups = {};
  for (const m of MARKERS) (groups[m.group] ||= []).push(m);
  sheet(`<h2>${isNew ? 'Результаты анализов' : 'Анализы'}</h2>
    <label class="field"><span>Дата и время сдачи</span><input class="input" type="datetime-local" name="t" value="${localInput(l.t)}"><div class="help">Время важно для калибровки кривой тестостерона.</div></label>
    ${Object.entries(groups).map(([g, ms]) => `<div class="xs muted" style="margin:18px 4px 8px;font-weight:600">${g}</div>${ms.map((m) => {
      const u = S.units[m.id] || m.base;
      const f = m.units.find((x) => x[0] === u)?.[1] || 1;
      const v = l.values[m.id] != null ? round(l.values[m.id] / f, 3).replace(/\s/g, '') : '';
      return `<label class="field"><span>${m.name}</span><div class="unit-in"><input class="input" inputmode="decimal" data-m="${m.id}" value="${v}" placeholder="—">${m.units.length > 1 ? `<select class="input" data-u="${m.id}">${m.units.map(([n]) => `<option ${n === u ? 'selected' : ''}>${n}</option>`).join('')}</select>` : `<span class="xs muted" style="align-self:center;min-width:56px">${m.base}</span>`}</div></label>`;
    }).join('')}`).join('')}
    <div class="actions"><button class="btn block" data-save>Сохранить</button>${isNew ? '' : '<button class="btn block danger" data-del>Удалить</button>'}<button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    $('[data-save]', el).onclick = () => {
      const values = {};
      for (const inp of $$('[data-m]', el)) {
        const m = markerById(inp.dataset.m), n = num(inp.value);
        if (n == null) continue;
        const u = $(`[data-u="${m.id}"]`, el)?.value || m.base;
        S.units[m.id] = u;
        values[m.id] = n * (m.units.find((x) => x[0] === u)?.[1] || 1);
      }
      if (!Object.keys(values).length) return toast('Введи хотя бы один показатель');
      Object.assign(l, { t: new Date($('[name=t]', el).value).getTime(), values });
      if (isNew) S.labs.push(l);
      commit(); closeSheet(); render(); toast('Анализы сохранены');
    };
    $('[data-del]', el)?.addEventListener('click', () => { if (!confirm('Удалить эти анализы?')) return; S.labs = S.labs.filter((x) => x.id !== l.id); commit(); closeSheet(); render(); });
  });
}

function bpSheet(b) {
  const isNew = !b;
  b ||= { id: E.uid(), t: Date.now(), sys: '', dia: '', pulse: '' };
  sheet(`<h2>Давление</h2>
    <div class="three"><label class="field"><span>Верхнее</span><input class="input" inputmode="numeric" name="sys" value="${b.sys}"></label>
    <label class="field"><span>Нижнее</span><input class="input" inputmode="numeric" name="dia" value="${b.dia}"></label>
    <label class="field"><span>Пульс</span><input class="input" inputmode="numeric" name="pulse" value="${b.pulse || ''}"></label></div>
    <label class="field"><span>Когда</span><input class="input" type="datetime-local" name="t" value="${localInput(b.t)}"></label>
    <div class="actions"><button class="btn block" data-save>Сохранить</button>${isNew ? '' : '<button class="btn block danger" data-del>Удалить</button>'}<button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    $('[data-save]', el).onclick = () => {
      const sys = num($('[name=sys]', el).value), dia = num($('[name=dia]', el).value);
      if (!sys || !dia || sys < 60 || sys > 260 || dia < 30 || dia > 180) return toast('Проверь значения');
      Object.assign(b, { sys, dia, pulse: num($('[name=pulse]', el).value), t: new Date($('[name=t]', el).value).getTime() });
      if (isNew) S.bp.push(b);
      commit(); closeSheet(); render();
      const st = E.bpStatus(sys, dia); toast(`${sys}/${dia} · ${st.label}`);
    };
    $('[data-del]', el)?.addEventListener('click', () => { S.bp = S.bp.filter((x) => x.id !== b.id); commit(); closeSheet(); render(); });
  });
}

function actionsHtml(a) {
  if (!a) return '';
  return `${a.note ? `<p class="sm" style="margin:0 0 12px">${esc(a.note)}</p>` : ''}${(a.items || []).map((it) => `<div class="alert"><span class="ic ${it.caution ? 'st-warning' : 'st-good'}">${ic(it.caution ? 'warning' : 'pill', 'ic')}</span><div class="grow">
    <div class="t">${esc(it.name)}</div>
    ${it.dose !== '—' ? `<div class="x"><b>Сколько:</b> ${esc(it.dose)}</div>` : ''}
    ${it.period !== '—' ? `<div class="x"><b>Сколько времени:</b> ${esc(it.period)}</div>` : ''}
    <div class="x"><b>${it.caution ? 'Важно:' : 'Эффект:'}</b> ${esc(it.effect)}</div>${evTag(it.ev)}</div></div>`).join('')}
    ${a.retest ? `<div class="sm muted" style="margin:8px 4px">Пересдать / проверить: через ${esc(a.retest)}.</div>` : ''}
    <p class="disclaimer" style="margin:10px 4px 0">Дозы — диапазоны из исследований, не назначение. Согласуй с врачом, особенно если принимаешь лекарства.</p>`;
}


function plainHtml(m, last, st) {
  const p = PLAIN[m.id];
  if (!p) return '';
  const dir = last && st && st !== 'good' ? (m.hi != null && last.v > m.hi ? 'high' : m.lo != null && last.v < m.lo ? 'low' : null) : null;
  const row = (k, title) => p[k] ? `<div class="plain-row ${dir === k ? 'now' : ''}"><div class="t">${title}${dir === k ? ' — <span class="st-' + st + '">это про тебя сейчас</span>' : ''}</div><div class="x">${esc(p[k])}</div></div>` : '';
  return `<h2 class="sec">Что это значит</h2><div class="card"><p class="sm" style="margin:0">${esc(p.what)}</p>${row('high', 'Если высокий')}${row('low', 'Если низкий')}</div>`;
}

function viewMarker(id) {
  const m = markerById(id);
  const pts = S.labs.filter((l) => l.values[id] != null).map((l) => ({ t: l.t, v: l.values[id] })).sort((a, b) => a.t - b.t);
  const last = pts[pts.length - 1];
  const st = last ? E.markerStatus(m, last.v) : null;
  let a = ACTIONS[id]; if (a?.ref) a = { ...ACTIONS[a.ref], retest: a.retest };
  const out = st && st !== 'good';
  return `<button class="back" data-back>${ic('back')}Здоровье</button>
    <div class="top"><div><h1 style="font-size:26px">${m.name}</h1><div class="sub">Норма ${normText(m)} ${m.base}</div></div></div>
    ${last ? `<div class="card"><div class="row between"><div><div class="xs muted">${fmtDT(last.t)}</div><div style="font-size:32px;font-weight:700">${round(last.v, 2)} <small class="sm muted">${m.base}</small></div></div>${st ? badge(st) : ''}</div>
      ${pts.length > 1 ? `<div class="chart" id="ch-marker" style="margin-top:12px"></div>` : ''}</div>` : ''}
    ${id === 'hct' ? hctCard() : ''}${id === 'e2' ? e2Card() : ''}
    ${plainHtml(m, last, st)}
    ${m.note ? `<div class="alert"><span class="ic st-info">${ic('info', 'ic')}</span><div class="x">${esc(m.note)}</div></div>` : ''}
    ${a ? `<h2 class="sec">${out ? 'Что можно сделать' : 'Если показатель уйдёт из нормы'}</h2>${actionsHtml(a)}` : ''}
    ${pts.length ? `<h2 class="sec">История</h2><div class="card tight">${[...pts].reverse().map((p) => { const s = E.markerStatus(m, p.v); return `<div class="li"><div class="grow">${fmtDT(p.t)}</div><div class="end">${round(p.v, 2)}</div>${s && s !== 'good' ? badge(s) : ''}</div>`; }).join('')}</div>` : ''}`;
}

/* ---------- Ещё ---------- */
function viewMore() {
  return `<div class="top"><div><h1>Ещё</h1></div></div>
    <div class="card tight">
      <button class="li" data-act="db">${ic('db')}<div class="grow"><div class="t">База препаратов</div><div class="d">Свойства, риски, какие анализы сдавать</div></div>${ic('chev', 'chev')}</button>
      <button class="li" data-act="report">${ic('doc')}<div class="grow"><div class="t">Отчёт для врача</div><div class="d">Схема, анализы, давление, самочувствие — PDF</div></div>${ic('chev', 'chev')}</button>
      <button class="li" data-act="ics">${ic('cal')}<div class="grow"><div class="t">Напоминания в Календарь</div><div class="d">Уколы на 60 дней и сдача анализов</div></div>${ic('chev', 'chev')}</button>
    </div>
    <div class="card tight">
      <button class="li" data-act="backup">${ic('save')}<div class="grow"><div class="t">Сохранить копию данных</div><div class="d">Файл JSON — храни в надёжном месте</div></div></button>
      <button class="li" data-act="restore">${ic('restore')}<div class="grow"><div class="t">Восстановить из копии</div></div></button>
    </div>
    <div class="card tight">
      <div class="li">${ic('pct')}<div class="grow"><div class="t">Восстановление (ПКТ)</div><div class="d">План выхода и контроль ЛГ/ФСГ/теста — в разработке</div></div><span class="badge">скоро</span></div>
    </div>
    <div class="card"><div class="row">${ic('shield')}<h3>Приватность</h3></div><p class="sm muted" style="margin:6px 0 0">Все данные хранятся только на этом телефоне. Ни серверов, ни аккаунтов. Если удалить приложение с экрана «Домой» — данные пропадут, поэтому делай копии.</p></div>
    <p class="disclaimer" style="margin:16px 4px">Баланс — дневник и модель, а не медицинский прибор. Кривая — оценка по фармакокинетике эфиров, реальные уровни показывает только анализ. Решения о препаратах и дозах принимай с врачом.</p>
    <button class="btn block danger" data-act="wipe">Удалить все данные</button>`;
}

function viewDb() {
  const groups = {};
  for (const c of COMPOUNDS) (groups[c.kind] ||= []).push(c);
  return `<button class="back" data-back>${ic('back')}Ещё</button>
    <div class="top"><div><h1>Препараты</h1><div class="sub">У каждого — уровень доказательности</div></div></div>
    <div class="legend" style="margin:0 4px 12px">${Object.entries(EVIDENCE).map(([k, v]) => `<span><span class="dot ${k}"></span> ${v.label}</span>`).join('')}</div>
    ${Object.entries(groups).map(([k, cs]) => `<h2 class="sec">${KIND_LABEL[k]}</h2><div class="card tight">${cs.map((c) => `<button class="li" data-compound="${c.id}"><span class="dot ${c.ev}"></span><div class="grow"><div class="t">${esc(c.name)}</div><div class="d">${c.kind === 'aas' ? `полупериод спада ≈ ${c.decay} д` : esc(KIND_LABEL[c.kind])}</div></div>${ic('chev', 'chev')}</button>`).join('')}</div>`).join('')}`;
}

function viewCompound(id) {
  const c = byId(id);
  const pips = (n) => `<span class="pips">${[1, 2, 3].map((i) => `<i class="${i <= n ? 'on' : ''}"></i>`).join('')}</span>`;
  const rows = [['Ароматизация в E2', c.arom], ['Пролактин', c.prl], ['Гематокрит', c.hct], ['Липиды', c.lip], ['Печень', c.liver], ['Давление', c.bp]];
  return `<button class="back" data-back>${ic('back')}Препараты</button>
    <div class="top"><div><h1 style="font-size:26px">${esc(c.name)}</h1><div class="sub">${esc(KIND_LABEL[c.kind])}</div></div></div>
    <div class="card"><div class="row between"><span class="sm muted">Доказательность</span><span class="badge"><span class="dot ${c.ev}"></span>${EVIDENCE[c.ev].label}</span></div>
      <div class="xs muted" style="margin-top:6px">${EVIDENCE[c.ev].hint}</div></div>
    ${c.hormone ? `<div class="stats"><div class="stat"><div class="k">Нарастание</div><div class="v">${c.rise}<small> д</small></div></div><div class="stat"><div class="k">Спад ½</div><div class="v">${c.decay}<small> д</small></div></div><div class="stat"><div class="k">Активного</div><div class="v">${Math.round(c.frac * 100)}<small>%</small></div></div></div>` : ''}
    ${c.kind === 'aas' || c.kind === 'oral' ? `<h2 class="sec">Влияние</h2><div class="card" style="padding:4px 18px">${rows.map(([n, v]) => `<div class="scale-row"><span>${n}</span>${pips(v)}</div>`).join('')}</div>` : ''}
    <h2 class="sec">Важно знать</h2><div class="card stack">${c.notes.map((n) => `<div class="sm">${esc(n)}</div>`).join('')}</div>
    <h2 class="sec">Что контролировать</h2><div class="card"><div class="chips">${c.labs.map((l) => `<span class="chip">${markerById(l)?.name || l}</span>`).join('')}</div></div>`;
}

/* ---------- отчёт ---------- */
function buildReport() {
  const lv = E.latestValues(S), load = E.weeklyLoad(S);
  const bp = S.bp.filter((b) => Date.now() - b.t < 30 * DAY);
  const sym = S.symptoms.filter((x) => Date.now() - x.t < 30 * DAY);
  const avgK = (k) => (sym.length ? round(sym.reduce((a, x) => a + x[k], 0) / sym.length, 1) : '—');
  $('#report').innerHTML = `<h1>Отчёт · ${new Date().toLocaleDateString('ru-RU')}</h1>
    <div>Самонаблюдение пациента. Кривая — фармакокинетическая модель, не измерение.</div>
    <h2>Текущая схема</h2><table><tr><th>Препарат</th><th>Доза</th><th>Интервал</th><th>В неделю</th></tr>
    ${S.protocol.filter((p) => p.active).map((p) => `<tr><td>${esc(byId(p.compoundId).name)}</td><td>${p.dose} мг</td><td>${p.interval} д</td><td>${round((p.dose * 7) / p.interval, 0)} мг</td></tr>`).join('')}</table>
    ${load.level ? `<div>Суммарно: ${round(load.mg, 0)} мг/нед</div>` : ''}
    <h2>Оценочный тестостерон (модель)</h2><div class="chart" id="rep-chart" style="width:640px"></div>
    <h2>Последние анализы</h2><table><tr><th>Показатель</th><th>Значение</th><th>Норма</th><th>Дата</th><th></th></tr>
    ${MARKERS.filter((m) => lv[m.id]).map((m) => { const st = E.markerStatus(m, lv[m.id].v); return `<tr><td>${m.name}</td><td>${round(lv[m.id].v, 2)} ${m.base}</td><td>${normText(m)}</td><td>${fmtDate(lv[m.id].t)}</td><td>${st && st !== 'good' ? ST_LABEL[st] : ''}</td></tr>`; }).join('') || '<tr><td colspan="5">Нет данных</td></tr>'}</table>
    <h2>Давление за 30 дней</h2><div>${bp.length ? `${bp.length} измерений, среднее ${Math.round(bp.reduce((a, b) => a + b.sys, 0) / bp.length)}/${Math.round(bp.reduce((a, b) => a + b.dia, 0) / bp.length)}, макс. ${Math.max(...bp.map((b) => b.sys))}/${Math.max(...bp.map((b) => b.dia))}` : 'Нет данных'}</div>
    <h2>Самочувствие за 30 дней (1–5)</h2><div>${sym.length ? SYMPTOM_SCALES.map((s) => `${s.name}: ${avgK(s.id)}`).join(' · ') : 'Нет данных'}</div>
    <h2>Последние уколы</h2><table>${[...S.doses].sort((a, b) => b.t - a.t).slice(0, 10).map((d) => `<tr><td>${fmtDT(d.t)}</td><td>${esc(byId(d.compoundId).name)}</td><td>${d.dose} мг</td></tr>`).join('')}</table>`;
  const now = Date.now();
  const rc = $('#rep-chart');
  if (E.testoSummary(S)) lineChart(rc, { series: E.testoSeries(S, now - 30 * DAY, now + 10 * DAY, 3), from: now - 30 * DAY, to: now + 10 * DAY, band: [8.6, 29], unit: 'нмоль/л', labs: S.labs.filter((l) => l.values.tt != null).map((l) => ({ t: l.t, v: l.values.tt })), h: 180 });
}

/* ---------- файлы ---------- */
async function shareFile(name, type, text) {
  const file = new File([text], name, { type });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = name; document.body.append(a); a.click(); a.remove();
}

/* ---------- привязка событий ---------- */
function bind(v) {
  const now = Date.now();
  const ch = $('#ch-test', v);
  if (ch) {
    const from = now - range * DAY * 0.65, to = now + range * DAY * 0.35;
    const step = range > 45 ? 4 : 2;
    lineChart(ch, {
      series: E.testoSeries(S, from, to, step), from, to, band: [8.6, 29], unit: 'нмоль/л',
      labs: S.labs.filter((l) => l.values.tt != null).map((l) => ({ t: l.t, v: l.values.tt })),
      doses: [...S.doses, ...E.futureDoses(S, to - now)].filter((d) => byId(d.compoundId)?.hormone === 'testosterone'),
    });
  }
  $$('[data-hormone]', v).forEach((el) => {
    const from = now - range * DAY * 0.65, to = now + range * DAY * 0.35;
    lineChart(el, { series: E.releaseSeries(S, el.dataset.hormone, from, to, 3), from, to, unit: 'мг/сут', color: 'var(--series-2)', h: 140,
      doses: [...S.doses, ...E.futureDoses(S, to - now)].filter((d) => byId(d.compoundId)?.hormone === el.dataset.hormone) });
  });
  const cm = $('#ch-marker', v);
  if (cm && sub?.id) {
    const m = markerById(sub.id);
    const pts = S.labs.filter((l) => l.values[m.id] != null).map((l) => ({ t: l.t, v: l.values[m.id] })).sort((a, b) => a.t - b.t);
    const pad = Math.max((pts.at(-1).t - pts[0].t) * 0.08, DAY);
    lineChart(cm, { series: pts, from: pts[0].t - pad, to: pts.at(-1).t + pad, unit: m.base, h: 150, band: m.lo != null && m.hi != null ? [m.lo, m.hi] : null, labs: pts });
  }
  const M = tab === 'feel' && !sub ? E.metabolism(S) : null;
  const cw = $('#ch-weight', v);
  if (cw && M && M.trend.length > 1) {
    const tr = M.trend.slice(-60);
    lineChart(cw, { series: tr, from: tr[0].t, to: tr.at(-1).t + DAY, unit: 'кг', h: 160, labs: tr.filter((p) => p.raw).map((p) => ({ t: p.t, v: p.raw })), minV: Math.min(...tr.map((p) => p.raw || p.v)) - 1 });
  }
  const ct = $('#ch-tdee', v);
  if (ct && M && M.hist.length >= 2) {
    const h = M.hist.map((x) => ({ t: x.t, v: x.tdee }));
    lineChart(ct, { series: h, from: h[0].t - DAY, to: h.at(-1).t + DAY, unit: 'ккал', h: 150, labs: h, minV: Math.min(...h.map((p) => p.v)) * 0.9 });
  }
  $$('[data-metab]', v).forEach((b) => (b.onclick = () => metabActionsSheet(b.dataset.metab)));
  $$('[data-marker-go]', v).forEach((b) => (b.onclick = () => go('health', { kind: 'marker', id: b.dataset.markerGo })));
  $$('[data-feel]', v).forEach((b) => (b.onclick = () => { feelTab = b.dataset.feel; render(); }));
  $$('[data-todo]', v).forEach((b) => (b.onclick = () => { const a = b.dataset.todo; if (a === 'plan') go('health'); else if (a === 'doses') go('doses'); else ACT[a]?.(); }));
  $$('[data-set]', v).forEach((b) => (b.onclick = () => setSheet(S.workouts.find((w) => w.id === b.dataset.set))));
  $$('[data-ex-chart]', v).forEach((el) => {
    const x = X.strength(S).find((q) => q.ex === el.dataset.exChart);
    if (!x) return;
    const pts = x.arr.map((w) => ({ t: w.t, v: w.e }));
    lineChart(el, { series: pts, from: pts[0].t - DAY, to: pts.at(-1).t + DAY, unit: 'кг', h: 140, labs: pts, minV: Math.min(...pts.map((q) => q.v)) * 0.95 });
  });
  const phEl = $('#photos', v);
  if (phEl) fillPhotos(phEl);
  $$('[data-tile]', v).forEach((b) => (b.onclick = () => { const g = b.dataset.tile; if (g.startsWith('marker:')) go('health', { kind: 'marker', id: g.slice(7) }); else go(g); }));
  $$('[data-range]', v).forEach((b) => (b.onclick = () => { range = +b.dataset.range; render(); }));
  $$('[data-back]', v).forEach((b) => (b.onclick = () => { if (sub?.kind === 'compound') go('more', { kind: 'db' }); else go(tab); }));
  $$('[data-goto]', v).forEach((b) => (b.onclick = () => { const g = b.dataset.goto; if (g === 'labs') labSheet(); else if (g === 'bp') bpSheet(); else go(g); }));
  $$('[data-edit-protocol]', v).forEach((b) => (b.onclick = () => protocolSheet(S.protocol.find((p) => p.id === b.dataset.editProtocol))));
  $$('[data-dose]', v).forEach((b) => (b.onclick = () => doseSheet(S.doses.find((d) => d.id === b.dataset.dose))));
  $$('[data-vial]', v).forEach((b) => (b.onclick = () => vialSheet(S.vials.find((d) => d.id === b.dataset.vial))));
  $$('[data-sym]', v).forEach((b) => (b.onclick = () => checkinSheet(S.symptoms.find((d) => d.id === b.dataset.sym))));
  $$('[data-lab]', v).forEach((b) => (b.onclick = () => labSheet(S.labs.find((d) => d.id === b.dataset.lab))));
  $$('[data-bp]', v).forEach((b) => (b.onclick = () => bpSheet(S.bp.find((d) => d.id === b.dataset.bp))));
  $$('[data-marker]', v).forEach((b) => (b.onclick = () => go('health', { kind: 'marker', id: b.dataset.marker })));
  $$('[data-compound]', v).forEach((b) => (b.onclick = () => go('more', { kind: 'compound', id: b.dataset.compound })));
  $$('[data-act]', v).forEach((b) => (b.onclick = () => ACT[b.dataset.act]?.()));
}

const ACT = {
  'log-dose': () => doseSheet(),
  'add-protocol': () => protocolSheet(),
  'add-vial': () => vialSheet(),
  checkin: () => checkinSheet(),
  measure: () => measureSheet(),
  'add-set': () => setSheet(),
  'add-photo': () => pickPhoto(),
  profile: () => profileSheet(),
  'metab-actions': () => metabActionsSheet(),
  'add-lab': () => labSheet(),
  'add-bp': () => bpSheet(),
  'bp-actions': () => sheet(`<h2>Давление: что можно сделать</h2>${actionsHtml(BP_ACTIONS)}<div class="actions"><button class="btn block ghost" data-close>Закрыть</button></div>`),
  'add-don': () => sheet(`<h2>Донация крови</h2><label class="field"><span>Дата</span><input class="input" type="date" name="d" value="${localInput(Date.now()).slice(0, 10)}"></label><div class="actions"><button class="btn block" data-save>Сохранить</button><button class="btn block ghost" data-close>Отмена</button></div>`, (el) => {
    $('[data-save]', el).onclick = () => { S.donations.push({ id: E.uid(), t: new Date($('[name=d]', el).value).getTime() }); commit(); closeSheet(); render(); };
  }),
  db: () => go('more', { kind: 'db' }),
  report: () => { buildReport(); setTimeout(() => window.print(), 100); },
  ics: () => { if (!S.protocol.some((p) => p.active)) return toast('Сначала добавь схему'); shareFile('balans-napominaniya.ics', 'text/calendar', E.buildIcs(S, X.labPlan(S).visit)); },
  backup: () => shareFile(`balans-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify(S)),
  restore: () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'application/json,.json';
    inp.onchange = async () => {
      try {
        const data = JSON.parse(await inp.files[0].text());
        if (!data || data.v !== 1 || !Array.isArray(data.doses)) throw new Error('bad');
        if (!confirm('Заменить текущие данные копией?')) return;
        S = { ...E.load(), ...data }; commit(); render(); toast('Восстановлено');
      } catch { toast('Файл не подходит'); }
    };
    inp.click();
  },
  wipe: () => { if (!confirm('Удалить все данные без возможности восстановления?')) return; if (!confirm('Точно? Сначала лучше сохранить копию.')) return; localStorage.removeItem('balans.v1'); S = E.load(); render(); onboarding(); },
};

/* ---------- первый запуск ---------- */
function onboarding() {
  if (S.onboarded) return;
  sheet(`<h2>Баланс</h2>
    <p class="sm">Дневник курса: кривая уровня по эфирам, уколы, самочувствие, анализы и давление. Всё хранится только на этом телефоне.</p>
    <div class="alert"><span class="ic st-warning">${ic('warning', 'ic')}</span><div class="x">Кривая — модель, а не измерение. Приложение не подбирает дозы и не заменяет врача: оно помогает вовремя заметить риски и прийти к врачу с данными.</div></div>
    <h3 style="margin:18px 0 10px">Твоя схема</h3>
    <label class="field"><span>Препарат</span><select class="input" name="c">${compoundOptions('test-e', (c) => c.kind === 'aas')}</select></label>
    <div class="two"><label class="field"><span>Доза, мг</span><input class="input" name="dose" inputmode="decimal" value="500"></label>
    <label class="field"><span>Каждые, дней</span><input class="input" name="int" inputmode="decimal" value="5"></label></div>
    <label class="field"><span>Последний укол</span><input class="input" type="datetime-local" name="last" value="${localInput(Date.now() - DAY)}"></label>
    <label class="field"><span>Колю так с</span><input class="input" type="date" name="since"><div class="help">Примерная дата начала. Если пусто — посчитаю, что ты только начал.</div></label>
    <div class="actions"><button class="btn block" data-save>Начать</button><button class="btn block ghost" data-skip>Заполню позже</button></div>`, (el) => {
    $('.scrim').onclick = null;
    const done = () => { S.onboarded = true; commit(); closeSheet(); render(); };
    $('[data-skip]', el).onclick = done;
    $('[data-save]', el).onclick = () => {
      const dose = num($('[name=dose]', el).value), interval = num($('[name=int]', el).value);
      const t = new Date($('[name=last]', el).value).getTime();
      if (!dose || !interval) return toast('Проверь дозу и интервал');
      const c = $('[name=c]', el).value;
      const sinceV = $('[name=since]', el).value;
      S.protocol.push({ id: E.uid(), compoundId: c, dose, interval, active: true, start: Date.now(), since: sinceV ? new Date(`${sinceV}T09:00`).getTime() : null });
      if (Number.isFinite(t)) S.doses.push({ id: E.uid(), compoundId: c, dose, t, site: null, ml: dose / (byId(c).defaultConc || 250) });
      done();
    };
  });
}

/* ---------- старт ---------- */
render();
onboarding();
navigator.storage?.persist?.();
if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
let rt; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(render, 200); });
