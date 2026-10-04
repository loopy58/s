// 나무·건물·탈것·동물 같은 소품을 기본 도형으로 만듭니다.
import * as THREE from 'three';
import { toon, basic, G, mesh, gableGeo, hipGeo, canvasTexture, signTexture, texturedToon, FONT_UI } from './toon.js';

const F = { flat: true };
const leafMat = (c) => toon(c, F);

// ───────── 나무 ─────────
export function makeTree(kind, rand = Math.random, theme = {}) {
  const g = new THREE.Group();
  const s = 0.85 + rand() * 0.4;
  const trunk = '#8b5e3c';
  switch (kind) {
    case 'pine':
    case 'pine_snow': {
      g.add(mesh(G.cyl(0.16, 0.22, 1.0, 6), trunk, 0, 0.5, 0));
      const greens = ['#2f7d4a', '#3a8f57', '#46a063'];
      for (let i = 0; i < 3; i++) {
        const r = 1.35 - i * 0.33;
        const y = 1.25 + i * 0.85;
        g.add(mesh(G.cone(r, 1.4, 7), leafMat(greens[i]), 0, y, 0));
        if (kind === 'pine_snow') g.add(mesh(G.cone(r * 0.55, 0.62, 7), leafMat('#f7fbff'), 0, y + 0.42, 0));
      }
      break;
    }
    case 'bare': {
      const c = '#7a5a45';
      g.add(mesh(G.cyl(0.14, 0.24, 2.4, 6), c, 0, 1.2, 0));
      for (let i = 0; i < 4; i++) {
        const a = i * 1.7 + rand();
        const b = mesh(G.cyl(0.05, 0.09, 1.2, 5), c, Math.cos(a) * 0.35, 2.0 + i * 0.15, Math.sin(a) * 0.35);
        b.rotation.z = Math.cos(a) * 0.8;
        b.rotation.x = -Math.sin(a) * 0.8;
        g.add(b);
      }
      g.add(mesh(G.ico(0.45, 0), leafMat('#f5f9fc'), 0, 2.6, 0, { s: [1.2, 0.5, 1.2] }));
      break;
    }
    case 'cherry':
    case 'round':
    case 'mango': {
      const cols = kind === 'cherry' ? ['#ffb7cf', '#ffa0bf', '#ffd1e0'] : kind === 'mango' ? ['#2e7d32', '#388e3c', '#43a047'] : ['#5fae4a', '#6cbf55', '#4f9e3d'];
      const big = kind === 'mango' ? 1.25 : 1;
      g.add(mesh(G.cyl(0.18 * big, 0.26 * big, 1.6, 7), kind === 'cherry' ? '#6d4c41' : trunk, 0, 0.8, 0));
      g.add(mesh(G.ico(1.15 * big, 1), leafMat(cols[0]), 0, 2.3 * big, 0));
      g.add(mesh(G.ico(0.8 * big, 1), leafMat(cols[1]), 0.6 * big, 2.0 * big, 0.3));
      g.add(mesh(G.ico(0.75 * big, 1), leafMat(cols[2]), -0.55 * big, 2.15 * big, -0.25));
      if (kind === 'mango') for (let i = 0; i < 4; i++) g.add(mesh(G.sphere(0.13, 8, 6), '#ffb300', Math.cos(i * 1.6) * 1.1, 1.8 + (i % 2) * 0.3, Math.sin(i * 1.6) * 1.1));
      break;
    }
    case 'banyan': {
      g.add(mesh(G.cyl(0.35, 0.5, 2.0, 8), '#7b5b43', 0, 1.0, 0));
      g.add(mesh(G.ico(1.6, 1), leafMat('#4c8f3a'), 0, 2.9, 0, { s: [1.3, 0.7, 1.3] }));
      g.add(mesh(G.ico(1.1, 1), leafMat('#5aa046'), 1.0, 3.1, 0.6, { s: [1.2, 0.6, 1.2] }));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(G.cyl(0.03, 0.03, 1.8, 4), '#8d6e63', Math.cos(a) * 1.3, 1.5, Math.sin(a) * 1.3));
      }
      break;
    }
    case 'palm': {
      let x = 0;
      let y = 0;
      const lean = (rand() - 0.5) * 0.5;
      for (let i = 0; i < 6; i++) {
        const seg = mesh(G.cyl(0.13, 0.17, 0.62, 6), i % 2 ? '#a07850' : '#8f6a45', x, y + 0.31, 0);
        seg.rotation.z = -lean * 0.5;
        g.add(seg);
        x += lean * 0.22;
        y += 0.58;
      }
      const top = new THREE.Group();
      top.position.set(x, y, 0);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const leaf = new THREE.Group();
        leaf.rotation.y = a;
        const blade = mesh(G.box(0.38, 0.05, 1.9), leafMat(i % 2 ? '#3f9b45' : '#4caf50'), 0, -0.25, 0.85, { rx: 0.45 });
        leaf.add(blade);
        top.add(leaf);
      }
      for (let i = 0; i < 3; i++) top.add(mesh(G.sphere(0.13, 8, 6), '#6d4c2f', Math.cos(i * 2) * 0.18, -0.15, Math.sin(i * 2) * 0.18));
      g.add(top);
      break;
    }
    case 'banana': {
      g.add(mesh(G.cyl(0.16, 0.22, 1.4, 7), '#7cb342', 0, 0.7, 0));
      for (let i = 0; i < 5; i++) {
        const leaf = new THREE.Group();
        leaf.position.y = 1.3;
        leaf.rotation.y = (i / 5) * Math.PI * 2 + rand();
        leaf.add(mesh(G.sphere(0.5, 8, 6), leafMat(i % 2 ? '#7cc443' : '#8bd450'), 0, 0.45, 0.6, { s: [0.55, 0.12, 1.6], rx: -0.6 }));
        g.add(leaf);
      }
      break;
    }
    case 'acacia': {
      const t = mesh(G.cyl(0.12, 0.2, 2.2, 6), '#6d4c41', 0, 1.1, 0);
      g.add(t);
      for (const sx of [-1, 1]) {
        const b = mesh(G.cyl(0.07, 0.1, 1.2, 5), '#6d4c41', sx * 0.35, 2.4, 0, { rz: -sx * 0.6 });
        g.add(b);
      }
      g.add(mesh(G.cyl(1.9, 1.6, 0.45, 9), leafMat('#6f9a3a'), 0, 3.05, 0));
      g.add(mesh(G.cyl(1.3, 1.5, 0.3, 9), leafMat('#7fae45'), 0.3, 3.35, 0.2));
      break;
    }
    case 'baobab': {
      g.add(mesh(G.cyl(0.65, 0.95, 3.2, 9), '#a1887f', 0, 1.6, 0));
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const b = mesh(G.cyl(0.07, 0.14, 1.1, 5), '#a1887f', Math.cos(a) * 0.5, 3.5, Math.sin(a) * 0.5);
        b.rotation.z = Math.cos(a) * 0.7;
        b.rotation.x = -Math.sin(a) * 0.7;
        g.add(b);
        g.add(mesh(G.ico(0.4, 0), leafMat('#7cb342'), Math.cos(a) * 0.95, 3.95, Math.sin(a) * 0.95));
      }
      break;
    }
    default:
      g.add(mesh(G.cyl(0.18, 0.26, 1.6, 7), trunk, 0, 0.8, 0));
      g.add(mesh(G.ico(1.1, 1), leafMat('#5fae4a'), 0, 2.2, 0));
  }
  g.scale.setScalar(s);
  g.rotation.y = rand() * Math.PI * 2;
  g.userData.radius = { baobab: 1.0, banyan: 0.6, mango: 0.45 }[kind] ?? 0.35;
  return g;
}

