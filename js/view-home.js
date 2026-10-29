// Главная: матчи игрового дня.
import { freshnessNote, dateControls, bindDateControls, gameDayToday } from './ui.js';
import { scoreboard } from './api.js';
import { badge, esc, statusText, fmtYMD, ymdShift, fmtDate, sameLocalDay, liveDot, loading, errorBox } from './ui.js';
import { plural } from './rating.js';

function card(ev, i = 0) {
  const { home, away, status } = ev;
  const started = status.state !== 'pre' && home.hasScore;
  const live = status.state === 'in';
  const side = (c, cls) => `
    <div class="game__team ${cls} ${status.state === 'post' && !c.winner ? 'is-lost' : ''}">
      ${badge(c.team, 'md')}
      <div class="game__name">
        <span class="game__city">${esc(c.team.city)}</span>
        <span class="game__club">${esc(c.team.name)}</span>
        ${c.record ? `<span class="game__rec">${esc(c.record)}</span>` : ''}
      </div>
    </div>`;
  // после начала — кто сколько набрал; до матча — лучший бомбардир команды в среднем за сезон
  const leaders = [away, home]
    .map(c => (c.leaders.points ? { ...c.leaders.points, note: '' } : c.leaders.pointsPerGame ? { ...c.leaders.pointsPerGame, note: ' в ср.' } : null))
    .filter(Boolean)
    .map(l => `<span>${esc(l.name)} <b>${esc(l.value)}</b>${l.note}</span>`)
    .join('');
  return `
  <a class="game${live ? ' game--live' : ''}" href="#/game/${ev.id}" style="--i:${Math.min(i, 8)};--ga:${away.team.glow};--gh:${home.team.glow}">
    ${side(away, 'game__team--away')}
    <div class="game__mid">
      ${live ? liveDot : ''}
      ${started
        ? `<div class="game__score"><span class="${away.winner ? 'is-win' : ''}">${away.score}</span><i>:</i><span class="${home.winner ? 'is-win' : ''}">${home.score}</span></div>`
        : `<div class="game__time">${new Date(ev.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>`}
      <div class="game__status">${esc(started || status.state !== 'pre' ? statusText(status, ev.date, home.lines) : 'по вашему времени')}</div>
    </div>
    ${side(home, 'game__team--home')}
    ${leaders ? `<div class="game__leaders" aria-label="Самые результативные">${leaders}</div>` : ''}
  </a>`;
}

function spotlight(events, day) {
  const live = events.find(e => e.status.state === 'in');
  const finished = events.filter(e => e.status.state === 'post');
  const close = [...finished].sort((a,b) => Math.abs(a.home.score-a.away.score)-Math.abs(b.home.score-b.away.score))[0];
  const featured = live || close || events[0];
  const scorers = finished.flatMap(e => [e.away, e.home].map(c => c.leaders.points)).filter(l => l && Number.isFinite(parseFloat(l.value)));
  const scorer = scorers.sort((a,b) => parseFloat(b.value)-parseFloat(a.value))[0];
  return `<section class="broadcast" aria-label="Главное за игровой день">
    <div class="broadcast__copy">
      <p class="eyebrow"><span></span> NBA NEON / ИГРА НА ДРУГОЙ ЧАСТОТЕ</p>
      <h1>Пока город спал.<br><em>Игра жила.</em></h1>
      <p class="broadcast__intro">Вся энергия НБА — в одном месте. Матчи, герои и цифры, за которыми стоит игра.</p>
      <div class="broadcast__actions"><a class="action-primary" href="#/index/day/${day}">Герои игрового дня <span>→</span></a><a class="action-secondary" href="#/index/season">Рейтинг сезона →</a></div>
      <div class="broadcast__stats"><div><b>${String(events.length).padStart(2,'0')}</b><span>матчей в расписании</span></div><div><b>${String(finished.length).padStart(2,'0')}</b><span>завершено</span></div><div><b>${String(events.filter(e => e.status.state === 'in').length).padStart(2,'0')}</b><span>в прямом эфире</span></div></div>
    </div>
    <div class="arena" ${featured ? `style="--arena-a:${featured.away.team.glow};--arena-b:${featured.home.team.glow}"` : ''}>
      <div class="arena__orbit" aria-hidden="true"></div><div class="arena__orbit arena__orbit--two" aria-hidden="true"></div>
      ${featured ? `<p class="arena__label">${live ? 'СЕЙЧАС НА ПЛОЩАДКЕ' : close ? 'САМЫЙ БЛИЗКИЙ СЧЁТ ДНЯ' : 'СЛЕДУЮЩИЙ В РАСПИСАНИИ'}</p>
      <a class="arena__match" href="#/game/${featured.id}">
        <span class="arena__team">${badge(featured.away.team, 'xl')}<b>${esc(featured.away.team.abbr)}</b></span>
        <span class="arena__score">${featured.status.state === 'pre' ? '<i>VS</i>' : `${featured.away.score}<i>:</i>${featured.home.score}`}</span>
        <span class="arena__team">${badge(featured.home.team, 'xl')}<b>${esc(featured.home.team.abbr)}</b></span>
        <span class="arena__names">${esc(featured.away.team.full)} · ${esc(featured.home.team.full)}</span>
        <span class="arena__status">${esc(statusText(featured.status, featured.date, featured.home.lines))}</span>
        <span class="arena__cta">Открыть матч <b>→</b></span>
      </a>` : `<p class="arena__label">ПАУЗА МЕЖДУ МАТЧАМИ</p><div class="arena__empty" aria-hidden="true">🏀</div><p>Сегодня площадка отдыхает.<br>История игры — всегда рядом.</p>`}
    </div>
    <div class="broadcast__ticker"><span>BEYOND THE SCORE</span>${scorer ? `<a href="#/player/${scorer.id}">Лидер по очкам среди завершённых матчей: <b>${esc(scorer.name)} · ${esc(scorer.value)} очк.</b> →</a>` : '<span>Каждый матч. Каждый игрок. Свой взгляд на игру.</span>'}<span class="broadcast__ticker-end">NBA / NEON</span></div>
  </section>`;
}

export async function renderHome(root, params, ctx) {
  root.innerHTML = loading('Загружаю матчи…');

  const draw = async () => {
    let data;
    try {
      data = await scoreboard(params.day || null);
    } catch (e) {
      root.innerHTML = errorBox(e);
      root.querySelector('[data-retry]')?.addEventListener('click', draw);
      return;
    }
    const day = (data.day || '').replace(/-/g, '') || params.day || gameDayToday();
    const evs = data.events;
    const liveCount = evs.filter(e => e.status.state === 'in').length;

    let sub = '';
    if (evs.length) {
      const first = evs[0].date, last = evs[evs.length - 1].date;
      const t = d => new Date(d).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
      sub = sameLocalDay(first, last)
        ? `По вашему времени: ${fmtDate(first)}, ${t(first)}–${t(last)}`
        : `По вашему времени: с ${fmtDate(first)}, ${t(first)} до ${fmtDate(last)}, ${t(last)}`;
    }

    root.innerHTML = `
      ${spotlight(evs, day)}
      <section class="day">
        <div class="schedule-heading"><h2>Расписание и результаты</h2><span>GAME CENTER</span></div>
        ${dateControls(day)}
        <header class="day__head">
          <a class="day__nav" href="#/day/${ymdShift(day, -1)}" aria-label="Предыдущий день">‹</a>
          <div class="day__text">
            <h2 class="day__title">${day ? esc(fmtYMD(day, { weekday: true })) : 'Сегодня'}</h2>
            <p class="day__sub">
              ${evs.length ? `${evs.length} ${plural(evs.length, 'матч', 'матча', 'матчей')}. ${esc(sub)}` : 'В этот игровой день матчей нет'}
            </p>
            ${liveCount ? `<p class="day__live">${liveDot} идёт ${liveCount} ${plural(liveCount, 'матч', 'матча', 'матчей')}, счёт обновляется сам</p>` : ''}
          </div>
          <a class="day__nav" href="#/day/${ymdShift(day, 1)}" aria-label="Следующий день">›</a>
        </header>
        ${evs.length
          ? `<div class="games ${ctx.isRefresh ? '' : 'games--enter'}">${evs.map(card).join('')}</div>`
          : `<div class="state"><p>Листай стрелками на соседние дни или открой <a href="#/standings">таблицу конференций</a>.</p></div>`}
        ${freshnessNote(data.freshness)}
      </section>`;

    bindDateControls(root);
    if (root.isConnected) document.title = 'NBA Neon — матчи, составы и рейтинги игроков';
    ctx.setLive(liveCount > 0 || evs.some(e => e.status.state === 'pre' && new Date(e.date) - Date.now() < 15 * 60_000));
  };

  ctx.onRefresh(draw);
  await draw();
}

