// Справочник команд: русские названия, конференции и запасные цвета.
// Цвета с ESPN приходят вместе с данными и имеют приоритет — эти нужны,
// если API их не прислал (например, в турнирной таблице).

export const TEAMS = {
  1:  { abbr: 'ATL',  city: 'Атланта',        name: 'Хокс',          conf: 'East', c1: 'c8102e', c2: 'fdb927' },
  2:  { abbr: 'BOS',  city: 'Бостон',         name: 'Селтикс',       conf: 'East', c1: '008348', c2: 'ffffff' },
  3:  { abbr: 'NO',   city: 'Нью-Орлеан',     name: 'Пеликанс',      conf: 'West', c1: '0c2340', c2: 'c8102e' },
  4:  { abbr: 'CHI',  city: 'Чикаго',         name: 'Буллз',         conf: 'East', c1: 'ce1141', c2: '000000' },
  5:  { abbr: 'CLE',  city: 'Кливленд',       name: 'Кавальерс',     conf: 'East', c1: '860038', c2: 'fdbb30' },
  6:  { abbr: 'DAL',  city: 'Даллас',         name: 'Маверикс',      conf: 'West', c1: '0064b1', c2: 'bbc4ca' },
  7:  { abbr: 'DEN',  city: 'Денвер',         name: 'Наггетс',       conf: 'West', c1: '0e2240', c2: 'fec524' },
  8:  { abbr: 'DET',  city: 'Детройт',        name: 'Пистонс',       conf: 'East', c1: 'c8102e', c2: '1d42ba' },
  9:  { abbr: 'GS',   city: 'Голден Стэйт',   name: 'Уорриорз',      conf: 'West', c1: 'fdb927', c2: '1d428a' },
  10: { abbr: 'HOU',  city: 'Хьюстон',        name: 'Рокетс',        conf: 'West', c1: 'ce1141', c2: 'c4ced3' },
  11: { abbr: 'IND',  city: 'Индиана',        name: 'Пэйсерс',       conf: 'East', c1: '002d62', c2: 'fdbb30' },
  12: { abbr: 'LAC',  city: 'Лос-Анджелес',   name: 'Клипперс',      conf: 'West', c1: 'c8102e', c2: '1d428a' },
  13: { abbr: 'LAL',  city: 'Лос-Анджелес',   name: 'Лейкерс',       conf: 'West', c1: '552583', c2: 'fdb927' },
  14: { abbr: 'MIA',  city: 'Майами',         name: 'Хит',           conf: 'East', c1: '98002e', c2: 'f9a01b' },
  15: { abbr: 'MIL',  city: 'Милуоки',        name: 'Бакс',          conf: 'East', c1: '00471b', c2: 'eee1c6' },
  16: { abbr: 'MIN',  city: 'Миннесота',      name: 'Тимбервулвз',   conf: 'West', c1: '266092', c2: '79bc43' },
  17: { abbr: 'BKN',  city: 'Бруклин',        name: 'Нетс',          conf: 'East', c1: '000000', c2: 'ffffff' },
  18: { abbr: 'NY',   city: 'Нью-Йорк',       name: 'Никс',          conf: 'East', c1: '1d428a', c2: 'f58426' },
  19: { abbr: 'ORL',  city: 'Орландо',        name: 'Мэджик',        conf: 'East', c1: '0077c0', c2: 'c4ced4' },
  20: { abbr: 'PHI',  city: 'Филадельфия',    name: 'Сиксерс',       conf: 'East', c1: '1d428a', c2: 'e01234' },
  21: { abbr: 'PHX',  city: 'Финикс',         name: 'Санз',          conf: 'West', c1: '29127a', c2: 'e56020' },
  22: { abbr: 'POR',  city: 'Портленд',       name: 'Трэйл Блэйзерс', conf: 'West', c1: 'e03a3e', c2: '000000' },
  23: { abbr: 'SAC',  city: 'Сакраменто',     name: 'Кингз',         conf: 'West', c1: '5a2d81', c2: '6a7a82' },
  24: { abbr: 'SA',   city: 'Сан-Антонио',    name: 'Сперс',         conf: 'West', c1: 'c4ced4', c2: '000000' },
  25: { abbr: 'OKC',  city: 'Оклахома-Сити',  name: 'Тандер',        conf: 'West', c1: '007ac1', c2: 'ef3b24' },
  26: { abbr: 'UTAH', city: 'Юта',            name: 'Джаз',          conf: 'West', c1: '4e008e', c2: '79a3dc' },
  27: { abbr: 'WSH',  city: 'Вашингтон',      name: 'Уизардс',       conf: 'East', c1: 'e31837', c2: '002b5c' },
  28: { abbr: 'TOR',  city: 'Торонто',        name: 'Рэпторс',       conf: 'East', c1: 'd91244', c2: '000000' },
  29: { abbr: 'MEM',  city: 'Мемфис',         name: 'Гриззлис',      conf: 'West', c1: '5d76a9', c2: '12173f' },
  30: { abbr: 'CHA',  city: 'Шарлотт',        name: 'Хорнетс',       conf: 'East', c1: '008ca8', c2: '1d1160' },
};

