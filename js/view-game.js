// Страница матча: счёт, площадка со стартовыми пятёрками, скамейка, лучшие, бокс-скор.
import { gameSummary } from './api.js';
import { matchRating, ratingTone, gameScore, plural } from './rating.js';
import { badge, esc, ratingPill, statusText, fmtDate, fmtTime, liveDot, loading, errorBox, periodName, teamVars, pctText, signed } from './ui.js';

// ---------- площадка ----------

const POS_RANK = { C: 0, 'C-F': 0, 'F-C': 1, PF: 1, F: 2, SF: 2, 'G-F': 3, 'F-G': 3, SG: 3, G: 4, PG: 4 };
// места на левой половине (x, y в %): центровой у кольца, разыгрывающий ближе к центру
const SLOTS = [[12, 50], [21, 21], [23, 79], [36, 30], [41, 68]];

function courtLines() {
  // площадка 94×50 футов → 940×500
  const half = side => {
    const m = x => (side === 'L' ? x : 940 - x);
    const bx = m(52.5);
    const arcX = m(142);
    const sweep = side === 'L' ? 1 : 0;
    return `
      <rect x="${side === 'L' ? 0 : 750}" y="170" width="190" height="160" class="court__paint court__paint--${side}"/>
      <circle cx="${m(190)}" cy="250" r="60" class="court__ln"/>
      <path class="court__ln" d="M ${m(0)} 30 L ${arcX} 30 A 237.5 237.5 0 0 ${sweep} ${arcX} 470 L ${m(0)} 470"/>
      <path class="court__ln" d="M ${m(52.5)} 210 A 40 40 0 0 ${sweep} ${m(52.5)} 290"/>
      <line x1="${m(40)}" y1="220" x2="${m(40)}" y2="280" class="court__ln court__ln--board"/>
      <circle cx="${bx}" cy="250" r="7.5" class="court__rim"/>`;
  };
  return `
    <rect x="0" y="0" width="470" height="500" class="court__half court__half--away"/>
    <rect x="470" y="0" width="470" height="500" class="court__half court__half--home"/>
    <rect x="1" y="1" width="938" height="498" class="court__ln" rx="6"/>
    <line x1="470" y1="0" x2="470" y2="500" class="court__ln"/>
    <circle cx="470" cy="250" r="60" class="court__ln"/>
    <circle cx="470" cy="250" r="20" class="court__ln"/>
    ${half('L')}${half('R')}`;
}

function courtSVG() {
  const lines = courtLines();
  return `
    <svg class="court__svg court__svg--land" viewBox="0 0 940 500" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>
    <svg class="court__svg court__svg--port" viewBox="0 0 500 940" preserveAspectRatio="none" aria-hidden="true">
      <g transform="matrix(0 1 1 0 0 0)">${lines}</g>
    </svg>`;
}

const surname = p => {
  const parts = p.name.split(' ');
  const last = parts.slice(1).join(' ') || p.name;
  return last.replace(/ (Jr\.|Sr\.|II|III|IV)$/, '');
};

const playerHref = (p, g, t) => `#/player/${p.id}?game=${g.id}&team=${t.id}`;

function chip(p, g, t, slot, side) {
  const [x, y] = slot;
  const lx = side === 'away' ? x : 100 - x;
  const py = side === 'away' ? x : 100 - x;
  const s = p.s;
  return `
    <a class="chip" href="${playerHref(p, g, t)}" style="--x:${lx}%;--y:${y}%;--px:${y}%;--py:${py}%;${teamVars(t)}">
      <span class="chip__num">${esc(p.jersey)}</span>
      ${s ? `<span class="chip__rate">${ratingPill(s)}</span>` : ''}
      <span class="chip__name">${esc(surname(p))}</span>
      ${s ? `<span class="chip__line">${s.pts}/${s.reb}/${s.ast}</span>` : ''}
    </a>`;
}

function court(g) {
  const sides = [['away', g.away.team], ['home', g.home.team]];
  const chips = sides.map(([side, t]) => {
    const starters = (g.players[t.id] || []).filter(p => p.starter).slice(0, 5);
    starters.sort((a, b) => (POS_RANK[a.pos] ?? 2) - (POS_RANK[b.pos] ?? 2));
    return starters.map((p, i) => chip(p, g, t, SLOTS[i], side)).join('');
  }).join('');
  return `
    <section class="panel">
      <h2 class="panel__title">Стартовые пятёрки</h2>
      <div class="court" style="--ga:${g.away.team.glow};--gh:${g.home.team.glow}">
        ${courtSVG()}
        ${chips}
      </div>
      <p class="hint">Под фамилией: очки/подборы/передачи. Цветная плашка — индекс полезности за матч из 10. Нажми на игрока, чтобы открыть его карточку.</p>
    </section>`;
}

