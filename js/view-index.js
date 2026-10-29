// Вкладка «Индекс»: лучшие и худшие игроки дня и рейтинг всей лиги за сезон.
import { freshnessNote, ratingGuide, dateControls, bindDateControls } from './ui.js';
import { combineFreshness, scoreboard, gameSummary, leagueSeason } from './api.js';
import { teamInfo } from './teams.js';
import { matchRating, ratingTone, breakdown, playerProfile, tierOf, ATTR_LABELS, currentSeasonYear, plural } from './rating.js';
import { badge, avatar, bindSort, esc, ratingPill, fmtYMD, ymdShift, liveDot, loading, errorBox, teamVars } from './ui.js';

function tabs(active) {
  return `
    <header class="page-head">
      <h1 class="page-title">Индекс полезности</h1>
      <nav class="seg" aria-label="Режим">
        <a href="#/index" class="${active === 'day' ? 'is-active' : ''}">Лучшие за день</a>
        <a href="#/index/season" class="${active === 'season' ? 'is-active' : ''}">Рейтинг сезона</a>
      </nav>
    </header>`;
}

// ---------- за день ----------

async function collectDay(day) {
  let sb = await scoreboard(day || null);
  let shown = day || (sb.day || '').replace(/-/g, '');
  let started = sb.events.filter(e => e.status.state !== 'pre');
  // днём по Москве у ESPN уже «новый» день без сыгранных матчей — показываем прошедшую ночь
  if (!day && !started.length && shown) {
    shown = ymdShift(shown, -1);
    sb = await scoreboard(shown);
    started = sb.events.filter(e => e.status.state !== 'pre');
  }
  const games = (await Promise.allSettled(started.map(e => gameSummary(e.id, e.status.state === 'in'))))
    .filter(r => r.status === 'fulfilled').map(r => r.value);
  const rows = [];
  for (const g of games) {
    for (const side of ['away', 'home']) {
      const t = g[side].team;
      const opp = g[side === 'away' ? 'home' : 'away'].team;
      for (const p of g.players[t.id] || []) {
        if (p.dnp) continue;
        rows.push({ p, t: teamInfo({ id: t.id }), opp, g, r: matchRating(p.s), b: breakdown(p.s), live: g.status.state === 'in' });
      }
    }
  }
  return { freshness: combineFreshness([sb.freshness, ...games.map(g => g.freshness)], games.length < started.length), day: (sb.day || '').replace(/-/g, '') || shown, rows, games, live: games.some(g => g.status.state === 'in'), total: sb.events.length };
}

const href = row => `#/player/${row.p.id}?game=${row.g.id}&team=${row.t.id}`;

function bigCard(row, i, kind) {
  const { p, t, r } = row;
  const tone = ratingTone(r, p.s.min);
  return `
    <a class="icard icard--${kind}${i === 0 ? ' icard--first' : ''}" href="${href(row)}" style="${teamVars(t)}">
      ${kind === 'top' ? `<span class="icard__place">${i + 1}</span>` : ''}
      ${avatar(p, t, 'lg')}
      <span class="icard__body">
        <span class="icard__name">${esc(p.name)}</span>
        <span class="icard__team">${badge(t, 'xs', { orbit: false })} ${esc(t.name)} против ${esc(row.opp.name)}${row.live ? ' ' + liveDot : ''}</span>
        <span class="icard__line">${p.s.pts} очк., ${p.s.reb} подб., ${p.s.ast} перед., ${p.s.tov} пот., ${Math.round(p.s.min)} мин</span>
      </span>
      <span class="icard__rate">${ratingPill(p.s, { big: true })}<small>${tone.word}</small></span>
    </a>`;
}

function miniParts(b) {
  // крошечная полоска: из чего сложился индекс
  const keys = [['scoring', 'Атака'], ['passing', 'Пас'], ['rebounding', 'Подбор'], ['defense', 'Защита'], ['mistakes', 'Ошибки']];
  const sum = keys.reduce((a, [k]) => a + Math.abs(b[k]), 0) || 1;
  return `<span class="mini" title="${keys.map(([k, l]) => `${l}: ${b[k] > 0 ? '+' : ''}${b[k].toFixed(1)}`).join(', ')}">${keys.map(([k]) => `<i class="mini__${k}" style="flex-grow:${(Math.abs(b[k]) / sum).toFixed(3)}"></i>`).join('')}</span>`;
}

