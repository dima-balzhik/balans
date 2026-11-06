// Баланс — прогнозы, связи, план анализов, напоминания, силовые. Всё считается на устройстве.
import * as E from './engine.js';
import { markerById, byId } from './data.js';

const { DAY } = E;
const now = () => Date.now();
const median = (arr) => { const a = [...arr].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };

/* ---------- прогноз гематокрита ---------- */
// Линейный тренд по анализам после последней донации. Гематокрит растёт первые 3–6 месяцев,
// потом обычно выходит на плато — поэтому прогноз дальше 4 месяцев не показываем.
export function hctForecast(s) {
  const lastDon = s.donations.reduce((m, d) => Math.max(m, d.t), 0);
  const pts = s.labs.filter((l) => l.values?.hct != null && l.t > lastDon && now() - l.t < 240 * DAY)
    .map((l) => ({ t: l.t, v: l.values.hct })).sort((a, b) => a.t - b.t);
  if (!pts.length) return null;
  const last = pts.at(-1);
  if (pts.length < 2 || pts.at(-1).t - pts[0].t < 14 * DAY) return { n: pts.length, last, slope: null };
  const n = pts.length, mt = pts.reduce((a, p) => a + p.t, 0) / n, mv = pts.reduce((a, p) => a + p.v, 0) / n;
  const num = pts.reduce((a, p) => a + (p.t - mt) * (p.v - mv), 0), den = pts.reduce((a, p) => a + (p.t - mt) ** 2, 0);
  const slope = den ? num / den : 0; // %/мс
  const at = (t) => mv + slope * (t - mt);
  const perMonth = slope * 30 * DAY;
  const when = (target) => {
    if (slope <= 0) return null;
    const t = mt + (target - mv) / slope;
    return t > now() && t - now() < 120 * DAY ? t : t <= now() ? now() : null;
  };
  return { n, last, slope, perMonth, nowV: at(now()), at52: last.v >= 52 ? null : when(52), at54: last.v >= 54 ? null : when(54), conf: n >= 3 ? 'средняя' : 'низкая', pts };
}

/* ---------- оценка эстрадиола ---------- */
// E2 (пг/мл) ≈ k × тестостерон (нмоль/л). k у каждого свой — считаем по анализам.
// Без анализов берём грубое среднее (≈1,1), это только ориентир.
const K_POP = 1.1;
export function e2Estimate(s) {
  const sum = E.testoSummary(s);
  if (!sum) return null;
  const { factor } = E.calibration(s);
  const ks = [];
  for (const l of s.labs) {
    const e2 = l.values?.e2;
    if (e2 == null) continue;
    const t = l.values.tt ?? E.releaseAt(E.allDoses(s), 'testosterone', l.t) * E.POP_SCALE * factor;
    if (t > 3) ks.push({ t: l.t, k: e2 / t });
  }
  const last3 = ks.sort((a, b) => a.t - b.t).slice(-3).map((x) => x.k);
  const k = last3.length ? median(last3) : K_POP;
  const m = markerById('e2');
  const val = (v) => ({ v: k * v, st: E.markerStatus(m, k * v) });
  const hasAI = s.protocol.some((p) => p.active && byId(p.compoundId)?.kind === 'ai');
  return { k, n: ks.length, now: val(sum.cur), peak: sum.peak ? val(sum.peak) : null, trough: sum.trough ? val(sum.trough) : null, hasAI };
}

