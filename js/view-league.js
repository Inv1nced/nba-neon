// Таблица конференций, страница команды и описание формул.
import { standings, teamRoster, teamSchedule } from './api.js';
import { teamInfo } from './teams.js';
import { badge, avatar, esc, posRu, fmtDate, fmtTime, loading, errorBox, teamVars, statusText, liveDot } from './ui.js';
import { plural } from './rating.js';

function confTable(conf) {
  const rows = conf.rows.map((r, i) => {
    const seed = r.seed || i + 1;
    const zone = seed <= 6 ? 'po' : seed <= 10 ? 'pi' : 'out';
    return `
      <tr class="zone-${zone}" style="${teamVars(r.team)}">
        <td class="st__seed">${seed}</td>
        <th scope="row"><a class="st__team" href="#/team/${r.team.id}">${badge(r.team, 'xs', { orbit: false })}<span><b>${esc(r.team.city)}</b><span class="st__nick"> ${esc(r.team.name)}</span></span></a></th>
        <td>${r.w}</td><td>${r.l}</td>
        <td>${esc(r.pctText)}</td>
        <td>${esc(r.gb)}</td>
        <td class="st__opt">${esc(r.home)}</td>
        <td class="st__opt">${esc(r.road)}</td>
        <td class="st__opt">${esc(r.l10)}</td>
        <td class="st__streak ${/^W/.test(r.streak) ? 'is-w' : /^L/.test(r.streak) ? 'is-l' : ''}">${esc(r.streak.replace(/^W/, 'В').replace(/^L/, 'П'))}</td>
        <td class="st__opt">${esc(r.diff)}</td>
      </tr>`;
  }).join('');
  return `
    <section class="panel">
      <h2 class="panel__title">${esc(conf.name)}</h2>
      <div class="box__scroll">
        <table class="st">
          <thead><tr>
            <th scope="col" title="Место">#</th><th scope="col">Команда</th>
            <th scope="col" title="Победы">В</th><th scope="col" title="Поражения">П</th>
            <th scope="col" title="Процент побед">%</th><th scope="col" title="Отставание от лидера">Отст.</th>
            <th scope="col" class="st__opt">Дома</th><th scope="col" class="st__opt">В гостях</th>
            <th scope="col" class="st__opt" title="Последние 10 матчей">10 игр</th><th scope="col">Серия</th>
            <th scope="col" class="st__opt" title="Разница очков за игру">+/−</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </section>`;
}

export async function renderStandings(root) {
  root.innerHTML = loading('Загружаю таблицу…');
  const draw = async () => {
    let data;
    try { data = await standings(); } catch (e) {
      root.innerHTML = errorBox(e);
      root.querySelector('[data-retry]')?.addEventListener('click', draw);
      return;
    }
    root.innerHTML = `
      <header class="page-head">
        <h1 class="page-title">Таблица конференций${data.season ? ` ${esc(data.season)}` : ''}</h1>
        <p class="legend"><span class="lg lg--po"></span>1–6 — прямо в плей-офф <span class="lg lg--pi"></span>7–10 — плей-ин</p>
      </header>
      <div class="confs">${data.confs.map(confTable).join('')}</div>`;
    if (root.isConnected) document.title = 'Таблица — NBA Neon';
  };
  await draw();
}

// ---------- команда ----------

function gameRow(ev) {
  const res = ev.status.state === 'post' && ev.my != null
    ? `<span class="tg__res ${ev.win ? 'is-w' : 'is-l'}">${ev.win ? 'В' : 'П'}</span><b>${ev.my}:${ev.their}</b>`
    : ev.status.state === 'in' ? `${liveDot}<b>${ev.my ?? ''}:${ev.their ?? ''}</b>`
    : `<span class="tg__time">${esc(fmtTime(ev.date))}</span>`;
  return `
    <a class="tg" href="#/game/${ev.id}" style="${teamVars(ev.opp)}">
      <span class="tg__date">${esc(fmtDate(ev.date, { weekday: true }))}</span>
      <span class="tg__opp">${ev.home ? 'дома с' : 'в гостях у'} ${badge(ev.opp, 'xs', { orbit: false })} ${esc(ev.opp.city)} ${esc(ev.opp.name)}</span>
      <span class="tg__score">${res}</span>
    </a>`;
}

