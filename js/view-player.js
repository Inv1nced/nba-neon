// Карточка игрока: рейтинг в духе 2K, атрибуты, биография, рост по сезонам и разбор матча.
import { athlete, athleteCareer, gameSummary } from './api.js';
import { teamInfo, TEAMS } from './teams.js';
import {
  playerProfile, tierOf, growthText, ATTR_LABELS, breakdown, matchRating, ratingTone, verdict,
  trueShooting, currentSeasonYear, plural,
} from './rating.js';
import { badge, esc, posRu, fmtDate, loading, errorBox, teamVars, ratingPill, signed, pctText, fix1 } from './ui.js';

const COUNTRY_RU = { USA: 'США', Canada: 'Канада', France: 'Франция', Serbia: 'Сербия', Germany: 'Германия', Australia: 'Австралия', Spain: 'Испания', Greece: 'Греция', Slovenia: 'Словения', Cameroon: 'Камерун', Nigeria: 'Нигерия', Lithuania: 'Литва', Latvia: 'Латвия', Turkey: 'Турция', Croatia: 'Хорватия', Italy: 'Италия', Japan: 'Япония', China: 'Китай', 'Dominican Republic': 'Доминикана', Bahamas: 'Багамы', 'Bosnia and Herzegovina': 'Босния и Герцеговина', Montenegro: 'Черногория', Brazil: 'Бразилия', Argentina: 'Аргентина', 'New Zealand': 'Новая Зеландия', 'South Sudan': 'Южный Судан', Senegal: 'Сенегал', 'United Kingdom': 'Великобритания', England: 'Англия', Russia: 'Россия', Ukraine: 'Украина', Georgia: 'Грузия', Israel: 'Израиль', 'Czech Republic': 'Чехия', Finland: 'Финляндия', Sweden: 'Швеция', Austria: 'Австрия', Switzerland: 'Швейцария', Netherlands: 'Нидерланды', Belgium: 'Бельгия', Poland: 'Польша', Mali: 'Мали', 'DR Congo': 'ДР Конго', Sudan: 'Судан' };

