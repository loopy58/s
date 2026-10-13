// 퍼즐 그림을 코드로 그립니다. 같은 seed면 누구의 기기에서든 똑같은 그림이 나와요.
// 외부 이미지가 필요 없어서 오프라인에서도, 저작권 걱정 없이도 쓸 수 있어요.
import { mulberry32 } from './rng.js';

const TAU = Math.PI * 2;

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function mix(a, b, t) {
  const x = rgb(a);
  const y = rgb(b);
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

function alpha(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

function tools(rand) {
  const R = (a, b) => a + rand() * (b - a);
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  // 사인파를 겹친 부드러운 1차원 잡음 (-1 ~ 1)
  const wave = (octaves = 4, rough = 0.5) => {
    const parts = [];
    let amp = 1;
    let total = 0;
    for (let i = 0; i < octaves; i++) {
      parts.push([R(1, 2.2) * 2 ** i, R(0, TAU), amp]);
      total += amp;
      amp *= rough;
    }
    return (x) => parts.reduce((s, [f, p, a]) => s + Math.sin(x * f * TAU + p) * a, 0) / total;
  };
  return { rand, R, pick, wave };
}

function vGradient(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fill();
}

function glow(ctx, x, y, r0, r1, color, a) {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  g.addColorStop(0, alpha(color, a));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r1, y - r1, r1 * 2, r1 * 2);
}

function cloud(ctx, T, x, y, size, color, shade) {
  const n = Math.round(T.R(4, 7));
  const puffs = [];
  for (let i = 0; i < n; i++) {
    const u = i / (n - 1) - 0.5;
    puffs.push([
      x + u * size * 2.2 + T.R(-0.1, 0.1) * size,
      y - (0.5 - Math.abs(u)) * size * 0.9 + T.R(-0.08, 0.08) * size,
      size * (0.5 - Math.abs(u) * 0.4) * T.R(0.85, 1.15),
    ]);
  }
  for (const [fill, dy] of [[shade, size * 0.12], [color, 0]]) {
    ctx.fillStyle = fill;
    for (const [px, py, r] of puffs) circle(ctx, px, py + dy, r);
    ctx.beginPath();
    ctx.ellipse(x, y + size * 0.12 + dy, size * 1.15, size * 0.28, 0, 0, TAU);
    ctx.fill();
  }
}

// 능선: base 높이에서 amp만큼 출렁이는 산·언덕
function ridgeY(T, w, base, amp, peaky) {
  const n = T.wave(5, 0.5);
  return (x) => base - amp * (peaky ? 1 - Math.abs(n(x / w)) : 0.5 + 0.5 * n(x / w));
}

function fillRidge(ctx, w, h, Y, fill) {
  ctx.beginPath();
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 4; x += 4) ctx.lineTo(x, Y(x));
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function birds(ctx, T, w, h, s, color, count, top, bottom) {
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.0028;
  ctx.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const x = T.R(0.08, 0.92) * w;
    const y = T.R(top, bottom) * h;
    const b = s * T.R(0.008, 0.016);
    ctx.beginPath();
    ctx.moveTo(x - b, y - b * 0.3);
    ctx.quadraticCurveTo(x - b * 0.4, y - b * 0.7, x, y);
    ctx.quadraticCurveTo(x + b * 0.4, y - b * 0.7, x + b, y - b * 0.3);
    ctx.stroke();
  }
}

// ── 1. 노을 산맥 ────────────────────────────────────────────
function sunset(ctx, w, h, T) {
  const s = Math.min(w, h);
  const P = T.pick([
    { sky: ['#2b1d5c', '#8a3b8f', '#e9677a', '#ffb070', '#ffe2a8'], sun: '#fff3cf', far: '#d68aa0', near: '#2a1636' },
    { sky: ['#0f2350', '#3d5a9e', '#c7789a', '#f6a96b', '#fde3b0'], sun: '#fff8e1', far: '#9a9ccc', near: '#141a38' },
    { sky: ['#14324a', '#2c7a8c', '#e39a5c', '#f4c27a', '#f9e6bf'], sun: '#fff5d6', far: '#7fb0a8', near: '#0f2a30' },
    { sky: ['#3b0f3f', '#a12e5a', '#f0644a', '#f9a13f', '#ffe08a'], sun: '#fffbe6', far: '#d77a6a', near: '#2b0d24' },
  ]);
  const horizon = h * T.R(0.5, 0.6);
  ctx.fillStyle = vGradient(ctx, 0, horizon + h * 0.08, P.sky);
  ctx.fillRect(0, 0, w, h);

  const sx = w * T.R(0.22, 0.78);
  const sy = horizon - h * T.R(0.02, 0.16);
  const sr = s * T.R(0.06, 0.09);
  glow(ctx, sx, sy, sr * 0.8, sr * 7, P.sun, 0.6);
  ctx.fillStyle = P.sun;
  circle(ctx, sx, sy, sr);

  // 길게 늘어진 노을 구름
  for (let i = 0, n = T.R(6, 11); i < n; i++) {
    const y = T.R(0.06, 0.85) * horizon;
    ctx.fillStyle = alpha(mix(P.sky[1 + Math.floor(T.R(0, 3))], '#ffffff', 0.25), T.R(0.35, 0.7));
    ctx.beginPath();
    ctx.ellipse(T.R(0, w), y, w * T.R(0.08, 0.22), s * T.R(0.01, 0.025), 0, 0, TAU);
    ctx.fill();
  }
  birds(ctx, T, w, h, s, alpha(P.near, 0.75), Math.round(T.R(4, 9)), 0.12, 0.38);

  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const t = i / (layers - 1);
    const base = horizon - h * 0.04 + (h * 0.88 - horizon + h * 0.04) * t ** 1.3;
    const amp = h * (0.15 - 0.06 * t);
    const Y = ridgeY(T, w, base, amp, i < 3);
    const col = mix(P.far, P.near, t ** 0.8);
    const g = ctx.createLinearGradient(0, base - amp, 0, base + h * 0.12);
    g.addColorStop(0, mix(col, P.sky[3], 0.22 * (1 - t)));
    g.addColorStop(1, col);
    fillRidge(ctx, w, h, Y, g);
    if (i >= layers - 2) {
      ctx.fillStyle = mix(col, '#000000', 0.18);
      for (let x = T.R(0, 20); x < w; x += s * T.R(0.008, 0.03)) {
        const y = Y(x) + 2;
        const th = s * T.R(0.02, 0.05) * (i === layers - 1 ? 1.5 : 1);
        ctx.beginPath();
        ctx.moveTo(x, y - th);
        ctx.lineTo(x - th * 0.33, y + 3);
        ctx.lineTo(x + th * 0.33, y + 3);
        ctx.fill();
      }
    }
  }
}