export function makeRock(rand = Math.random, color = '#9e9e9e') {
  const r = mesh(G.dodeca(0.6), toon(color, F), 0, 0.25, 0, { s: [1 + rand() * 0.8, 0.6 + rand() * 0.5, 1 + rand() * 0.6], ry: rand() * 3 });
  const g = new THREE.Group();
  g.add(r);
  return g;
}

// ───────── 건물 ─────────
function windowTexture(cols, rows, wall, glass = '#8ecae6', frame = '#ffffff') {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = wall;
    ctx.fillRect(0, 0, w, h);
    const cw = w / cols;
    const rh = h / rows;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = i * cw + cw * 0.18;
        const y = j * rh + rh * 0.2;
        ctx.fillStyle = frame;
        ctx.fillRect(x - 3, y - 3, cw * 0.64 + 6, rh * 0.55 + 6);
        ctx.fillStyle = (i * 7 + j * 3) % 5 === 0 ? '#ffe9a8' : glass;
        ctx.fillRect(x, y, cw * 0.64, rh * 0.55);
      }
    }
  });
}

function signBoard(text, opts, w = 3, h = 0.75) {
  const tex = signTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), texturedToon(tex));
  m.castShadow = false;
  return m;
}

function door(color = '#6d4c41', w = 1.0, h = 1.6) {
  return mesh(G.box(w, h, 0.12), color, 0, h / 2, 0);
}