export async function renderTeam(root, params) {
  root.innerHTML = loading('Загружаю команду…');
  const draw = async () => {
    const [rR, sR, stR] = await Promise.allSettled([teamRoster(params.id), teamSchedule(params.id), standings()]);
    const team = teamInfo({ id: params.id });
    if (rR.status === 'rejected' && sR.status === 'rejected') {
      root.innerHTML = errorBox(rR.reason);
      root.querySelector('[data-retry]')?.addEventListener('click', draw);
      return;
    }
    const roster = rR.status === 'fulfilled' ? rR.value : [];
    const games = sR.status === 'fulfilled' ? sR.value : [];
    let row = null, conf = null;
    if (stR.status === 'fulfilled') {
      for (const c of stR.value.confs) {
        const i = c.rows.findIndex(r => r.team.id === team.id);
        if (i >= 0) { row = c.rows[i]; conf = c; row.place = row.seed || i + 1; }
      }
    }
    const played = games.filter(g => g.status.state === 'post').slice(-5).reverse();
    const next = games.filter(g => g.status.state !== 'post').slice(0, 4);
    const posOrder = { PG: 0, G: 1, SG: 2, 'G-F': 3, SF: 4, F: 5, 'F-G': 5, PF: 6, 'F-C': 7, C: 8, 'C-F': 8 };
    roster.sort((a, b) => (posOrder[a.pos] ?? 5) - (posOrder[b.pos] ?? 5) || (+a.jersey || 0) - (+b.jersey || 0));

    root.innerHTML = `
      <a class="back" href="#/standings">‹ Таблица конференций</a>
      <section class="team-hero" style="${teamVars(team)}">
        ${badge(team, 'xxl')}
        <div>
          <h1 class="team-hero__name"><span>${esc(team.city)}</span>${esc(team.name)}</h1>
          ${row ? `<p class="team-hero__rec"><b>${row.w}–${row.l}</b> ${row.place}-е место, ${esc(conf.name.toLowerCase())}</p>
            <p class="team-hero__stats">Набирает ${esc(row.ppg)} за игру, пропускает ${esc(row.opp)}. Серия: ${esc(row.streak.replace(/^W/, 'В').replace(/^L/, 'П'))}</p>` : ''}
        </div>
      </section>
      <div class="team-cols">
        <section class="panel">
          <h2 class="panel__title">Последние матчи</h2>
          ${played.length ? `<div class="tg-list">${played.map(gameRow).join('')}</div>` : '<p class="muted">Сезон только начался — сыгранных матчей пока нет.</p>'}
          ${next.length ? `<h2 class="panel__title panel__title--sub">Ближайшие</h2><div class="tg-list">${next.map(gameRow).join('')}</div>` : ''}
        </section>
        <section class="panel">
          <h2 class="panel__title">Состав</h2>
          ${roster.length ? `<div class="roster">${roster.map(p => `
            <a class="roster__item" href="#/player/${p.id}?team=${team.id}" style="${teamVars(team)}">
              ${avatar(p, team, 'sm')}
              <span class="roster__name">${esc(p.name)}${p.injured ? ' <em title="В списке травмированных">травма</em>' : ''}</span>
              <span class="roster__meta">${esc(posRu(p.pos))}${p.age ? `, ${p.age} ${plural(p.age, 'год', 'года', 'лет')}` : ''}</span>
            </a>`).join('')}</div>` : '<p class="muted">Состав сейчас недоступен.</p>'}
        </section>
      </div>`;
    if (root.isConnected) document.title = `${team.full} — NBA Neon`;
  };
  await draw();
}

// ---------- как считаем ----------