// ── 2. 별빛 마을 ────────────────────────────────────────────
const HOUSE = ['#e76f51', '#f4a261', '#e9c46a', '#2a9d8f', '#8ab17d', '#b56576', '#6d9dc5', '#f2e8cf'];
const ROOF = ['#9b2226', '#5e548e', '#3d405b', '#bb3e03', '#386641', '#6b4226'];

function house(ctx, T, x, y, hw, dim, night) {
  const hh = hw * T.R(0.65, 1.05);
  const body = mix(T.pick(HOUSE), dim, night ? 0.5 : 0.08);
  const roof = mix(T.pick(ROOF), dim, night ? 0.45 : 0.05);
  const top = y - hh;
  ctx.fillStyle = body;
  ctx.fillRect(x, top, hw, hh + hw * 0.3);
  if (T.rand() < 0.5) {
    ctx.fillStyle = mix(roof, '#000000', 0.2);
    ctx.fillRect(x + hw * 0.65, top - hw * 0.45, hw * 0.12, hw * 0.35);
  }
  ctx.fillStyle = roof;
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.1, top + 1);
  ctx.lineTo(x + hw / 2, top - hw * T.R(0.35, 0.55));
  ctx.lineTo(x + hw * 1.1, top + 1);
  ctx.fill();
  const wins = hw > 40 ? 2 : 1;
  const ws = hw * 0.2;
  for (let i = 0; i < wins; i++) {
    const wx = x + hw * (wins === 1 ? 0.4 : 0.18 + i * 0.44);
    const wy = top + hh * 0.22;
    const lit = !night || T.rand() < 0.75;
    if (night && lit) glow(ctx, wx + ws / 2, wy + ws / 2, 0, ws * 2.2, '#ffcf5a', 0.35);
    ctx.fillStyle = night ? (lit ? '#ffd36b' : '#1d1b2e') : '#cfe8ff';
    ctx.fillRect(wx, wy, ws, ws);
  }
  ctx.fillStyle = mix(roof, '#000000', 0.3);
  ctx.fillRect(x + hw * 0.62, top + hh * 0.55, hw * 0.18, hh * 0.45);
}

function nightVillage(ctx, w, h, T) {
  const s = Math.min(w, h);
  const P = T.pick([
    { sky: ['#070b1f', '#142456', '#2f4c8f'], aurora: ['#3dffb5', '#56c8ff'], hill: ['#22385e', '#172a48', '#0d182c'] },
    { sky: ['#0b0820', '#2a1a5e', '#5a3b8c'], aurora: ['#ff7ad9', '#7af0ff'], hill: ['#2e2756', '#1f1a3d', '#120f26'] },
    { sky: ['#03121a', '#0b3446', '#1d6070'], aurora: ['#7dff8a', '#3df0e0'], hill: ['#164145', '#0e2e31', '#071c1e'] },
  ]);
  ctx.fillStyle = vGradient(ctx, 0, h * 0.8, P.sky);
  ctx.fillRect(0, 0, w, h);

  for (let i = 0; i < 480; i++) {
    const x = T.R(0, w);
    const y = h * 0.75 * T.rand() ** 1.3;
    ctx.fillStyle = `rgba(255,252,235,${T.R(0.35, 1)})`;
    circle(ctx, x, y, s * (T.rand() ** 4 * 0.0035 + 0.0007));
  }

  // 오로라: 세로로 늘어진 빛 커튼
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let b = 0; b < 2; b++) {
    const n = T.wave(3, 0.5);
    const shimmer = T.wave(6, 0.8);
    const y0 = h * T.R(0.22, 0.4);
    const amp = h * T.R(0.06, 0.12);
    const ray = h * T.R(0.16, 0.28);
    const col = P.aurora[b];
    for (let x = 0; x < w; x += 3) {
      const y = y0 + amp * n(x / w);
      const a = 0.08 + 0.22 * (0.5 + 0.5 * shimmer(x / w));
      const g = ctx.createLinearGradient(0, y + s * 0.01, 0, y - ray);
      g.addColorStop(0, alpha(col, 0));
      g.addColorStop(0.15, alpha(col, a));
      g.addColorStop(1, alpha(col, 0));
      ctx.fillStyle = g;
      ctx.fillRect(x, y - ray, 3, ray + s * 0.01);
    }
  }
  ctx.restore();

  const mx = w * T.R(0.12, 0.88);
  const my = h * T.R(0.1, 0.24);
  const mr = s * T.R(0.045, 0.065);
  glow(ctx, mx, my, mr, mr * 5, '#fff6d0', 0.32);
  ctx.fillStyle = '#fdf4d0';
  circle(ctx, mx, my, mr);
  ctx.fillStyle = 'rgba(200,185,140,.35)';
  for (let i = 0; i < 4; i++) circle(ctx, mx + T.R(-0.5, 0.5) * mr, my + T.R(-0.5, 0.5) * mr, mr * T.R(0.1, 0.22));

  const bases = [0.66, 0.76, 0.88];
  const amps = [0.1, 0.08, 0.06];
  for (let i = 0; i < 3; i++) {
    const Y = ridgeY(T, w, h * bases[i], h * amps[i], false);
    fillRidge(ctx, w, h, Y, P.hill[i]);
    if (i === 0) continue;
    let x = T.R(-20, 40);
    while (x < w) {
      const hw = s * T.R(0.05, 0.085) * (i === 2 ? 1.3 : 0.75);
      if (T.rand() < 0.8) house(ctx, T, x, Y(x + hw / 2) + hw * 0.08, hw, P.hill[0], true);
      else {
        // 뾰족한 나무
        const tx = x + hw / 2;
        const ty = Y(tx) + hw * 0.1;
        ctx.fillStyle = mix(P.hill[i], '#000000', 0.35);
        ctx.fillRect(tx - hw * 0.05, ty - hw * 0.35, hw * 0.1, hw * 0.35);
        ctx.fillStyle = mix(P.hill[i], '#2d6a4f', 0.45);
        ctx.beginPath();
        ctx.moveTo(tx, ty - hw * 1.3);
        ctx.lineTo(tx - hw * 0.32, ty - hw * 0.25);
        ctx.lineTo(tx + hw * 0.32, ty - hw * 0.25);
        ctx.fill();
      }
      x += hw * T.R(1.15, 2.1);
    }
  }
  // 반딧불
  for (let i = 0; i < 40; i++) {
    const x = T.R(0, w);
    const y = h * T.R(0.85, 1);
    glow(ctx, x, y, 0, s * 0.012, '#d9ff7a', 0.6);
  }
}