/* ---------- связи «что на что влияет» ---------- */
function testoAt(s, t) {
  const { factor } = E.calibration(s);
  return E.releaseAt(E.allDoses(s), 'testosterone', t) * E.POP_SCALE * factor;
}
export function correlations(s) {
  const rows = s.symptoms.map((x) => ({ ...x, T: testoAt(s, x.t), gym: (s.workouts || []).some((w) => new Date(w.t).toDateString() === new Date(x.t).toDateString()) }));
  const out = [];
  const Y = [['libido', 'либидо'], ['erection', 'эрекция'], ['mood', 'настроение'], ['energy', 'энергия']];
  const X = [
    { k: 'sleepH', split: () => 7, hi: 'спишь 7+ ч', lo: 'меньше 7 ч' },
    { k: 'steps', split: (v) => Math.round(median(v) / 1000) * 1000, hi: (x) => `шагов больше ${x / 1000} тыс.`, lo: 'меньше' },
    { k: 'T', split: (v) => Math.round(median(v) / 10) * 10, hi: (x) => `тест по модели выше ~${x}`, lo: 'ниже' },
    { k: 'gym', bool: true, hi: 'в дни тренировок', lo: 'в дни отдыха' },
    { k: 'kcal', split: (v) => Math.round(median(v) / 100) * 100, hi: (x) => `ешь больше ${x} ккал`, lo: 'меньше' },
  ];
  for (const x of X) {
    const have = rows.filter((r) => r[x.k] != null && r[x.k] !== '' && (x.bool || r[x.k] > 0));
    if (have.length < 10) continue;
    const thr = x.bool ? null : x.split(have.map((r) => +r[x.k]));
    const isHi = (r) => (x.bool ? r[x.k] : +r[x.k] >= thr);
    for (const [yk, yl] of Y) {
      const hi = have.filter(isHi).map((r) => r[yk]).filter((v) => v != null);
      const lo = have.filter((r) => !isHi(r)).map((r) => r[yk]).filter((v) => v != null);
      if (hi.length < 4 || lo.length < 4) continue;
      const a = hi.reduce((p, c) => p + c, 0) / hi.length, b = lo.reduce((p, c) => p + c, 0) / lo.length;
      if (Math.abs(a - b) < 0.5) continue;
      const hiL = typeof x.hi === 'function' ? x.hi(thr) : x.hi;
      const text = x.bool ? `В дни тренировок ${yl} в среднем ${E.round(a, 1)}, а в дни отдыха — ${E.round(b, 1)}.` : `Когда ${hiL}, ${yl} в среднем ${E.round(a, 1)}, а когда ${x.lo} — ${E.round(b, 1)}.`;
      out.push({ diff: Math.abs(a - b), good: a > b, text, n: hi.length + lo.length });
    }
  }
  // давление и тренировки
  const bpDays = (s.bp || []).map((b) => ({ sys: b.sys, gym: (s.workouts || []).some((w) => new Date(w.t).toDateString() === new Date(b.t).toDateString()) }));
  const g = bpDays.filter((b) => b.gym), r = bpDays.filter((b) => !b.gym);
  if (g.length >= 3 && r.length >= 3) {
    const a = g.reduce((p, c) => p + c.sys, 0) / g.length, b = r.reduce((p, c) => p + c.sys, 0) / r.length;
    if (Math.abs(a - b) >= 5) out.push({ diff: 1, good: a < b, text: `В дни тренировок верхнее давление в среднем ${Math.round(a)}, в дни отдыха — ${Math.round(b)}.`, n: g.length + r.length });
  }
  return { items: out.sort((a, b) => b.diff - a.diff).slice(0, 6), days: rows.length };
}