export function makeBuilding(def, rand = Math.random) {
  const g = new THREE.Group();
  let w = 4;
  let d = 4;
  const T = def.type;
  if (T === 'clinic') {
    w = 9; d = 6;
    g.add(mesh(G.box(w + 0.4, 0.3, d + 0.4), '#cfd8dc', 0, 0.15, 0, { receive: true }));
    g.add(mesh(G.box(w, 4, d), '#fbfaf5', 0, 2.3, 0));
    g.add(mesh(G.box(w + 0.3, 0.35, d + 0.3), '#4fb3a9', 0, 4.45, 0));
    g.add(mesh(G.box(w * 0.92, 0.12, d * 0.9), '#e0e0e0', 0, 4.68, 0));
    // 창문
    for (const sx of [-1, 1]) {
      g.add(mesh(G.box(2.2, 1.3, 0.1), '#9ad1e6', sx * 2.9, 2.3, d / 2 + 0.02));
      g.add(mesh(G.box(2.4, 0.12, 0.2), '#ffffff', sx * 2.9, 1.6, d / 2 + 0.06));
    }
    // 유리문 + 차양
    g.add(mesh(G.box(1.9, 2.3, 0.12), '#7fb8d6', 0, 1.45, d / 2 + 0.02));
    g.add(mesh(G.box(0.06, 2.3, 0.14), '#ffffff', 0, 1.45, d / 2 + 0.05));
    g.add(mesh(G.box(2.8, 0.15, 1.2), '#4fb3a9', 0, 2.85, d / 2 + 0.55));
    // 간판과 십자 표시(초록 십자)
    const sign = signBoard(def.name || '진료소', { bg: '#ffffff', fg: '#2a7f78', border: '#4fb3a9' }, 4.6, 1.1);
    sign.position.set(0, 3.55, d / 2 + 0.08);
    g.add(sign);
    const plus = new THREE.Group();
    plus.add(mesh(G.box(0.95, 0.3, 0.12), '#43a047', 0, 0, 0));
    plus.add(mesh(G.box(0.3, 0.95, 0.12), '#43a047', 0, 0, 0));
    plus.add(mesh(G.cyl(0.62, 0.62, 0.1, 20), '#ffffff', 0, 0, -0.08, { rx: Math.PI / 2 }));
    plus.position.set(0, 5.4, d / 2 - 0.6);
    g.add(plus);
    g.add(mesh(G.box(0.12, 0.8, 0.12), '#b0bec5', 0, 4.9, d / 2 - 0.7));
    if (def.ribbon) {
      const rb = signBoard('🎗️ 무료 HIV 검사', { bg: '#fff', fg: '#c62828', border: '#e53935', size: 60 }, 3.2, 0.8);
      rb.position.set(3.4, 0.9, d / 2 + 0.6);
      g.add(rb);
      g.add(mesh(G.box(0.1, 1.2, 0.1), '#9e9e9e', 3.4, 0.6, d / 2 + 0.55));
    }
  } else if (T === 'apartment') {
    w = 6; d = 5;
    const floors = def.floors || 6;
    const h = floors * 1.3;
    const tex = windowTexture(4, floors, def.color || '#e9dccb');
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const mat = texturedToon(tex);
    g.add(mesh(G.box(w, h, d), mat, 0, h / 2, 0));
    g.add(mesh(G.box(w + 0.3, 0.3, d + 0.3), '#8d99a6', 0, h + 0.15, 0));
    g.add(mesh(G.box(1.6, 2.0, 0.1), '#5d6d7e', 0, 1.0, d / 2 + 0.02));
  } else if (T === 'shop') {
    w = 4.5; d = 3.6;
    g.add(mesh(G.box(w, 3.2, d), '#f5f0e6', 0, 1.6, 0));
    g.add(mesh(G.box(w + 0.2, 0.3, d + 0.2), def.color || '#f28b82', 0, 3.35, 0));
    g.add(mesh(G.box(3.4, 1.7, 0.1), '#a8dadc', 0, 1.25, d / 2 + 0.02));
    // 줄무늬 차양
    for (let i = 0; i < 6; i++) g.add(mesh(G.box(w / 6, 0.08, 1.1), i % 2 ? '#ffffff' : def.color || '#f28b82', -w / 2 + w / 12 + (i * w) / 6, 2.45, d / 2 + 0.5, { rx: 0.35 }));
    const sign = signBoard(def.sign || '가게', { bg: def.signColor || '#2e7d32', fg: '#ffffff' }, 3, 0.75);
    sign.position.set(0, 2.95, d / 2 + 0.07);
    g.add(sign);
  } else if (T === 'house') {
    w = 4.4; d = 4;
    g.add(mesh(G.box(w, 2.6, d), def.color || '#fff3e0', 0, 1.3, 0));
    g.add(mesh(gableGeo(w + 0.7, 1.6, d + 0.5), toon(def.roof || '#e57373', F), 0, 2.6, 0, { ry: Math.PI / 2 }));
    const dr = door('#8d6e63', 0.9, 1.6);
    dr.position.z = d / 2 + 0.03;
    g.add(dr);
    for (const sx of [-1, 1]) g.add(mesh(G.box(0.8, 0.8, 0.08), '#90caf9', sx * 1.3, 1.6, d / 2 + 0.02));
    g.add(mesh(G.box(0.5, 1.1, 0.5), '#8d6e63', 1.2, 3.5, -0.6));
  } else if (T === 'hanok') {
    w = 6; d = 4;
    g.add(mesh(G.box(w + 0.6, 0.5, d + 0.6), '#a7a39b', 0, 0.25, 0, { receive: true }));
    g.add(mesh(G.box(w, 2.0, d), '#f7f1e3', 0, 1.5, 0));
    for (const sx of [-1, -0.33, 0.33, 1]) g.add(mesh(G.box(0.22, 2.0, 0.22), '#7b4a2d', sx * (w / 2 - 0.1), 1.5, d / 2));
    g.add(mesh(G.box(w, 0.2, 0.24), '#7b4a2d', 0, 2.45, d / 2));
    for (const sx of [-1, 0, 1]) g.add(mesh(G.box(1.2, 1.2, 0.08), '#e9dcc0', sx * 1.9, 1.4, d / 2 + 0.03));
    g.add(mesh(hipGeo(w + 2.2, 1.4, d + 2.0), toon('#4f5966', F), 0, 2.55, 0));
    g.add(mesh(G.box(w * 0.6, 0.25, 0.3), '#3c444f', 0, 3.9, 0));
    g.add(mesh(G.box(w + 1.0, 0.18, 0.4), '#5c6673', 0, 2.62, d / 2 + 0.95));
  } else if (T === 'school') {
    w = 13; d = 5;
    const tex = windowTexture(8, 3, '#f6efe0', '#a5d8ff', '#e0c9a6');
    g.add(mesh(G.box(w, 6.5, d), texturedToon(tex), 0, 3.25, 0));
    g.add(mesh(G.box(w + 0.4, 0.4, d + 0.4), '#c0705a', 0, 6.7, 0));
    g.add(mesh(G.box(3, 8, d + 0.6), '#efe3cc', 0, 4, 0.2));
    g.add(mesh(G.cyl(0.85, 0.85, 0.12, 24), '#ffffff', 0, 6.6, d / 2 + 0.55, { rx: Math.PI / 2 }));
    g.add(mesh(G.box(0.08, 0.6, 0.05), '#333', 0, 6.75, d / 2 + 0.62));
    g.add(mesh(G.box(0.45, 0.08, 0.05), '#333', 0.18, 6.6, d / 2 + 0.62));
    g.add(mesh(G.box(2.0, 2.4, 0.12), '#8d6e63', 0, 1.2, d / 2 + 0.33));
    const sign = signBoard('햇살초등학교', { bg: '#fff8e1', fg: '#6d4c41', border: '#c0705a' }, 2.8, 0.7);
    sign.position.set(0, 2.9, d / 2 + 0.35);
    g.add(sign);
    g.add(mesh(G.cyl(0.06, 0.06, 7, 6), '#bdbdbd', w / 2 + 1.2, 3.5, 2));
    // 학교 깃발 (교기)
    const flagTex = canvasTexture(192, 128, (ctx, fw, fh) => {
      ctx.fillStyle = '#2a9d8f';
      ctx.fillRect(0, 0, fw, fh);
      ctx.fillStyle = '#ffd166';
      ctx.font = `64px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('햇살', fw / 2, fh / 2 + 4);
    });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), texturedToon(flagTex));
    flag.material.side = THREE.DoubleSide;
    flag.position.set(w / 2 + 1.9, 6.45, 2);
    g.add(flag);
  } else if (T === 'playground') {
    w = 8; d = 6;
    // 미끄럼틀
    g.add(mesh(G.box(1.2, 0.12, 3.4), '#ff7043', -1.5, 1.0, 0.6, { rx: 0.55 }));
    g.add(mesh(G.box(1.4, 0.15, 1.2), '#ffca28', -1.5, 1.95, -1.4));
    for (const sx of [-0.6, 0.6]) for (const sz of [-1.9, -0.9]) g.add(mesh(G.cyl(0.06, 0.06, 2, 6), '#42a5f5', -1.5 + sx, 1, sz));
    // 그네
    for (const sx of [1.0, 3.6]) g.add(mesh(G.box(0.15, 2.6, 0.15), '#66bb6a', sx, 1.3, 0));
    g.add(mesh(G.box(2.9, 0.15, 0.15), '#66bb6a', 2.3, 2.6, 0));
    for (const sx of [1.7, 2.9]) {
      g.add(mesh(G.cyl(0.02, 0.02, 1.8, 4), '#9e9e9e', sx, 1.7, 0));
      g.add(mesh(G.box(0.6, 0.08, 0.3), '#ef5350', sx, 0.8, 0));
    }
    g.add(mesh(G.cyl(1.4, 1.5, 0.2, 16), '#f3e0b5', 1.5, 0.1, 2.3, { receive: true }));
  } else if (T === 'desert_house') {
    w = 5; d = 4.5;
    const c = '#e2c08d';
    g.add(mesh(G.box(w, 3, d), c, 0, 1.5, 0));
    for (let i = 0; i < 6; i++) {
      g.add(mesh(G.box(0.45, 0.45, 0.45), c, -w / 2 + 0.3 + (i * (w - 0.6)) / 5, 3.2, d / 2 - 0.2));
      g.add(mesh(G.box(0.45, 0.45, 0.45), c, -w / 2 + 0.3 + (i * (w - 0.6)) / 5, 3.2, -d / 2 + 0.2));
    }
    g.add(mesh(G.box(1.0, 1.8, 0.1), '#7a4e2d', 0, 0.9, d / 2 + 0.02));
    for (const sx of [-1, 1]) g.add(mesh(G.box(0.6, 0.8, 0.1), '#5b3a22', sx * 1.5, 1.9, d / 2 + 0.02));
    if (def.dome) {
      g.add(mesh(new THREE.SphereGeometry(1.4, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), toon('#f1e3c6'), 0, 3.0, 0));
      g.add(mesh(G.cyl(0.05, 0.05, 0.6, 4), '#c9a227', 0, 4.65, 0));
    }
  } else if (T === 'chinese_house') {
    w = 6; d = 4.5;
    g.add(mesh(G.box(w + 0.4, 0.35, d + 0.4), '#9e9e9e', 0, 0.17, 0));
    g.add(mesh(G.box(w, 2.6, d), def.color || '#f3e0c0', 0, 1.65, 0));
    for (const sx of [-1, -0.33, 0.33, 1]) g.add(mesh(G.cyl(0.14, 0.14, 2.6, 8), '#c62828', sx * (w / 2 - 0.1), 1.65, d / 2 + 0.2));
    g.add(mesh(hipGeo(w + 2, 1.5, d + 1.8), toon('#5d6b73', F), 0, 2.95, 0));
    g.add(mesh(G.box(w * 0.7, 0.3, 0.35), '#46525a', 0, 4.4, 0));
    for (const sx of [-1, 1]) g.add(mesh(G.cone(0.2, 0.6, 5), '#46525a', sx * (w / 2 + 0.8), 3.15, d / 2 + 0.8, { rz: sx * 0.9 }));
    for (const sx of [-1.5, 1.5]) {
      g.add(mesh(G.sphere(0.32, 12, 10), toon('#e53935', { emissive: '#ff5252', emissiveIntensity: 0.35 }), sx, 2.3, d / 2 + 0.7, { s: [1, 1.2, 1] }));
      g.add(mesh(G.cyl(0.18, 0.18, 0.1, 10), '#ffd54f', sx, 2.72, d / 2 + 0.7));
    }
    g.add(mesh(G.box(1.2, 1.9, 0.1), '#8d2c1e', 0, 1.3, d / 2 + 0.02));
  } else if (T === 'stilt_house') {
    w = 4.4; d = 3.8;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.cyl(0.12, 0.12, 1.4, 6), '#6d4c41', sx * (w / 2 - 0.2), 0.7, sz * (d / 2 - 0.2)));
    g.add(mesh(G.box(w + 0.4, 0.2, d + 0.4), '#8d6e63', 0, 1.45, 0));
    g.add(mesh(G.box(w, 2.0, d), '#c8a27a', 0, 2.55, 0));
    g.add(mesh(gableGeo(w + 0.9, 1.3, d + 0.7), toon('#90a4ae', F), 0, 3.55, 0, { ry: Math.PI / 2 }));
    g.add(mesh(G.box(0.9, 1.4, 0.08), '#5d4037', 0, 2.3, d / 2 + 0.02));
    for (let i = 0; i < 4; i++) g.add(mesh(G.box(0.8, 0.06, 0.12), '#795548', 0, 0.3 + i * 0.35, d / 2 + 0.5 + i * 0.05));
  } else if (T === 'tube_house') {
    w = 3; d = 4.5;
    const h = 6.5;
    g.add(mesh(G.box(w, h, d), def.color || '#ffd54f', 0, h / 2, 0));
    for (let f = 0; f < 3; f++) {
      g.add(mesh(G.box(1.6, 1.2, 0.08), '#80deea', 0, 1.2 + f * 2.1, d / 2 + 0.02));
      if (f > 0) {
        g.add(mesh(G.box(w * 0.9, 0.12, 0.8), '#eeeeee', 0, 0.55 + f * 2.1, d / 2 + 0.4));
        g.add(mesh(G.box(w * 0.9, 0.5, 0.05), '#90a4ae', 0, 0.85 + f * 2.1, d / 2 + 0.78));
        g.add(mesh(G.sphere(0.25, 8, 6), leafMat('#43a047'), 0.9, 1.0 + f * 2.1, d / 2 + 0.45));
      }
    }
    g.add(mesh(G.box(w + 0.2, 0.25, d + 0.2), '#bdbdbd', 0, h + 0.12, 0));
  } else if (T === 'hut') {
    w = 3.6; d = 3.6;
    g.add(mesh(G.cyl(1.6, 1.7, 2.0, 12), '#c47f45', 0, 1.0, 0));
    g.add(mesh(G.cone(2.3, 1.8, 12), toon('#d8b45a', F), 0, 2.85, 0));
    g.add(mesh(G.box(0.8, 1.4, 0.1), '#4e342e', 0, 0.7, 1.62));
  } else if (T === 'tent') {
    w = 5; d = 4;
    g.add(mesh(gableGeo(w, 2.6, d), toon('#f5f7f8', F), 0, 0, 0, { ry: 0 }));
    g.add(mesh(G.box(1.0, 1.4, 0.05), '#90a4ae', 0, 0.7, d / 2 + 0.01));
    g.add(mesh(G.box(w, 0.18, 0.06), '#1e88e5', 0, 0.3, d / 2 + 0.02));
    if (def.label) {
      const s = signBoard(def.label, { bg: '#ffffff', fg: '#1565c0', border: '#1e88e5', size: 56 }, 3.2, 0.7);
      s.position.set(0, 1.9, d / 2 + 0.6);
      g.add(s);
      g.add(mesh(G.box(0.08, 1.6, 0.08), '#9e9e9e', 1.5, 0.8, d / 2 + 0.55));
    }
  } else if (T === 'hotel') {
    w = 6; d = 5;
    const tex = windowTexture(4, 8, '#e8d9c4', '#90caf9', '#ffffff');
    g.add(mesh(G.box(w, 10, d), texturedToon(tex), 0, 5, 0));
    const s = signBoard('HOTEL', { bg: '#b71c1c', fg: '#ffffff' }, 3, 0.75);
    s.position.set(0, 9.2, d / 2 + 0.05);
    g.add(s);
  } else if (T === 'market_stall') {
    w = 3; d = 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(mesh(G.cyl(0.05, 0.05, 2.2, 5), '#8d6e63', sx * 1.3, 1.1, sz * 0.8));
    g.add(mesh(G.box(2.8, 0.15, 1.6), '#a1887f', 0, 0.9, 0));
    g.add(mesh(G.box(3.2, 0.12, 2.2), def.color || '#e76f51', 0, 2.25, 0, { rz: 0.06 }));
    const fruits = ['#ffb300', '#e53935', '#7cb342', '#ff7043', '#fdd835'];
    for (let i = 0; i < 8; i++) g.add(mesh(G.sphere(0.13, 8, 6), fruits[i % 5], -1.1 + (i % 4) * 0.7, 1.1, -0.35 + Math.floor(i / 4) * 0.6));
  } else if (T === 'busstop') {
    w = 3.6; d = 1.4;
    g.add(mesh(G.box(3.6, 0.12, 1.4), '#90a4ae', 0, 2.5, 0));
    for (const sx of [-1, 1]) g.add(mesh(G.box(0.1, 2.5, 0.1), '#607d8b', sx * 1.6, 1.25, -0.5));
    g.add(mesh(G.box(3.4, 1.6, 0.06), basic('#bfe3f2', { transparent: true, opacity: 0.5 }), 0, 1.4, -0.6));
    g.add(mesh(G.box(2.4, 0.12, 0.5), '#8d6e63', 0, 0.5, -0.25));
    const s = signBoard('🚌 버스', { bg: '#1e88e5', fg: '#ffffff', size: 64 }, 1.4, 0.45);
    s.position.set(1.8, 2.2, 0.4);
    g.add(s);
  } else if (T === 'lamp') {
    w = 0.5; d = 0.5;
    g.add(mesh(G.cyl(0.07, 0.1, 3.4, 6), '#455a64', 0, 1.7, 0));
    g.add(mesh(G.sphere(0.25, 10, 8), toon('#fff6c9', { emissive: '#ffe082', emissiveIntensity: 0.8 }), 0, 3.5, 0));
  } else if (T === 'bench') {
    w = 2; d = 0.8;
    g.add(mesh(G.box(2, 0.12, 0.6), '#a1887f', 0, 0.5, 0));
    g.add(mesh(G.box(2, 0.5, 0.1), '#a1887f', 0, 0.85, -0.28));
    for (const sx of [-0.8, 0.8]) g.add(mesh(G.box(0.1, 0.5, 0.5), '#5d4037', sx, 0.25, 0));
  } else if (T === 'snowman') {
    w = 1.2; d = 1.2;
    g.add(mesh(G.sphere(0.7, 14, 10), '#ffffff', 0, 0.6, 0));
    g.add(mesh(G.sphere(0.48, 14, 10), '#ffffff', 0, 1.55, 0));
    g.add(mesh(G.cone(0.08, 0.35, 6), '#ff8f00', 0, 1.55, 0.55, { rx: Math.PI / 2 }));
    for (const sx of [-1, 1]) g.add(mesh(G.sphere(0.05, 6, 4), '#222', sx * 0.15, 1.7, 0.42));
    g.add(mesh(G.torus(0.42, 0.1, 6, 14), '#e53935', 0, 1.15, 0, { rx: Math.PI / 2 }));
    g.add(mesh(G.cyl(0.3, 0.3, 0.4, 12), '#263238', 0, 2.05, 0));
    g.add(mesh(G.cyl(0.45, 0.45, 0.05, 14), '#263238', 0, 1.86, 0));
  } else if (T === 'fence') {
    const len = def.len || 8;
    w = len; d = 0.3;
    for (let i = 0; i <= len; i += 1.2) g.add(mesh(G.box(0.15, 0.9, 0.15), '#ffffff', -len / 2 + i, 0.45, 0));
    g.add(mesh(G.box(len, 0.1, 0.08), '#ffffff', 0, 0.7, 0));
    g.add(mesh(G.box(len, 0.1, 0.08), '#ffffff', 0, 0.35, 0));
    g.userData.noCollide = false;
  } else if (T === 'jars') {
    w = 2.6; d = 1.8;
    g.add(mesh(G.box(2.8, 0.3, 2.0), '#9e9e9e', 0, 0.15, 0));
    const pos = [[-0.8, -0.4], [0, -0.45], [0.8, -0.4], [-0.4, 0.45], [0.45, 0.45]];
    pos.forEach(([x, z], i) => {
      const s = i < 3 ? 1 : 0.8;
      g.add(mesh(G.sphere(0.42 * s, 12, 10), '#6d4030', x, 0.62 * s + 0.2, z, { s: [1, 1.15, 1] }));
      g.add(mesh(G.cyl(0.28 * s, 0.3 * s, 0.1, 12), '#5a3426', x, 1.08 * s + 0.2, z));
    });
  } else if (T === 'well') {
    w = 1.6; d = 1.6;
    g.add(mesh(G.cyl(0.9, 0.9, 0.2, 14), '#bdbdbd', 0, 0.1, 0, { receive: true }));
    g.add(mesh(G.cyl(0.1, 0.12, 1.2, 8), '#2e7d32', 0, 0.8, 0));
    g.add(mesh(G.box(0.25, 0.3, 0.25), '#2e7d32', 0, 1.45, 0));
    g.add(mesh(G.box(0.08, 0.08, 0.9), '#2e7d32', 0, 1.55, -0.4, { rx: 0.4 }));
    g.add(mesh(G.cyl(0.06, 0.04, 0.3, 6), '#2e7d32', 0, 1.25, 0.25, { rx: Math.PI / 2 }));
    g.add(mesh(G.cyl(0.25, 0.2, 0.35, 10), '#ffb300', 0.2, 0.37, 0.45));
  } else if (T === 'boat') {
    w = 1.5; d = 4;
    g.add(mesh(G.box(1.2, 0.4, 3.4), '#8d6e63', 0, 0.05, 0));
    g.add(mesh(G.cone(0.6, 1.0, 4), '#8d6e63', 0, 0.05, 2.1, { rx: Math.PI / 2, ry: Math.PI / 4, s: [1, 1, 0.5] }));
    g.userData.noCollide = true;
  } else if (T === 'cages') {
    w = 3; d = 2;
    for (let i = 0; i < 3; i++) {
      const c = new THREE.Mesh(G.box(0.9, 0.8, 0.9), basic('#9e9e9e', { wireframe: true }));
      c.position.set(-1 + i * 1.0, 0.4 + (i === 1 ? 0.8 : 0), 0);
      g.add(c);
    }
    const s = signBoard('야생동물 거래 금지', { bg: '#ffebee', fg: '#c62828', border: '#e53935', size: 54 }, 2.4, 0.55);
    s.position.set(0, 2.1, 0.6);
    g.add(s);
  } else if (T === 'flower_shop') {
    w = 4; d = 2.5;
    g.add(mesh(G.box(3.6, 0.8, 1.6), '#8d6e63', 0, 0.4, 0));
    g.add(mesh(G.box(4, 0.12, 2.4), '#ec407a', 0, 2.4, 0.2, { rz: 0.04 }));
    for (const sx of [-1.8, 1.8]) g.add(mesh(G.cyl(0.05, 0.05, 2.4, 5), '#6d4c41', sx, 1.2, 1.1));
    const cols = ['#ff4081', '#ffeb3b', '#ffffff', '#ff7043', '#ab47bc'];
    for (let i = 0; i < 6; i++) {
      const x = -1.4 + i * 0.56;
      g.add(mesh(G.cyl(0.2, 0.15, 0.35, 8), '#4fc3f7', x, 0.98, 0.3));
      g.add(mesh(G.ico(0.22, 0), toon(cols[i % 5], F), x, 1.3, 0.3));
    }
    for (let i = 0; i < 3; i++) g.add(mesh(G.cyl(0.3, 0.28, 0.4, 10), '#90a4ae', -1.2 + i * 1.2, 0.2, 1.3));
    for (let i = 0; i < 3; i++) g.add(mesh(G.cyl(0.26, 0.26, 0.02, 10), basic('#4fa3d8'), -1.2 + i * 1.2, 0.38, 1.3));
  } else if (T === 'ribbon_banner') {
    w = 2.5; d = 0.5;
    const tex = canvasTexture(256, 320, (ctx, cw, ch) => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, cw, ch);
      ctx.strokeStyle = '#e53935';
      ctx.lineWidth = 34;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(78, 260);
      ctx.bezierCurveTo(110, 170, 200, 120, 160, 60);
      ctx.bezierCurveTo(130, 20, 90, 40, 96, 80);
      ctx.bezierCurveTo(100, 130, 160, 180, 190, 260);
      ctx.stroke();
      ctx.fillStyle = '#c62828';
      ctx.font = `34px ${FONT_UI}`;
      ctx.textAlign = 'center';
      ctx.fillText('12월 1일', cw / 2, 304);
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.0), texturedToon(tex));
    p.position.set(0, 2.1, 0.06);
    g.add(p);
    g.add(mesh(G.box(1.8, 2.2, 0.1), '#6d4c41', 0, 2.1, 0));
    for (const sx of [-0.8, 0.8]) g.add(mesh(G.box(0.12, 1.2, 0.12), '#6d4c41', sx, 0.6, 0));
  } else if (T === 'bigtree') {
    w = 3; d = 3;
    g.add(mesh(G.cyl(0.6, 0.9, 3.6, 9), '#7b5b43', 0, 1.8, 0));
    g.add(mesh(G.ico(2.6, 1), leafMat('#2e7d32'), 0, 4.8, 0, { s: [1.2, 0.8, 1.2] }));
    g.add(mesh(G.ico(1.8, 1), leafMat('#388e3c'), 1.5, 5.4, 0.8));
    g.userData.radius = 1.1;
  }
  g.userData.size = [w, d];
  return g;
}

// 표지판(살펴보기 가능)
export function makeSignpost() {
  const g = new THREE.Group();
  g.add(mesh(G.box(0.14, 1.2, 0.14), '#8d6e63', 0, 0.6, 0));
  g.add(mesh(G.box(1.3, 0.8, 0.12), '#d7a86e', 0, 1.35, 0));
  g.add(mesh(G.box(1.1, 0.08, 0.02), '#8d6e63', 0, 1.5, 0.07));
  g.add(mesh(G.box(0.9, 0.08, 0.02), '#8d6e63', 0, 1.33, 0.07));
  g.add(mesh(G.box(1.0, 0.08, 0.02), '#8d6e63', 0, 1.16, 0.07));
  return g;
}

// ───────── 탈것 ─────────
export function makeVehicle(type, color) {
  const g = new THREE.Group();
  if (type === 'bike') {
    const c = color || '#4fb3a9';
    for (const z of [-0.75, 0.75]) {
      g.add(mesh(G.torus(0.33, 0.12, 8, 18), '#263238', 0, 0.36, z, { ry: Math.PI / 2 }));
      g.add(mesh(G.cyl(0.14, 0.14, 0.2, 10), '#b0bec5', 0, 0.36, z, { rz: Math.PI / 2 }));
    }
    g.add(mesh(G.capsule(0.3, 0.9, 6, 12), c, 0, 0.7, -0.15, { rx: Math.PI / 2 }));
    g.add(mesh(G.box(0.5, 0.9, 0.18), c, 0, 0.95, 0.6, { rx: -0.25 }));
    g.add(mesh(G.box(0.4, 0.14, 0.75), '#3e2723', 0, 1.08, -0.3));
    g.add(mesh(G.cyl(0.04, 0.04, 0.8, 6), '#90a4ae', 0, 1.45, 0.62, { rz: Math.PI / 2 }));
    g.add(mesh(G.cyl(0.035, 0.035, 0.5, 6), '#90a4ae', 0, 1.2, 0.66, { rx: -0.25 }));
    g.add(mesh(G.sphere(0.12, 10, 8), toon('#fff9c4', { emissive: '#fff59d', emissiveIntensity: 0.6 }), 0, 1.2, 0.82));
    g.add(mesh(G.box(0.36, 0.08, 0.5), '#90a4ae', 0, 0.85, -0.95));
    g.userData.seatY = 0.62;
    g.userData.seatZ = -0.3;
  } else if (type === 'car') {
    const c = color || '#e53935';
    g.add(mesh(G.box(1.9, 0.75, 3.4), c, 0, 0.75, 0));
    g.add(mesh(G.box(1.86, 0.4, 1.0), c, 0, 1.3, 1.1));
    g.add(mesh(G.box(1.7, 0.6, 0.08), basic('#bde0fe', { transparent: true, opacity: 0.65 }), 0, 1.45, 0.62, { rx: -0.35 }));
    g.add(mesh(G.box(1.6, 0.18, 0.9), '#5d4037', 0, 1.1, -0.65));
    g.add(mesh(G.box(1.6, 0.6, 0.18), '#5d4037', 0, 1.35, -1.1));
    for (const sx of [-1, 1]) {
      for (const sz of [-1.05, 1.05]) {
        g.add(mesh(G.cyl(0.38, 0.38, 0.28, 14), '#263238', sx * 0.92, 0.38, sz, { rz: Math.PI / 2 }));
        g.add(mesh(G.cyl(0.18, 0.18, 0.3, 10), '#cfd8dc', sx * 0.93, 0.38, sz, { rz: Math.PI / 2 }));
      }
      g.add(mesh(G.sphere(0.16, 10, 8), toon('#fffde7', { emissive: '#fff59d', emissiveIntensity: 0.6 }), sx * 0.62, 0.85, 1.7, { s: [1, 0.8, 0.5] }));
      g.add(mesh(G.box(0.3, 0.14, 0.06), '#ff5252', sx * 0.65, 0.88, -1.71));
    }
    g.add(mesh(G.box(1.95, 0.2, 0.2), '#eceff1', 0, 0.45, 1.72));
    g.add(mesh(G.box(1.95, 0.2, 0.2), '#eceff1', 0, 0.45, -1.72));
    g.add(mesh(G.cyl(0.2, 0.2, 0.06, 12), '#37474f', -0.45, 1.5, 0.35, { rx: -0.9 }));
    g.userData.seatY = 0.55;
    g.userData.seatZ = -0.45;
    g.userData.seatX = -0.45;
  } else if (type === 'plane' || type === 'jet') {
    const jet = type === 'jet';
    const body = jet ? '#eceff1' : '#ffffff';
    const stripe = jet ? '#e53935' : '#1e88e5';
    const L = jet ? 7 : 9;
    const R = jet ? 0.55 : 0.8;
    g.add(mesh(G.capsule(R, L, 8, 16), body, 0, 0, 0, { rx: Math.PI / 2 }));
    g.add(mesh(G.cyl(R * 1.01, R * 1.01, L * 0.9, 16, 1), stripe, 0, -R * 0.15, 0, { rx: Math.PI / 2, s: [1, 1, 0.15] }));
    g.add(mesh(G.box(R * 1.2, R * 0.35, 0.9), '#263238', 0, R * 0.42, L / 2 + R * 0.35, { rx: 0.4 }));
    for (let i = 0; i < (jet ? 4 : 9); i++) {
      for (const sx of [-1, 1]) g.add(mesh(G.box(0.05, 0.22, 0.28), '#37474f', sx * R * 0.98, R * 0.25, L / 2 - 1.2 - i * 0.7));
    }
    if (jet) {
      const wing = new THREE.Shape();
      wing.moveTo(0, 1.6);
      wing.lineTo(4.2, -1.4);
      wing.lineTo(4.2, -2.2);
      wing.lineTo(0, -1.6);
      const wg = new THREE.ExtrudeGeometry(wing, { depth: 0.12, bevelEnabled: false });
      wg.rotateX(Math.PI / 2);
      for (const sx of [-1, 1]) {
        const w = mesh(wg, body, 0, -0.1, 0);
        w.scale.x = sx;
        g.add(w);
      }
      g.add(mesh(G.box(0.12, 1.8, 1.6), stripe, 0, 1.1, -L / 2 + 0.2, { rx: -0.4 }));
      g.add(mesh(G.cyl(0.3, 0.38, 1.4, 10), '#90a4ae', 0, 0, -L / 2 - 0.5, { rx: Math.PI / 2 }));
    } else {
      for (const sx of [-1, 1]) {
        const w = mesh(G.box(5.2, 0.16, 1.6), body, sx * 2.9, -0.25, 0.3, { ry: sx * 0.22 });
        g.add(w);
        g.add(mesh(G.cyl(0.34, 0.3, 1.3, 12), '#b0bec5', sx * 2.1, -0.75, 0.8, { rx: Math.PI / 2 }));
        g.add(mesh(G.cyl(0.25, 0.25, 0.05, 12), '#37474f', sx * 2.1, -0.75, 1.46, { rx: Math.PI / 2 }));
        g.add(mesh(G.box(2.1, 0.12, 0.9), body, sx * 1.2, 0.2, -L / 2 - 0.2, { ry: sx * 0.25 }));
      }
      g.add(mesh(G.box(0.14, 2.0, 1.8), stripe, 0, 1.25, -L / 2 - 0.1, { rx: -0.35 }));
      for (const z of [-0.8, 0.8]) {
        g.add(mesh(G.cyl(0.04, 0.04, 0.8, 6), '#607d8b', 0, -1.15, z));
        g.add(mesh(G.cyl(0.25, 0.25, 0.2, 10), '#263238', 0, -1.55, z, { rz: Math.PI / 2 }));
      }
      g.add(mesh(G.cyl(0.04, 0.04, 0.8, 6), '#607d8b', 0, -1.15, L / 2));
      g.add(mesh(G.cyl(0.2, 0.2, 0.18, 10), '#263238', 0, -1.55, L / 2, { rz: Math.PI / 2 }));
    }
  } else if (type === 'scooter') {
    const v = makeVehicle('bike', color);
    return v;
  }
  return g;
}

// ───────── 동물 ─────────
export function makeAnimal(kind) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const legs = [];
  const addLeg = (x, z, h, r, c) => {
    const lg = new THREE.Group();
    lg.position.set(x, h, z);
    lg.add(mesh(G.cyl(r, r * 0.9, h, 6), c, 0, -h / 2, 0));
    rig.add(lg);
    legs.push(lg);
  };
  if (kind === 'cow') {
    rig.add(mesh(G.box(0.9, 0.75, 1.5), '#fafafa', 0, 1.05, 0));
    rig.add(mesh(G.box(0.92, 0.4, 0.5), '#3e2723', 0, 1.15, 0.2));
    rig.add(mesh(G.box(0.6, 0.3, 0.4), '#3e2723', 0.15, 1.3, -0.45));
    const head = new THREE.Group();
    head.position.set(0, 1.35, 0.9);
    head.add(mesh(G.box(0.55, 0.5, 0.55), '#fafafa', 0, 0, 0));
    head.add(mesh(G.box(0.5, 0.25, 0.2), '#f8bbd0', 0, -0.15, 0.33));
    for (const s of [-1, 1]) {
      head.add(mesh(G.cone(0.05, 0.25, 5), '#fff3e0', s * 0.22, 0.32, 0, { rz: -s * 0.4 }));
      head.add(mesh(G.sphere(0.05, 6, 4), '#222', s * 0.15, 0.08, 0.28));
    }
    rig.add(head);
    root.userData.head = head;
    for (const sx of [-0.3, 0.3]) for (const sz of [-0.55, 0.55]) addLeg(sx, sz, 0.7, 0.1, '#fafafa');
    root.userData.speed = 0.6;
    root.userData.radius = 0.8;
  } else if (kind === 'camel') {
    rig.add(mesh(G.sphere(0.6, 12, 10), '#d2a56c', 0, 1.6, 0, { s: [0.85, 0.75, 1.4] }));
    rig.add(mesh(G.sphere(0.45, 12, 10), '#c9955a', 0, 2.05, -0.05, { s: [0.9, 0.9, 1.1] }));
    const neck = mesh(G.cyl(0.14, 0.2, 1.0, 8), '#d2a56c', 0, 2.0, 0.85, { rx: 0.6 });
    rig.add(neck);
    const head = new THREE.Group();
    head.position.set(0, 2.45, 1.2);
    head.add(mesh(G.box(0.3, 0.3, 0.55), '#d2a56c', 0, 0, 0.1));
    for (const s of [-1, 1]) head.add(mesh(G.sphere(0.04, 6, 4), '#222', s * 0.14, 0.06, 0.15));
    head.add(mesh(G.sphere(0.06, 6, 4), '#d2a56c', -0.12, 0.2, -0.05));
    head.add(mesh(G.sphere(0.06, 6, 4), '#d2a56c', 0.12, 0.2, -0.05));
    rig.add(head);
    root.userData.head = head;
    for (const sx of [-0.25, 0.25]) for (const sz of [-0.5, 0.5]) addLeg(sx, sz, 1.25, 0.08, '#c9955a');
    root.userData.speed = 0.5;
    root.userData.radius = 0.9;
  } else if (kind === 'chicken') {
    rig.add(mesh(G.sphere(0.25, 10, 8), '#fafafa', 0, 0.38, 0, { s: [0.9, 0.9, 1.15] }));
    const head = new THREE.Group();
    head.position.set(0, 0.62, 0.18);
    head.add(mesh(G.sphere(0.13, 10, 8), '#fafafa', 0, 0, 0));
    head.add(mesh(G.box(0.04, 0.1, 0.12), '#e53935', 0, 0.13, 0));
    head.add(mesh(G.cone(0.04, 0.1, 4), '#ffb300', 0, -0.02, 0.15, { rx: Math.PI / 2 }));
    for (const s of [-1, 1]) head.add(mesh(G.sphere(0.02, 4, 4), '#222', s * 0.07, 0.03, 0.1));
    rig.add(head);
    root.userData.head = head;
    rig.add(mesh(G.cone(0.12, 0.22, 5), '#eeeeee', 0, 0.48, -0.28, { rx: -0.9 }));
    for (const sx of [-0.08, 0.08]) addLeg(sx, 0, 0.18, 0.02, '#ffb300');
    root.userData.speed = 1.0;
    root.userData.radius = 0.25;
  }
  root.userData.legs = legs;
  root.userData.rig = rig;
  root.traverse((o) => { if (o.isMesh) o.userData.dynamic = true; });
  return root;
}

export function animateAnimal(a, dt, speed, t) {
  const legs = a.userData.legs || [];
  a.userData.phase = (a.userData.phase || Math.random() * 6) + dt * (speed > 0.05 ? 7 : 0);
  legs.forEach((l, i) => {
    const target = speed > 0.05 ? Math.sin(a.userData.phase + (i % 2 ? Math.PI : 0) + (i > 1 ? Math.PI / 2 : 0)) * 0.5 : 0;
    l.rotation.x += (target - l.rotation.x) * Math.min(1, dt * 10);
  });
  const head = a.userData.head;
  if (head) head.rotation.x = speed > 0.05 ? 0 : Math.sin(t * 0.7 + (a.userData.seed || 0)) * 0.25 + 0.15;
}