// ── 3. 푸른 바다 ────────────────────────────────────────────
function boat(ctx, T, x, y, size) {
  const hull = T.pick(['#d64545', '#2b4d7d', '#f5f0e6', '#e8a33d', '#2f8f6f', '#6a4c93']);
  const sail = T.pick([['#ffffff', '#fdf3dc'], ['#ffffff', '#e63946'], ['#ffe066', '#ffffff'], ['#f1faee', '#457b9d']]);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  ctx.beginPath();
  ctx.ellipse(x, y + size * 0.14, size * 0.6, size * 0.06, 0, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = '#4a3b2f';
  ctx.lineWidth = Math.max(1, size * 0.025);
  ctx.beginPath();
  ctx.moveTo(x, y - size * 0.1);
  ctx.lineTo(x, y - size * 1.12);
  ctx.stroke();
  ctx.fillStyle = sail[0];
  ctx.beginPath();
  ctx.moveTo(x + size * 0.04, y - size * 1.08);
  ctx.lineTo(x + size * 0.04, y - size * 0.2);
  ctx.lineTo(x + size * 0.58, y - size * 0.2);
  ctx.fill();
  ctx.fillStyle = sail[1];
  ctx.beginPath();
  ctx.moveTo(x - size * 0.04, y - size * 0.95);
  ctx.lineTo(x - size * 0.04, y - size * 0.22);
  ctx.lineTo(x - size * 0.42, y - size * 0.22);
  ctx.fill();
  ctx.fillStyle = hull;
  ctx.beginPath();
  ctx.moveTo(x - size * 0.62, y - size * 0.12);
  ctx.lineTo(x + size * 0.62, y - size * 0.12);
  ctx.lineTo(x + size * 0.42, y + size * 0.1);
  ctx.lineTo(x - size * 0.45, y + size * 0.1);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.fillRect(x - size * 0.56, y - size * 0.06, size * 1.1, Math.max(1, size * 0.03));
}

function sea(ctx, w, h, T) {
  const s = Math.min(w, h);
  const P = T.pick([
    { sky: ['#5fb4ff', '#a9dbff', '#f3fbff'], sea: ['#2a8bd6', '#0d4c8c'], sand: '#f2d7a0', sun: '#fffbe0' },
    { sky: ['#ff9e7a', '#ffc9a0', '#fff1d6'], sea: ['#3a7fbf', '#1a3f73'], sand: '#e8c088', sun: '#fff4d0' },
    { sky: ['#43c6db', '#a8ecf0', '#f0fffb'], sea: ['#18a3b5', '#0a5c78'], sand: '#f5e0b3', sun: '#ffffff' },
  ]);
  const hz = h * T.R(0.42, 0.5);
  ctx.fillStyle = vGradient(ctx, 0, hz, P.sky);
  ctx.fillRect(0, 0, w, hz + 2);
  const sx = w * T.R(0.15, 0.85);
  const sy = hz * T.R(0.2, 0.55);
  glow(ctx, sx, sy, s * 0.03, s * 0.35, P.sun, 0.55);
  ctx.fillStyle = P.sun;
  circle(ctx, sx, sy, s * 0.045);
  for (let i = 0, n = T.R(4, 7); i < n; i++) {
    cloud(ctx, T, T.R(0, w), hz * T.R(0.15, 0.8), s * T.R(0.04, 0.09), '#ffffff', 'rgba(150,170,200,.35)');
  }
  // 수평선 너머 섬
  for (let i = 0, n = T.R(1, 3); i < n; i++) {
    ctx.fillStyle = mix(P.sea[0], P.sky[0], 0.35);
    ctx.beginPath();
    ctx.ellipse(T.R(0, w), hz, w * T.R(0.06, 0.18), h * T.R(0.02, 0.05), 0, Math.PI, TAU);
    ctx.fill();
  }
  ctx.fillStyle = vGradient(ctx, hz, h, [mix(P.sea[0], P.sky[2], 0.3), P.sea[0], P.sea[1]]);
  ctx.fillRect(0, hz, w, h - hz);
  // 햇빛 반짝임
  for (let i = 0; i < 160; i++) {
    const y = hz + (h - hz) * T.rand() ** 1.5;
    const spread = (y - hz) * 0.5 + s * 0.02;
    const x = sx + T.R(-1, 1) * spread;
    ctx.fillStyle = `rgba(255,255,240,${T.R(0.25, 0.7)})`;
    ctx.fillRect(x, y, s * T.R(0.01, 0.04), Math.max(1, s * 0.003));
  }
  // 물결
  ctx.lineCap = 'round';
  for (let i = 0; i < 900; i++) {
    const u = T.rand() ** 1.6;
    const y = hz + (h - hz) * u;
    const x = T.R(0, w);
    const len = s * (0.008 + 0.05 * u);
    ctx.strokeStyle = T.rand() < 0.6 ? `rgba(255,255,255,${T.R(0.15, 0.45)})` : alpha(P.sea[1], T.R(0.2, 0.5));
    ctx.lineWidth = Math.max(1, s * (0.001 + 0.004 * u));
    ctx.beginPath();
    ctx.moveTo(x - len / 2, y);
    ctx.quadraticCurveTo(x, y - len * 0.2, x + len / 2, y);
    ctx.stroke();
  }
  const boats = [];
  for (let i = 0, n = Math.round(T.R(3, 6)); i < n; i++) boats.push(T.R(0.05, 1));
  boats.sort((a, b) => a - b);
  for (const d of boats) boat(ctx, T, T.R(0.08, 0.92) * w, hz + (h - hz) * (0.06 + 0.55 * d), s * (0.03 + 0.11 * d));

  if (T.rand() < 0.5) {
    // 등대 바위
    const left = T.rand() < 0.5;
    const rx = left ? w * T.R(0.05, 0.2) : w * T.R(0.8, 0.95);
    const ry = h * 0.93;
    ctx.fillStyle = '#5b5048';
    ctx.beginPath();
    ctx.ellipse(rx, ry, w * 0.17, h * 0.14, 0, Math.PI, TAU);
    ctx.lineTo(rx + w * 0.17, h);
    ctx.lineTo(rx - w * 0.17, h);
    ctx.fill();
    ctx.fillStyle = '#7a6d62';
    ctx.beginPath();
    ctx.ellipse(rx - w * 0.03, ry - h * 0.06, w * 0.1, h * 0.06, 0, Math.PI, TAU);
    ctx.fill();
    const lw = s * 0.07;
    const lh = s * 0.32;
    const top = ry - h * 0.12 - lh;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(rx - lw * 0.5, top + lh);
    ctx.lineTo(rx - lw * 0.33, top);
    ctx.lineTo(rx + lw * 0.33, top);
    ctx.lineTo(rx + lw * 0.5, top + lh);
    ctx.closePath();
    ctx.clip();
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = k % 2 ? '#ffffff' : '#d62828';
      ctx.fillRect(rx - lw, top + (lh / 6) * k, lw * 2, lh / 6 + 1);
    }
    ctx.restore();
    ctx.fillStyle = '#ffe9a6';
    ctx.fillRect(rx - lw * 0.3, top - lw * 0.5, lw * 0.6, lw * 0.5);
    glow(ctx, rx, top - lw * 0.25, 0, lw * 3, '#fff3b0', 0.5);
    ctx.fillStyle = '#2b2d42';
    ctx.beginPath();
    ctx.moveTo(rx - lw * 0.42, top - lw * 0.5);
    ctx.lineTo(rx, top - lw * 1.05);
    ctx.lineTo(rx + lw * 0.42, top - lw * 0.5);
    ctx.fill();
  } else {
    // 모래사장과 파라솔
    const by = h * T.R(0.84, 0.9);
    const Y = ridgeY(T, w, by, h * 0.04, false);
    ctx.strokeStyle = 'rgba(255,255,255,.75)';
    ctx.lineWidth = s * 0.012;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 6) ctx.lineTo(x, Y(x) - s * 0.006);
    ctx.stroke();
    fillRidge(ctx, w, h, Y, vGradient(ctx, by - h * 0.04, h, [P.sand, mix(P.sand, '#a0703c', 0.3)]));
    const ux = w * T.R(0.2, 0.8);
    const uy = h * 0.95;
    const ur = s * 0.11;
    ctx.strokeStyle = '#6b4226';
    ctx.lineWidth = s * 0.008;
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.lineTo(ux + ur * 0.1, uy - ur * 1.4);
    ctx.stroke();
    const stripes = ['#e63946', '#ffffff', '#ffb703'];
    for (let k = 0; k < 6; k++) {
      ctx.fillStyle = stripes[k % 3];
      ctx.beginPath();
      ctx.moveTo(ux + ur * 0.1, uy - ur * 1.4);
      ctx.arc(ux + ur * 0.1, uy - ur * 1.4 + ur * 0.45, ur, Math.PI + (k * Math.PI) / 6, Math.PI + ((k + 1) * Math.PI) / 6);
      ctx.fill();
    }
  }
  birds(ctx, T, w, h, s, 'rgba(60,60,70,.7)', Math.round(T.R(3, 7)), 0.08, 0.3);
}

