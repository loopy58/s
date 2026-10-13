// 퍼즐 판: 조각 그리기, 끌어 놓기, 맞춤 판정, 완성 연출
// 조각 위치는 "판의 왼쪽 위 = (0, 0)인 그림 픽셀" 단위로 저장해서 화면 크기가 바뀌어도 그대로 쓸 수 있어요.
import { cutPuzzle, piecePath } from './jigsaw.js';
import { shuffle } from './rng.js';
import * as sound from './sound.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const CONFETTI = ['#ff7a2f', '#ffd23f', '#3dd68c', '#4dabf7', '#ff5d8f', '#b07bff', '#ffffff'];

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, r);
  else g.rect(x, y, w, h);
}

export class Game {
  constructor(canvas, { onProgress, onComplete, onChange } = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.board = document.createElement('canvas');
    this.bctx = this.board.getContext('2d');
    this.hit = document.createElement('canvas').getContext('2d');
    this.cb = { onProgress, onComplete, onChange };
    this.P = null;
    this.view = null;
    this.raf = 0;
    this.drag = null;
    this.fx = [];
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerup', (e) => this.up(e, false));
    canvas.addEventListener('pointercancel', (e) => this.up(e, true));
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  start({ image, cols, rows, seed, state }) {
    this.image = image;
    this.W = image.width;
    this.H = image.height;
    this.P = cutPuzzle(this.W, this.H, cols, rows, seed);
    const { pw, ph } = this.P;
    this.S = this.P.S;
    this.pieces = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        this.pieces.push({ id: this.pieces.length, c, r, path: piecePath(this.P, c, r), x: 0, y: 0, placed: false, cv: null });
      }
    }
    this.total = this.pieces.length;
    this.mistakes = 0;
    this.moves = 0;
    this.hintUsed = false;
    this.ghost = false;
    this.elapsed = 0;
    this.running = false;
    this.started = false;
    this.paused = false;
    this.done = false;
    this.finale = null;
    this.drag = null;
    this.fx = [];
    this.needScatter = true;

