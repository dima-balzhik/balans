// Баланс — модель, хранилище и правила. Всё считается на устройстве.
import { COMPOUNDS, MARKERS, byId, markerById } from './data.js';

const DAY = 86400000;
const LN2 = Math.log(2);
// Грубая популяционная оценка: 1 мг/сут высвобождаемого тестостерона ≈ 1.94 нмоль/л
// в среднем (≈ 100 мг энантата в неделю → ~20 нмоль/л). Уточняется по анализам.
const POP_SCALE = 1.94;

/* ---------- хранилище ---------- */
const KEY = 'balans.v1';
const EMPTY = { v: 1, onboarded: false, protocol: [], doses: [], vials: [], symptoms: [], labs: [], bp: [], donations: [], units: {} };

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    return { ...structuredClone(EMPTY), ...JSON.parse(raw) };
  } catch { return structuredClone(EMPTY); }
}
export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
}
export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- фармакокинетика ---------- */
// Функция Бейтмана с площадью 1: доля дозы, высвобождаемая в сутки в момент t (сутки).
function unit(t, rise, decay) {
  if (t <= 0) return 0;
  const ka = LN2 / rise, ke = LN2 / decay;
  if (Math.abs(ka - ke) < 1e-6) return ke * ke * t * Math.exp(-ke * t);
  return (ka * ke / (ka - ke)) * (Math.exp(-ke * t) - Math.exp(-ka * t));
}