// ── 4. 꽃 들판 ──────────────────────────────────────────────
function flower(ctx, x, y, r, color, center, rot, petals) {
  if (r > 3) {
    ctx.strokeStyle = '#2f6b2f';
    ctx.lineWidth = Math.max(1, r * 0.18);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + r * 0.2, y + r * 2.4);
    ctx.stroke();
  }
  ctx.fillStyle = color;
  for (let k = 0; k < petals; k++) {
    const a = rot + (k / petals) * TAU;
    ctx.beginPath();
    ctx.ellipse(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.45, r * 0.5, r * 0.3, a, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = center;
  circle(ctx, x, y, r * 0.3);
}

function meadow(ctx, w, h, T) {
  const s = Math.min(w, h);
  const hills = T.pick([
    ['#b5dc8f', '#8cc56f', '#67ab58'],
    ['#d3dc8a', '#a9c66a', '#7ea84f'],
    ['#a6d9b0', '#7cc08c', '#55a06a'],
  ]);
  ctx.fillStyle = vGradient(ctx, 0, h * 0.6, ['#5fb6ff', '#a6dcff', '#eaf8ff']);
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * T.R(0.1, 0.9), h * 0.08, s * 0.02, s * 0.4, '#fffbe0', 0.6);
  for (let i = 0, n = T.R(3, 6); i < n; i++) {
    cloud(ctx, T, T.R(0, w), h * T.R(0.08, 0.35), s * T.R(0.04, 0.08), '#ffffff', 'rgba(140,170,210,.3)');
  }
  const bases = [0.5, 0.57, 0.64];
  const amps = [0.1, 0.08, 0.06];
  for (let i = 0; i < 3; i++) {
    const Y = ridgeY(T, w, h * bases[i], h * amps[i], false);
    fillRidge(ctx, w, h, Y, hills[i]);
    for (let x = T.R(0, 80); x < w; x += s * T.R(0.04, 0.16)) {
      if (T.rand() < 0.45) continue;
      const tr = s * T.R(0.012, 0.025) * (1 + i * 0.4);
      const y = Y(x);
      ctx.strokeStyle = '#6b4a2b';
      ctx.lineWidth = tr * 0.3;
      ctx.beginPath();
      ctx.moveTo(x, y + 2);
      ctx.lineTo(x, y - tr * 1.4);
      ctx.stroke();
      ctx.fillStyle = mix(hills[i], '#1f4d1f', 0.45);
      if (T.rand() < 0.5) circle(ctx, x, y - tr * 1.8, tr);
      else {
        ctx.beginPath();
        ctx.ellipse(x, y - tr * 2, tr * 0.55, tr * 1.5, 0, 0, TAU);
        ctx.fill();
      }
    }
    if (i === 1) {
      // 빨간 헛간
      const bx = w * T.R(0.15, 0.8);
      const bw = s * 0.09;
      const by = Y(bx + bw / 2) + bw * 0.1;
      ctx.fillStyle = '#b23a2e';
      ctx.fillRect(bx, by - bw * 0.7, bw, bw * 0.75);
      ctx.fillStyle = '#7a2420';
      ctx.beginPath();
      ctx.moveTo(bx - bw * 0.08, by - bw * 0.68);
      ctx.lineTo(bx + bw / 2, by - bw * 1.1);
      ctx.lineTo(bx + bw * 1.08, by - bw * 0.68);
      ctx.fill();
      ctx.strokeStyle = '#f4efe6';
      ctx.lineWidth = bw * 0.04;
      ctx.strokeRect(bx + bw * 0.32, by - bw * 0.42, bw * 0.36, bw * 0.42);
      ctx.beginPath();
      ctx.moveTo(bx + bw * 0.32, by - bw * 0.42);
      ctx.lineTo(bx + bw * 0.68, by);
      ctx.moveTo(bx + bw * 0.68, by - bw * 0.42);
      ctx.lineTo(bx + bw * 0.32, by);
      ctx.stroke();
    }
  }
  const yf = h * 0.66;
  ctx.fillStyle = vGradient(ctx, yf, h, ['#6db35a', '#3f8a3b']);
  ctx.beginPath();
  const fY = ridgeY(T, w, yf, h * 0.03, false);
  ctx.moveTo(0, h);
  for (let x = 0; x <= w + 4; x += 4) ctx.lineTo(x, fY(x));
  ctx.lineTo(w, h);
  ctx.fill();

  // 꽃 무리: 색깔별로 모여 피어 있어야 조각을 맞추기 쉬워요.
  const COLORS = ['#ff5d73', '#ffd23f', '#ffffff', '#b07bff', '#ff9f1c', '#4dabf7', '#ff85c0', '#e63946'];
  const patches = [];
  for (let i = 0, n = Math.round(T.R(5, 8)); i < n; i++) patches.push([T.R(0, 1), T.R(0, 1), T.pick(COLORS)]);
  const items = [];
  for (let i = 0; i < 1400; i++) items.push({ type: 'grass', u: T.rand(), x: T.R(-0.02, 1.02) });
  for (let i = 0; i < 750; i++) items.push({ type: 'flower', u: T.rand() ** 0.8, x: T.R(-0.02, 1.02) });
  items.sort((a, b) => a.u - b.u);
  for (const it of items) {
    const y = yf + (h - yf + s * 0.03) * it.u;
    const x = it.x * w;
    const depth = 0.25 + 0.75 * it.u;
    if (it.type === 'grass') {
      ctx.strokeStyle = T.rand() < 0.5 ? 'rgba(30,90,30,.55)' : 'rgba(170,220,120,.5)';
      ctx.lineWidth = Math.max(1, s * 0.002 * depth);
      const gl = s * 0.02 * depth;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + gl * 0.1, y - gl * 0.6, x + T.R(-0.4, 0.4) * gl, y - gl);
      ctx.stroke();
      continue;
    }
    let best = patches[0];
    let bestD = Infinity;
    for (const p of patches) {
      const d = Math.hypot(p[0] - it.x, (p[1] - it.u) * 0.6);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    const color = T.rand() < 0.82 ? best[2] : T.pick(COLORS);
    const r = s * (0.004 + 0.026 * it.u ** 1.4) * T.R(0.75, 1.25);
    flower(ctx, x, y, r, color, color === '#ffd23f' ? '#8a4b16' : '#ffcf3f', T.R(0, TAU), T.rand() < 0.5 ? 5 : 6);
  }
  // 나비
  for (let i = 0; i < 4; i++) {
    const x = T.R(0.1, 0.9) * w;
    const y = h * T.R(0.6, 0.85);
    const b = s * T.R(0.012, 0.02);
    ctx.fillStyle = T.pick(['#ffffff', '#ffd23f', '#7fd1ff', '#ff9f1c']);
    for (const d of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(x + d * b * 0.6, y - b * 0.3, b * 0.6, b * 0.45, d * 0.5, 0, TAU);
      ctx.ellipse(x + d * b * 0.45, y + b * 0.35, b * 0.4, b * 0.3, -d * 0.4, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = '#333';
    ctx.fillRect(x - b * 0.06, y - b * 0.6, b * 0.12, b * 1.2);
  }
}

// ── 5. 스테인드글라스 ────────────────────────────────────────
function stainedGlass(ctx, w, h, T) {
  const s = Math.min(w, h);
  const pal = T.pick([
    ['#0b3d91', '#1f7a8c', '#e63946', '#f4a261', '#e9c46a', '#2a9d8f', '#f1faee'],
    ['#5f0f40', '#9a031e', '#fb8b24', '#e36414', '#0f4c5c', '#ffd166', '#06d6a0'],
    ['#22223b', '#4a4e69', '#9a8c98', '#ef476f', '#f2e9e4', '#ffd166', '#118ab2'],
    ['#03045e', '#0077b6', '#00b4d8', '#90e0ef', '#ffb703', '#fb8500', '#d62828'],
  ]);
  const cols = Math.round(T.R(16, 24));
  const rows = Math.round((cols * h) / w);
  const cw = w / cols;
  const ch = h / rows;
  const pts = [];
  for (let r = 0; r <= rows; r++) {
    pts[r] = [];
    for (let c = 0; c <= cols; c++) {
      const jx = c > 0 && c < cols ? T.R(-0.38, 0.38) * cw : 0;
      const jy = r > 0 && r < rows ? T.R(-0.38, 0.38) * ch : 0;
      pts[r][c] = [c * cw + jx, r * ch + jy];
    }
  }
  const cx = w * T.R(0.3, 0.7);
  const cy = h * T.R(0.3, 0.7);
  const petals = Math.round(T.R(5, 9));
  const rings = T.R(4, 7);
  const twist = T.R(-1.5, 1.5);
  const maxD = Math.hypot(w, h) / 2;
  const tris = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const a = pts[r][c];
      const b = pts[r][c + 1];
      const d = pts[r + 1][c];
      const e = pts[r + 1][c + 1];
      if (T.rand() < 0.5) tris.push([a, b, e], [a, e, d]);
      else tris.push([a, b, d], [b, e, d]);
    }
  }
  for (const t of tris) {
    const mx = (t[0][0] + t[1][0] + t[2][0]) / 3;
    const my = (t[0][1] + t[1][1] + t[2][1]) / 3;
    const dist = Math.hypot(mx - cx, my - cy) / maxD;
    const ang = Math.atan2(my - cy, mx - cx);
    const v = dist * rings + 0.6 * Math.sin(ang * petals + dist * twist * 6);
    const idx = ((Math.floor(v) % pal.length) + pal.length) % pal.length;
    ctx.fillStyle = mix(pal[idx], T.rand() < 0.5 ? '#ffffff' : '#000000', T.R(0, 0.2));
    ctx.beginPath();
    ctx.moveTo(t[0][0], t[0][1]);
    ctx.lineTo(t[1][0], t[1][1]);
    ctx.lineTo(t[2][0], t[2][1]);
    ctx.closePath();
    ctx.fill();
    const g = ctx.createLinearGradient(t[0][0], t[0][1], t[2][0], t[2][1]);
    g.addColorStop(0, 'rgba(255,255,255,.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.strokeStyle = '#1b1b1f';
  ctx.lineWidth = s * 0.006;
  ctx.lineJoin = 'round';
  for (const t of tris) {
    ctx.beginPath();
    ctx.moveTo(t[0][0], t[0][1]);
    ctx.lineTo(t[1][0], t[1][1]);
    ctx.lineTo(t[2][0], t[2][1]);
    ctx.closePath();
    ctx.stroke();
  }
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxD * 0.9);
  g.addColorStop(0, 'rgba(255,250,220,.35)');
  g.addColorStop(1, 'rgba(255,250,220,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  ctx.lineWidth = s * 0.02;
  ctx.strokeRect(0, 0, w, h);
}

// ── 6. 바우하우스 ────────────────────────────────────────────
function bauhaus(ctx, w, h, T) {
  const pal = T.pick([
    ['#e63946', '#f1c453', '#1d3557', '#2a9d8f', '#f4a261', '#111111'],
    ['#ef476f', '#ffd166', '#06d6a0', '#118ab2', '#073b4c', '#f78c6b'],
    ['#d1495b', '#edae49', '#00798c', '#30638e', '#003d5b', '#8ab17d'],
    ['#264653', '#2a9d8f', '#e9c46a', '#f4a261', '#e76f51', '#8ab17d'],
  ]);
  const paper = T.pick(['#f4ecdc', '#f7f1e3', '#efe6d2']);
  const cols = T.pick([6, 8, 8, 10]);
  const cell = w / cols;
  const rows = Math.ceil(h / cell);
  const other = (not) => {
    let c = T.pick([...pal, paper]);
    for (let i = 0; i < 5 && c === not; i++) c = T.pick([...pal, paper]);
    return c;
  };
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bg = T.rand() < 0.3 ? paper : T.pick(pal);
      const fg = other(bg);
      const third = other(fg);
      ctx.save();
      ctx.translate(c * cell + cell / 2, r * cell + cell / 2);
      ctx.beginPath();
      ctx.rect(-cell / 2, -cell / 2, cell, cell);
      ctx.clip();
      ctx.rotate((Math.floor(T.rand() * 4) * Math.PI) / 2);
      ctx.translate(-cell / 2, -cell / 2);
      ctx.fillStyle = bg;
      ctx.fillRect(-1, -1, cell + 2, cell + 2);
      ctx.fillStyle = fg;
      const k = cell;
      switch (Math.floor(T.rand() * 10)) {
        case 0:
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.arc(0, 0, k, 0, Math.PI / 2);
          ctx.fill();
          break;
        case 1:
          ctx.beginPath();
          ctx.arc(k / 2, 0, k / 2, 0, Math.PI);
          ctx.fill();
          ctx.fillStyle = third;
          ctx.beginPath();
          ctx.arc(k / 2, k, k / 4, Math.PI, TAU);
          ctx.fill();
          break;
        case 2:
          circle(ctx, k / 2, k / 2, k * 0.38);
          ctx.fillStyle = third;
          circle(ctx, k / 2, k / 2, k * 0.17);
          break;
        case 3:
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(k, 0);
          ctx.lineTo(0, k);
          ctx.fill();
          break;
        case 4:
          for (let i = 0; i < 4; i++) ctx.fillRect(0, (k / 4) * i, k, k / 8);
          break;
        case 5:
          for (let i = 4; i > 0; i--) {
            ctx.fillStyle = i % 2 ? fg : bg;
            circle(ctx, k / 2, k / 2, k * 0.12 * i);
          }
          break;
        case 6:
          for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) circle(ctx, k * (0.2 + 0.3 * i), k * (0.2 + 0.3 * j), k * 0.08);
          break;
        case 7:
          ctx.fillRect(k * 0.38, k * 0.1, k * 0.24, k * 0.8);
          ctx.fillRect(k * 0.1, k * 0.38, k * 0.8, k * 0.24);
          break;
        case 8:
          ctx.beginPath();
          ctx.arc(0, k, k, -Math.PI / 2, 0);
          ctx.arc(k, 0, k, Math.PI / 2, Math.PI);
          ctx.fill();
          break;
        default:
          ctx.fillRect(0, 0, k / 2, k / 2);
          ctx.fillRect(k / 2, k / 2, k / 2, k / 2);
          ctx.fillStyle = third;
          circle(ctx, k * 0.75, k * 0.25, k * 0.16);
      }
      ctx.restore();
    }
  }
}

