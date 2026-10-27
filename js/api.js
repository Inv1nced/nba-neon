// Работа с открытым API ESPN: загрузка, кэш и приведение ответов к удобному виду.
import { teamInfo, rememberTeam, separate } from './teams.js';

const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba';
const SITE_V2 = 'https://site.api.espn.com/apis/v2/sports/basketball/nba';
const WEB = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba';
const CORE = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba';

// Сначала идём напрямую. Если браузер не пустит (CORS), пробуем через публичные прокси.
const ROUTES = [
  u => u,
  u => 'https://corsproxy.io/?url=' + encodeURIComponent(u),
  u => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(u),
];

const mem = new Map();

async function fetchWithTimeout(url, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status);
      err.status = res.status;
      throw err;
    }
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

export async function getJSON(url, ttl = 30_000) {
  const hit = mem.get(url);
  if (hit && Date.now() - hit.t < ttl) return hit.data;

  let lastErr;
  for (const make of ROUTES) {
    try {
      const data = await fetchWithTimeout(make(url));
      mem.set(url, { t: Date.now(), data });
      return data;
    } catch (e) {
      lastErr = e;
      if (e.status === 404) break; // такого ресурса нет — прокси не помогут
    }
  }
  if (hit) return hit.data; // лучше старые данные, чем пустой экран
  throw lastErr || new Error('Не удалось загрузить ' + url);
}

// ---------- мелкие помощники ----------

const num = v => {
  if (v == null || v === '' || v === '--') return 0;
  if (typeof v === 'object') v = v.value ?? v.displayValue;
  const n = parseFloat(String(v).replace('+', ''));
  return Number.isFinite(n) ? n : 0;
};

const pair = v => {
  const [a, b] = String(v ?? '0-0').split('-');
  return [num(a), num(b)];
};

function minutesOf(v) {
  if (v == null || v === '' || v === '--') return 0;
  const s = String(v);
  if (s.includes(':')) {
    const [m, sec] = s.split(':');
    return num(m) + num(sec) / 60;
  }
  return num(s);
}

function statusOf(st) {
  const t = st?.type || {};
  return {
    state: t.state || 'pre', // pre | in | post
    completed: !!t.completed,
    name: t.name || '',
    detail: t.detail || t.description || '',
    short: t.shortDetail || t.detail || '',
    period: st?.period || 0,
    clock: st?.displayClock || '',
  };
}

function recordOf(c) {
  const arr = c.records || c.record || [];
  const tot = arr.find(r => r.type === 'total' || r.name === 'overall' || r.name === 'All Splits') || arr[0];
  return tot?.summary || tot?.displayValue || '';
}

function competitorOf(c) {
  rememberTeam(c.team);
  const leaders = {};
  for (const cat of c.leaders || []) {
    const l = cat.leaders?.[0];
    if (l?.athlete) {
      leaders[cat.name] = {
        id: String(l.athlete.id),
        name: l.athlete.shortName || l.athlete.displayName,
        value: l.displayValue,
      };
    }
  }
  return {
    team: teamInfo(c.team),
    score: c.score != null ? num(c.score) : null,
    hasScore: c.score != null && c.score !== '',
    winner: !!c.winner,
    record: recordOf(c),
    lines: (c.linescores || []).map(l => num(l.displayValue ?? l.value)),
    leaders,
  };
}

function pairOf(awayRaw, homeRaw) {
  const a = competitorOf(awayRaw), h = competitorOf(homeRaw);
  [a.team, h.team] = separate(a.team, h.team);
  return [a, h];
}

// ---------- расписание и счёт ----------

export async function scoreboard(dateStr) {
  const live = !dateStr;
  const url = `${SITE}/scoreboard` + (dateStr ? `?dates=${dateStr}` : '');
  const json = await getJSON(url, live ? 15_000 : 20_000);
  const events = (json.events || []).map(ev => {
    const comp = ev.competitions?.[0] || {};
    const cs = comp.competitors || [];
    const home = cs.find(c => c.homeAway === 'home') || cs[0];
    const away = cs.find(c => c.homeAway === 'away') || cs[1];
    const [a, h] = pairOf(away, home);
    return {
      id: String(ev.id),
      date: ev.date || comp.date,
      status: statusOf(ev.status || comp.status),
      home: h,
      away: a,
      venue: comp.venue?.fullName || '',
      city: comp.venue?.address?.city || '',
      tv: (comp.broadcasts || []).flatMap(b => b.names || []).slice(0, 2),
      note: comp.notes?.[0]?.headline || '',
    };
  });
  events.sort((a, b) => new Date(a.date) - new Date(b.date));
  return { day: json.day?.date || null, events };
}