// ---------- скамейка ----------

function reasonRu(r) {
  const s = String(r || '').toUpperCase();
  if (!s) return 'не выходил';
  if (s.includes('COACH')) return 'решение тренера';
  if (s.includes('REST')) return 'отдых';
  if (s.includes('ILLNESS')) return 'болезнь';
  if (s.includes('PERSONAL')) return 'личные причины';
  if (s.includes('SUSPEN')) return 'дисквалификация';
  if (s.includes('LEAGUE') || s.includes('ASSIGN')) return 'в G-Лиге';
  if (/INJUR|SORE|STRAIN|SPRAIN|ANKLE|KNEE|HAMSTRING|FOOT|BACK|HIP|CALF|WRIST|SHOULDER|GROIN|CONCUSS|ACHILLES|TOE|HAND|FINGER|SURGERY|FRACTURE|TEAR/.test(s)) return 'травма';
  return 'не выходил';
}

function bench(g, t) {
  const list = (g.players[t.id] || []).filter(p => !p.starter);
  if (!list.length) return '';
  const rows = list.map(p => p.dnp
    ? `<li class="bench__row is-dnp" title="${esc(p.reason)}">
         <span class="bench__num">${esc(p.jersey)}</span>
         <span class="bench__name">${esc(p.name)}</span>
         <span class="bench__dnp">${esc(reasonRu(p.reason))}</span>
       </li>`
    : `<li><a class="bench__row" href="${playerHref(p, g, t)}">
         <span class="bench__num">${esc(p.jersey)}</span>
         <span class="bench__name">${esc(p.name)}<small>${Math.round(p.s.min)} мин</small></span>
         <span class="bench__line">${p.s.pts}/${p.s.reb}/${p.s.ast}</span>
         ${ratingPill(p.s)}
       </a></li>`).join('');
  return `
    <div class="bench" style="${teamVars(t)}">
      <h3 class="bench__title">${badge(t, 'sm', { orbit: false })} Скамейка: ${esc(t.name)}</h3>
      <ul class="bench__list">${rows}</ul>
    </div>`;
}

// ---------- лучшие ----------

function best(g) {
  const all = [];
  for (const side of ['away', 'home']) {
    const t = g[side].team;
    for (const p of g.players[t.id] || []) if (!p.dnp && p.s.min >= 8) all.push({ p, t, r: matchRating(p.s), gs: gameScore(p.s) });
  }
  all.sort((a, b) => b.r - a.r || b.gs - a.gs);
  const top = all.slice(0, 3);
  if (!top.length) return '';
  const done = g.status.state === 'post';
  return `
    <section class="panel">
      <h2 class="panel__title">${done ? 'Лучшие в матче' : 'Лучшие по ходу матча'}</h2>
      <div class="podium">
        ${top.map(({ p, t, r }, i) => `
          <a class="podium__item${i === 0 ? ' podium__item--mvp' : ''}" href="${playerHref(p, g, t)}" style="${teamVars(t)}">
            ${i === 0 ? `<span class="podium__crown">${done ? 'MVP матча' : 'Лидер матча'}</span>` : ''}
            ${ratingPill(p.s, { big: true })}
            <span class="podium__name">${esc(p.name)}</span>
            <span class="podium__team">${badge(t, 'xs', { orbit: false })} ${esc(t.name)}</span>
            <span class="podium__line">${p.s.pts} очк., ${p.s.reb} подб., ${p.s.ast} перед.</span>
            <span class="podium__word">${ratingTone(r, p.s.min).word}</span>
          </a>`).join('')}
      </div>
    </section>`;
}

// ---------- сравнение команд ----------

const COMPARE = [
  ['fieldGoalPct', 'Попадания с игры', '%'],
  ['threePointFieldGoalPct', 'Трёхочковые', '%'],
  ['freeThrowPct', 'Штрафные', '%'],
  ['totalRebounds', 'Подборы'],
  ['offensiveRebounds', 'Подборы в нападении'],
  ['assists', 'Передачи'],
  ['steals', 'Перехваты'],
  ['blocks', 'Блок-шоты'],
  ['turnovers', 'Потери', '', true],
  ['pointsInPaint', 'Очки из краски'],
  ['fastBreakPoints', 'Очки с быстрого отрыва'],
  ['largestLead', 'Наибольший отрыв'],
];