function heightCm(a) {
  let inches = a.heightIn;
  if (!inches && a.heightText) {
    const m = a.heightText.match(/(\d+)'\s*(\d+)?/);
    if (m) inches = +m[1] * 12 + (+m[2] || 0);
  }
  return inches ? Math.round(inches * 2.54) : null;
}
function weightKg(a) {
  let lb = a.weightLb;
  if (!lb && a.weightText) lb = parseFloat(a.weightText);
  return lb ? Math.round(lb * 0.4536) : null;
}
const ageWord = n => `${n} ${plural(n, 'год', 'года', 'лет')}`;

function birthPlace(a) {
  const b = a.birth;
  if (b && (b.city || b.country)) {
    const country = COUNTRY_RU[b.country] || b.country || '';
    return [b.city, b.state, country].filter(Boolean).join(', ');
  }
  return a.birthText || '';
}

function seasonNo(a) {
  const start = currentSeasonYear() - 1;
  if (a.debut) return start - a.debut + 1;
  if (a.exp != null) return a.exp; // ESPN считает текущий сезон
  return null;
}

function bio(a, team, prof) {
  const lines = [];
  const role = posRu(a.pos).toLowerCase() || 'игрок';
  lines.push(`${esc(a.name)} — ${esc(role)}${team ? ` «${esc(team.full)}»` : ''}${a.age ? `, ${ageWord(a.age)}` : ''}.`);
  if (a.dob) {
    const place = birthPlace(a);
    lines.push(`Родился ${esc(fmtDate(a.dob, { year: true }))} года${place ? ` (${esc(place)})` : ''}.`);
  }
  const h = heightCm(a), w = weightKg(a);
  if (h || w) lines.push(`${h ? `Рост ${h} см` : ''}${h && w ? ', ' : ''}${w ? `${h ? 'вес' : 'Вес'} ${w} кг` : ''}.`);
  if (a.draft.year && a.draft.round && a.draft.pick) {
    lines.push(`Выбран на драфте ${a.draft.year} года в ${a.draft.round}-м раунде под ${a.draft.pick}-м номером.`);
  } else if (a.draft.text) {
    lines.push(`Драфт: ${esc(a.draft.text)}.`);
  }
  if (a.college) lines.push(`До НБА играл за ${esc(a.college)}.`);
  const n = seasonNo(a);
  if (n != null) lines.push(n <= 1 ? 'Новичок: это его первый сезон в НБА.' : `Сейчас проводит ${n}-й сезон в НБА.`);
  if (prof) lines.push(`Рейтинг по нашей формуле — ${prof.ovr}, уровень «${tierOf(prof.ovr).name.toLowerCase()}». ${growthText(a.age, prof.delta, prof.ovr, prof.pot)}`);
  return lines.join(' ');
}

// ---------- визуальные блоки ----------

function radar(attrs) {
  const R = 100, cx = 130, cy = 120;
  const pt = (i, v) => {
    const ang = -Math.PI / 2 + (i * 2 * Math.PI) / 6;
    const r = (Math.max(v, 20) - 20) / 80 * R;
    return [cx + r * Math.cos(ang), cy + r * Math.sin(ang)];
  };
  const ring = v => ATTR_LABELS.map((_, i) => pt(i, v).join(',')).join(' ');
  const poly = ATTR_LABELS.map(([k], i) => pt(i, attrs[k]).join(',')).join(' ');
  const labels = ATTR_LABELS.map(([k, short], i) => {
    const [x, y] = pt(i, 116);
    return `<text x="${x}" y="${y}" class="radar__lbl" text-anchor="middle" dominant-baseline="middle">${short} <tspan class="radar__num">${attrs[k]}</tspan></text>`;
  }).join('');
  return `
    <svg class="radar" viewBox="0 0 260 240" role="img" aria-label="Атрибуты игрока">
      ${[40, 60, 80, 100].map(v => `<polygon points="${ring(v)}" class="radar__ring"/>`).join('')}
      ${ATTR_LABELS.map((_, i) => { const [x, y] = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" class="radar__axis"/>`; }).join('')}
      <polygon points="${poly}" class="radar__shape"/>
      ${labels}
    </svg>`;
}

function card(a, team, prof) {
  const tier = tierOf(prof?.ovr ?? 60);
  const delta = prof?.delta;
  return `
    <div class="pcard pcard--${tier.key}" style="${teamVars(team)}">
      <div class="pcard__shine" aria-hidden="true"></div>
      <div class="pcard__top">
        <div class="pcard__ovr"><b>${prof ? prof.ovr : '—'}</b><span>рейтинг</span></div>
        <div class="pcard__pos">${esc(a.pos || '')}</div>
        ${badge(team, 'sm', { orbit: false })}
      </div>
      <div class="pcard__num" aria-hidden="true">${esc(a.jersey)}</div>
      <div class="pcard__name"><span>${esc(a.first)}</span>${esc(a.last || a.name)}</div>
      <div class="pcard__tier">${esc(tier.name)}</div>
      ${prof ? `
      <div class="pcard__attrs">
        ${ATTR_LABELS.map(([k, short, title]) => `<div title="${esc(title)}"><b>${prof.attrs[k]}</b><span>${short}</span></div>`).join('')}
      </div>
      <div class="pcard__pot">
        <span>Потенциал <b>${prof.pot}</b></span>
        ${delta != null ? `<span class="trend ${delta > 0 ? 'trend--up' : delta < 0 ? 'trend--down' : ''}">${delta === 0 ? 'на уровне прошлого сезона' : `${delta > 0 ? '▲ +' : '▼ −'}${Math.abs(delta)} к прошлому сезону`}</span>` : ''}
      </div>` : ''}
    </div>`;
}

function facts(a, team) {
  const h = heightCm(a), w = weightKg(a);
  const n = seasonNo(a);
  const rows = [
    ['Команда', team ? `<a href="#/team/${team.id}">${esc(team.full)}</a>` : ''],
    ['Позиция', esc(posRu(a.pos))],
    ['Номер', esc(a.jersey)],
    ['Возраст', a.age ? ageWord(a.age) : ''],
    ['Рост', h ? `${h} см` : ''],
    ['Вес', w ? `${w} кг` : ''],
    ['Драфт', a.draft.year ? `${a.draft.year}${a.draft.round ? `, ${a.draft.round}-й раунд` : ''}${a.draft.pick ? `, №${a.draft.pick}` : ''}` : ''],
    ['Колледж', esc(a.college)],
    ['Сезон в НБА', n != null ? (n <= 1 ? 'первый' : `${n}-й`) : ''],
  ].filter(([, v]) => v);
  return `<dl class="facts">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
}