// ---------- матч целиком ----------

const STAT_ALIASES = {
  minutes: 'min', MIN: 'min',
  points: 'pts', PTS: 'pts',
  'fieldGoalsMade-fieldGoalsAttempted': 'fg', FG: 'fg',
  'threePointFieldGoalsMade-threePointFieldGoalsAttempted': 'tp', '3PT': 'tp',
  'freeThrowsMade-freeThrowsAttempted': 'ft', FT: 'ft',
  rebounds: 'reb', REB: 'reb',
  assists: 'ast', AST: 'ast',
  turnovers: 'tov', TO: 'tov',
  steals: 'stl', STL: 'stl',
  blocks: 'blk', BLK: 'blk',
  offensiveRebounds: 'oreb', OREB: 'oreb',
  defensiveRebounds: 'dreb', DREB: 'dreb',
  fouls: 'pf', PF: 'pf',
  plusMinus: 'pm', '+/-': 'pm',
};

function parseLine(cols, values) {
  const raw = {};
  cols.forEach((c, i) => { if (c) raw[c] = values[i]; });
  const [fgm, fga] = pair(raw.fg);
  const [tpm, tpa] = pair(raw.tp);
  const [ftm, fta] = pair(raw.ft);
  const s = {
    min: minutesOf(raw.min),
    pts: num(raw.pts),
    fgm, fga, tpm, tpa, ftm, fta,
    oreb: num(raw.oreb),
    dreb: num(raw.dreb),
    reb: num(raw.reb),
    ast: num(raw.ast),
    stl: num(raw.stl),
    blk: num(raw.blk),
    tov: num(raw.tov),
    pf: num(raw.pf),
    pm: num(raw.pm),
  };
  if (!s.reb && (s.oreb || s.dreb)) s.reb = s.oreb + s.dreb;
  if (!s.dreb && s.reb > s.oreb) s.dreb = s.reb - s.oreb;
  return s;
}

export async function gameSummary(id, live = false) {
  const json = await getJSON(`${SITE}/summary?event=${id}`, live ? 15_000 : 60_000);
  const comp = json.header?.competitions?.[0] || {};
  const cs = comp.competitors || [];
  const homeC = cs.find(c => c.homeAway === 'home') || cs[0] || {};
  const awayC = cs.find(c => c.homeAway === 'away') || cs[1] || {};

  // в боксе цвета есть у команд — подмешиваем их к шапке
  for (const bt of json.boxscore?.teams || []) rememberTeam(bt.team);

  const players = {};
  const playerBlocks = json.boxscore?.players || [];
  for (const block of playerBlocks) {
    rememberTeam(block.team);
    const teamId = String(block.team?.id);
    const st = block.statistics?.[0];
    if (!st) continue;
    const cols = (st.keys?.length ? st.keys : st.labels || st.names || []).map(k => STAT_ALIASES[k] || null);
    const fallbackCols = (st.labels || st.names || []).map(k => STAT_ALIASES[k] || null);
    const useCols = cols.filter(Boolean).length >= 8 ? cols : fallbackCols;
    players[teamId] = (st.athletes || []).map(a => {
      const played = !a.didNotPlay && Array.isArray(a.stats) && a.stats.length > 0;
      return {
        id: String(a.athlete?.id),
        name: a.athlete?.displayName || '',
        short: a.athlete?.shortName || a.athlete?.displayName || '',
        jersey: a.athlete?.jersey ?? '',
        pos: a.athlete?.position?.abbreviation || '',
        starter: !!a.starter,
        dnp: !played,
        reason: played ? '' : (a.reason || ''),
        ejected: !!a.ejected,
        s: played ? parseLine(useCols, a.stats) : null,
      };
    });
  }

  const teamStats = {};
  for (const bt of json.boxscore?.teams || []) {
    const m = {};
    for (const s of bt.statistics || []) m[s.name] = s.displayValue;
    teamStats[String(bt.team?.id)] = m;
  }

  const gi = json.gameInfo || {};
  const [away, home] = pairOf(awayC, homeC);
  return {
    id: String(id),
    date: comp.date,
    status: statusOf(comp.status),
    home,
    away,
    venue: gi.venue?.fullName || '',
    city: gi.venue?.address?.city || '',
    attendance: gi.attendance || 0,
    season: json.header?.season?.year || null,
    players,
    teamStats,
    hasBox: Object.values(players).some(list => list.some(p => !p.dnp)),
  };
}

