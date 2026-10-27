// Все расчёты: индекс полезности за матч, рейтинг игрока, атрибуты и потенциал.
// Формулы описаны на странице «Как считаем» и в README.

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lin = (x, x0, y0, x1, y1) => y0 + (clamp(x, Math.min(x0, x1), Math.max(x0, x1)) - x0) * (y1 - y0) / (x1 - x0);

// ---------- один матч ----------

// Game Score Джона Холлинджера — классическая «полезность» за игру.
// Раскладываем его на составляющие, чтобы было видно, за что плюсы и минусы.
export function breakdown(s) {
  const parts = {
    scoring: s.pts + 0.4 * s.fgm - 0.7 * s.fga - 0.4 * (s.fta - s.ftm),
    passing: 0.7 * s.ast,
    rebounding: 0.7 * s.oreb + 0.3 * s.dreb,
    defense: s.stl + 0.7 * s.blk,
    mistakes: -(s.tov + 0.4 * s.pf),
  };
  parts.total = parts.scoring + parts.passing + parts.rebounding + parts.defense + parts.mistakes;
  return parts;
}

export const gameScore = s => breakdown(s).total;

export function trueShooting(s) {
  const att = 2 * (s.fga + 0.44 * s.fta);
  return att > 0 ? s.pts / att : null;
}

// Оценка за матч по 10-балльной шкале (как в футбольных приложениях):
// 6.0 — средняя игра, 7+ — хорошая, 8+ — отличная, 9+ — выдающаяся.
export function matchRating(s) {
  if (!s) return null;
  let r = 5.8 + 0.12 * gameScore(s) + 0.015 * (s.pm || 0);
  // если сыграл совсем мало, оценка тянется к средней — выводов по 3 минутам не сделать
  if (s.min < 8) r = 6 + (r - 6) * Math.max(s.min, 1) / 8;
  return Math.round(clamp(r, 3, 10) * 10) / 10;
}

export function ratingTone(r, min = 99) {
  if (r == null) return { key: 'none', word: '—' };
  if (min < 8) return { key: 'short', word: 'Мало минут' };
  if (r >= 9) return { key: 'elite', word: 'Шедевр' };
  if (r >= 8) return { key: 'great', word: 'Отлично' };
  if (r >= 7) return { key: 'good', word: 'Хорошо' };
  if (r >= 6.3) return { key: 'ok', word: 'Нормально' };
  if (r >= 5.5) return { key: 'meh', word: 'Слабовато' };
  return { key: 'bad', word: 'Провал' };
}

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const n = (v, one, few, many) => `${v} ${plural(v, one, few, many)}`;

// Короткий разбор: что получилось и что нет.
export function verdict(s) {
  const pros = [], cons = [];
  const ts = trueShooting(s);
  const cats = [s.pts, s.reb, s.ast, s.stl, s.blk].filter(v => v >= 10).length;

  if (cats >= 3) pros.push(`Трипл-дабл: ${n(s.pts, 'очко', 'очка', 'очков')}, ${n(s.reb, 'подбор', 'подбора', 'подборов')}, ${n(s.ast, 'передача', 'передачи', 'передач')}`);
  else if (cats === 2) pros.push('Дабл-дабл');

  if (s.pts >= 30) pros.push(`${n(s.pts, 'очко', 'очка', 'очков')} — главная ударная сила`);
  else if (s.pts >= 20) pros.push(n(s.pts, 'очко', 'очка', 'очков'));

  if (ts != null && ts >= 0.65 && s.fga >= 8) pros.push(`Очень точный: ${s.fgm} из ${s.fga} с игры, TS ${Math.round(ts * 100)}%`);
  if (s.tpm >= 4) pros.push(`${s.tpm} из ${s.tpa} из-за дуги`);
  if (s.reb >= 10) pros.push(`${n(s.reb, 'подбор', 'подбора', 'подборов')}${s.oreb >= 4 ? `, из них ${s.oreb} в нападении` : ''}`);
  else if (s.oreb >= 4) pros.push(`${n(s.oreb, 'подбор', 'подбора', 'подборов')} в нападении — лишние владения`);
  if (s.ast >= 8) pros.push(`${n(s.ast, 'передача', 'передачи', 'передач')} — разыгрывал атаки`);
  else if (s.ast >= 5 && s.tov <= 1) pros.push(`Аккуратный пас: ${n(s.ast, 'передача', 'передачи', 'передач')} и ${n(s.tov, 'потеря', 'потери', 'потерь')}`);
  if (s.stl + s.blk >= 4) pros.push(`Полезен в защите: ${n(s.stl, 'перехват', 'перехвата', 'перехватов')} и ${n(s.blk, 'блок-шот', 'блок-шота', 'блок-шотов')}`);
  else if (s.blk >= 3) pros.push(n(s.blk, 'блок-шот', 'блок-шота', 'блок-шотов'));
  if (s.pm >= 15) pros.push(`Пока он был на площадке, команда выиграла отрезок на +${s.pm}`);

  if (ts != null && ts < 0.45 && s.fga >= 10) cons.push(`Мазал: ${s.fgm} из ${s.fga} с игры`);
  if (s.tpa >= 6 && s.tpm / s.tpa < 0.25) cons.push(`Трёхочковые не шли: ${s.tpm} из ${s.tpa}`);
  if (s.fta >= 5 && s.ftm / s.fta < 0.6) cons.push(`Штрафные ${s.ftm} из ${s.fta} (${pct(s.ftm, s.fta)}%)`);
  if (s.tov >= 4) cons.push(`${n(s.tov, 'потеря', 'потери', 'потерь')} — много отданных мячей`);
  if (s.pf >= 5) cons.push(`${n(s.pf, 'фол', 'фола', 'фолов')} — на грани перебора`);
  if (s.pm <= -15) cons.push(`С ним на площадке команда проиграла отрезок на ${s.pm}`);
  if (s.min >= 20 && gameScore(s) < 3) cons.push(`Мало пользы за ${n(Math.round(s.min), 'минуту', 'минуты', 'минут')}`);

  return { pros, cons };
}

