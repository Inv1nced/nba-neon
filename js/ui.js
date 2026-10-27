// Общие кусочки интерфейса: значки команд, оценки, форматирование.
import { matchRating, ratingTone } from './rating.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const teamVars = t => `--c1:${t.c1};--c2:${t.c2};--glow:${t.glow}`;

// Значок команды — светящаяся «планета» в цветах клуба с орбитой.
// Официальные логотипы не используем: это оригинальный значок по аббревиатуре.
export function badge(t, size = 'md', { orbit = true, link = false } = {}) {
  const inner = `
    <span class="badge badge--${size}" style="${teamVars(t)}" aria-hidden="true">
      ${orbit ? '<span class="badge__orbit"><span class="badge__moon"></span></span>' : ''}
      <span class="badge__core"><span class="badge__abbr${t.abbr.length > 3 ? ' badge__abbr--long' : ''}">${esc(t.abbr)}</span></span>
    </span>`;
  return link ? `<a class="badge-link" href="#/team/${t.id}" aria-label="${esc(t.full)}">${inner}</a>` : inner;
}

export function ratingPill(s, { big = false } = {}) {
  if (!s) return '<span class="rate rate--none">—</span>';
  const r = matchRating(s);
  const tone = ratingTone(r, s.min);
  return `<span class="rate rate--${tone.key}${big ? ' rate--big' : ''}" title="Индекс полезности за матч: ${r} — ${tone.word}">${r.toFixed(1)}</span>`;
}

export const POS_RU = {
  PG: 'Разыгрывающий', SG: 'Атакующий защитник', SF: 'Лёгкий форвард', PF: 'Тяжёлый форвард', C: 'Центровой',
  G: 'Защитник', F: 'Форвард', 'G-F': 'Защитник-форвард', 'F-G': 'Форвард-защитник', 'F-C': 'Форвард-центровой', 'C-F': 'Центровой-форвард',
};
export const posRu = p => POS_RU[p] || p || '';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

export function fmtTime(d) {
  return new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}
export function fmtDate(d, { weekday = false, year = false } = {}) {
  const x = new Date(d);
  return `${weekday ? WD[x.getDay()] + ', ' : ''}${x.getDate()} ${MONTHS[x.getMonth()]}${year ? ' ' + x.getFullYear() : ''}`;
}
export function fmtYMD(ymd, opts) {
  // YYYYMMDD или YYYY-MM-DD → дата без сдвига часового пояса
  const s = String(ymd).replace(/-/g, '');
  return fmtDate(new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8)), opts);
}
export function ymdShift(ymd, days) {
  const s = String(ymd).replace(/-/g, '');
  const d = new Date(+s.slice(0, 4), +s.slice(4, 6) - 1, +s.slice(6, 8) + days);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
export function sameLocalDay(a, b) {
  const x = new Date(a), y = new Date(b);
  return x.toDateString() === y.toDateString();
}

const ORD = ['', '1-я', '2-я', '3-я', '4-я'];
export function periodName(p) {
  if (p <= 4) return `${ORD[p]} четверть`;
  return p === 5 ? 'овертайм' : `${p - 4}-й овертайм`;
}

export function statusText(st, date, lines = []) {
  switch (st.name) {
    case 'STATUS_HALFTIME': return 'Большой перерыв';
    case 'STATUS_END_PERIOD': return `Конец: ${periodName(st.period)}`;
    case 'STATUS_POSTPONED': return 'Матч перенесён';
    case 'STATUS_CANCELED': return 'Матч отменён';
    case 'STATUS_DELAYED': return 'Начало задерживается';
    default: break;
  }
  if (st.state === 'pre') return `Начало в ${fmtTime(date)}`;
  if (st.state === 'in') return `${periodName(st.period)}, ${st.clock}`;
  const ot = Math.max(st.period, lines.length) - 4;
  return ot > 0 ? (ot === 1 ? 'Финал, овертайм' : `Финал, ${ot} овертайма`) : 'Финал';
}

export const liveDot = '<span class="live"><span class="live__dot"></span>LIVE</span>';

export function loading(text = 'Загружаю…') {
  return `<div class="state"><div class="state__ball" aria-hidden="true"></div><p>${esc(text)}</p></div>`;
}

export function errorBox(err, retryLabel = 'Повторить') {
  const msg = err?.status === 404
    ? 'ESPN не нашёл эти данные. Возможно, матч ещё не начался или ссылка устарела.'
    : 'Не получилось загрузить данные ESPN. Проверь интернет и попробуй ещё раз.';
  return `<div class="state state--error"><p>${esc(msg)}</p><button class="btn" data-retry>${esc(retryLabel)}</button></div>`;
}

export const fix1 = v => (Math.round(v * 10) / 10).toFixed(1);
export const pctText = (a, b) => (b > 0 ? Math.round((a / b) * 100) + '%' : '—');
export const signed = v => (v > 0 ? '+' + v : String(v));