// ── 7. 열기구 축제 ───────────────────────────────────────────
function balloon(ctx, T, cx, cy, r, haze, z) {
  const COLORS = ['#e63946', '#ffb703', '#219ebc', '#8338ec', '#fb5607', '#ffffff', '#06d6a0', '#ff006e', '#3a86ff'];
  const a = T.pick(COLORS);
  let b = T.pick(COLORS);
  if (b === a) b = '#ffffff';
  const c = T.pick(COLORS);
  const env = new Path2D();
  env.moveTo(cx - r, cy);
  env.arc(cx, cy, r, Math.PI, 0);
  env.bezierCurveTo(cx + r, cy + r * 0.75, cx + r * 0.4, cy + r * 1.15, cx + r * 0.22, cy + r * 1.45);
  env.lineTo(cx - r * 0.22, cy + r * 1.45);
  env.bezierCurveTo(cx - r * 0.4, cy + r * 1.15, cx - r, cy + r * 0.75, cx - r, cy);
  env.closePath();

  ctx.strokeStyle = alpha('#5a4630', 0.9);
  ctx.lineWidth = Math.max(1, r * 0.02);
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.2, cy + r * 1.44);
  ctx.lineTo(cx - r * 0.12, cy + r * 1.72);
  ctx.moveTo(cx + r * 0.2, cy + r * 1.44);
  ctx.lineTo(cx + r * 0.12, cy + r * 1.72);
  ctx.stroke();
  ctx.fillStyle = '#8a5a2b';
  ctx.fillRect(cx - r * 0.14, cy + r * 1.7, r * 0.28, r * 0.2);

  ctx.save();
  ctx.clip(env);
  ctx.fillStyle = a;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2.5);
  const style = Math.floor(T.rand() * 3);
  if (style === 0) {
    for (let k = 5; k > 0; k--) {
      ctx.fillStyle = k % 2 ? a : b;
      ctx.beginPath();
      ctx.ellipse(cx, cy + r * 0.3, (r * 1.1 * k) / 5, r * 1.6, 0, 0, TAU);
      ctx.fill();
    }
  } else if (style === 1) {
    for (let k = 0; k < 5; k++) {
      ctx.fillStyle = [a, b, c, b, a][k];
      ctx.fillRect(cx - r, cy - r + k * r * 0.5, r * 2, r * 0.5);
    }
  } else {
    ctx.fillStyle = b;
    ctx.beginPath();
    const n = 6;
    ctx.moveTo(cx - r, cy + r * 0.1);
    for (let k = 0; k <= n * 2; k++) ctx.lineTo(cx - r + (k * r) / n, cy + (k % 2 ? -r * 0.25 : r * 0.1));
    ctx.lineTo(cx + r, cy + r * 0.6);
    for (let k = n * 2; k >= 0; k--) ctx.lineTo(cx - r + (k * r) / n, cy + r * 0.6 + (k % 2 ? -r * 0.25 : 0));
    ctx.fill();
    ctx.fillStyle = c;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 0.45);
  }
  const hi = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, 0, cx - r * 0.35, cy - r * 0.4, r * 1.2);
  hi.addColorStop(0, 'rgba(255,255,255,.45)');
  hi.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hi;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2.5);
  const sh = ctx.createLinearGradient(cx - r, 0, cx + r, 0);
  sh.addColorStop(0.5, 'rgba(0,0,0,0)');
  sh.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = sh;
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2.5);
  ctx.fillStyle = alpha(haze, (1 - z) * 0.45);
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2.5);
  ctx.restore();
}