// ---------- таблица ----------

export async function standings() {
  const json = await getJSON(`${SITE_V2}/standings`, 5 * 60_000);
  const confs = (json.children || []).map(ch => {
    const rows = (ch.standings?.entries || []).map(e => {
      rememberTeam(e.team);
      const st = {};
      const rec = {};
      for (const s of e.stats || []) {
        st[s.name] = s;
        if (s.type) rec[s.type] = s.summary || s.displayValue;
      }
      const v = k => st[k]?.value ?? num(st[k]?.displayValue);
      const d = k => st[k]?.displayValue ?? '';
      return {
        team: teamInfo(e.team),
        w: v('wins'), l: v('losses'),
        pct: v('winPercent'),
        pctText: d('winPercent'),
        gb: d('gamesBehind'),
        seed: v('playoffSeed') || null,
        streak: d('streak'),
        home: rec.home || '', road: rec.road || '',
        l10: rec.lasttengames || '',
        diff: d('differential'),
        ppg: d('avgPointsFor'), opp: d('avgPointsAgainst'),
      };
    });
    rows.sort((a, b) => (a.seed && b.seed ? a.seed - b.seed : b.pct - a.pct || b.w - a.w));
    const isEast = /east/i.test(ch.abbreviation || ch.name || '');
    return { key: isEast ? 'East' : 'West', name: isEast ? 'Восточная конференция' : 'Западная конференция', rows };
  });
  confs.sort(a => (a.key === 'East' ? -1 : 1));
  return { season: json.seasons?.[0]?.displayName || '', confs };
}

// ---------- команда ----------

export async function teamRoster(id) {
  const json = await getJSON(`${SITE}/teams/${id}/roster`, 30 * 60_000);
  rememberTeam(json.team);
  let list = json.athletes || [];
  if (list.length && list[0].items) list = list.flatMap(g => g.items); // формат с группами по позициям
  return list.map(a => ({
    id: String(a.id),
    name: a.displayName || a.fullName,
    jersey: a.jersey ?? '',
    pos: a.position?.abbreviation || '',
    age: a.age || null,
    height: a.height || null,
    exp: a.experience?.years ?? null,
    injured: (a.injuries || []).length > 0,
  }));
}

