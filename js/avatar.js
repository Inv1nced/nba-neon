// Аватарки в форме вытянутых шестиугольников.
// Каждая собирается из id игрока или команды: свой узор, угол градиента и рисунок,
// поэтому у каждого игрока и клуба аватарка своя и не меняется от раза к разу.

let uid = 0;
const nextId = () => `hx${++uid}`;

export function hash(str) {
  let h = 2166136261;
  for (const ch of String(str)) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// простой детерминированный генератор случайных чисел
function rng(seed) {
  let s = seed || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

// смешивание двух hex-цветов (t — доля второго)
export function mix(a, b, t) {
  const p = c => {
    c = String(c).replace('#', '');
    if (c.length === 3) c = c.split('').map(x => x + x).join('');
    const n = parseInt(c, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const x = p(a), y = p(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// вытянутый шестиугольник 100×124 с вершиной сверху
export const HEX = '50,0 100,28 100,96 50,124 0,96 0,28';
export const HEX_CSS = 'polygon(50% 0, 100% 22.6%, 100% 77.4%, 50% 100%, 0 77.4%, 0 22.6%)';

function pattern(kind, r, color) {
  const o = `stroke="${color}" fill="none"`;
  switch (kind) {
    case 0: { // диагональные полосы
      const step = 9 + Math.floor(r() * 7);
      let out = '';
      for (let x = -130; x < 130; x += step) out += `<line x1="${x}" y1="0" x2="${x + 124}" y2="124" ${o} stroke-width="${2 + r() * 3}"/>`;
      return out;
    }
    case 1: { // сетка точек
      const step = 9 + Math.floor(r() * 5);
      let out = '';
      for (let y = 4; y < 124; y += step) for (let x = 4 + ((y / step) % 2) * step / 2; x < 100; x += step) out += `<circle cx="${x}" cy="${y}" r="${1.2 + r() * 1.3}" fill="${color}"/>`;
      return out;
    }
    case 2: { // вложенные шестиугольники
      let out = '';
      for (let k = 0.15; k < 1; k += 0.17 + r() * 0.05) {
        const pts = HEX.split(' ').map(p => p.split(',').map(Number)).map(([x, y]) => `${50 + (x - 50) * k},${62 + (y - 62) * k}`).join(' ');
        out += `<polygon points="${pts}" ${o} stroke-width="2"/>`;
      }
      return out;
    }
    case 3: { // шевроны
      const step = 12 + Math.floor(r() * 6);
      let out = '';
      for (let y = -10; y < 140; y += step) out += `<polyline points="0,${y + 14} 50,${y} 100,${y + 14}" ${o} stroke-width="3"/>`;
      return out;
    }
    case 4: { // линии скорости
      let out = '';
      for (let i = 0; i < 14; i++) {
        const y = r() * 124, x = r() * 60, len = 25 + r() * 60;
        out += `<line x1="${x}" y1="${y}" x2="${x + len}" y2="${y}" ${o} stroke-width="${1 + r() * 2.5}" stroke-linecap="round"/>`;
      }
      return out;
    }
    case 5: { // «микросхема»
      let out = '';
      for (let i = 0; i < 9; i++) {
        let x = Math.round(r() * 10) * 10, y = Math.round(r() * 12) * 10;
        let d = `M${x},${y}`;
        for (let k = 0; k < 3; k++) {
          if (r() < 0.5) x += (r() < 0.5 ? -1 : 1) * 20; else y += (r() < 0.5 ? -1 : 1) * 20;
          d += ` L${x},${y}`;
        }
        out += `<path d="${d}" ${o} stroke-width="2"/><circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
      }
      return out;
    }
    case 6: { // треугольная мозаика
      let out = '';
      const s = 20;
      for (let y = 0; y < 130; y += s) for (let x = -s; x < 110; x += s) {
        if (r() < 0.45) out += `<polygon points="${x},${y + s} ${x + s / 2},${y} ${x + s},${y + s}" fill="${color}" opacity="${0.3 + r() * 0.7}"/>`;
      }
      return out;
    }
    default: { // лучи из угла
      let out = '';
      const cx = r() < 0.5 ? 0 : 100;
      for (let a = 0; a < 180; a += 12 + r() * 6) {
        const rad = (a * Math.PI) / 180;
        out += `<line x1="${cx}" y1="124" x2="${cx + Math.cos(rad) * 200 * (cx ? -1 : 1)}" y2="${124 - Math.sin(rad) * 200}" ${o} stroke-width="2.5"/>`;
      }
      return out;
    }
  }
}

// ---------- аватарка игрока ----------

export function playerAvatar({ id, label = '', team }) {
  const h = hash('p' + id);
  const r = rng(h);
  const gid = nextId();
  const kind = h % 8;
  const ang = Math.round(r() * 360);
  const c1 = team?.c1 || '#5b3cff';
  const c2 = team?.c2 || '#35f0ff';
  const glow = team?.glow || '#9a6bff';
  const text = String(label).slice(0, 3);
  const fs = text.length > 2 ? 15 : 18;
  return `
  <svg class="hx-svg" viewBox="0 0 100 124" aria-hidden="true">
    <defs>
      <clipPath id="${gid}c"><polygon points="${HEX}"/></clipPath>
      <linearGradient id="${gid}g" gradientTransform="rotate(${ang} .5 .5)">
        <stop offset="0" stop-color="${c1}"/>
        <stop offset=".62" stop-color="${mix(c1, '#07031c', 0.65)}"/>
        <stop offset="1" stop-color="#07031c"/>
      </linearGradient>
      <linearGradient id="${gid}b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ffffff" stop-opacity=".42"/>
        <stop offset="1" stop-color="#ffffff" stop-opacity=".08"/>
      </linearGradient>
      <linearGradient id="${gid}j" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${c1}"/>
        <stop offset="1" stop-color="${mix(c1, '#000000', 0.45)}"/>
      </linearGradient>
    </defs>
    <g clip-path="url(#${gid}c)">
      <rect width="100" height="124" fill="url(#${gid}g)"/>
      <g opacity=".3">${pattern(kind, r, c2)}</g>
      <ellipse cx="50" cy="70" rx="42" ry="34" fill="${glow}" opacity=".18"/>
      <path d="M14,124 C14,98 28,86 50,86 C72,86 86,98 86,124 Z" fill="url(#${gid}b)" stroke="${glow}" stroke-width="2"/>
      <path d="M27,124 L29,98 C31,92 35,90 39,89 L50,101 L61,89 C65,90 69,92 71,98 L73,124 Z" fill="url(#${gid}j)" stroke="${c2}" stroke-width="2"/>
      <rect x="44" y="72" width="12" height="16" rx="5" fill="url(#${gid}b)"/>
      <ellipse cx="50" cy="56" rx="15.5" ry="18" fill="url(#${gid}b)" stroke="${glow}" stroke-width="2"/>
      ${text ? `<text x="50" y="${fs > 16 ? 119 : 118}" text-anchor="middle" class="hx-num" font-size="${fs}" fill="#fff">${text}</text>` : ''}
    </g>
    <polygon points="${HEX}" fill="none" stroke="${glow}" stroke-width="3"/>
  </svg>`;
}

// ---------- значок команды ----------

export function teamEmblem(t) {
  const h = hash('t' + (t.id || t.abbr));
  const r = rng(h);
  const gid = nextId();
  const kind = (h >>> 3) % 8;
  const ang = Math.round(r() * 360);
  const len = String(t.abbr).length;
  const fs = len > 3 ? 25 : len > 2 ? 31 : 38;
  return `
  <svg class="hx-svg" viewBox="0 0 100 124" aria-hidden="true">
    <defs>
      <clipPath id="${gid}c"><polygon points="${HEX}"/></clipPath>
      <radialGradient id="${gid}g" cx="35%" cy="25%" r="90%" gradientTransform="rotate(${ang} .5 .5)">
        <stop offset="0" stop-color="${mix(t.c1, '#ffffff', 0.3)}"/>
        <stop offset=".45" stop-color="${t.c1}"/>
        <stop offset="1" stop-color="${mix(t.c1, '#05021a', 0.7)}"/>
      </radialGradient>
    </defs>
    <g clip-path="url(#${gid}c)">
      <rect width="100" height="124" fill="url(#${gid}g)"/>
      <g opacity=".28">${pattern(kind, r, t.c2)}</g>
      <polygon points="${HEX.split(' ').map(p => p.split(',').map(Number)).map(([x, y]) => `${50 + (x - 50) * 0.78},${62 + (y - 62) * 0.78}`).join(' ')}" fill="none" stroke="${t.c2}" stroke-width="2.5" opacity=".75"/>
      <text x="50" y="${62 + fs * 0.36}" text-anchor="middle" class="hx-abbr" font-size="${fs}" fill="#fff">${t.abbr}</text>
    </g>
  </svg>`;
}