function compare(g) {
  const A = g.teamStats[g.away.team.id] || {}, H = g.teamStats[g.home.team.id] || {};
  const rows = COMPARE.filter(([k]) => A[k] != null && H[k] != null).map(([k, label, unit = '', lowerBetter]) => {
    const a = parseFloat(A[k]) || 0, h = parseFloat(H[k]) || 0;
    const max = Math.max(a, h, 1);
    const aBetter = lowerBetter ? a < h : a > h;
    const hBetter = lowerBetter ? h < a : h > a;
    return `
      <div class="cmp__row">
        <span class="cmp__val ${aBetter ? 'is-better' : ''}">${a}${unit}</span>
        <span class="cmp__bar cmp__bar--away"><i style="width:${(a / max) * 100}%"></i></span>
        <span class="cmp__label">${label}</span>
        <span class="cmp__bar cmp__bar--home"><i style="width:${(h / max) * 100}%"></i></span>
        <span class="cmp__val ${hBetter ? 'is-better' : ''}">${h}${unit}</span>
      </div>`;
  }).join('');
  if (!rows) return '';
  return `
    <section class="panel">
      <h2 class="panel__title">Команды в цифрах</h2>
      <div class="cmp" style="--ga:${g.away.team.glow};--gh:${g.home.team.glow}">
        <div class="cmp__head">${badge(g.away.team, 'xs', { orbit: false })}<span></span>${badge(g.home.team, 'xs', { orbit: false })}</div>
        ${rows}
      </div>
    </section>`;
}

// ---------- бокс-скор ----------

const COLS = [
  ['min', 'Мин', s => Math.round(s.min)],
  ['pts', 'Очк', s => s.pts],
  ['reb', 'Под', s => s.reb],
  ['ast', 'Пер', s => s.ast],
  ['stl', 'Пх', s => s.stl],
  ['blk', 'Бш', s => s.blk],
  ['tov', 'Пот', s => s.tov],
  ['pf', 'Фол', s => s.pf],
  ['fg', 'С игры', s => `${s.fgm}-${s.fga}`, s => s.fga ? s.fgm / s.fga : -1],
  ['tp', '3-очк', s => `${s.tpm}-${s.tpa}`, s => s.tpa ? s.tpm / s.tpa : -1],
  ['ft', 'Штр', s => `${s.ftm}-${s.fta}`, s => s.fta ? s.ftm / s.fta : -1],
  ['pm', '+/−', s => signed(s.pm)],
];