function dayTable(rows) {
  return `
    <div class="box__scroll">
      <table class="box__table idx-table" data-sortable>
        <thead><tr>
          <th scope="col" data-key="rank" tabindex="0">#</th>
          <th scope="col">Игрок</th>
          <th scope="col" data-key="min" tabindex="0" class="opt">Мин</th>
          <th scope="col" data-key="pts" tabindex="0">Очк</th>
          <th scope="col" data-key="reb" tabindex="0">Под</th>
          <th scope="col" data-key="ast" tabindex="0">Пер</th>
          <th scope="col" data-key="tov" tabindex="0" class="opt">Пот</th>
          <th scope="col" class="opt">Вклад</th>
          <th scope="col" data-key="ip" tabindex="0" aria-sort="descending">ИП</th>
        </tr></thead>
        <tbody>${rows.map((row, i) => `
          <tr data-rank="${i + 1}" data-min="${row.p.s.min}" data-pts="${row.p.s.pts}" data-reb="${row.p.s.reb}" data-ast="${row.p.s.ast}" data-tov="${row.p.s.tov}" data-ip="${row.r}" style="${teamVars(row.t)}">
            <td class="idx-rank">${i + 1}</td>
            <th scope="row"><a class="idx-player" href="${href(row)}">${avatar(row.p, row.t, 'xs')}<span>${esc(row.p.short)}<small>${esc(row.t.abbr)}${row.p.starter ? '' : ', скамейка'}</small></span></a></th>
            <td class="opt">${Math.round(row.p.s.min)}</td>
            <td>${row.p.s.pts}</td><td>${row.p.s.reb}</td><td>${row.p.s.ast}</td>
            <td class="opt">${row.p.s.tov}</td>
            <td class="opt">${miniParts(row.b)}</td>
            <td>${ratingPill(row.p.s)}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

async function renderDay(root, params, ctx) {
  root.innerHTML = tabs('day') + loading('Считаю индекс по всем матчам дня…');
  const draw = async () => {
    let data;
    try { data = await collectDay(params.day); } catch (e) {
      root.innerHTML = tabs('day') + errorBox(e);
      root.querySelector('[data-retry]')?.addEventListener('click', draw);
      return;
    }
    const day = data.day;
    const ok = data.rows.filter(x => x.p.s.min >= 8).sort((a, b) => b.r - a.r || b.b.total - a.b.total);
    const top = ok.slice(0, 3);
    const flops = data.rows.filter(x => x.p.s.min >= 20).sort((a, b) => a.r - b.r).slice(0, 3);
    const keepScroll = window.scrollY;

    root.innerHTML = `
      ${tabs('day')}
      ${ratingGuide()}
      ${dateControls(day, '#/index/day/')}
      <section class="day day--compact">
        <header class="day__head">
          <a class="day__nav" href="#/index/day/${ymdShift(day, -1)}" aria-label="Предыдущий день">‹</a>
          <div class="day__text">
            <h2 class="day__title day__title--sm">${esc(fmtYMD(day, { weekday: true }))}</h2>
            <p class="day__sub">${data.games.length ? `${data.games.length} ${plural(data.games.length, 'матч', 'матча', 'матчей')}, ${ok.length} ${plural(ok.length, 'игрок', 'игрока', 'игроков')} с 8+ минутами` : 'В этот день матчи ещё не начинались'}</p>
            ${data.live ? `<p class="day__live">${liveDot} есть матчи в прямом эфире — индекс обновляется сам</p>` : ''}
          </div>
          <a class="day__nav" href="#/index/day/${ymdShift(day, 1)}" aria-label="Следующий день">›</a>
        </header>
      </section>
      ${ok.length ? `
      <section class="panel">
        <h2 class="panel__title">Лучшие за день</h2>
        <div class="icards">${top.map((row, i) => bigCard(row, i, 'top')).join('')}</div>
      </section>
      ${flops.length ? `
      <section class="panel">
        <h2 class="panel__title">Провалы дня</h2>
        <p class="hint hint--top">Самые низкие оценки среди тех, кто провёл на площадке 20+ минут.</p>
        <div class="icards icards--flop">${flops.map((row, i) => bigCard(row, i, 'flop')).join('')}</div>
      </section>` : ''}
      <section class="panel">
        <h2 class="panel__title">Все игроки дня</h2>
        <p class="hint hint--top">Полоска «Вклад» показывает, из чего сложился индекс: <span class="lg-dot mini__scoring"></span>атака <span class="lg-dot mini__passing"></span>пас <span class="lg-dot mini__rebounding"></span>подбор <span class="lg-dot mini__defense"></span>защита <span class="lg-dot mini__mistakes"></span>ошибки. Заголовки столбцов сортируют таблицу.</p>
        ${dayTable(ok)}
      </section>` : `<div class="state"><p>Индекс появится, когда начнутся матчи. Листай на прошедшие дни стрелкой влево.</p></div>`}
      ${freshnessNote(data.freshness)}`;
    bindSort(root);
    bindDateControls(root);
    if (ctx.isRefresh && root.isConnected) window.scrollTo(0, keepScroll);
    if (root.isConnected) document.title = 'Индекс дня — NBA Neon';
    ctx.setLive(data.live);
  };
  ctx.onRefresh(draw);
  await draw();
}

// ---------- сезон ----------

const POS_GROUPS = [
  ['all', 'Все', () => true],
  ['g', 'Защитники', p => /^G/.test(p)],
  ['f', 'Форварды', p => /^F/.test(p)],
  ['c', 'Центровые', p => /^C/.test(p)],
];
const SORTS = [
  ['ovr', 'Рейтинг'],
  ['pot', 'Потенциал'],
  ['grow', 'Рост'],
  ...ATTR_LABELS.map(([k, short]) => [k, short]),
];

const state = { pos: 'all', sort: 'ovr', shown: 30 };

function seasonRow(x, i) {
  const t = teamInfo({ id: x.teamId });
  const tier = tierOf(x.prof.ovr);
  const d = x.prof.delta;
  return `
    <a class="srow srow--${tier.key}" href="#/player/${x.id}?team=${t.id}" style="${teamVars(t)}">
      <span class="srow__rank">${i + 1}</span>
      ${avatar({ id: x.id, jersey: '', name: x.name }, t, 'sm')}
      <span class="srow__who">
        <b>${esc(x.name)}</b>
        <small>${esc(t.abbr)}, ${esc(x.pos)}${x.age ? `, ${x.age} ${plural(x.age, 'год', 'года', 'лет')}` : ''}, ${x.gp} ${plural(x.gp, 'игра', 'игры', 'игр')}</small>
      </span>
      <span class="srow__attrs">${ATTR_LABELS.map(([k, short]) => `<span class="${state.sort === k ? 'is-on' : ''}"><b>${x.prof.attrs[k]}</b>${short}</span>`).join('')}</span>
      <span class="srow__pot${state.sort === 'pot' ? ' is-on' : ''}"><b>${x.prof.pot}</b>потенц.</span>
      <span class="srow__grow ${d > 0 ? 'trend--up' : d < 0 ? 'trend--down' : ''}${state.sort === 'grow' ? ' is-on' : ''}">${d == null ? 'новичок' : d > 0 ? `▲ +${d}` : d < 0 ? `▼ ${d}` : '='}</span>
      <span class="srow__ovr"><b>${x.prof.ovr}</b><small>${esc(tier.name)}</small></span>
    </a>`;
}

async function renderSeason(root, params, ctx) {
  root.innerHTML = tabs('season') + loading('Загружаю статистику всей лиги…');
  let data;
  try { data = await leagueSeason(currentSeasonYear()); } catch (e) {
    root.innerHTML = tabs('season') + errorBox(e);
    root.querySelector('[data-retry]')?.addEventListener('click', () => renderSeason(root, params, ctx));
    return;
  }
  const all = data.players
    .filter(x => x.cur.gp >= 2 && x.cur.min >= 10)
    .map(x => {
      const seasons = [x.prev, x.cur].filter(Boolean).map(s => ({ ...s, label: s.year === data.year ? data.season : '' }));
      return { ...x.cur, prof: playerProfile(seasons, x.cur.age, data.year) };
    })
    .filter(x => x.prof);

  const drawList = () => {
    const grp = POS_GROUPS.find(g => g[0] === state.pos);
    const key = state.sort;
    const val = x => key === 'ovr' ? x.prof.ovr : key === 'pot' ? x.prof.pot : key === 'grow' ? (x.prof.delta ?? -99) : x.prof.attrs[key];
    const list = all.filter(x => grp[2](x.pos)).sort((a, b) => val(b) - val(a) || b.prof.ovr - a.prof.ovr);
    root.querySelector('.slist').innerHTML = list.slice(0, state.shown).map(seasonRow).join('');
    const more = root.querySelector('[data-more]');
    more.hidden = list.length <= state.shown;
    more.textContent = `Показать ещё (${list.length - state.shown})`;
    root.querySelectorAll('[data-pos]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.pos === state.pos)));
    root.querySelectorAll('[data-sort]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
  };

  root.innerHTML = `
    ${tabs('season')}
    ${ratingGuide()}
    ${freshnessNote(data.freshness)}
    <section class="panel">
      <h2 class="panel__title">Рейтинг сезона ${esc(data.season)}</h2>
      <p class="hint hint--top">Рейтинг и атрибуты по средним за сезон, в начале сезона с учётом прошлого. В списке ${all.length} ${plural(all.length, 'игрок', 'игрока', 'игроков')}: 2+ матча и 10+ минут в среднем.</p>
      <div class="chips" role="group" aria-label="Позиция">${POS_GROUPS.map(([k, l]) => `<button class="chip-btn" data-pos="${k}">${l}</button>`).join('')}</div>
      <div class="chips" role="group" aria-label="Сортировка">${SORTS.map(([k, l]) => `<button class="chip-btn chip-btn--sort" data-sort="${k}">${l}</button>`).join('')}</div>
      <div class="slist"></div>
      <button class="btn btn--wide" data-more>Показать ещё</button>
    </section>`;
  root.querySelectorAll('[data-pos]').forEach(b => b.addEventListener('click', () => { state.pos = b.dataset.pos; state.shown = 30; drawList(); }));
  root.querySelectorAll('[data-sort]').forEach(b => b.addEventListener('click', () => { state.sort = b.dataset.sort; state.shown = 30; drawList(); }));
  root.querySelector('[data-more]').addEventListener('click', () => { state.shown += 30; drawList(); });
  drawList();
  if (root.isConnected) document.title = 'Рейтинг сезона — NBA Neon';
}

export async function renderIndex(root, params, ctx) {
  if (params.mode === 'season') return renderSeason(root, params, ctx);
  return renderDay(root, params, ctx);
}