// ---------- сезон и карьера ----------

// Game Score по средним за сезон
export const seasonGS = r => (r ? gameScore(r) : 0);

// Общий рейтинг (OVR) в духе NBA 2K: 64 + 1.4 × средний Game Score.
// Ролевой игрок ~70, крепкий стартер ~80, звезда 88+, MVP-уровень 97–99.
export const ovrFromGS = g => Math.round(clamp(64 + 1.4 * g, 40, 99));

export function currentSeasonYear(date = new Date()) {
  // сезон ESPN называется по году окончания: октябрь 2026 → сезон 2027 (2026-27)
  return date.getMonth() >= 7 ? date.getFullYear() + 1 : date.getFullYear();
}

const AVG_KEYS = ['min', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'blk', 'stl', 'pf', 'tov', 'pts'];

// «средний новичок»: ~17 минут, 7 очков, 3 подбора — Game Score около 5
const ROOKIE_PRIOR = { gp: 0, min: 17, fgm: 2.8, fga: 6.4, tpm: 0.9, tpa: 2.6, ftm: 1.0, fta: 1.4, oreb: 0.8, dreb: 2.4, reb: 3.2, ast: 1.5, blk: 0.4, stl: 0.6, pf: 1.6, tov: 0.9, pts: 7.5 };

function blend(a, b, w) {
  const out = { gp: a.gp };
  for (const k of AVG_KEYS) out[k] = a[k] * w + b[k] * (1 - w);
  return out;
}

// В начале сезона несколько игр мало что значат, поэтому текущий сезон
// смешивается с прошлым: вес текущего = игры / (игры + 12).
export function profileStats(seasons, seasonYear = currentSeasonYear()) {
  if (!seasons?.length) return null;
  const cur = seasons.find(s => s.year === seasonYear && s.gp > 0);
  const past = seasons.filter(s => s.year < seasonYear && s.gp > 0);
  const prev = past[past.length - 1] || null;
  if (cur && prev) {
    const w = cur.gp / (cur.gp + 12);
    return { stats: blend(cur, prev, w), basis: `${cur.gp} ${plural(cur.gp, 'игра', 'игры', 'игр')} этого сезона + прошлый сезон`, cur, prev };
  }
  if (cur) {
    // новичок без прошлых сезонов: первые матчи смешиваем с уровнем среднего новичка
    const w = cur.gp / (cur.gp + 12);
    return { stats: blend(cur, ROOKIE_PRIOR, w), basis: `${cur.gp} ${plural(cur.gp, 'игра', 'игры', 'игр')} в НБА — рейтинг уточнится с новыми матчами`, cur, prev: null };
  }
  if (prev) return { stats: prev, basis: `сезон ${prev.label}`, cur: null, prev };
  return null;
}