function balloons(ctx, w, h, T) {
  const s = Math.min(w, h);
  const P = T.pick([
    { sky: ['#7cc6fe', '#c4e7ff', '#ffe9c7'], far: '#a8b8d8', near: '#7a93b8' },
    { sky: ['#f7a072', '#fcd5a5', '#fff3dc'], far: '#c79bb0', near: '#a07591' },
    { sky: ['#9ad1d4', '#d7efe8', '#fff8e6'], far: '#9fb7c0', near: '#6f8f99' },
  ]);
  ctx.fillStyle = vGradient(ctx, 0, h, P.sky);
  ctx.fillRect(0, 0, w, h);
  glow(ctx, w * T.R(0.1, 0.9), h * T.R(0.55, 0.7), s * 0.03, s * 0.45, '#fff6dc', 0.7);
  for (let i = 0, n = T.R(3, 6); i < n; i++) {
    cloud(ctx, T, T.R(0, w), h * T.R(0.1, 0.6), s * T.R(0.03, 0.07), 'rgba(255,255,255,.85)', 'rgba(200,180,200,.25)');
  }
  fillRidge(ctx, w, h, ridgeY(T, w, h * 0.78, h * 0.12, true), P.far);
  fillRidge(ctx, w, h, ridgeY(T, w, h * 0.84, h * 0.07, false), P.near);
  // 조각보 같은 밭
  const FIELDS = ['#9cc56b', '#c9d56f', '#e6c86e', '#7fae5b', '#d9a35b', '#b5cf7a', '#8fbf73'];
  let y = h * 0.87;
  let bandH = h * 0.018;
  while (y < h) {
    let x = T.R(-80, 0);
    while (x < w) {
      const fw = s * T.R(0.08, 0.2) * (1 + (y - h * 0.87) / (h * 0.15));
      ctx.fillStyle = T.pick(FIELDS);
      ctx.fillRect(x, y, fw + 1, bandH + 1);
      ctx.fillStyle = 'rgba(60,80,40,.25)';
      ctx.fillRect(x, y, Math.max(1, s * 0.002), bandH);
      x += fw;
    }
    ctx.fillStyle = 'rgba(60,80,40,.25)';
    ctx.fillRect(0, y, w, Math.max(1, s * 0.002));
    y += bandH;
    bandH *= 1.35;
  }
  const list = [];
  for (let i = 0, n = Math.round(T.R(8, 13)); i < n; i++) list.push({ z: T.rand(), x: T.R(0.05, 0.95) * w, y: h * T.R(0.08, 0.66) });
  list.sort((a, b) => a.z - b.z);
  for (const b of list) balloon(ctx, T, b.x, b.y, s * (0.03 + 0.1 * b.z), P.sky[1], b.z);
  birds(ctx, T, w, h, s, 'rgba(70,60,80,.6)', Math.round(T.R(2, 6)), 0.05, 0.3);
}