// Плановые будущие приёмы по схеме, начиная после последнего записанного приёма.
export function futureDoses(s, horizonMs, now = Date.now()) {
  const out = [];
  for (const p of s.protocol.filter((x) => x.active)) {
    const last = s.doses.filter((d) => d.compoundId === p.compoundId).reduce((m, d) => Math.max(m, d.t), 0);
    let t = last ? last + p.interval * DAY : Math.max(p.start || now, now);
    while (t < now) t += p.interval * DAY;
    for (let i = 0; t <= now + horizonMs && i < 400; i++, t += p.interval * DAY) {
      out.push({ compoundId: p.compoundId, dose: p.dose, t, planned: true });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

// Высвобождение активного вещества (мг/сут) по гормону в момент t.
export function releaseAt(doses, hormone, t) {
  let sum = 0;
  for (const d of doses) {
    const c = byId(d.compoundId);
    if (!c || c.hormone !== hormone) continue;
    const dt = (t - d.t) / DAY;
    if (dt <= 0 || dt > c.decay * 12) continue;
    sum += d.dose * c.frac * unit(dt, c.rise, c.decay);
  }
  return sum;
}

// Личный коэффициент по анализам тестостерона общего (нмоль/л).
export function calibration(s) {
  const pts = [];
  for (const l of s.labs) {
    const v = l.values?.tt;
    if (v == null) continue;
    const model = releaseAt(s.doses, 'testosterone', l.t) * POP_SCALE;
    if (model > 1) pts.push(v / model);
  }
  const last = pts.slice(-3).sort((a, b) => a - b);
  const factor = last.length ? last[Math.floor(last.length / 2)] : 1;
  return { factor: Math.min(Math.max(factor, 0.2), 5), n: pts.length };
}

export function testoSeries(s, from, to, stepH = 2) {
  const all = [...s.doses, ...futureDoses(s, to - Date.now())];
  const { factor } = calibration(s);
  const out = [];
  for (let t = from; t <= to; t += stepH * 3600000) {
    out.push({ t, v: releaseAt(all, 'testosterone', t) * POP_SCALE * factor });
  }
  return out;
}

export function releaseSeries(s, hormone, from, to, stepH = 2) {
  const all = [...s.doses, ...futureDoses(s, to - Date.now())];
  const out = [];
  for (let t = from; t <= to; t += stepH * 3600000) out.push({ t, v: releaseAt(all, hormone, t) });
  return out;
}

export function activeHormones(s) {
  const set = new Set();
  for (const p of s.protocol.filter((x) => x.active)) { const c = byId(p.compoundId); if (c?.hormone) set.add(c.hormone); }
  for (const d of s.doses) { const c = byId(d.compoundId); if (c?.hormone && Date.now() - d.t < c.decay * 8 * DAY) set.add(c.hormone); }
  return [...set];
}

// Сводка по тестостерону: сейчас, тренд, ближайший минимум, колебание.
export function testoSummary(s, now = Date.now()) {
  const p = s.protocol.find((x) => x.active && byId(x.compoundId)?.hormone === 'testosterone');
  const ser = testoSeries(s, now - DAY, now + 30 * DAY, 1);
  if (!ser.length || ser.every((x) => x.v < 0.5)) return null;
  const at = (t) => ser.reduce((b, x) => (Math.abs(x.t - t) < Math.abs(b.t - t) ? x : b));
  const cur = at(now).v;
  const prev = at(now - 6 * 3600000).v;
  const trend = cur > prev * 1.01 ? 'up' : cur < prev * 0.99 ? 'down' : 'flat';
  const lastDose = s.doses.filter((d) => byId(d.compoundId)?.hormone === 'testosterone').reduce((m, d) => (d.t > (m?.t || 0) ? d : m), null);
  const next = futureDoses(s, 60 * DAY, now).find((d) => byId(d.compoundId)?.hormone === 'testosterone');
  // стабильный интервал: последние полные интервалы в прогнозе
  let peak = null, trough = null;
  if (p) {
    const span = ser.filter((x) => x.t > now + 30 * DAY - p.interval * DAY * 2);
    if (span.length) {
      peak = Math.max(...span.map((x) => x.v));
      trough = Math.min(...span.map((x) => x.v));
    }
  }
  const nextTrough = next ? at(next.t - 3600000) : null;
  const avg = ser.filter((x) => x.t > now).slice(0, (p?.interval || 7) * 24).reduce((a, x, _, arr) => a + x.v / arr.length, 0);
  return { cur, trend, lastDose, next, peak, trough, nextTrough, avg, dayInCycle: lastDose ? (now - lastDose.t) / DAY : null, interval: p?.interval };
}

/* ---------- недельная нагрузка ---------- */
export function weeklyLoad(s) {
  let mg = 0;
  const parts = [];
  for (const p of s.protocol.filter((x) => x.active)) {
    const c = byId(p.compoundId);
    if (!c || (c.kind !== 'aas' && c.kind !== 'oral')) continue;
    const w = (p.dose * 7) / p.interval;
    mg += w;
    parts.push({ c, w });
  }
  let level;
  if (mg === 0) level = null;
  else if (mg <= 200) level = { st: 'good', label: 'Заместительная/низкая', text: 'Близко к заместительной терапии.' };
  else if (mg <= 500) level = { st: 'warning', label: 'Умеренно высокая', text: 'Риски по давлению, гематокриту и липидам уже заметны — нужен регулярный контроль.' };
  else if (mg <= 1000) level = { st: 'serious', label: 'Высокая', text: 'Риски по давлению, гематокриту, липидам и E2 растут с дозой. Анализы — каждые 6–8 недель, давление — несколько раз в неделю.' };
  else level = { st: 'critical', label: 'Очень высокая', text: 'Высокий суммарный риск для сердца и сосудов. Обязателен контроль врача.' };
  return { mg, parts, level };
}

/* ---------- анализы ---------- */
export function markerStatus(m, v) {
  if (v == null || Number.isNaN(v)) return null;
  if (m.criticalHi != null && v >= m.criticalHi) return 'critical';
  if (m.criticalLo != null && v <= m.criticalLo) return 'critical';
  if (m.seriousHi != null && v >= m.seriousHi) return 'serious';
  if (m.seriousLo != null && v <= m.seriousLo) return 'serious';
  if (m.warnHi != null && v > m.warnHi) return 'warning';
  if (m.warnLo != null && v < m.warnLo) return 'warning';
  if (!m.noFlagHi && m.hi != null && m.warnHi == null && v > m.hi) return 'warning';
  if (!m.noFlagLo && m.lo != null && m.warnLo == null && v < m.lo) return 'warning';
  return 'good';
}

export function latestValues(s) {
  const out = {};
  for (const l of [...s.labs].sort((a, b) => a.t - b.t)) {
    for (const [k, v] of Object.entries(l.values || {})) if (v != null) out[k] = { v, t: l.t };
  }
  return out;
}

export function lastLabDate(s, markerId) {
  return s.labs.filter((l) => (markerId ? l.values?.[markerId] != null : true)).reduce((m, l) => Math.max(m, l.t), 0);
}

/* ---------- давление ---------- */
export function bpStatus(sys, dia) {
  if (sys >= 180 || dia >= 120) return { st: 'critical', label: 'Криз — срочно к врачу' };
  if (sys >= 140 || dia >= 90) return { st: 'serious', label: 'Гипертензия 2 ст.' };
  if (sys >= 130 || dia >= 80) return { st: 'warning', label: 'Гипертензия 1 ст.' };
  if (sys >= 120) return { st: 'warning', label: 'Повышенное' };
  return { st: 'good', label: 'Норма' };
}

/* ---------- проверка сочетаний ---------- */
const sumOf = (cs, k) => cs.reduce((a, c) => a + (c[k] || 0), 0);

export function checkStack(s, extraIds = []) {
  const ids = new Set([...s.protocol.filter((x) => x.active).map((x) => x.compoundId), ...extraIds]);
  const cs = [...ids].map(byId).filter(Boolean);
  const res = [];
  if (!cs.length) return res;
  const aas = cs.filter((c) => c.kind === 'aas' || c.kind === 'oral');
  const hasTest = cs.some((c) => c.hormone === 'testosterone');
  const orals = cs.filter((c) => c.kind === 'oral');
  const nineteenNor = cs.filter((c) => c.prl >= 2);
  const ai = cs.find((c) => c.kind === 'ai');
  const nonArom = aas.filter((c) => c.arom === 0);
  const testEsters = cs.filter((c) => c.hormone === 'testosterone');
  const since = (id) => (Date.now() - lastLabDate(s, id)) / DAY;

  if (aas.length && !hasTest) {
    res.push({ st: 'serious', title: 'Нет базы тестостерона', text: 'Свой тестостерон на курсе выключен. Без теста в схеме эстрадиол и либидо часто проваливаются: член не стоит, желания нет, настроение на нуле.', ev: 'yellow' });
  }
  if (hasTest && nonArom.length) {
    res.push({ st: 'good', title: `Тест + ${nonArom.map((c) => c.short).join(', ')}`, text: 'Тест как база держит E2 в физиологичном диапазоне. Учитывай: в эстрадиол ароматизируется только тест, поэтому E2 оценивай по нему.', ev: 'yellow' });
  }
  if (testEsters.length > 1) {
    res.push({ st: 'info', title: 'Несколько эфиров теста', text: 'Они суммируются на одной кривой тестостерона.', ev: 'green' });
  }
  const hct = sumOf(aas, 'hct');
  if (hct >= 4) res.push({ st: 'serious', title: 'Суммарный риск по гематокриту', text: 'Препараты вместе сильно сгущают кровь. ОАК — каждые 4–6 недель, давление — регулярно, донацию обсуди с врачом.', ev: 'yellow' });
  else if (hct >= 3) res.push({ st: 'warning', title: 'Гематокрит', text: 'Риск густой крови суммируется. Следи за гематокритом и гемоглобином.', ev: 'green' });

  const lip = sumOf(aas, 'lip');
  if (lip >= 4) res.push({ st: 'serious', title: 'Сильное давление на липиды', text: 'ЛПВП может упасть очень низко, ЛПНП — вырасти. Липидограмма каждые 6–8 недель; кардио, омега-3 и питание — в помощь, но не замена контролю.', ev: 'yellow' });
  else if (lip >= 3) res.push({ st: 'warning', title: 'Липиды', text: 'Сочетание заметно снижает ЛПВП. Контролируй липидограмму.', ev: 'yellow' });

  if (nineteenNor.length >= 2) res.push({ st: 'serious', title: 'Два 19-нор препарата', text: 'Высокий риск повышения пролактина и проблем с либидо. Контроль пролактина обязателен.', ev: 'yellow' });
  else if (nineteenNor.length) res.push({ st: 'warning', title: 'Пролактин', text: `${nineteenNor[0].short} может повышать пролактин. Сдай пролактин, если падает либидо.`, ev: 'yellow' });

  if (orals.length >= 2) res.push({ st: 'critical', title: 'Два оральных препарата', text: 'Нагрузка на печень и липиды суммируется. Так делать опасно.', ev: 'yellow' });
  else if (orals.length) res.push({ st: 'warning', title: 'Пероральный препарат', text: 'Нагрузка на печень и сильное падение ЛПВП. АЛТ/АСТ и липиды — в начале и через 4 недели.', ev: 'green' });

  if (ai) {
    const aromLoad = sumOf(aas, 'arom');
    if (since('e2') > 42) res.push({ st: 'warning', title: 'Анастрозол без свежего E2', text: 'Анастрозол без свежего анализа — это вслепую. Перебор роняет эстрадиол: член перестаёт стоять, пропадает желание, болят суставы. Дозу подбирают только по анализу E2.', ev: 'green' });
    if (nonArom.length && aromLoad <= 2) res.push({ st: 'warning', title: 'Риск низкого E2', text: 'Мастерон в эстрадиол не превращается, поэтому эстрадиола и так меньше. С анастрозолом его легко опустить слишком низко: тогда член вялый, секса не хочется, суставы ноют.', ev: 'yellow' });
    else res.push({ st: 'info', title: 'Анастрозол', text: 'Если член стал хуже стоять, пропало желание или заныли суставы — возможно, эстрадиол слишком низкий. Сначала анализ E2, потом выводы.', ev: 'green' });
  }
  const cab = cs.find((c) => c.kind === 'dopa');
  if (cab && since('prl') > 60) res.push({ st: 'warning', title: 'Каберголин без анализа пролактина', text: 'Применяется только при подтверждённом высоком пролактине.', ev: 'green' });
  if (cs.some((c) => c.pct)) res.push({ st: 'info', title: 'Препараты восстановления', text: 'Раздел ПКТ появится позже. Пока можно вести журнал приёма.', ev: 'green' });
  const order = { critical: 0, serious: 1, warning: 2, info: 3, good: 4 };
  return res.sort((a, b) => order[a.st] - order[b.st]);
}

/* ---------- подсказки по самочувствию ---------- */
export function symptomHints(s) {
  const recent = [...s.symptoms].sort((a, b) => b.t - a.t).filter((x) => Date.now() - x.t < 10 * DAY).slice(0, 3);
  if (recent.length < 2) return [];
  const avg = (k) => recent.reduce((a, x) => a + (x[k] || 3), 0) / recent.length;
  const flag = (f) => recent.some((x) => x.flags?.includes(f));
  const ids = new Set(s.protocol.filter((x) => x.active).map((x) => x.compoundId));
  const cs = [...ids].map(byId).filter(Boolean);
  const hints = [];
  const lowLib = avg('libido') <= 2.5 || avg('erection') <= 2.5;
  if (lowLib) {
    const hiE2 = flag('edema') || flag('nipples');
    const loE2 = flag('joints') || flag('dryskin');
    if (hiE2) hints.push({ st: 'warning', title: 'Похоже на высокий E2', text: 'Не тянет на секс, а ещё отекаешь или чешутся соски — так часто бывает, когда эстрадиола слишком много. Сдай эстрадиол, чтобы знать точно.', labs: ['e2'] });
    if (loE2 && cs.some((c) => c.kind === 'ai')) hints.push({ st: 'warning', title: 'Похоже на низкий E2', text: 'Член вялый, желания нет, а ещё болят суставы или сухая кожа — на анастрозоле так бывает, когда эстрадиол «уронили» слишком низко. Сдай E2, прежде чем что-то менять.', labs: ['e2'] });
    if (cs.some((c) => c.prl >= 2)) hints.push({ st: 'warning', title: 'Проверь пролактин', text: 'Пропало желание или сложно кончить — в схеме есть препарат, который поднимает пролактин, а он гасит либидо. Сдай пролактин.', labs: ['prl'] });
    if (!hints.length) hints.push({ st: 'warning', title: 'Либидо снизилось', text: 'Член хуже стоит, не хочется секса — на курсе чаще всего виноват эстрадиол (слишком высокий или слишком низкий) или пролактин. Сдай эстрадиол, пролактин и тестостерон — по цифрам станет понятно, в чём дело.', labs: ['e2', 'prl', 'tt'] });
  }
  if (flag('headache')) {
    const lastBp = [...s.bp].sort((a, b) => b.t - a.t)[0];
    hints.push({ st: lastBp && bpStatus(lastBp.sys, lastBp.dia).st !== 'good' ? 'serious' : 'warning', title: 'Головная боль', text: 'Измерь давление. На курсе оно часто поднимается незаметно, и головная боль — один из немногих сигналов.' });
  }
  if (avg('sleep') <= 2) hints.push({ st: 'info', title: 'Сон просел', text: 'Высокие дозы и поздние тренировки бьют по сну. Если есть храп — проверь апноэ.' });
  return hints;
}

// Среднее либидо по дню цикла (сутки после укола).
export function libidoByCycleDay(s) {
  const tDoses = s.doses.filter((d) => byId(d.compoundId)?.hormone === 'testosterone').map((d) => d.t).sort((a, b) => a - b);
  const buckets = {};
  for (const x of s.symptoms) {
    const before = tDoses.filter((t) => t <= x.t).pop();
    if (!before) continue;
    const day = Math.floor((x.t - before) / DAY);
    if (day > 13) continue;
    (buckets[day] ||= []).push(x.libido || 3);
  }
  return Object.entries(buckets).map(([d, arr]) => ({ day: +d, v: arr.reduce((a, b) => a + b, 0) / arr.length, n: arr.length })).sort((a, b) => a.day - b.day);
}

/* ---------- напоминания ---------- */
export function reminders(s) {
  const out = [];
  const lab = lastLabDate(s);
  const sinceLab = lab ? (Date.now() - lab) / DAY : Infinity;
  if (sinceLab > 56) out.push({ st: 'warning', title: lab ? `Анализы сдавались ${Math.round(sinceLab)} дн. назад` : 'Анализов ещё нет', text: 'Пора сдать: тест общий, E2, пролактин, ОАК (гематокрит), липиды, АЛТ/АСТ, ПСА. Лучше утром, натощак, перед уколом.', action: 'labs' });
  const lastBp = s.bp.reduce((m, b) => Math.max(m, b.t), 0);
  if (!lastBp || Date.now() - lastBp > 7 * DAY) out.push({ st: 'info', title: 'Давление не измерялось неделю', text: 'На курсе давление стоит мерить 2–3 раза в неделю, утром в покое.', action: 'bp' });
  const lv = latestValues(s);
  if (lv.hct && lv.hct.v >= 52) {
    const lastDon = s.donations.reduce((m, d) => Math.max(m, d.t), 0);
    const ok = !lastDon || Date.now() - lastDon > 56 * DAY;
    out.push({ st: lv.hct.v >= 54 ? 'critical' : 'serious', title: `Гематокрит ${lv.hct.v}%`, text: ok ? 'Высокий — обсуди с врачом донацию или кровопускание.' : `Последняя донация ${fmtDate(lastDon)}. Следующая — не раньше чем через 8 недель после неё.`, action: 'health' });
  }
  return out;
}

/* ---------- запас ---------- */
export function vialState(s, v) {
  const used = s.doses.filter((d) => d.compoundId === v.compoundId && d.t >= v.t).reduce((a, d) => a + (d.ml || 0), 0);
  const left = Math.max(0, v.ml - used);
  const p = s.protocol.find((x) => x.active && x.compoundId === v.compoundId);
  const perDay = p ? p.dose / v.conc / p.interval : 0;
  return { used, left, daysLeft: perDay ? left / perDay : null };
}

/* ---------- ротация мест ---------- */
export function siteUsage(s, sites) {
  return sites.map((x) => {
    const last = s.doses.filter((d) => d.site === x.id).reduce((m, d) => Math.max(m, d.t), 0);
    return { ...x, last };
  });
}

/* ---------- форматирование ---------- */
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
export const fmtDate = (t) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const fmtTime = (t) => new Date(t).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
export const fmtDT = (t) => `${fmtDate(t)}, ${fmtTime(t)}`;
export function fmtIn(ms) {
  const h = ms / 3600000;
  if (h < 0) return 'просрочено';
  if (h < 1) return 'меньше часа';
  if (h < 24) return `${Math.round(h)} ч`;
  const H = Math.round(h), d = Math.floor(H / 24), rh = H - d * 24;
  return rh ? `${d} д ${rh} ч` : `${d} д`;
}
export const round = (v, n = 1) => (v == null ? '—' : (Math.round(v * 10 ** n) / 10 ** n).toLocaleString('ru-RU'));

/* ---------- календарь (.ics) ---------- */
const icsDate = (t) => new Date(t).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
export function buildIcs(s) {
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Balans//RU', 'CALSCALE:GREGORIAN'];
  const ev = (t, title, desc, alarms) => {
    lines.push('BEGIN:VEVENT', `UID:${uid()}@balans`, `DTSTAMP:${icsDate(Date.now())}`, `DTSTART:${icsDate(t)}`, `DTEND:${icsDate(t + 15 * 60000)}`, `SUMMARY:${title}`, `DESCRIPTION:${desc}`);
    for (const a of alarms) lines.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${title}`, `TRIGGER:${a}`, 'END:VALARM');
    lines.push('END:VEVENT');
  };
  for (const d of futureDoses(s, 60 * DAY)) {
    const c = byId(d.compoundId);
    ev(d.t, `Баланс: ${c.short} ${d.dose} мг`, 'Отметь приём в приложении', ['-PT0M', '-PT1H']);
  }
  const next = futureDoses(s, 60 * DAY).find((d) => byId(d.compoundId)?.hormone === 'testosterone');
  const lab = lastLabDate(s);
  if (next && (!lab || Date.now() - lab > 42 * DAY)) {
    const t = new Date(next.t); t.setHours(8, 0, 0, 0);
    ev(t.getTime(), 'Баланс: сдать анализы перед уколом', 'Натощак: тест общий, E2, пролактин, ОАК, липиды, АЛТ/АСТ, ПСА', ['-P1D', '-PT0M']);
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

export { DAY, POP_SCALE, COMPOUNDS, MARKERS, byId, markerById };
