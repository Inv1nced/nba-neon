// Маршрутизация по #адресам и автообновление во время матчей.
import { loadTeamColors } from './api.js';
import { renderHome } from './view-home.js';
import { renderGame } from './view-game.js';
import { renderPlayer } from './view-player.js';
import { renderStandings, renderTeam, renderAbout } from './view-league.js';
import { startBackground } from './bg.js';

const root = document.getElementById('app');
const LIVE_EVERY = 20_000;

const routes = [
  [/^#?\/?$/, renderHome, () => ({}), 'games'],
  [/^#\/day\/(\d{8})$/, renderHome, m => ({ day: m[1] }), 'games'],
  [/^#\/game\/(\d+)$/, renderGame, m => ({ id: m[1] }), 'games'],
  [/^#\/player\/(\d+)(?:\?(.*))?$/, renderPlayer, m => ({ id: m[1], ...Object.fromEntries(new URLSearchParams(m[2] || '')) }), 'games'],
  [/^#\/standings$/, renderStandings, () => ({}), 'standings'],
  [/^#\/team\/(\d+)$/, renderTeam, m => ({ id: m[1] }), 'standings'],
  [/^#\/about$/, renderAbout, () => ({}), 'about'],
];

let navId = 0;
let ctx = null;

function makeCtx(id) {
  const c = {
    refresh: null,
    live: false,
    isRefresh: false,
    onRefresh(fn) { c.refresh = fn; },
    setLive(v) { c.live = !!v; document.body.classList.toggle('is-live', c.live); },
    get current() { return id === navId; },
  };
  return c;
}

async function route() {
  const hash = location.hash || '#/';
  const id = ++navId;
  ctx = makeCtx(id);
  document.body.classList.remove('is-live');
  const found = routes.find(([re]) => re.test(hash)) || routes[0];
  const [re, view, params, section] = found;
  document.querySelectorAll('[data-nav]').forEach(a => a.classList.toggle('is-active', a.dataset.nav === section));
  window.scrollTo(0, 0);
  try {
    await view(root, params(hash.match(re) || []), ctx);
  } catch (e) {
    console.error(e);
    if (id === navId) root.innerHTML = `<div class="state state--error"><p>Что-то сломалось при отрисовке страницы. Обнови её.</p></div>`;
  }
  root.focus({ preventScroll: true });
}

setInterval(async () => {
  if (!ctx || !ctx.live || !ctx.refresh || document.hidden) return;
  const c = ctx;
  c.isRefresh = true;
  try { if (c.current) await c.refresh(); } finally { c.isRefresh = false; }
}, LIVE_EVERY);

document.addEventListener('visibilitychange', () => {
  // вернулись во вкладку посреди матча — сразу подтянуть счёт
  if (!document.hidden && ctx?.live && ctx.refresh) {
    ctx.isRefresh = true;
    ctx.refresh().finally(() => { ctx.isRefresh = false; });
  }
});

window.addEventListener('hashchange', route);

startBackground(document.getElementById('space'));

// цвета команд подгружаем заранее, но не дольше 2,5 секунд
Promise.race([loadTeamColors(), new Promise(r => setTimeout(r, 2500))]).finally(route);
