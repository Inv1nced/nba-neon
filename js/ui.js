// Общие кусочки интерфейса: значки команд, оценки, форматирование.
import { matchRating, ratingTone } from './rating.js';
import { teamEmblem, playerAvatar } from './avatar.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const teamVars = t => `--c1:${t.c1};--c2:${t.c2};--glow:${t.glow}`;

// Значок команды — вытянутый шестиугольник в цветах клуба со своим узором.
// Официальные логотипы не используем: это оригинальный значок по аббревиатуре.
export function badge(t, size = 'md', { orbit = true, link = false } = {}) {
  const anim = orbit && !['xs', 'sm'].includes(size);
  const inner = `
    <span class="badge badge--${size}${anim ? ' badge--anim' : ''}" style="${teamVars(t)}" aria-hidden="true">
      <span class="badge__body">
        <span class="badge__ring"></span>
        <span class="badge__core">${teamEmblem(t)}</span>
      </span>
    </span>`;
  return link ? `<a class="badge-link" href="#/team/${t.id}" aria-label="${esc(t.full)}">${inner}</a>` : inner;
}

// Аватарка игрока: шестиугольник с силуэтом, номером и узором по id игрока.
export function avatar(p, t, size = 'md') {
  return `<span class="pav pav--${size}" style="${teamVars(t)}" aria-hidden="true">${playerAvatar({ id: p.id, label: p.jersey !== '' && p.jersey != null ? p.jersey : initials(p.name), team: t })}</span>`;
}

export function initials(name = '') {
  const parts = String(name).replace(/ (Jr\.|Sr\.|II|III|IV)$/, '').split(' ').filter(Boolean);
  return ((parts[0]?.[0] || '') + (parts[parts.length - 1]?.[0] || '')).toUpperCase();
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

// Сортировка таблиц по клику на заголовок (значения берутся из data-атрибутов строк)
export function bindSort(root) {
  root.querySelectorAll('table[data-sortable]').forEach(table => {
    const tbody = table.tBodies[0];
    let current = null, dir = -1;
    const sortBy = th => {
      const key = th.dataset.key;
      dir = current === key ? -dir : (key === 'i' ? 1 : -1);
      current = key;
      const rows = [...tbody.rows];
      rows.sort((a, b) => (parseFloat(a.dataset[key]) - parseFloat(b.dataset[key])) * dir);
      rows.forEach(r => tbody.appendChild(r));
      table.querySelectorAll('th[data-key]').forEach(h => h.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');
    };
    table.querySelectorAll('thead th[data-key]').forEach(th => {
      th.addEventListener('click', () => sortBy(th));
      th.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(th); } });
    });
  });
}


// Время получения данных сохраняется при чтении кэша и сетевых ошибках.
export function freshnessNote(meta) {
  const stamp = meta?.fetchedAt ? new Date(meta.fetchedAt).toLocaleString('ru-RU') : 'неизвестно';
  return `<p class="updated ${meta?.stale ? 'updated--stale' : ''}" role="status">${meta?.stale ? 'Обновление недоступно. Данные могут быть устаревшими или неполными. ' : ''}Данные ESPN получены: ${esc(stamp)}</p>`;
}
export function ratingGuide(prof = null) {
  return `<details class="rating-guide"><summary>Как читать рейтинг и потенциал</summary>
    <div><p><b>Авторская модель NBA Neon.</b> Оценка за матч — из 10, сезонный рейтинг — от 40 до 99. Это разные шкалы; они не являются официальными рейтингами НБА или NBA 2K.</p>
    ${prof ? `<p><b>Основа оценки:</b> ${esc(prof.basis)}. ${prof.cur ? `Сыграно в текущем сезоне: ${prof.cur.gp}.` : ''}</p>` : ''}
    <p>Рейтинг учитывает результативность и другие показатели протокола. В начале сезона он смешивается с прошлым сезоном, у новичков — с условным уровнем новичка. Мало матчей — оценка ещё может заметно измениться.</p>
    <p><b>Потенциал — условная оценка:</b> рейтинг плюс прибавка за возраст и рост показателей. Это не прогноз будущей карьеры. Защита без перехватов и блоков, роль в команде и контекст матча отражаются лишь частично.</p>
    <a href="#/about">Формулы и шкалы →</a></div></details>`;
}
export function gameDayToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()).replace(/-/g, '');
}
export function dateControls(day, prefix = '#/day/') {
  const today = gameDayToday();
  const val = /^\d{8}$/.test(day || '') ? `${day.slice(0,4)}-${day.slice(4,6)}-${day.slice(6)}` : '';
  return `<div class="date-controls"><a href="${prefix}${today}" ${day === today ? 'aria-current="date"' : ''}>Сегодня</a><a href="${prefix}${ymdShift(today, -1)}">Вчера</a><label>Выбрать дату <input type="date" aria-label="Игровой день" value="${val}" data-date-prefix="${prefix}" min="1946-01-01" max="2100-12-31"></label><span>Игровой день · Нью-Йорк</span></div>`;
}
export function bindDateControls(root) {
  root.querySelectorAll('[data-date-prefix]').forEach(input => input.addEventListener('change', () => {
    if (input.value && input.validity.valid) location.hash = input.dataset.datePrefix + input.value.replace(/-/g, '');
  }));
}