function boxTable(g, t) {
  const list = (g.players[t.id] || []).filter(p => !p.dnp);
  if (!list.length) return '';
  const rows = list.map((p, i) => `
    <tr data-i="${i}" ${COLS.map(([k, , , sortFn]) => `data-${k}="${sortFn ? sortFn(p.s) : p.s[k]}"`).join(' ')} data-ip="${matchRating(p.s)}">
      <th scope="row"><a href="${playerHref(p, g, t)}"><span class="box__num">${esc(p.jersey)}</span>${esc(p.short)}${p.starter ? '<em>старт</em>' : ''}</a></th>
      ${COLS.map(([, , fmt]) => `<td>${fmt(p.s)}</td>`).join('')}
      <td>${ratingPill(p.s)}</td>
    </tr>`).join('');
  const tot = list.reduce((acc, p) => { for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta']) acc[k] = (acc[k] || 0) + p.s[k]; return acc; }, {});
  return `
    <div class="box" style="${teamVars(t)}">
      <h3 class="box__title">${badge(t, 'sm', { orbit: false })} ${esc(t.full)}</h3>
      <div class="box__scroll">
        <table class="box__table" data-sortable>
          <thead><tr>
            <th scope="col" data-key="i">Игрок</th>
            ${COLS.map(([k, label]) => `<th scope="col" data-key="${k}" tabindex="0">${label}</th>`).join('')}
            <th scope="col" data-key="ip" tabindex="0" title="Индекс полезности за матч">ИП</th>
          </tr></thead>
          <tbody>${rows}</tbody>
          <tfoot><tr>
            <th scope="row">Команда</th><td></td><td>${tot.pts}</td><td>${tot.reb}</td><td>${tot.ast}</td><td>${tot.stl}</td><td>${tot.blk}</td><td>${tot.tov}</td><td>${tot.pf}</td>
            <td>${tot.fgm}-${tot.fga}<small>${pctText(tot.fgm, tot.fga)}</small></td>
            <td>${tot.tpm}-${tot.tpa}<small>${pctText(tot.tpm, tot.tpa)}</small></td>
            <td>${tot.ftm}-${tot.fta}<small>${pctText(tot.ftm, tot.fta)}</small></td><td></td><td></td>
          </tr></tfoot>
        </table>
      </div>
    </div>`;
}

function bindSort(root) {
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

// ---------- шапка ----------

function linescore(g) {
  const a = g.away.lines, h = g.home.lines;
  const n = Math.max(a.length, h.length);
  if (!n) return '';
  const head = Array.from({ length: n }, (_, i) => `<th scope="col">${i < 4 ? i + 1 : 'ОТ' + (n > 5 ? i - 3 : '')}</th>`).join('');
  const row = (c, arr) => `<tr><th scope="row">${esc(c.team.abbr)}</th>${Array.from({ length: n }, (_, i) => `<td>${arr[i] ?? ''}</td>`).join('')}<td class="ls__total">${c.score ?? ''}</td></tr>`;
  return `
    <table class="ls" aria-label="Счёт по четвертям">
      <thead><tr><th></th>${head}<th scope="col">Итог</th></tr></thead>
      <tbody>${row(g.away, a)}${row(g.home, h)}</tbody>
    </table>`;
}

function hero(g) {
  const { away, home, status } = g;
  const started = status.state !== 'pre' && home.hasScore;
  const side = (c, cls) => `
    <div class="hero__team ${cls} ${status.state === 'post' && !c.winner ? 'is-lost' : ''}">
      ${badge(c.team, 'xl', { link: true })}
      <a class="hero__name" href="#/team/${c.team.id}"><span>${esc(c.team.city)}</span>${esc(c.team.name)}</a>
      ${c.record ? `<span class="hero__rec">${esc(c.record)}</span>` : ''}
    </div>`;
  return `
    <section class="hero" style="--ga:${away.team.glow};--gh:${home.team.glow}">
      ${side(away, 'hero__team--away')}
      <div class="hero__mid">
        ${status.state === 'in' ? liveDot : ''}
        ${started
          ? `<div class="hero__score"><span class="${away.winner ? 'is-win' : ''}">${away.score}</span><i>:</i><span class="${home.winner ? 'is-win' : ''}">${home.score}</span></div>`
          : `<div class="hero__time">${fmtTime(g.date)}</div>`}
        <div class="hero__status">${esc(statusText(status, g.date, home.lines))}</div>
        <div class="hero__meta">${esc(fmtDate(g.date, { weekday: true }))}${g.venue ? `<br>${esc(g.venue)}${g.city ? ', ' + esc(g.city) : ''}` : ''}${g.attendance ? `<br>${g.attendance.toLocaleString('ru-RU')} зрителей` : ''}</div>
      </div>
      ${side(home, 'hero__team--home')}
    </section>
    ${started ? `<div class="panel panel--tight">${linescore(g)}</div>` : ''}`;
}

export async function renderGame(root, params, ctx) {
  root.innerHTML = loading('Загружаю матч…');
  const draw = async () => {
    let g;
    try {
      g = await gameSummary(params.id, true);
    } catch (e) {
      root.innerHTML = errorBox(e);
      root.querySelector('[data-retry]')?.addEventListener('click', draw);
      return;
    }
    const keepScroll = window.scrollY;
    const body = g.hasBox
      ? `${court(g)}
         <section class="panel">
           <h2 class="panel__title">Скамейка</h2>
           <div class="benches">${bench(g, g.away.team)}${bench(g, g.home.team)}</div>
         </section>
         ${best(g)}
         ${compare(g)}
         <section class="panel">
           <h2 class="panel__title">Полная статистика</h2>
           <p class="hint">Нажми на заголовок столбца, чтобы отсортировать.</p>
           ${boxTable(g, g.away.team)}${boxTable(g, g.home.team)}
         </section>`
      : `<section class="panel"><div class="state"><p>Составы и статистика появятся, когда матч начнётся. ${g.status.state === 'pre' ? `Начало в ${esc(fmtTime(g.date))} по вашему времени.` : ''}</p>
           <p><a class="btn" href="#/team/${g.away.team.id}">${esc(g.away.team.name)}: состав</a> <a class="btn" href="#/team/${g.home.team.id}">${esc(g.home.team.name)}: состав</a></p></div></section>`;

    root.innerHTML = `
      <a class="back" href="#/day/${new Date(new Date(g.date).getTime() - 5 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '')}">‹ Все матчи дня</a>
      ${hero(g)}
      ${body}
      <p class="updated">${g.status.state === 'in' ? 'Матч идёт — страница обновляется сама каждые 20 секунд. ' : ''}Обновлено в ${new Date().toLocaleTimeString('ru-RU')}</p>`;
    bindSort(root);
    if (ctx.isRefresh) window.scrollTo(0, keepScroll);
    document.title = `${g.away.team.abbr} ${g.away.score ?? ''}:${g.home.score ?? ''} ${g.home.team.abbr} — NBA Neon`;
    ctx.setLive(g.status.state === 'in' || (g.status.state === 'pre' && new Date(g.date) - Date.now() < 15 * 60_000));
  };
  ctx.onRefresh(draw);
  await draw();
}

export { periodName, plural };