function careerChart(history, seasonYear) {
  if (history.length < 2) return '';
  const W = 640, H = 210, padL = 34, padR = 16, padT = 24, padB = 34;
  const ys = history.map(h => h.ovr);
  const lo = Math.max(40, Math.min(...ys) - 4), hi = Math.min(100, Math.max(...ys) + 4);
  const x = i => padL + (i * (W - padL - padR)) / Math.max(history.length - 1, 1);
  const y = v => padT + (1 - (v - lo) / (hi - lo || 1)) * (H - padT - padB);
  const done = history.filter(h => h.year < seasonYear);
  const curIdx = history.findIndex(h => h.year === seasonYear);
  const line = done.map((h, i) => `${i ? 'L' : 'M'}${x(i)},${y(h.ovr)}`).join(' ');
  const every = history.length > 12 ? 2 : 1;
  const n = history.length;
  const grid = [lo, Math.round((lo + hi) / 2), hi].map(v => `<line x1="${padL}" x2="${W - padR}" y1="${y(v)}" y2="${y(v)}" class="chart__grid"/><text x="${padL - 8}" y="${y(v)}" class="chart__axis" text-anchor="end" dominant-baseline="middle">${Math.round(v)}</text>`).join('');
  const dots = history.map((h, i) => `
    <circle cx="${x(i)}" cy="${y(h.ovr)}" r="${i === curIdx ? 6 : 4.5}" class="chart__dot${i === curIdx ? ' chart__dot--cur' : ''}"><title>${h.label}: ${h.ovr} (${h.gp} ${plural(h.gp, 'игра', 'игры', 'игр')})</title></circle>
    <text x="${x(i)}" y="${y(h.ovr) - 12}" class="chart__val" text-anchor="middle">${h.ovr}</text>
    ${(n - 1 - i) % every === 0 ? `<text x="${x(i)}" y="${H - 10}" class="chart__axis" text-anchor="middle">${h.label.length > 5 ? h.label.slice(2) : h.label}</text>` : ''}`).join('');
  const curLink = curIdx > 0 && done.length ? `<path d="M${x(curIdx - 1)},${y(history[curIdx - 1].ovr)} L${x(curIdx)},${y(history[curIdx].ovr)}" class="chart__line chart__line--cur"/>` : '';
  return `
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Рейтинг по сезонам">
      ${grid}
      <path d="${line}" class="chart__line"/>
      ${curLink}
      ${dots}
    </svg>`;
}