export function renderAbout(root) {
  root.innerHTML = `
    <header class="page-head"><h1 class="page-title">Как считаются рейтинги</h1></header>
    <section class="panel prose">
      <h2 class="panel__title">Индекс полезности за матч</h2>
      <p>Основа — Game Score Джона Холлинджера, самая известная «оценка полезности» за одну игру:</p>
      <p class="formula">Очки + 0,4·Попадания − 0,7·Броски − 0,4·Промахи штрафных + 0,7·Подборы в нападении + 0,3·Подборы в защите + Перехваты + 0,7·Передачи + 0,7·Блок-шоты − 0,4·Фолы − Потери</p>
      <p>Мы раскладываем его на пять частей — атака, пас, подбор, защита и ошибки, — поэтому в карточке видно, за что игрок получил плюсы, а где потерял.</p>
      <p>Чтобы было понятнее, Game Score переводится в оценку из 10, как в футбольных приложениях: <span class="formula">5,8 + 0,12·Game Score + 0,015·(+/−)</span>. Если игрок провёл на площадке меньше 8 минут, оценка тянется к 6,0 — по паре минут выводы не сделать.</p>
      <ul class="scale">
        <li>${'<span class="rate rate--elite">9.0</span>'} шедевр</li>
        <li>${'<span class="rate rate--great">8.0</span>'} отлично</li>
        <li>${'<span class="rate rate--good">7.0</span>'} хорошо</li>
        <li>${'<span class="rate rate--ok">6.3</span>'} нормально</li>
        <li>${'<span class="rate rate--meh">5.5</span>'} слабовато</li>
        <li>${'<span class="rate rate--bad">5.0</span>'} провал</li>
      </ul>
    </section>
    <section class="panel prose">
      <h2 class="panel__title">Рейтинг игрока (как в NBA 2K)</h2>
      <p>Берём средние показатели за сезон, считаем по ним Game Score и переводим в шкалу 40–99: <span class="formula">64 + 1,4·Game Score</span>. Игрок ротации — около 70, стартер — 76+, сильный стартер — 81+, звезда — 87+, суперзвезда — 93+.</p>
      <p>В начале сезона пара матчей мало что значит, поэтому текущий сезон смешивается с прошлым: вес текущего равен <span class="formula">игры / (игры + 12)</span>. У новичков вместо прошлого сезона — уровень среднего новичка.</p>
      <h3 class="sub">Атрибуты</h3>
      <ul>
        <li><b>АТК</b> — сколько очков приносит за игру.</li>
        <li><b>БРС</b> — точность броска (TS%, учитывает трёхочковые и штрафные) плюс объём трёхочковых.</li>
        <li><b>ПАС</b> — передачи и их соотношение к потерям.</li>
        <li><b>ПДБ</b> — подборы.</li>
        <li><b>ЗАЩ</b> — перехваты, блок-шоты и подборы у своего щита.</li>
        <li><b>НАД</b> — надёжность: как редко владение заканчивается потерей.</li>
      </ul>
      <h3 class="sub">Потенциал и рост</h3>
      <p>Потенциал — это рейтинг плюс запас по возрасту: до 19 лет +14, в 22 года +8, в 25 лет +3, после 27 запаса нет. Если молодой игрок прибавил к прошлому сезону, потенциал ещё немного растёт. График «Как растёт» показывает рейтинг за каждый сезон карьеры.</p>
    </section>
    <section class="panel prose">
      <h2 class="panel__title">Вкладка «Индекс»</h2>
      <p>«Лучшие за день» собирает всех игроков, сыгравших 8+ минут, из всех матчей игрового дня и сортирует по индексу полезности. «Провалы дня» — самые низкие оценки среди тех, кто провёл на площадке 20+ минут.</p>
      <p>«Рейтинг сезона» считает рейтинг, потенциал и атрибуты для всей лиги по средним за сезон. В общей статистике ESPN подборы не делятся на подборы в нападении и в защите, поэтому там берётся типичная доля: четверть в нападении. Из-за этого рейтинг в списке может отличаться от карточки игрока на 1–2 пункта.</p>
    </section>
    <section class="panel prose">
      <h2 class="panel__title">Откуда данные</h2>
      <p>Счёт, составы и статистика — из открытого API ESPN, напрямую в браузере. Во время матчей страница обновляется каждые 20 секунд. Значки команд — собственный дизайн по аббревиатурам и цветам клубов; сайт не связан с НБА и ESPN.</p>
    </section>`;
  if (root.isConnected) document.title = 'Как считаем — NBA Neon';
}