export function attributes(r) {
  const ts = trueShooting(r);
  const chances = r.fga + 0.44 * r.fta + r.tov;
  const tovPct = chances > 2 ? (r.tov / chances) * 100 : 12;
  const astTo = r.ast / Math.max(r.tov, 0.5);
  const shooting = r.fga >= 2 && ts != null
    ? lin(ts, 0.48, 50, 0.66, 95) + (r.tpm - 1.5) * 2
    : 45;
  const a = {
    scoring: lin(r.pts, 3, 45, 30, 98),
    shooting,
    passing: lin(r.ast, 0.5, 42, 9.5, 97) + clamp((astTo - 2) * 2, -6, 6),
    rebounding: lin(r.reb, 1.5, 40, 13, 97),
    defense: lin(r.stl + r.blk + 0.15 * r.dreb, 0.5, 42, 3.6, 96),
    security: 95 - (tovPct - 6) * 3.1,
  };
  for (const k in a) a[k] = Math.round(clamp(a[k], 30, 99));
  return a;
}

export const ATTR_LABELS = [
  ['scoring', 'АТК', 'Атака — сколько очков приносит'],
  ['shooting', 'БРС', 'Бросок — точность (TS%) и трёхочковые'],
  ['passing', 'ПАС', 'Пас — передачи и соотношение передач к потерям'],
  ['rebounding', 'ПДБ', 'Подбор'],
  ['defense', 'ЗАЩ', 'Защита — перехваты, блок-шоты, подбор у своего щита'],
  ['security', 'НАД', 'Надёжность — как редко теряет мяч'],
];

function ageBonus(age) {
  if (age == null) return 3;
  if (age <= 19) return 14;
  const table = { 20: 12, 21: 10, 22: 8, 23: 6, 24: 4, 25: 3, 26: 2, 27: 1 };
  return table[age] ?? 0;
}

export function playerProfile(seasons, age, seasonYear = currentSeasonYear()) {
  const prof = profileStats(seasons, seasonYear);
  if (!prof) return null;
  const g = seasonGS(prof.stats);
  const ovr = ovrFromGS(g);

  // история рейтинга по сезонам (для графика роста)
  // за текущий сезон показываем тот же рейтинг, что и на карточке (с учётом прошлого сезона)
  const history = seasons.filter(s => s.gp > 0).map(s => ({ year: s.year, label: s.label, ovr: s.year === seasonYear ? ovr : ovrFromGS(seasonGS(s)), gp: s.gp }));
  const prevOvr = prof.prev ? ovrFromGS(seasonGS(prof.prev)) : null;
  const delta = prevOvr != null && prof.cur ? ovr - prevOvr : null;

  let trendBonus = 0;
  if (delta != null && (age ?? 30) <= 27) trendBonus = clamp(Math.round(delta * 0.4), -2, 4);
  const pot = Math.max(ovr, Math.min(99, ovr + ageBonus(age) + trendBonus));

  return { ovr, pot, delta, history, attrs: attributes(prof.stats), basis: prof.basis, stats: prof.stats, cur: prof.cur, prev: prof.prev };
}

export function tierOf(ovr) {
  if (ovr >= 90) return { key: 'galaxy', name: 'Суперзвезда' };
  if (ovr >= 85) return { key: 'star', name: 'Звезда' };
  if (ovr >= 80) return { key: 'gold', name: 'Сильный стартер' };
  if (ovr >= 75) return { key: 'silver', name: 'Стартер' };
  if (ovr >= 70) return { key: 'bronze', name: 'Игрок ротации' };
  return { key: 'iron', name: 'Резерв' };
}

export function growthText(age, delta, ovr, pot) {
  const phase = age == null ? '' : age <= 23 ? 'Молодой игрок' : age <= 29 ? 'Игрок в расцвете' : age <= 33 ? 'Опытный игрок' : 'Ветеран';
  let trend = '';
  if (delta != null) {
    if (delta >= 2) trend = `прибавил ${delta} к прошлому сезону — растёт`;
    else if (delta <= -2) trend = `потерял ${Math.abs(delta)} по сравнению с прошлым сезоном`;
    else trend = 'играет на уровне прошлого сезона';
  }
  const room = pot - ovr;
  const roomText = room >= 8 ? 'большой запас роста' : room >= 3 ? 'есть куда расти' : 'уже близок к своему пику';
  return [phase, trend, roomText].filter(Boolean).join(', ') + '.';
}

export function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}
