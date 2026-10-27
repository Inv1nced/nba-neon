// Фон: космос со звёздами и туманностями, а в нём — объёмная паркетная площадка
// с неоновой разметкой и кольцами. Площадка медленно поворачивается, по ней прыгает мяч.
// Всё рисуется на canvas 2D со своей перспективной проекцией, без библиотек.

export function startBackground(canvas) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  let stars = [], nebula = null, planks = [];
  let shoot = null, nextShoot = 4000;
  let raf = 0, last = 0;
  let scrollY = 0, px = 0, py = 0; // параллакс от прокрутки и курсора

  // ---------- космос ----------

  function makeNebula() {
    const c = document.createElement('canvas');
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070320');
    bg.addColorStop(0.55, '#0b0428');
    bg.addColorStop(1, '#10051f');
    g.fillStyle = bg;
    g.fillRect(0, 0, W, H);
    const M = Math.max(W, H);
    const blob = (x, y, r, color) => {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, color);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg;
      g.fillRect(0, 0, W, H);
    };
    blob(W * 0.12, H * 0.16, M * 0.55, 'rgba(110, 50, 255, 0.30)');
    blob(W * 0.9, H * 0.08, M * 0.45, 'rgba(255, 40, 190, 0.20)');
    blob(W * 0.5, H * 0.72, M * 0.45, 'rgba(40, 200, 255, 0.10)');
    return c;
  }

  // паркет: доски вдоль площадки, длина каждой случайная
  function makePlanks() {
    const out = [];
    const tones = [[96, 56, 26], [110, 66, 31], [86, 49, 22], [118, 72, 36], [102, 60, 28]];
    for (let z = -25; z < 25; z += 2.5) {
      let x = -47 - Math.random() * 6;
      while (x < 47) {
        const len = 7 + Math.random() * 12;
        const t = tones[Math.floor(Math.random() * tones.length)];
        const v = 0.85 + Math.random() * 0.3;
        out.push({ x0: Math.max(x, -47), x1: Math.min(x + len, 47), z0: z, z1: z + 2.5, rgb: t.map(c => Math.round(c * v)) });
        x += len;
      }
    }
    return out;
  }

  function build() {
    const count = Math.min(520, Math.round((W * H) / 2600));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H * 0.75,
      r: Math.random() < 0.08 ? 1.5 + Math.random() : 0.4 + Math.random() * 0.9,
      a: 0.35 + Math.random() * 0.65,
      sp: 0.4 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? '120,240,255' : Math.random() < 0.12 ? '255,150,235' : '255,255,255',
    }));
    nebula = makeNebula();
    planks = makePlanks();
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, W < 700 ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (reduce) draw(0);
  }

  // ---------- 3D: камера и проекция ----------

  let cam, R, U, F, focal, cx0, cy0;

  function setCamera(t) {
    const narrow = W < 700;
    // на узком экране смотрим вдоль площадки, чтобы она уходила вглубь, а не в стороны
    const yaw = (narrow ? 1.38 : 0.62) + Math.sin(t * 0.00006) * (narrow ? 0.22 : 0.32) + Math.min(scrollY, 3000) * 0.00012 + px * 0.08;
    const pitch = (narrow ? 0.62 : 0.5) + Math.sin(t * 0.00009) * 0.05 + py * 0.04;
    const dist = narrow ? 118 : 112;
    cam = [Math.sin(yaw) * Math.cos(pitch) * dist, Math.sin(pitch) * dist, Math.cos(yaw) * Math.cos(pitch) * dist];
    const target = [0, 2 + Math.sin(t * 0.0004) * 0.6, 0];
    F = norm(sub(target, cam));
    R = norm(cross(F, [0, 1, 0]));
    U = cross(R, F);
    focal = Math.max(W, H * 0.9);
    cx0 = W / 2;
    cy0 = H * (narrow ? 0.66 : 0.62);
  }

  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(...a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

  function P(x, y, z) {
    const d = sub([x, y, z], cam);
    const zz = dot(d, F);
    if (zz < 2) return null;
    return [cx0 + (dot(d, R) * focal) / zz, cy0 - (dot(d, U) * focal) / zz, zz];
  }

  function poly(points, fill) {
    const pts = points.map(p => P(...p));
    if (pts.some(p => !p)) return;
    ctx.beginPath();
    pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
  }

  function path3d(points) {
    let started = false;
    ctx.beginPath();
    for (const p of points) {
      const s = P(...p);
      if (!s) { started = false; continue; }
      if (!started) { ctx.moveTo(s[0], s[1]); started = true; } else ctx.lineTo(s[0], s[1]);
    }
  }

  function neon(points, color, width = 1.6) {
    path3d(points);
    ctx.strokeStyle = `rgba(${color},0.22)`;
    ctx.lineWidth = width * 4.5;
    ctx.stroke();
    ctx.strokeStyle = `rgba(${color},0.95)`;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  const arc = (cx, cz, r, a0, a1, y = 0.02, n = 40) =>
    Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]; });

  // ---------- площадка ----------

  function drawCourt(t) {
    const T = -1.6; // толщина «плиты»
    // свечение под площадкой
    const c = P(0, T, 0);
    if (c) {
      const rad = (60 * focal) / c[2];
      const g = ctx.createRadialGradient(c[0], c[1], 0, c[0], c[1], rad);
      g.addColorStop(0, 'rgba(120, 70, 255, 0.35)');
      g.addColorStop(0.5, 'rgba(53, 240, 255, 0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(c[0] - rad, c[1] - rad, rad * 2, rad * 2);
    }
    // боковые грани плиты — видны те, что повернуты к камере
    const corners = [[-47, -25], [47, -25], [47, 25], [-47, 25]];
    for (let i = 0; i < 4; i++) {
      const [x0, z0] = corners[i], [x1, z1] = corners[(i + 1) % 4];
      const mid = [(x0 + x1) / 2, T / 2, (z0 + z1) / 2];
      const outward = [Math.sign(mid[0]) * (Math.abs(mid[0]) > 40 ? 1 : 0), 0, Math.sign(mid[2]) * (Math.abs(mid[2]) > 20 ? 1 : 0)];
      if (dot(outward, sub(cam, mid)) <= 0) continue;
      poly([[x0, 0, z0], [x1, 0, z1], [x1, T, z1], [x0, T, z0]], 'rgba(48, 22, 10, 0.95)');
      neon([[x0, T, z0], [x1, T, z1]], '154,107,255', 1);
    }
    // паркет
    for (const p of planks) {
      poly([[p.x0, 0, p.z0], [p.x1, 0, p.z0], [p.x1, 0, p.z1], [p.x0, 0, p.z1]], `rgb(${p.rgb[0]},${p.rgb[1]},${p.rgb[2]})`);
    }
    // лак: блик и затемнение к краям
    const cc = P(0, 0, 0);
    if (cc) {
      const rad = (55 * focal) / cc[2];
      const g = ctx.createRadialGradient(cc[0], cc[1] - rad * 0.15, 0, cc[0], cc[1], rad);
      g.addColorStop(0, 'rgba(255, 220, 170, 0.16)');
      g.addColorStop(0.6, 'rgba(10, 4, 30, 0.15)');
      g.addColorStop(1, 'rgba(10, 4, 30, 0.55)');
      ctx.save();
      path3d([[-47, 0, -25], [47, 0, -25], [47, 0, 25], [-47, 0, 25], [-47, 0, -25]]);
      ctx.clip();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
    // краска (трапеции под кольцами) и центр
    for (const s of [-1, 1]) {
      poly([[s * 47, 0.01, -8], [s * 28, 0.01, -8], [s * 28, 0.01, 8], [s * 47, 0.01, 8]], s < 0 ? 'rgba(154, 107, 255, 0.32)' : 'rgba(255, 79, 216, 0.28)');
    }
    poly(arc(0, 0, 6, 0, Math.PI * 2, 0.01, 36), 'rgba(53, 240, 255, 0.16)');

    // разметка
    const CY = '120,240,255';
    neon([[-47, 0.02, -25], [47, 0.02, -25], [47, 0.02, 25], [-47, 0.02, 25], [-47, 0.02, -25]], CY, 1.8);
    neon([[0, 0.02, -25], [0, 0.02, 25]], CY);
    neon(arc(0, 0, 6, 0, Math.PI * 2), CY);
    neon(arc(0, 0, 2, 0, Math.PI * 2, 0.02, 20), CY);
    for (const s of [-1, 1]) {
      const bx = s * 41.75;
      neon([[s * 47, 0.02, -8], [s * 28, 0.02, -8], [s * 28, 0.02, 8], [s * 47, 0.02, 8]], CY);
      neon(arc(s * 28, 0, 6, 0, Math.PI * 2), CY);
      const a = Math.asin(22 / 23.75);
      const three = s < 0
        ? [[-47, 0.02, -22], [bx + Math.cos(a) * 23.75 * 1, 0.02, -22], ...arc(bx, 0, 23.75, -a, a), [-47, 0.02, 22]]
        : [[47, 0.02, -22], [bx - Math.cos(a) * 23.75, 0.02, -22], ...arc(bx, 0, 23.75, Math.PI + a, Math.PI - a), [47, 0.02, 22]];
      neon(three, '255,120,230', 1.6);
      drawHoop(s, t);
    }
  }

  function drawHoop(s, t) {
    const bx = s * 43;
    // стойка и вынос
    neon([[s * 48, 0, 0], [s * 48, 13, 0], [bx, 11.5, 0]], '200,200,255', 1.4);
    // щит
    poly([[bx, 9, -3], [bx, 9, 3], [bx, 12.5, 3], [bx, 12.5, -3]], 'rgba(160, 220, 255, 0.12)');
    neon([[bx, 9, -3], [bx, 9, 3], [bx, 12.5, 3], [bx, 12.5, -3], [bx, 9, -3]], '220,240,255', 1.4);
    neon([[bx, 10, -1], [bx, 10, 1], [bx, 11.5, 1], [bx, 11.5, -1], [bx, 10, -1]], '220,240,255', 1);
    // кольцо и сетка
    const rx = bx - s * 1.25;
    neon(arc(rx, 0, 0.9, 0, Math.PI * 2, 10, 24), '255,140,40', 2);
    const sway = Math.sin(t * 0.002 + s) * 0.08;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      neon([[rx + Math.cos(a) * 0.9, 10, Math.sin(a) * 0.9], [rx + Math.cos(a) * 0.5 + sway, 8.4, Math.sin(a) * 0.5]], '255,255,255', 0.6);
    }
  }

  // ---------- мяч ----------

  function drawBall(t) {
    const r = 2.2;
    const period = 1300;
    const ph = (t % period) / period;
    const h = Math.abs(Math.sin(ph * Math.PI)) * 9; // прыжок
    const x = Math.sin(t * 0.00021) * 14;
    const z = Math.sin(t * 0.00033) * 8;
    // тень на паркете
    const shadowR = r * (1.2 - h / 22);
    path3d(arc(x, z, shadowR, 0, Math.PI * 2, 0.03, 24));
    ctx.fillStyle = `rgba(0, 0, 0, ${0.55 - h / 30})`;
    ctx.fill();
    // кольцо-волна в момент удара о пол
    if (h < 2.5) {
      const k = 1 - h / 2.5;
      neon(arc(x, z, r * (1.4 + (1 - k) * 2.5), 0, Math.PI * 2, 0.04, 28), `255,79,216`, 1.2 * k + 0.2);
    }
    const c = P(x, r + h, z);
    if (!c) return;
    const sr = (r * focal) / c[2];
    const g = ctx.createRadialGradient(c[0] - sr * 0.35, c[1] - sr * 0.4, sr * 0.1, c[0], c[1], sr);
    g.addColorStop(0, '#ffc07a');
    g.addColorStop(0.45, '#f06f1f');
    g.addColorStop(0.85, '#9a3207');
    g.addColorStop(1, '#3a0c03');
    ctx.save();
    ctx.shadowColor = 'rgba(255, 120, 40, 0.8)';
    ctx.shadowBlur = sr * 0.8;
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c[0], c[1], sr, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    // швы, вращаются
    ctx.save();
    ctx.beginPath(); ctx.arc(c[0], c[1], sr, 0, Math.PI * 2); ctx.clip();
    ctx.translate(c[0], c[1]);
    ctx.rotate(t * 0.003);
    ctx.strokeStyle = 'rgba(30, 8, 0, 0.85)';
    ctx.lineWidth = Math.max(1, sr * 0.07);
    ctx.beginPath(); ctx.moveTo(-sr, 0); ctx.lineTo(sr, 0); ctx.stroke();
    const rot = t * 0.004;
    ctx.beginPath(); ctx.ellipse(0, 0, Math.max(0.5, Math.abs(Math.cos(rot)) * sr), sr, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(-sr * 0.95 + Math.sin(rot) * sr * 0.2, 0, sr * 0.55, sr * 0.98, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(sr * 0.95 + Math.sin(rot) * sr * 0.2, 0, sr * 0.55, sr * 0.98, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
  }

  // ---------- кадр ----------

  function draw(t) {
    ctx.drawImage(nebula, 0, 0, W, H);
    for (const s of stars) {
      const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * 0.001 * s.sp + s.ph);
      ctx.fillStyle = `rgba(${s.hue},${(s.a * tw).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    if (!reduce) drawShootingStar(t);

    setCamera(t);
    ctx.save();
    ctx.globalAlpha = W < 700 ? 0.62 : 0.78; // площадка — фон, текст поверх неё должен читаться
    drawCourt(t);
    drawBall(reduce ? 400 : t);
    ctx.restore();

    // лёгкая дымка сверху, чтобы шапка и заголовки не спорили с фоном
    const fog = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    fog.addColorStop(0, 'rgba(7, 3, 32, 0.55)');
    fog.addColorStop(1, 'rgba(7, 3, 32, 0)');
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, W, H * 0.45);
  }

  function drawShootingStar(t) {
    if (!shoot && t > nextShoot) {
      const fromLeft = Math.random() < 0.5;
      shoot = { x: fromLeft ? W * Math.random() * 0.5 : W * (0.5 + Math.random() * 0.5), y: H * Math.random() * 0.3, vx: (fromLeft ? 1 : -1) * (0.6 + Math.random() * 0.4), vy: 0.28 + Math.random() * 0.2, t0: t };
    }
    if (!shoot) return;
    const k = (t - shoot.t0) / 900;
    if (k > 1) { shoot = null; nextShoot = t + 6000 + Math.random() * 9000; return; }
    const x = shoot.x + shoot.vx * k * 520, y = shoot.y + shoot.vy * k * 520;
    const g = ctx.createLinearGradient(x, y, x - shoot.vx * 140, y - shoot.vy * 140);
    g.addColorStop(0, `rgba(200,250,255,${1 - k})`);
    g.addColorStop(1, 'rgba(200,250,255,0)');
    ctx.strokeStyle = g; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - shoot.vx * 140, y - shoot.vy * 140); ctx.stroke();
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; // ~30 кадров в секунду: плавно и бережёт батарею
    last = t;
    draw(t);
  }

  resize();
  let rt;
  window.addEventListener('resize', () => {
    // на телефоне при прокрутке прыгает адресная строка — из-за неё фон не пересобираем
    if (window.innerWidth === W && Math.abs(window.innerHeight - H) < 140) return;
    clearTimeout(rt); rt = setTimeout(resize, 150);
  });
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    px = (e.clientX / W - 0.5) * 2;
    py = (e.clientY / H - 0.5) * 2;
  }, { passive: true });

  if (!reduce) {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    });
  }
}