/* ---------- план анализов ---------- */
export function labPlan(s) {
  const cs = s.protocol.filter((p) => p.active).map((p) => byId(p.compoundId)).filter(Boolean);
  const orals = cs.some((c) => c.kind === 'oral');
  const nor19 = cs.some((c) => c.prl >= 2);
  const lv = E.latestValues(s);
  const hctHigh = lv.hct && lv.hct.v >= 50;
  const groups = [
    { id: 'oak', name: 'Общий анализ крови', markers: ['hct', 'hgb'], every: hctHigh ? 28 : 42, why: hctHigh ? 'Гематокрит уже высокий — чаще' : 'Густота крови — главный скрытый риск' },
    { id: 'horm', name: 'Тестостерон общий + эстрадиол', markers: ['tt', 'e2'], every: 56, why: 'Калибровка кривой и контроль E2' },
    { id: 'lip', name: 'Липидограмма', markers: ['ldl', 'hdl', 'tg', 'chol'], every: orals ? 28 : 56, why: 'Сосуды и сердце' },
    { id: 'liver', name: 'АЛТ, АСТ', markers: ['alt', 'ast'], every: orals ? 28 : 56, why: 'Печень' },
    { id: 'psa', name: 'ПСА', markers: ['psa'], every: 90, why: 'Простата' },
    { id: 'kid', name: 'Креатинин, глюкоза', markers: ['creat', 'glu'], every: 90, why: 'Почки и сахар' },
    { id: 'thy', name: 'ТТГ, Т3 св., Т4 св.', markers: ['tsh', 'ft3', 'ft4'], every: 180, why: 'Щитовидка и обмен' },
    { id: 'vitd', name: 'Витамин D', markers: ['vitd'], every: 180, why: 'Иммунитет, настроение, кости' },
  ];
  if (nor19) groups.splice(2, 0, { id: 'prl', name: 'Пролактин', markers: ['prl'], every: 56, why: 'В схеме есть препарат, который его поднимает' });
  const changed = s.protocol.filter((p) => p.active && p.changedAt).reduce((m, p) => Math.max(m, p.changedAt), 0);
  const items = groups.map((g) => {
    const last = Math.max(0, ...g.markers.map((m) => E.lastLabDate(s, m)));
    let due = last ? last + g.every * DAY : now();
    let reason = '';
    if (g.id === 'horm' && changed && E.lastLabDate(s, 'e2') < changed) { due = Math.min(due, changed + 21 * DAY); reason = 'Схема менялась — проверить E2 через 3 недели'; }
    if (g.id === 'oak') {
      const f = hctForecast(s);
      if (f?.at54 && f.at54 - 7 * DAY < due) { due = Math.max(now(), f.at54 - 7 * DAY); reason = 'По прогнозу гематокрит подходит к 54%'; }
    }
    return { ...g, last, due, overdue: due < now() - DAY, reason };
  }).sort((a, b) => a.due - b.due);
  // ближайший визит: всё, что подходит в пределах 2 недель от первого срока, — одной сдачей
  const first = items[0];
  const visitItems = items.filter((i) => i.due <= first.due + 14 * DAY);
  // утро дня укола = минимум кривой
  const inj = E.futureDoses(s, 90 * DAY).filter((d) => byId(d.compoundId)?.hormone === 'testosterone');
  const target = Math.max(first.due, now());
  const day = inj.find((d) => d.t >= target - 12 * 3600000);
  let visit = day ? new Date(day.t) : new Date(target);
  visit.setHours(8, 0, 0, 0);
  if (visit.getTime() < now() - 6 * 3600000) visit = new Date(target);
  return { items, visit: { t: visit.getTime(), items: visitItems, beforeInjection: !!day } };
}

/* ---------- силовые ---------- */
export const EXERCISES = ['Жим лёжа', 'Присед', 'Становая', 'Жим стоя', 'Подтягивания', 'Тяга штанги'];
export const e1rm = (w, reps) => (reps <= 1 ? w : w * (1 + Math.min(reps, 12) / 30));
export function strength(s) {
  const by = {};
  for (const w of s.workouts || []) (by[w.ex] ||= []).push({ ...w, e: e1rm(w.w, w.reps) });
  return Object.entries(by).map(([ex, arr]) => {
    arr.sort((a, b) => a.t - b.t);
    const last = arr.at(-1), best = Math.max(...arr.map((x) => x.e));
    const ago = [...arr].reverse().find((x) => x.t <= now() - 28 * DAY);
    return { ex, arr, last, best, change: ago ? (last.e - ago.e) / ago.e : null };
  }).sort((a, b) => b.last.t - a.last.t);
}