    const ok = state && Array.isArray(state.pieces) && state.pieces.length === this.total && state.pieces.some((p) => !p[2]);
    if (ok) {
      state.pieces.forEach(([x, y, placed], i) => {
        const p = this.pieces[i];
        p.placed = !!placed;
        p.x = p.placed ? p.c * pw : Number(x) || 0;
        p.y = p.placed ? p.r * ph : Number(y) || 0;
      });
      this.mistakes = state.mistakes | 0;
      this.moves = state.moves | 0;
      this.elapsed = Number(state.elapsed) || 0;
      this.hintUsed = !!state.hintUsed;
      this.started = this.elapsed > 0;
      const loose = new Set(this.pieces.filter((p) => !p.placed).map((p) => p.id));
      this.order = (state.order || []).filter((id) => loose.delete(id));
      this.order.push(...loose);
      this.needScatter = false;
    } else {
      this.order = shuffle(this.pieces.map((p) => p.id));
    }
    this.placedCount = this.pieces.filter((p) => p.placed).length;
    this.view = null;
    this.resize();
    this.cb.onProgress?.(this.placedCount, this.total);
  }

  // ── 시계 ──────────────────────────────────────────────
  get time() {
    return this.elapsed + (this.running ? performance.now() - this.t0 : 0);
  }
  startClock() {
    if (this.running || this.done || this.paused) return;
    this.running = true;
    this.started = true;
    this.t0 = performance.now();
  }
  stopClock() {
    if (!this.running) return;
    this.elapsed += performance.now() - this.t0;
    this.running = false;
  }
  pause() {
    this.paused = true;
    this.stopClock();
    if (this.drag) {
      this.drag = null;
      this.requestDraw();
    }
  }
  resume() {
    this.paused = false;
    if (this.started) this.startClock();
  }

  // ── 배치 ──────────────────────────────────────────────
  resize() {
    if (!this.P) return;
    const cw = this.canvas.clientWidth;
    const ch = this.canvas.clientHeight;
    if (!cw || !ch) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const prev = this.view;
    if (prev && prev.cw === cw && prev.ch === ch && prev.dpr === dpr) return;
    for (const c of [this.canvas, this.board]) {
      c.width = Math.round(cw * dpr);
      c.height = Math.round(ch * dpr);
    }
    this.view = this.layout(cw, ch, dpr);
    this.renderPieces();
    if (this.needScatter || (prev && prev.portrait !== this.view.portrait)) {
      this.scatter();
      this.needScatter = false;
    } else {
      for (const p of this.pieces) if (!p.placed) this.clamp(p);
    }
    this.renderBoard();
    this.draw();
  }

  // 판 크기는 남은 조각을 판 바깥에 겹치지 않게 늘어놓을 수 있을 만큼으로 줄여 가며 정해요.
  // 다만 조각이 너무 작아져 집기 어려워지면(한 변 34px 미만) 더 줄이지 않고 조금씩 겹쳐 놓아요.
  layout(cw, ch, dpr) {
    const loose = this.pieces.filter((p) => !p.placed).length;
    const minCell = 34;
    let best = this.layoutAt(cw, ch, dpr, 1);
    for (let k = 1; k >= 0.5; k *= 0.93) {
      const v = this.layoutAt(cw, ch, dpr, k);
      if (k < 1 && this.S * v.s < minCell) break;
      best = v;
      if (this.slots(v, 1).length >= loose) break;
    }
    return best;
  }

  layoutAt(cw, ch, dpr, k) {
    const aspect = this.W / this.H;
    const pad = 14;
    const portrait = ch > cw * 1.05;
    let bw;
    let bh;
    if (portrait) {
      bw = cw - pad * 2;
      bh = bw / aspect;
      if (bh > ch * 0.5) {
        bh = ch * 0.5;
        bw = bh * aspect;
      }
    } else {
      // 판은 화면의 40% 정도, 나머지는 조각을 늘어놓을 자리
      bw = Math.sqrt(cw * ch * 0.4 * aspect);
      bh = bw / aspect;
      if (bw > cw * 0.64) {
        bw = cw * 0.64;
        bh = bw / aspect;
      }
      if (bh > ch - pad * 2) {
        bh = ch - pad * 2;
        bw = bh * aspect;
      }
    }
    bw *= k;
    bh *= k;
    const bx = Math.round((cw - bw) / 2);
    const by = Math.round(portrait ? pad + 4 : (ch - bh) / 2);
    return { cw, ch, dpr, portrait, bx, by, bw, bh, s: bw / this.W };
  }

  // 판과 겹치지 않는 조각 자리들. f가 1보다 작으면 이웃 조각끼리 조금 겹쳐요.
  slots(v, f) {
    const { cw, ch, bx, by, bw, bh, s } = v;
    const pws = this.P.pw * s;
    const phs = this.P.ph * s;
    const tab = this.S * s * 0.2; // 볼록한 부분은 이웃 조각의 오목한 자리와 엇갈리니 조금만 잡아요.
    const x0 = bx - 8;
    const y0 = by - 8;
    const x1 = bx + bw + 8;
    const y1 = by + bh + 8;
    const out = [];
    for (let y = tab + 6; y + phs + tab <= ch - 2; y += (phs + tab * 2) * f) {
      for (let x = tab + 6; x + pws + tab <= cw - 2; x += (pws + tab * 2) * f) {
        if (x + pws + tab > x0 && x - tab < x1 && y + phs + tab > y0 && y - tab < y1) continue;
        out.push([x, y]);
      }
    }
    return out;
  }

  // 판을 피해 조각을 고르게 흩어 놓아요. 자리가 모자라면 조금씩 겹쳐요.
  scatter() {
    const loose = shuffle(this.pieces.filter((p) => !p.placed));
    if (!loose.length) return;
    const { cw, ch, bx, by, s } = this.view;
    const pws = this.P.pw * s;
    const phs = this.P.ph * s;
    let slots = [];
    for (let f = 1.15; f >= 0.6; f -= 0.05) {
      slots = this.slots(this.view, f);
      if (slots.length >= loose.length) break;
    }
    shuffle(slots);
    loose.forEach((p, i) => {
      let x;
      let y;
      if (slots.length) {
        [x, y] = slots[i % slots.length];
        const j = i >= slots.length ? 0.35 : 0.08;
        x += (Math.random() - 0.5) * pws * j * 2;
        y += (Math.random() - 0.5) * phs * j * 2;
      } else {
        x = Math.random() * (cw - pws);
        y = Math.random() * (ch - phs);
      }
      p.x = (x - bx) / s;
      p.y = (y - by) / s;
      this.clamp(p);
    });
    this.order = loose.map((p) => p.id);
  }

  reshuffle() {
    if (this.done) return;
    this.scatter();
    this.requestDraw();
    this.cb.onChange?.();
  }

  // 조각이 화면 밖으로 사라지지 않게 절반 이상은 보이도록 붙잡아요.
  clamp(p) {
    const { cw, ch, bx, by, s } = this.view;
    const { pw, ph } = this.P;
    p.x = Math.min((cw - bx) / s - pw * 0.6, Math.max(-bx / s - pw * 0.4, p.x));
    p.y = Math.min((ch - by) / s - ph * 0.6, Math.max(-by / s - ph * 0.4, p.y));
  }

  // ── 그리기 ────────────────────────────────────────────
  renderPieces() {
    const { s, dpr } = this.view;
    const { pw, ph } = this.P;
    const k = s * dpr;
    const pad = this.S * 0.38 + 10 / s; // 볼록한 부분 + 그림자 자리
    this.pad = pad;
    const w = Math.ceil((pw + pad * 2) * k);
    const h = Math.ceil((ph + pad * 2) * k);
    for (const p of this.pieces) {
      if (p.placed) {
        p.cv = null;
        continue;
      }
      const cv = p.cv && p.cv.width === w && p.cv.height === h ? p.cv : Object.assign(document.createElement('canvas'), { width: w, height: h });
      const g = cv.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.clearRect(0, 0, w, h);
      g.setTransform(k, 0, 0, k, pad * k, pad * k);
      g.save();
      g.shadowColor = 'rgba(0,0,0,.42)';
      g.shadowBlur = 6 * dpr;
      g.shadowOffsetY = 2.5 * dpr;
      g.fillStyle = '#222';
      g.fill(p.path);
      g.restore();
      this.paintPiece(g, p, 1);
      p.cv = cv;
    }
  }

  // 현재 변환(조각 칸 왼쪽 위 = 원점, 그림 픽셀 단위) 위에 조각 그림과 테두리 입체감을 그려요.
  paintPiece(g, p, bevel) {
    const s = this.view.s;
    g.save();
    g.clip(p.path);
    const { pw, ph } = this.P;
    const m = this.S * 0.4;
    const ox = p.c * pw;
    const oy = p.r * ph;
    const x0 = Math.max(0, ox - m);
    const y0 = Math.max(0, oy - m);
    const x1 = Math.min(this.W, ox + pw + m);
    const y1 = Math.min(this.H, oy + ph + m);
    g.drawImage(this.image, x0, y0, x1 - x0, y1 - y0, x0 - ox, y0 - oy, x1 - x0, y1 - y0);
    if (bevel > 0) {
      g.lineWidth = 2.4 / s;
      g.translate(1 / s, 1 / s);
      g.strokeStyle = `rgba(255,255,255,${0.5 * bevel})`;
      g.stroke(p.path);
      g.translate(-2 / s, -2 / s);
      g.strokeStyle = `rgba(0,0,0,${0.4 * bevel})`;
      g.stroke(p.path);
    }
    g.restore();
  }

  renderBoard() {
    const { dpr, bx, by, bw, bh } = this.view;
    const g = this.bctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.board.width, this.board.height);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.fillStyle = 'rgba(0,0,0,.28)';
    roundRect(g, bx - 8, by - 8, bw + 16, bh + 16, 12);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,.07)';
    g.fillRect(bx, by, bw, bh);
    if (this.done && !this.finale) {
      g.drawImage(this.image, bx, by, bw, bh);
      return;
    }
    if (this.ghost) {
      g.globalAlpha = 0.3;
      g.drawImage(this.image, bx, by, bw, bh);
      g.globalAlpha = 1;
    }
    for (const p of this.pieces) if (p.placed) this.stamp(p);
  }

  stamp(p) {
    const { dpr, bx, by, s } = this.view;
    const g = this.bctx;
    g.setTransform(dpr * s, 0, 0, dpr * s, (bx + p.x * s) * dpr, (by + p.y * s) * dpr);
    this.paintPiece(g, p, 0.45);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  requestDraw() {
    if (!this.raf) {
      this.raf = requestAnimationFrame(() => {
        this.raf = 0;
        this.draw();
      });
    }
  }

  draw() {
    if (!this.view) return;
    const { dpr, bx, by, s } = this.view;
    const g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.board, 0, 0);
    for (const id of this.order) {
      const p = this.pieces[id];
      if (!p.cv) continue;
      const x = (bx + (p.x - this.pad) * s) * dpr;
      const y = (by + (p.y - this.pad) * s) * dpr;
      if (this.drag?.id === id) {
        const w = p.cv.width;
        const h = p.cv.height;
        g.drawImage(p.cv, x - w * 0.025, y - h * 0.025, w * 1.05, h * 1.05);
      } else {
        g.drawImage(p.cv, Math.round(x), Math.round(y));
      }
    }
    const now = performance.now();
    this.fx = this.fx.filter((f) => now - f.t0 < 500);
    for (const f of this.fx) {
      const a = 1 - (now - f.t0) / 500;
      const p = this.pieces[f.id];
      g.setTransform(dpr * s, 0, 0, dpr * s, (bx + p.x * s) * dpr, (by + p.y * s) * dpr);
      g.strokeStyle = f.kind === 'snap' ? `rgba(255,255,255,${0.9 * a})` : `rgba(255,90,90,${0.9 * a})`;
      g.lineWidth = (2 + 4 * a) / s;
      g.stroke(p.path);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (this.finale) this.drawFinale(g, now);
    if (this.finale && !this.finale.active) {
      this.finale = null;
      this.renderBoard();
      this.requestDraw();
    } else if (this.fx.length || this.finale) {
      this.requestDraw();
    }
  }

  drawFinale(g, now) {
    const f = this.finale;
    const t = (now - f.t0) / 1000;
    const { dpr, bx, by, bw, bh, ch } = this.view;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.globalAlpha = Math.min(1, t / 0.7);
    g.drawImage(this.image, bx, by, bw, bh);
    g.globalAlpha = 1;
    if (t > 0.3 && t < 1.4 && !reduceMotion.matches) {
      // 판 위로 지나가는 반짝임
      const u = (t - 0.3) / 1.1;
      const x = bx - bw * 0.4 + bw * 1.8 * u;
      g.save();
      g.beginPath();
      g.rect(bx, by, bw, bh);
      g.clip();
      const grad = g.createLinearGradient(x - bw * 0.15, by, x + bw * 0.15, by + bh);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,.35)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(bx, by, bw, bh);
      g.restore();
    }
    let alive = t < 1.5;
    for (const c of f.bits) {
      const x = c.x + c.vx * t;
      const y = c.y + c.vy * t + 520 * t * t;
      if (y > ch + 20) continue;
      alive = true;
      g.save();
      g.translate(x, y);
      g.rotate(c.rot + c.vr * t);
      g.fillStyle = c.color;
      g.fillRect(-c.w / 2, -c.h / 2, c.w, c.h * Math.abs(Math.cos(t * c.flip)));
      g.restore();
    }
    f.active = alive && t < 4;
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ── 조작 ──────────────────────────────────────────────
  local(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  pick(x, y, type) {
    const { bx, by, s } = this.view;
    const { pw, ph } = this.P;
    const m = this.S * 0.4;
    for (let i = this.order.length - 1; i >= 0; i--) {
      const p = this.pieces[this.order[i]];
      const lx = (x - bx) / s - p.x;
      const ly = (y - by) / s - p.y;
      if (lx < -m || ly < -m || lx > pw + m || ly > ph + m) continue;
      if (this.hit.isPointInPath(p.path, lx, ly)) return p.id;
    }
    if (type === 'mouse') return null;
    // 손가락은 작은 조각을 집기 어려우니 가까운 조각을 넉넉히 집어 줘요.
    let best = null;
    let bestD = Math.max(this.S * s * 0.75, 22);
    for (let i = this.order.length - 1; i >= 0; i--) {
      const p = this.pieces[this.order[i]];
      const d = Math.hypot(x - (bx + (p.x + pw / 2) * s), y - (by + (p.y + ph / 2) * s));
      if (d < bestD) {
        bestD = d;
        best = p.id;
      }
    }
    return best;
  }

  down(e) {
    if (!this.view || this.done || this.paused || this.drag) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const [x, y] = this.local(e);
    const id = this.pick(x, y, e.pointerType);
    if (id == null) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* 이미 끝난 포인터 */
    }
    this.order.splice(this.order.indexOf(id), 1);
    this.order.push(id);
    const p = this.pieces[id];
    const { bx, by, s } = this.view;
    this.drag = { id, pid: e.pointerId, dx: x - (bx + p.x * s), dy: y - (by + p.y * s), sx: x, sy: y, moved: 0 };
    this.canvas.classList.add('grabbing');
    this.startClock();
    sound.pick();
    this.requestDraw();
  }

  move(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    const [x, y] = this.local(e);
    const { bx, by, s } = this.view;
    const p = this.pieces[d.id];
    p.x = (x - d.dx - bx) / s;
    p.y = (y - d.dy - by) / s;
    d.moved = Math.max(d.moved, Math.hypot(x - d.sx, y - d.sy));
    this.clamp(p);
    this.requestDraw();
  }

  up(e, cancelled) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pid) return;
    this.drag = null;
    this.canvas.classList.remove('grabbing');
    const p = this.pieces[d.id];
    const { pw, ph } = this.P;
    const near = Math.hypot(p.x - p.c * pw, p.y - p.r * ph) <= Math.max(this.S * 0.28, 18 / this.view.s);
    if (near) {
      this.moves++;
      this.place(p);
    } else if (d.moved >= 3 && !cancelled) {
      this.moves++;
      // 판 위의 엉뚱한 자리에 내려놓으면 실수로 쳐요.
      const cx = p.x + pw / 2;
      const cy = p.y + ph / 2;
      if (cx > 0 && cy > 0 && cx < this.W && cy < this.H) {
        this.mistakes++;
        this.fx.push({ id: p.id, t0: performance.now(), kind: 'miss' });
        sound.miss();
      }
    }
    this.cb.onChange?.();
    this.requestDraw();
  }

  place(p) {
    p.placed = true;
    p.x = p.c * this.P.pw;
    p.y = p.r * this.P.ph;
    p.cv = null;
    this.order = this.order.filter((id) => id !== p.id);
    this.placedCount++;
    this.stamp(p);
    this.fx.push({ id: p.id, t0: performance.now(), kind: 'snap' });
    sound.snap();
    this.cb.onProgress?.(this.placedCount, this.total);
    if (this.placedCount === this.total) this.finish();
  }

  toggleGhost() {
    if (this.done) return this.ghost;
    this.ghost = !this.ghost;
    if (this.ghost) this.hintUsed = true;
    this.renderBoard();
    this.requestDraw();
    this.cb.onChange?.();
    return this.ghost;
  }

  finish() {
    this.done = true;
    this.stopClock();
    this.drag = null;
    sound.win();
    const { bx, by, bw, bh } = this.view;
    const bits = [];
    if (!reduceMotion.matches) {
      for (let i = 0; i < 160; i++) {
        const a = Math.random() * Math.PI * 2;
        const v = 250 + Math.random() * 550;
        bits.push({
          x: bx + bw / 2 + (Math.random() - 0.5) * bw * 0.3,
          y: by + bh / 2,
          vx: Math.cos(a) * v,
          vy: Math.sin(a) * v - 380,
          rot: Math.random() * 6,
          vr: (Math.random() - 0.5) * 12,
          flip: 4 + Math.random() * 8,
          w: 6 + Math.random() * 6,
          h: 8 + Math.random() * 8,
          color: CONFETTI[i % CONFETTI.length],
        });
      }
    }
    this.finale = { t0: performance.now(), bits, active: true };
    this.requestDraw();
    const stats = {
      seconds: Math.max(1, Math.round(this.time / 1000)),
      mistakes: this.mistakes,
      moves: this.moves,
      pieces: this.total,
      hintUsed: this.hintUsed,
    };
    setTimeout(() => this.cb.onComplete?.(stats), reduceMotion.matches ? 300 : 1300);
  }

  snapshot() {
    const r1 = (v) => Math.round(v * 10) / 10;
    return {
      pieces: this.pieces.map((p) => [r1(p.x), r1(p.y), p.placed ? 1 : 0]),
      order: [...this.order],
      mistakes: this.mistakes,
      moves: this.moves,
      elapsed: Math.round(this.time),
      hintUsed: this.hintUsed,
    };
  }
}