function seasonTable(prof, seasons) {
  const rows = [...seasons].filter(s => s.gp > 0).reverse().map(s => {
    const t = TEAMS[s.teamId];
    const ovr = prof.history.find(h => h.year === s.year)?.ovr ?? '';
    return `<tr>
      <th scope="row">${esc(s.label)}</th>
      <td>${t ? esc(t.abbr) : ''}</td><td>${s.gp}</td><td>${fix1(s.min)}</td>
      <td><b>${fix1(s.pts)}</b></td><td>${fix1(s.reb)}</td><td>${fix1(s.ast)}</td><td>${fix1(s.stl)}</td><td>${fix1(s.blk)}</td><td>${fix1(s.tov)}</td>
      <td>${pctText(s.fgm, s.fga)}</td><td>${pctText(s.tpm, s.tpa)}</td><td>${pctText(s.ftm, s.fta)}</td>
      <td><span class="ovr-chip">${ovr}</span></td>
    </tr>`;
  }).join('');
  return `
    <div class="box__scroll">
      <table class="box__table box__table--season">
        <thead><tr><th scope="col">Сезон</th><th scope="col">Клуб</th><th scope="col">И</th><th scope="col">Мин</th><th scope="col">Очк</th><th scope="col">Под</th><th scope="col">Пер</th><th scope="col">Пх</th><th scope="col">Бш</th><th scope="col">Пот</th><th scope="col">С игры</th><th scope="col">3-очк</th><th scope="col">Штр</th><th scope="col">Рейтинг</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

const PARTS = [
  ['scoring', 'Атака', 'Очки с учётом промахов'],
  ['passing', 'Пас', 'Передачи'],
  ['rebounding', 'Подбор', 'В нападении ценится выше'],
  ['defense', 'Защита', 'Перехваты и блок-шоты'],
  ['mistakes', 'Ошибки', 'Потери и фолы'],
];

function gameBlock(p, g, team, prof) {
  const opp = g.home.team.id === team.id ? g.away.team : g.home.team;
  const title = `В матче против «${esc(opp.full)}», ${esc(fmtDate(g.date))}`;
  if (!p) return '';
  if (p.dnp) {
    return `<section class="panel"><h2 class="panel__title">${title}</h2><p class="lead">Не выходил на площадку.</p><a class="back" href="#/game/${g.id}">‹ К матчу</a></section>`;
  }
  const s = p.s;
  const r = matchRating(s);
  const tone = ratingTone(r, s.min);
  const b = breakdown(s);
  const max = Math.max(8, ...PARTS.map(([k]) => Math.abs(b[k])));
  const v = verdict(s);
  const ts = trueShooting(s);
  const avg = prof?.cur || prof?.prev;
  const vs = (label, now, base) => {
    if (base == null) return '';
    const d = now - base;
    const cls = Math.abs(d) < 0.5 ? '' : d > 0 ? 'trend--up' : 'trend--down';
    return `<div><span>${label}</span><b>${now}</b><small class="trend ${cls}">обычно ${fix1(base)}</small></div>`;
  };
  return `
    <section class="panel game-block" style="${teamVars(team)}">
      <h2 class="panel__title">${title}</h2>
      <div class="gb">
        <div class="gb__score">
          ${ratingPill(s, { big: true })}
          <div><b class="gb__word">${tone.word}</b><span>индекс полезности из 10 за ${Math.round(s.min)} мин</span></div>
        </div>
        <div class="gb__line">
          <div><span>Очки</span><b>${s.pts}</b></div>
          <div><span>Подборы</span><b>${s.reb}</b></div>
          <div><span>Передачи</span><b>${s.ast}</b></div>
          <div><span>Перехваты</span><b>${s.stl}</b></div>
          <div><span>Блок-шоты</span><b>${s.blk}</b></div>
          <div><span>Потери</span><b>${s.tov}</b></div>
          <div><span>С игры</span><b>${s.fgm}/${s.fga}</b></div>
          <div><span>Трёхочковые</span><b>${s.tpm}/${s.tpa}</b></div>
          <div><span>Штрафные</span><b>${s.ftm}/${s.fta}</b></div>
          <div><span>TS%</span><b>${ts != null ? Math.round(ts * 100) : '—'}</b></div>
          <div><span>+/−</span><b>${signed(s.pm)}</b></div>
          <div><span>Фолы</span><b>${s.pf}</b></div>
        </div>
      </div>
      <h3 class="sub">Из чего сложился индекс</h3>
      <div class="parts">
        ${PARTS.map(([k, label, hint]) => {
          const val = b[k];
          const w = (Math.abs(val) / max) * 50;
          return `<div class="parts__row" title="${esc(hint)}">
            <span class="parts__label">${label}</span>
            <span class="parts__track"><i class="${val < 0 ? 'neg' : 'pos'}" style="width:${w}%;${val < 0 ? `right:50%` : `left:50%`}"></i></span>
            <span class="parts__val ${val < 0 ? 'neg' : 'pos'}">${val > 0 ? '+' : ''}${fix1(val)}</span>
          </div>`;
        }).join('')}
        <div class="parts__row parts__row--total"><span class="parts__label">Итого (Game Score)</span><span class="parts__val">${fix1(b.total)}</span></div>
      </div>
      <div class="pc">
        <div class="pc__col pc__col--pro"><h3 class="sub">Что получилось</h3>${v.pros.length ? `<ul>${v.pros.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Ничего выдающегося</p>'}</div>
        <div class="pc__col pc__col--con"><h3 class="sub">Что не получилось</h3>${v.cons.length ? `<ul>${v.cons.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p class="muted">Серьёзных минусов нет</p>'}</div>
      </div>
      ${avg ? `<h3 class="sub">По сравнению со средними за сезон ${esc(avg.label)}</h3>
      <div class="vs">${vs('Очки', s.pts, avg.pts)}${vs('Подборы', s.reb, avg.reb)}${vs('Передачи', s.ast, avg.ast)}${vs('Минуты', Math.round(s.min), avg.min)}</div>` : ''}
      <a class="back" href="#/game/${g.id}">‹ К матчу</a>
    </section>`;
}

export async function renderPlayer(root, params) {
  root.innerHTML = loading('Собираю карточку игрока…');
  const draw = async () => {
    const [aR, cR, gR] = await Promise.allSettled([
      athlete(params.id),
      athleteCareer(params.id),
      params.game ? gameSummary(params.game) : Promise.resolve(null),
    ]);
    if (aR.status === 'rejected') {
      root.innerHTML = errorBox(aR.reason);
      root.querySelector('[data-retry]')?.addEventListener('click', draw);
      return;
    }
    const a = aR.value;
    const seasons = cR.status === 'fulfilled' ? cR.value : [];
    const g = gR.status === 'fulfilled' ? gR.value : null;

    const teamId = params.team || a.teamId;
    // цвета клуба уже запомнены при загрузке матча — берём «родной» неон команды
    const team = teamInfo({ id: teamId });
    const seasonYear = g?.season || currentSeasonYear();
    const prof = playerProfile(seasons, a.age, seasonYear);
    const gp = g?.players?.[team.id]?.find(p => p.id === String(a.id));

    root.innerHTML = `
      ${g ? `<a class="back" href="#/game/${g.id}">‹ К матчу</a>` : `<a class="back" href="#/team/${team.id}">‹ ${esc(team.full || 'К команде')}</a>`}
      <section class="player" style="${teamVars(team)}">
        <div class="player__card">${card(a, team, prof)}</div>
        <div class="player__info">
          <h1 class="player__name">${esc(a.name)}</h1>
          <p class="player__bio">${bio(a, team, prof)}</p>
          ${facts(a, team)}
        </div>
        ${prof ? `<div class="player__radar">${radar(prof.attrs)}<p class="hint">Атрибуты по среднестатистическим показателям: ${esc(prof.basis)}.</p></div>` : ''}
      </section>
      ${g && gp ? gameBlock(gp, g, team, prof) : ''}
      ${prof ? `
      <section class="panel" style="${teamVars(team)}">
        <h2 class="panel__title">Как растёт</h2>
        <p class="lead">${esc(growthText(a.age, prof.delta, prof.ovr, prof.pot))} Потенциал — ${prof.pot}.</p>
        ${prof.history.length > 1 ? `${careerChart(prof.history, seasonYear)}
        <p class="hint">Рейтинг за каждый прошедший сезон считается по средним показателям. Пунктир ведёт к текущему рейтингу — сезон ещё идёт.</p>` : '<p class="hint">График появится, когда у игрока будет больше одного сезона в НБА.</p>'}
      </section>
      <section class="panel">
        <h2 class="panel__title">Статистика по сезонам</h2>
        ${seasonTable(prof, seasons)}
      </section>` : `
      <section class="panel"><p class="lead">У игрока пока нет сыгранных матчей в регулярном чемпионате НБА — рейтинг появится после первых игр.</p></section>`}`;
    document.title = `${a.name} — NBA Neon`;
  };
  await draw();
}
