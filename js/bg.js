// Фон: космос со звёздами, туманностями и медленно вращающейся планетой-мячом.
export function startBackground(canvas) {
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let W = 0, H = 0, dpr = 1;
  let stars = [], nebula = null, ball = null;
  let shoot = null, nextShoot = 4000;
  let raf = 0, last = 0;

  function makeNebula() {
    const c = document.createElement('canvas');
    c.width = W * dpr; c.height = H * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const bg = g.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, '#070320');
    bg.addColorStop(0.55, '#0b0428');
    bg.addColorStop(1, '#12051f');
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
    blob(W * 0.12, H * 0.18, M * 0.55, 'rgba(110, 50, 255, 0.30)');
    blob(W * 0.9, H * 0.08, M * 0.45, 'rgba(255, 40, 190, 0.20)');
    blob(W * 0.55, H * 0.55, M * 0.35, 'rgba(40, 200, 255, 0.07)');
    blob(W * 0.85, H * 0.95, M * 0.5, 'rgba(255, 110, 30, 0.16)');
    return c;
  }

  function makeBall(R) {
    const c = document.createElement('canvas');
    const S = Math.ceil(R * 2.6);
    c.width = S * dpr; c.height = S * dpr;
    const g = c.getContext('2d');
    g.scale(dpr, dpr);
    const cx = S / 2, cy = S / 2;
    // атмосфера
    const atm = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.28);
    atm.addColorStop(0, 'rgba(255, 90, 200, 0.35)');
    atm.addColorStop(0.5, 'rgba(120, 60, 255, 0.12)');
    atm.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = atm;
    g.fillRect(0, 0, S, S);
    // тело мяча
    const body = g.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    body.addColorStop(0, '#ffb15e');
    body.addColorStop(0.45, '#e9661b');
    body.addColorStop(0.8, '#8c2c06');
    body.addColorStop(1, '#2b0903');
    g.fillStyle = body;
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
    // фактура: мелкие пупырышки
    g.save();
    g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.clip();
    g.fillStyle = 'rgba(60, 15, 0, 0.18)';
    for (let i = 0; i < R * 6; i++) {
      const a = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * R;
      g.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, 1.2, 1.2);
    }
    // неоновый ободок
    const rim = g.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    rim.addColorStop(0, 'rgba(0,0,0,0)');
    rim.addColorStop(1, 'rgba(255, 70, 210, 0.45)');
    g.fillStyle = rim;
    g.fillRect(0, 0, S, S);
    g.restore();
    return { c, S, R };
  }

  function build() {
    const count = Math.min(650, Math.round((W * H) / 2400));
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() < 0.08 ? 1.6 + Math.random() : 0.4 + Math.random() * 0.9,
      a: 0.35 + Math.random() * 0.65,
      sp: 0.4 + Math.random() * 1.6,
      ph: Math.random() * Math.PI * 2,
      hue: Math.random() < 0.15 ? 'cyan' : Math.random() < 0.12 ? 'pink' : 'white',
    }));
    nebula = makeNebula();
    const R = Math.min(W, H) * (W < 700 ? 0.5 : 0.42);
    ball = makeBall(R);
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    build();
    if (reduce) draw(0);
  }

  const STAR = { white: '255,255,255', cyan: '120,240,255', pink: '255,150,235' };

  function drawSeams(cx, cy, R, rot) {
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.clip();
    ctx.translate(cx, cy);
    ctx.rotate(-0.38);
    ctx.strokeStyle = 'rgba(25, 6, 0, 0.78)';
    ctx.lineWidth = Math.max(2, R * 0.022);
    // экватор
    ctx.beginPath(); ctx.ellipse(0, 0, R, R * 0.16, 0, 0, Math.PI * 2); ctx.stroke();
    // меридианы — сжимаются и расширяются, создавая вращение
    for (let k = 0; k < 2; k++) {
      const a = rot + k * Math.PI / 2;
      const rx = Math.abs(Math.cos(a)) * R;
      ctx.beginPath(); ctx.ellipse(0, 0, Math.max(rx, 0.5), R, 0, 0, Math.PI * 2); ctx.stroke();
    }
    // две фирменные дуги мяча
    const off = Math.sin(rot) * R * 0.25;
    ctx.beginPath(); ctx.ellipse(-R * 0.95 + off, 0, R * 0.55, R * 0.98, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(R * 0.95 + off, 0, R * 0.55, R * 0.98, 0, Math.PI / 2, Math.PI * 1.5); ctx.stroke();
    ctx.restore();
  }

  function draw(t) {
    ctx.drawImage(nebula, 0, 0, W, H);
    for (const s of stars) {
      const tw = reduce ? 1 : 0.6 + 0.4 * Math.sin(t * 0.001 * s.sp + s.ph);
      ctx.fillStyle = `rgba(${STAR[s.hue]},${(s.a * tw).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    // планета-мяч в правом нижнем углу
    const cx = W * (W < 700 ? 0.92 : 0.9), cy = H * 1.02;
    // мяч приглушён, чтобы текст поверх него читался
    ctx.globalAlpha = W < 700 ? 0.42 : 0.6;
    ctx.drawImage(ball.c, cx - ball.S / 2, cy - ball.S / 2, ball.S, ball.S);
    drawSeams(cx, cy, ball.R, reduce ? 0.6 : t * 0.00012);
    ctx.globalAlpha = 1;

    if (!reduce) {
      if (!shoot && t > nextShoot) {
        const fromLeft = Math.random() < 0.5;
        shoot = { x: fromLeft ? W * Math.random() * 0.5 : W * (0.5 + Math.random() * 0.5), y: H * Math.random() * 0.35, vx: (fromLeft ? 1 : -1) * (0.6 + Math.random() * 0.4), vy: 0.28 + Math.random() * 0.2, t0: t };
      }
      if (shoot) {
        const k = (t - shoot.t0) / 900;
        if (k > 1) { shoot = null; nextShoot = t + 6000 + Math.random() * 9000; }
        else {
          const x = shoot.x + shoot.vx * k * 520, y = shoot.y + shoot.vy * k * 520;
          const g = ctx.createLinearGradient(x, y, x - shoot.vx * 140, y - shoot.vy * 140);
          g.addColorStop(0, `rgba(200,250,255,${1 - k})`);
          g.addColorStop(1, 'rgba(200,250,255,0)');
          ctx.strokeStyle = g; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - shoot.vx * 140, y - shoot.vy * 140); ctx.stroke();
        }
      }
    }
  }

  function loop(t) {
    raf = requestAnimationFrame(loop);
    if (t - last < 33) return; // ~30 кадров в секунду хватает и бережёт батарею
    last = t;
    draw(t);
  }

  resize();
  let rt;
  window.addEventListener('resize', () => {
    // на телефоне при прокрутке прыгает адресная строка — из-за неё фон не перерисовываем
    if (window.innerWidth === W && Math.abs(window.innerHeight - H) < 140) return;
    clearTimeout(rt); rt = setTimeout(resize, 150);
  });
  if (!reduce) {
    raf = requestAnimationFrame(loop);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else raf = requestAnimationFrame(loop);
    });
  }
}