// Цвета, пришедшие с API, запоминаем, чтобы раскрасить страницы без цветов в данных.
const liveColors = {};

export function rememberTeam(t) {
  if (!t || !t.id) return;
  if (t.color) liveColors[t.id] = { c1: t.color, c2: t.alternateColor || t.alt || null };
}

export function teamInfo(raw) {
  // raw — объект team из ESPN (или хотя бы { id })
  const id = String(raw?.id ?? '');
  const base = TEAMS[id] || {};
  const live = liveColors[id] || {};
  const c1 = raw?.color || live.c1 || base.c1 || '7a5cff';
  const c2 = raw?.alternateColor || live.c2 || base.c2 || '22e4ff';
  return {
    id,
    abbr: base.abbr || raw?.abbreviation || '—',
    city: base.city || raw?.location || '',
    name: base.name || raw?.name || raw?.shortDisplayName || raw?.displayName || 'Команда',
    full: base.city ? `${base.city} ${base.name}` : (raw?.displayName || ''),
    en: raw?.displayName || '',
    conf: base.conf || null,
    c1: '#' + c1.replace('#', ''),
    c2: '#' + c2.replace('#', ''),
    glow: neonFrom(c1, c2),
    glowAlt: neonFrom(c1, c2, true),
  };
}

// Если у соперников одинаковый неон (например, оба жёлтые), хозяевам
// берём второй фирменный цвет — иначе на площадке и в графиках их не различить.
const hueOf = g => {
  const m = String(g).match(/hsl\((\d+)\s+(\d+)%\s+(\d+)%/);
  return m ? { h: +m[1], s: +m[2], l: +m[3] } : null;
};
const tooClose = (a, b) => {
  const x = hueOf(a), y = hueOf(b);
  if (!x || !y) return false;
  const whiteX = x.l > 85, whiteY = y.l > 85;
  if (whiteX || whiteY) return whiteX && whiteY;
  const d = Math.abs(x.h - y.h) % 360;
  return Math.min(d, 360 - d) < 38;
};
export function separate(away, home) {
  if (!tooClose(away.glow, home.glow)) return [away, home];
  if (!tooClose(away.glow, home.glowAlt)) return [away, { ...home, glow: home.glowAlt }];
  if (!tooClose(away.glowAlt, home.glow)) return [{ ...away, glow: away.glowAlt }, home];
  return [away, { ...home, glow: 'hsl(190 95% 62%)' }];
}

// ---------- цвет неона из фирменных цветов ----------

function hexToRgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h * 360, s * 100, l * 100];
}

// Берём более «светящийся» из двух цветов и поднимаем яркость,
// чтобы тёмно-синие и чёрные команды тоже горели на тёмном фоне.
export function neonFrom(c1, c2, second = false) {
  const cand = [c1, c2].filter(Boolean).map(c => rgbToHsl(hexToRgb(c)));
  const score = ([, s, l]) => s * (1 - Math.abs(l - 55) / 55) + (s > 15 ? 30 : 0);
  cand.sort((a, b) => score(b) - score(a));
  let [h, s, l] = cand[second && cand.length > 1 ? 1 : 0];
  if (s < 12) return 'hsl(230 60% 92%)'; // чёрно-белые команды светятся белым
  s = Math.max(s, 70);
  l = Math.min(Math.max(l, 56), 70);
  return `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
}