/* ---------- замеры ---------- */
export const MEASURES = [['waist', 'Талия'], ['chest', 'Грудь'], ['arm', 'Бицепс'], ['thigh', 'Бедро'], ['bf', '% жира']];
export function measureSummary(s) {
  const arr = [...(s.measures || [])].sort((a, b) => a.t - b.t);
  if (!arr.length) return null;
  const last = arr.at(-1);
  const ref = [...arr].reverse().find((m) => m.t <= last.t - 21 * DAY) || arr[0];
  return { last, ref: ref === last ? null : ref, arr };
}

/* ---------- напоминания на сегодня ---------- */
export function todayTodos(s) {
  const out = [];
  const t = now();
  const dayStr = new Date().toDateString();
  for (const p of s.protocol.filter((x) => x.active)) {
    const c = byId(p.compoundId);
    if (!c || (c.kind !== 'aas' && c.kind !== 'oral' && c.kind !== 'ai')) continue;
    const last = s.doses.filter((d) => d.compoundId === p.compoundId).reduce((m, d) => Math.max(m, d.t), 0);
    if (!last) continue;
    const due = last + p.interval * DAY;
    if (due < t - 6 * 3600000) out.push({ st: 'serious', icon: 'syringe', title: `${c.short}: просрочено на ${E.fmtIn(t - due)}`, text: `${p.dose} мг. Отметь, если уже сделал.`, act: 'log-dose' });
    else if (new Date(due).toDateString() === dayStr || due < t) out.push({ st: 'warning', icon: 'syringe', title: `Сегодня ${c.short}`, text: `${p.dose} мг · ${E.fmtTime(due)}`, act: 'log-dose' });
    else if (due - t < 24 * 3600000) out.push({ st: 'info', icon: 'syringe', title: `Завтра ${c.short}`, text: `${p.dose} мг · ${E.fmtTime(due)}`, act: 'log-dose' });
  }
  const plan = labPlan(s);
  const vd = plan.visit.t - t;
  if (vd < 2 * DAY) {
    out.push({ st: vd < 0 ? 'serious' : 'warning', icon: 'flask', title: vd < 0 ? 'Пора сдать анализы' : new Date(plan.visit.t).toDateString() === dayStr ? 'Сегодня анализы' : 'Завтра анализы', text: `${plan.visit.beforeInjection ? 'Утром, натощак, до укола. ' : 'Утром, натощак. '}${plan.visit.items.map((i) => i.name).join(', ')}`, act: 'plan' });
  }
  const lastBp = s.bp.reduce((m, b) => Math.max(m, b.t), 0);
  if (!lastBp || t - lastBp > 3 * DAY) out.push({ st: 'info', icon: 'heart', title: lastBp ? `Давление не мерил ${Math.floor((t - lastBp) / DAY)} дн.` : 'Измерь давление', text: 'Утром, сидя, после 5 минут покоя', act: 'add-bp' });
  if (!s.symptoms.some((x) => new Date(x.t).toDateString() === dayStr)) out.push({ st: 'info', icon: 'today', title: 'Заполни дневник', text: 'Вес, калории, либидо — 30 секунд', act: 'checkin' });
  const lastM = Math.max(0, ...(s.measures || []).map((m) => m.t));
  if (!lastM || t - lastM > 7 * DAY) out.push({ st: 'info', icon: 'ruler', title: 'Замеры и фото', text: lastM ? `Последние ${Math.floor((t - lastM) / DAY)} дн. назад — раз в неделю` : 'Раз в неделю: талия, грудь, рука + фото', act: 'measure' });
  for (const v of s.vials) {
    const st = E.vialState(s, v);
    const p = s.protocol.find((x) => x.active && x.compoundId === v.compoundId);
    if (p && st.daysLeft != null && st.daysLeft < p.interval * 2) out.push({ st: 'warning', icon: 'drop', title: `${byId(v.compoundId).short}: флакон заканчивается`, text: `Осталось ${E.round(st.left, 1)} мл — примерно на ${Math.max(0, Math.floor(st.daysLeft))} дн.`, act: 'doses' });
  }
  const order = { serious: 0, warning: 1, info: 2 };
  return out.sort((a, b) => order[a.st] - order[b.st]);
}
