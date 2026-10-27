// Главная: матчи игрового дня.
import { scoreboard } from './api.js';
import { badge, esc, statusText, fmtYMD, ymdShift, fmtDate, sameLocalDay, liveDot, loading, errorBox } from './ui.js';
import { plural } from './rating.js';

function card(ev) {
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
  <a class="game${live ? ' game--live' : ''}" href="#/game/${ev.id}" style="--ga:${away.team.glow};--gh:${home.team.glow}">
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
    const day = (data.day || '').replace(/-/g, '') || params.day;
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
      <section class="day">
        <header class="day__head">
          <a class="day__nav" href="#/day/${ymdShift(day, -1)}" aria-label="Предыдущий день">‹</a>
          <div class="day__text">
            <h1 class="day__title">${day ? esc(fmtYMD(day, { weekday: true })) : 'Сегодня'}</h1>
            <p class="day__sub">
              ${evs.length ? `${evs.length} ${plural(evs.length, 'матч', 'матча', 'матчей')}. ${esc(sub)}` : 'В этот игровой день матчей нет'}
            </p>
            ${liveCount ? `<p class="day__live">${liveDot} идёт ${liveCount} ${plural(liveCount, 'матч', 'матча', 'матчей')}, счёт обновляется сам</p>` : ''}
          </div>
          <a class="day__nav" href="#/day/${ymdShift(day, 1)}" aria-label="Следующий день">›</a>
        </header>
        ${evs.length
          ? `<div class="games">${evs.map(card).join('')}</div>`
          : `<div class="state"><p>Листай стрелками на соседние дни или открой <a href="#/standings">таблицу конференций</a>.</p></div>`}
        <p class="updated">Данные ESPN, обновлено в ${new Date().toLocaleTimeString('ru-RU')}</p>
      </section>`;

    ctx.setLive(liveCount > 0 || evs.some(e => e.status.state === 'pre' && new Date(e.date) - Date.now() < 15 * 60_000));
  };

  ctx.onRefresh(draw);
  await draw();
}