// ── 공통 마무리: 종이 질감, 가장자리 그늘 ──────────────────────
function grain(ctx, w, h, rand, a) {
  const n = document.createElement('canvas');
  n.width = n.height = 160;
  const g = n.getContext('2d');
  const img = g.createImageData(160, 160);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = rand() * 255;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(n, 'repeat');
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function vignette(ctx, w, h, a) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.45, w / 2, h / 2, Math.hypot(w, h) * 0.6);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export const THEMES = [
  { id: 'sunset', name: '노을 산맥', draw: sunset },
  { id: 'night', name: '별빛 마을', draw: nightVillage },
  { id: 'sea', name: '푸른 바다', draw: sea },
  { id: 'meadow', name: '꽃 들판', draw: meadow },
  { id: 'glass', name: '스테인드글라스', draw: stainedGlass },
  { id: 'bauhaus', name: '바우하우스', draw: bauhaus },
  { id: 'balloon', name: '열기구 축제', draw: balloons },
];

export const ART_W = 1600;
export const ART_H = 1200;

export function paint(seed, w = ART_W, h = ART_H) {
  const theme = THEMES[seed % THEMES.length];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const T = tools(mulberry32(seed ^ 0x5bd1e995));
  theme.draw(ctx, w, h, T);
  grain(ctx, w, h, T.rand, 0.08);
  vignette(ctx, w, h, 0.16);
  return { canvas, title: `${theme.name} No.${1000 + (seed % 9000)}`, theme: theme.id };
}
