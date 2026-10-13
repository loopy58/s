// 직소 조각 모양 만들기
// 이웃한 두 조각은 같은 곡선을 나눠 쓰므로, 경계선을 한 번만 만들고 양쪽에서 방향만 바꿔 그립니다.
import { mulberry32 } from './rng.js';

export const LEVELS = [
  { id: 'easy', name: '쉬움', n: 12 },
  { id: 'normal', name: '보통', n: 24 },
  { id: 'hard', name: '어려움', n: 48 },
  { id: 'expert', name: '고수', n: 96 },
  { id: 'master', name: '달인', n: 150 },
];

// 그림 비율에 맞춰 조각이 정사각형에 가깝도록 가로·세로 칸 수를 정합니다.
export function gridFor(n, aspect) {
  const cols = Math.max(2, Math.round(Math.sqrt(n * aspect)));
  const rows = Math.max(2, Math.round(n / cols));
  return { cols, rows };
}

const TAB = 0.1; // 볼록한 부분 크기 (조각 짧은 변 기준)
const JITTER = 0.04; // 조각마다 모양이 조금씩 달라지는 정도

// 경계선 하나 = 3개의 3차 베지어 곡선(점 10개). 볼록·오목 방향은 flip(±1)으로 정해요.
export function cutPuzzle(W, H, cols, rows, seed) {
  const rand = mulberry32(seed);
  const jit = () => (rand() * 2 - 1) * JITTER;
  const pw = W / cols;
  const ph = H / rows;
  const S = Math.min(pw, ph);

  function line(count, from, to) {
    const edges = [];
    let prevE = 0;
    let prevFlip = 1;
    for (let i = 0; i < count; i++) {
      const flip = rand() < 0.5 ? 1 : -1;
      // 이어지는 경계선이 꺾이지 않도록 앞 경계선의 끝 기울기를 이어받아요.
      const a = i === 0 ? jit() : -prevE * prevFlip * flip;
      const b = jit();
      const c = jit();
      const d = jit();
      const e = jit();
      const [ax, ay] = from(i);
      const [bx, by] = to(i);
      const L = Math.hypot(bx - ax, by - ay);
      const ux = (bx - ax) / L;
      const uy = (by - ay) / L;
      const nx = -uy * flip;
      const ny = ux * flip;
      const mid = L / 2;
      const t = TAB;
      // [경계선 방향 거리(px), 수직 방향 거리(S 배수)]
      const pts = [
        [0, 0],
        [0.2 * L, a],
        [mid + (b + d) * S, -t + c],
        [mid + (-t + b) * S, t + c],
        [mid + (-2 * t + b - d) * S, 3 * t + c],
        [mid + (2 * t + b - d) * S, 3 * t + c],
        [mid + (t + b) * S, t + c],
        [mid + (b + d) * S, -t + c],
        [0.8 * L, e],
        [L, 0],
      ];
      edges.push(pts.map(([s, q]) => [ax + ux * s + nx * q * S, ay + uy * s + ny * q * S]));
      prevE = e;
      prevFlip = flip;
    }
    return edges;
  }

  const h = []; // h[r][c]: r번째 가로줄(y = r*ph)의 c번째 경계선
  const v = []; // v[c][r]: c번째 세로줄(x = c*pw)의 r번째 경계선
  for (let r = 1; r < rows; r++) h[r] = line(cols, (i) => [i * pw, r * ph], (i) => [(i + 1) * pw, r * ph]);
  for (let c = 1; c < cols; c++) v[c] = line(rows, (i) => [c * pw, i * ph], (i) => [c * pw, (i + 1) * ph]);
  return { W, H, cols, rows, pw, ph, S, h, v };
}

// 조각 하나의 외곽선. 좌표는 조각 칸의 왼쪽 위를 (0, 0)으로 하는 그림 픽셀 단위예요.
export function piecePath(P, c, r) {
  const { cols, rows, pw, ph, h, v } = P;
  const ox = c * pw;
  const oy = r * ph;
  const path = new Path2D();
  const fwd = (e) => {
    path.lineTo(e[0][0] - ox, e[0][1] - oy);
    for (let i = 1; i < 10; i += 3) {
      path.bezierCurveTo(e[i][0] - ox, e[i][1] - oy, e[i + 1][0] - ox, e[i + 1][1] - oy, e[i + 2][0] - ox, e[i + 2][1] - oy);
    }
  };
  const rev = (e) => {
    path.lineTo(e[9][0] - ox, e[9][1] - oy);
    for (let i = 8; i > 0; i -= 3) {
      path.bezierCurveTo(e[i][0] - ox, e[i][1] - oy, e[i - 1][0] - ox, e[i - 1][1] - oy, e[i - 2][0] - ox, e[i - 2][1] - oy);
    }
  };
  path.moveTo(0, 0);
  if (r === 0) path.lineTo(pw, 0);
  else fwd(h[r][c]);
  if (c === cols - 1) path.lineTo(pw, ph);
  else fwd(v[c + 1][r]);
  if (r === rows - 1) path.lineTo(0, ph);
  else rev(h[r + 1][c]);
  if (c === 0) path.lineTo(0, 0);
  else rev(v[c][r]);
  path.closePath();
  return path;
}