export async function teamSchedule(id) {
  const json = await getJSON(`${SITE}/teams/${id}/schedule`, 5 * 60_000);
  return (json.events || []).map(ev => {
    const comp = ev.competitions?.[0] || {};
    const cs = comp.competitors || [];
    const me = cs.find(c => String(c.team?.id ?? c.id) === String(id)) || cs[0] || {};
    const op = cs.find(c => c !== me) || {};
    return {
      id: String(ev.id),
      date: ev.date || comp.date,
      status: statusOf(comp.status || ev.status),
      home: me.homeAway === 'home',
      opp: teamInfo(op.team || {}),
      my: me.score != null ? num(me.score) : null,
      their: op.score != null ? num(op.score) : null,
      win: me.winner === true,
    };
  }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

// ---------- игрок ----------

export async function athlete(id) {
  // Два источника дополняют друг друга: веб-профиль знает колледж и клуб,
  // core-профиль — точную дату и место рождения.
  const [webR, coreR] = await Promise.allSettled([
    getJSON(`${WEB}/athletes/${id}`, 60 * 60_000).then(j => j.athlete || j),
    getJSON(`${CORE}/athletes/${id}`, 60 * 60_000),
  ]);
  const w = webR.status === 'fulfilled' && webR.value?.displayName ? webR.value : {};
  const c = coreR.status === 'fulfilled' && coreR.value?.displayName ? coreR.value : {};
  if (!w.displayName && !c.displayName) throw (webR.reason || coreR.reason || new Error('Нет данных об игроке'));
  const pick = (...vals) => vals.find(v => v != null && v !== '');

  // колледж в core API приходит ссылкой — догружаем название, только если его нет в веб-профиле
  let college = pick(w.college?.name, w.college?.shortName, c.college?.name) || '';
  if (!college && c.college?.$ref) {
    try {
      const col = await getJSON(c.college.$ref.replace('http://', 'https://'), 24 * 3600_000);
      college = col.name || col.shortDisplayName || '';
    } catch { /* без колледжа */ }
  }

  let teamId = w.team?.id ? String(w.team.id) : null;
  if (!teamId && c.team?.$ref) teamId = (c.team.$ref.match(/teams\/(\d+)/) || [])[1] || null;
  if (w.team?.id) rememberTeam(w.team);

  const draft = { ...(w.draft || {}), ...(c.draft || {}) };
  const dd = String(w.displayDraft || '').match(/(\d{4}):\s*Rd\s*(\d+),\s*Pk\s*(\d+)/);
  return {
    id: String(pick(c.id, w.id, id)),
    name: pick(w.displayName, c.displayName, c.fullName) || '',
    first: pick(w.firstName, c.firstName) || '',
    last: pick(w.lastName, c.lastName) || '',
    jersey: pick(w.jersey, c.jersey) ?? '',
    pos: pick(w.position?.abbreviation, c.position?.abbreviation) || '',
    posName: pick(w.position?.displayName, c.position?.displayName) || '',
    teamId,
    age: pick(w.age, c.age) || null,
    dob: pick(c.dateOfBirth, w.dateOfBirth) || null,
    birth: c.birthPlace || w.birthPlace || null,
    birthText: w.displayBirthPlace || '',
    heightIn: pick(c.height, w.height) || null,
    heightText: pick(w.displayHeight, c.displayHeight) || '',
    weightLb: pick(c.weight, w.weight) || null,
    weightText: pick(w.displayWeight, c.displayWeight) || '',
    college,
    draft: {
      year: pick(draft.year, dd?.[1] && +dd[1]) || null,
      round: pick(draft.round, dd?.[2] && +dd[2]) || null,
      pick: pick(draft.selection, dd?.[3] && +dd[3]) || null,
      text: w.displayDraft || draft.displayText || '',
    },
    debut: pick(c.debutYear, w.debutYear) || null,
    exp: pick(c.experience?.years, w.experience?.years) ?? null,
    active: (c.active ?? w.active) !== false,
  };
}

// Карьерная статистика по сезонам (регулярка). Если игрок за сезон
// менял клубы, строки за сезон объединяются с весом по числу игр.
export async function athleteCareer(id) {
  const json = await getJSON(`${WEB}/athletes/${id}/stats`, 30 * 60_000);
  const cat = (json.categories || []).find(c => c.name === 'averages') || json.categories?.[0];
  if (!cat) return [];
  const names = cat.names || [];
  const idx = n => names.indexOf(n);
  const get = (row, n) => row.stats?.[idx(n)];

  const bySeason = new Map();
  for (const row of cat.statistics || []) {
    const year = row.season?.year;
    if (!year) continue;
    const [fgm, fga] = pair(get(row, 'avgFieldGoalsMade-avgFieldGoalsAttempted'));
    const [tpm, tpa] = pair(get(row, 'avgThreePointFieldGoalsMade-avgThreePointFieldGoalsAttempted'));
    const [ftm, fta] = pair(get(row, 'avgFreeThrowsMade-avgFreeThrowsAttempted'));
    const s = {
      year,
      label: row.season?.displayName || String(year),
      teamId: row.teamId ? String(row.teamId) : null,
      gp: num(get(row, 'gamesPlayed')),
      gs: num(get(row, 'gamesStarted')),
      min: num(get(row, 'avgMinutes')),
      fgm, fga, tpm, tpa, ftm, fta,
      oreb: num(get(row, 'avgOffensiveRebounds')),
      dreb: num(get(row, 'avgDefensiveRebounds')),
      reb: num(get(row, 'avgRebounds')),
      ast: num(get(row, 'avgAssists')),
      blk: num(get(row, 'avgBlocks')),
      stl: num(get(row, 'avgSteals')),
      pf: num(get(row, 'avgFouls')),
      tov: num(get(row, 'avgTurnovers')),
      pts: num(get(row, 'avgPoints')),
    };
    const prev = bySeason.get(year);
    if (!prev) { bySeason.set(year, s); continue; }
    const tot = prev.gp + s.gp || 1;
    const merged = { ...s, teamId: s.teamId, gp: prev.gp + s.gp, gs: prev.gs + s.gs };
    for (const k of ['min', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'oreb', 'dreb', 'reb', 'ast', 'blk', 'stl', 'pf', 'tov', 'pts']) {
      merged[k] = (prev[k] * prev.gp + s[k] * s.gp) / tot;
    }
    bySeason.set(year, merged);
  }
  return [...bySeason.values()].sort((a, b) => a.year - b.year);
}

export { num };

// ---------- статистика всей лиги (для рейтинга сезона) ----------

const LEAGUE = 'https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba/statistics/byathlete';

function parseLeague(json, year) {
  const cats = json.categories || [];
  return (json.athletes || []).map(row => {
    const a = row.athlete || {};
    const v = {};
    (row.categories || []).forEach((c, ci) => {
      const names = cats.find(x => x.name === c.name)?.names || cats[ci]?.names || [];
      names.forEach((n, i) => { if (v[n] == null) v[n] = c.values?.[i] ?? num(c.totals?.[i]); });
    });
    const team = a.teams?.find(t => String(t.id) === String(a.teamId)) || a.teams?.[0];
    if (team) rememberTeam(team);
    const reb = v.avgRebounds || 0;
    return {
      id: String(a.id),
      name: a.displayName || '',
      short: a.shortName || a.displayName || '',
      age: a.age || null,
      pos: a.position?.abbreviation || '',
      teamId: a.teamId ? String(a.teamId) : (team ? String(team.id) : null),
      year,
      label: '',
      gp: v.gamesPlayed || 0,
      min: v.avgMinutes || 0,
      pts: v.avgPoints || 0,
      fgm: v.avgFieldGoalsMade || 0, fga: v.avgFieldGoalsAttempted || 0,
      tpm: v.avgThreePointFieldGoalsMade || 0, tpa: v.avgThreePointFieldGoalsAttempted || 0,
      ftm: v.avgFreeThrowsMade || 0, fta: v.avgFreeThrowsAttempted || 0,
      reb,
      // в общей статистике лиги нет деления подборов — берём типичную долю: четверть в нападении
      oreb: reb * 0.25, dreb: reb * 0.75,
      ast: v.avgAssists || 0, tov: v.avgTurnovers || 0,
      stl: v.avgSteals || 0, blk: v.avgBlocks || 0,
      pf: v.avgFouls || 0,
    };
  });
}

export async function leagueSeason(year) {
  const sort = '&sort=offensive.avgPoints:desc';
  const [cur, prev1, prev2] = await Promise.allSettled([
    getJSON(`${LEAGUE}?limit=500${sort}`, 20 * 60_000),
    getJSON(`${LEAGUE}?limit=500&season=${year - 1}&seasontype=2${sort}`, 6 * 3600_000),
    getJSON(`${LEAGUE}?limit=500&page=2&season=${year - 1}&seasontype=2${sort}`, 6 * 3600_000),
  ]);
  if (cur.status === 'rejected') throw cur.reason;
  const curYear = cur.value.requestedSeason?.year || year;
  const prev = new Map();
  for (const r of [prev1, prev2]) {
    if (r.status !== 'fulfilled') continue;
    for (const p of parseLeague(r.value, curYear - 1)) if (!prev.has(p.id)) prev.set(p.id, p);
  }
  return {
    season: cur.value.requestedSeason?.displayName || '',
    year: curYear,
    players: parseLeague(cur.value, curYear).map(p => ({ cur: p, prev: prev.get(p.id) || null })),
  };
}
