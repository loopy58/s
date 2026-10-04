// 2.5등신 캐릭터(주민·환자·플레이어)와 부엉 박사
import * as THREE from 'three';
import { toon, basic, G, mesh } from './toon.js';

const BLACK = '#2a2321';

function hairCap(color, r) {
  const g = new THREE.Group();
  // 정수리를 덮는 반구
  const top = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(color));
  top.castShadow = true;
  g.add(top);
  // 뒤통수를 덮는 부분 (z가 음수인 반쪽)
  const back = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 8, Math.PI, Math.PI, Math.PI * 0.5, Math.PI * 0.28), toon(color));
  back.castShadow = true;
  g.add(back);
  return g;
}

function addHair(head, look) {
  const c = look.hair || '#2b1d16';
  const r = 0.445;
  const style = look.style || 'short';
  if (style === 'bald') {
    const ring = mesh(new THREE.TorusGeometry(0.36, 0.08, 6, 16, Math.PI * 1.2), c, 0, -0.02, -0.05, { rx: Math.PI / 2, rz: Math.PI * -0.1 });
    ring.rotation.z = Math.PI * 1.4;
    head.add(ring);
    return;
  }
  if (style === 'afro') {
    head.add(mesh(G.ico(0.56, 1), c, 0, 0.16, -0.06, { flat: true }));
    head.add(mesh(G.sphere(0.2), c, 0, 0.3, 0.26, { s: [1.6, 0.6, 0.8] }));
    return;
  }
  const cap = hairCap(c, r);
  head.add(cap);
  // 앞머리
  head.add(mesh(G.sphere(0.22, 12, 8), c, -0.12, 0.27, 0.27, { s: [1.3, 0.55, 0.7] }));
  head.add(mesh(G.sphere(0.2, 12, 8), c, 0.15, 0.25, 0.29, { s: [1.1, 0.5, 0.65] }));
  if (style === 'long') {
    head.add(mesh(G.box(0.78, 0.7, 0.3), c, 0, -0.25, -0.24));
    head.add(mesh(G.box(0.16, 0.55, 0.3), c, -0.38, -0.2, 0.0));
    head.add(mesh(G.box(0.16, 0.55, 0.3), c, 0.38, -0.2, 0.0));
  } else if (style === 'bob') {
    head.add(mesh(G.sphere(0.46, 16, 10), c, 0, -0.08, -0.06, { s: [1.05, 0.7, 0.95] }));
    head.children[head.children.length - 1].geometry = new THREE.SphereGeometry(0.46, 16, 10, Math.PI * 0.85, Math.PI * 1.3);
  } else if (style === 'bun') {
    head.add(mesh(G.sphere(0.17), c, 0, 0.32, -0.34));
  } else if (style === 'pony') {
    head.add(mesh(G.capsule(0.1, 0.35), c, 0, -0.05, -0.48, { rx: 0.4 }));
    head.add(mesh(G.sphere(0.07), '#e57373', 0, 0.16, -0.43));
  } else if (style === 'twin') {
    head.add(mesh(G.sphere(0.15), c, -0.42, 0.0, -0.12));
    head.add(mesh(G.sphere(0.15), c, 0.42, 0.0, -0.12));
  } else if (style === 'perm') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      head.add(mesh(G.sphere(0.15, 8, 6), c, Math.cos(a) * 0.33, 0.24 + Math.sin(i * 1.7) * 0.04, Math.sin(a) * 0.3 - 0.04));
    }
    head.add(mesh(G.sphere(0.2, 8, 6), c, 0, 0.42, -0.02));
  }
}

function addHat(head, look) {
  const hat = look.hat;
  if (!hat) return;
  const add = (m) => { head.add(m); return m; };
  switch (hat) {
    case 'cap':
      add(new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), toon(look.hatColor || '#e53935'))).position.y = 0.04;
      add(mesh(G.cyl(0.26, 0.26, 0.04, 16), look.hatColor || '#e53935', 0, 0.06, 0.36, { s: [1, 1, 0.9] }));
      break;
    case 'helmet':
      add(new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.55), toon('#fdd835'))).position.y = 0.02;
      add(mesh(G.torus(0.48, 0.04, 6, 24), '#f9a825', 0, 0.02, 0, { rx: Math.PI / 2 }));
      break;
    case 'straw':
    case 'farmer':
    case 'sunhat': {
      const col = hat === 'sunhat' ? '#fff3c4' : '#e9c46a';
      add(mesh(G.cyl(0.78, 0.82, 0.04, 20), col, 0, 0.26, 0));
      add(mesh(G.cyl(0.36, 0.42, 0.26, 16), col, 0, 0.38, 0));
      add(mesh(G.cyl(0.43, 0.43, 0.06, 16), hat === 'farmer' ? '#e76f51' : '#d62828', 0, 0.3, 0));
      break;
    }
    case 'nurse':
      add(mesh(G.box(0.42, 0.16, 0.2), '#ffffff', 0, 0.44, 0.08, { rx: -0.25 }));
      add(mesh(G.box(0.1, 0.03, 0.02), '#4fb3a9', 0, 0.46, 0.19, { rx: -0.25 }));
      add(mesh(G.box(0.03, 0.1, 0.02), '#4fb3a9', 0, 0.46, 0.19, { rx: -0.25 }));
      break;
    case 'chef':
      add(mesh(G.cyl(0.36, 0.3, 0.42, 14), '#ffffff', 0, 0.5, 0));
      add(mesh(G.sphere(0.4, 14, 10), '#ffffff', 0, 0.74, 0, { s: [1, 0.6, 1] }));
      break;
    case 'kufi':
      add(new THREE.Mesh(new THREE.SphereGeometry(0.455, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.32), toon('#fafafa'))).position.y = 0.04;
      break;
    case 'ghutra':
    case 'ghutra_red': {
      const cloth = hat === 'ghutra_red' ? '#e9a3a3' : '#fafafa';
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.49, 18, 12, Math.PI * 0.5 + 0.95, Math.PI * 2 - 1.9, 0, Math.PI * 0.62), toon(cloth, { side: THREE.DoubleSide }));
      g.castShadow = true;
      add(g);
      add(mesh(G.box(0.86, 0.75, 0.12), cloth, 0, -0.32, -0.36, { rx: 0.15 }));
      add(mesh(G.torus(0.42, 0.045, 6, 24), BLACK, 0, 0.26, 0, { rx: Math.PI / 2 }));
      break;
    }
    case 'scarf_teal':
    case 'scarf_pink':
    case 'scarf_orange': {
      const col = { scarf_teal: '#26a69a', scarf_pink: '#f48fb1', scarf_orange: '#ff8a65' }[hat];
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.49, 18, 12, Math.PI * 0.5 + 0.85, Math.PI * 2 - 1.7, 0, Math.PI * 0.78), toon(col, { side: THREE.DoubleSide }));
      g.castShadow = true;
      add(g);
      add(mesh(G.cone(0.5, 0.7, 16), col, 0, -0.5, -0.12));
      break;
    }
    case 'headwrap':
    case 'headwrap_red': {
      const col = hat === 'headwrap_red' ? '#e53935' : '#ff9800';
      add(mesh(G.sphere(0.4, 14, 10), col, 0, 0.3, -0.06, { s: [1.15, 0.8, 1.15] }));
      add(mesh(G.sphere(0.16, 10, 8), col, 0.12, 0.6, 0.04));
      break;
    }
    case 'non_la':
      add(mesh(G.cone(0.82, 0.45, 20), '#f2dfa7', 0, 0.5, 0));
      break;
    default:
      break;
  }
}

function addFace(head, look, sick) {
  const eyeY = -0.02;
  for (const s of [-1, 1]) {
    head.add(mesh(G.sphere(0.065, 10, 8), BLACK, s * 0.15, eyeY, 0.39, { s: [0.9, 1.35, 0.6], shadow: false }));
    head.add(mesh(G.sphere(0.022, 6, 4), basic('#ffffff'), s * 0.15 + 0.02, eyeY + 0.04, 0.43, { shadow: false }));
  }
  const blush = sick === 'flushed' ? '#ff5a5a' : '#ffaaa5';
  for (const s of [-1, 1]) {
    head.add(mesh(G.sphere(0.07, 10, 6), basic(blush, { transparent: true, opacity: sick === 'flushed' ? 0.85 : 0.55 }), s * 0.26, -0.12, 0.33, { s: [1.2, 0.6, 0.4], shadow: false }));
  }
  // 입
  head.add(mesh(new THREE.TorusGeometry(0.05, 0.014, 4, 10, Math.PI), BLACK, 0, -0.16, 0.405, { rz: sick ? 0 : Math.PI, shadow: false }));
  if (sick === 'rash' || sick === 'pox') {
    const col = sick === 'rash' ? '#e04848' : '#ff6f6f';
    const spots = sick === 'rash'
      ? [[-0.25, 0.02, 0.32], [0.24, 0.05, 0.33], [-0.1, 0.17, 0.38], [0.18, -0.24, 0.32], [-0.3, -0.2, 0.25], [0.32, -0.08, 0.27], [0.02, 0.24, 0.36], [-0.18, -0.28, 0.3]]
      : [[-0.22, 0.12, 0.35], [0.27, -0.02, 0.32], [0.05, 0.2, 0.37], [-0.32, -0.12, 0.25], [0.15, -0.28, 0.32]];
    for (const [x, y, z] of spots) head.add(mesh(G.sphere(sick === 'rash' ? 0.03 : 0.04, 6, 4), col, x, y, z, { shadow: false }));
  }
}

function addAccessory(ch, look) {
  const { body, head, armR } = ch.parts;
  switch (look.acc) {
    case 'tie':
      body.add(mesh(G.box(0.08, 0.3, 0.04), '#d62828', 0, 0.05, 0.3));
      break;
    case 'apron':
      body.add(mesh(G.box(0.42, 0.5, 0.04), '#fafafa', 0, -0.05, 0.31));
      break;
    case 'scarf':
      body.add(mesh(G.torus(0.22, 0.08, 6, 14), '#e63946', 0, 0.26, 0, { rx: Math.PI / 2 }));
      break;
    case 'glasses':
      for (const s of [-1, 1]) head.add(mesh(G.torus(0.09, 0.016, 6, 16), BLACK, s * 0.15, -0.02, 0.42, { shadow: false }));
      head.add(mesh(G.box(0.1, 0.02, 0.02), BLACK, 0, 0, 0.43, { shadow: false }));
      break;
    case 'beard':
      head.add(mesh(G.sphere(0.24, 12, 8), look.hair === '#e0e0e0' ? '#e0e0e0' : '#2b2622', 0, -0.32, 0.22, { s: [1.2, 0.8, 0.7] }));
      break;
    case 'cane':
      armR.add(mesh(G.cyl(0.03, 0.03, 0.9, 6), '#8d6e63', 0.02, -0.55, 0.1));
      break;
    case 'stethoscope':
      body.add(mesh(G.torus(0.2, 0.025, 6, 18, Math.PI * 1.2), '#37474f', 0, 0.2, 0.12, { rx: Math.PI / 2.2, rz: Math.PI * 1.4 }));
      body.add(mesh(G.cyl(0.05, 0.05, 0.03, 10), '#b0bec5', 0.12, 0.0, 0.31, { rx: Math.PI / 2 }));
      break;
    case 'lungi':
      break;
    default:
      break;
  }
}

/**
 * 캐릭터를 만듭니다.
 * look: { skin, hair, style, top, bottom, hat, acc, coat, inner }
 * opts: { kid, sick }
 */
export function makeCharacter(look, opts = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  let skin = look.skin || '#f1c9a5';
  if (opts.sick === 'pale') skin = new THREE.Color(skin).lerp(new THREE.Color('#d9e3cf'), 0.35).getStyle();

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  for (const [g, s] of [[legL, -1], [legR, 1]]) {
    g.position.set(s * 0.13, 0.45, 0);
    g.add(mesh(G.cyl(0.1, 0.09, 0.36, 8), look.bottom || '#3c4f76', 0, -0.18, 0));
    g.add(mesh(G.sphere(0.12, 10, 8), '#4a3b35', 0, -0.4, 0.04, { s: [1, 0.7, 1.35] }));
    rig.add(g);
  }

  const body = new THREE.Group();
  body.position.y = 0.72;
  const top = look.coat ? '#ffffff' : look.top || '#5c8dd6';
  body.add(mesh(G.cyl(0.25, 0.32, 0.56, 14), top, 0, 0, 0));
  if (look.coat) {
    body.add(mesh(G.box(0.16, 0.42, 0.04), look.inner || '#4fb3a9', 0, 0.06, 0.29));
    body.add(mesh(G.cyl(0.33, 0.36, 0.14, 14), '#ffffff', 0, -0.3, 0));
  }
  if (look.acc === 'lungi') body.add(mesh(G.cyl(0.33, 0.38, 0.3, 14), '#7e57c2', 0, -0.32, 0));
  // 목
  body.add(mesh(G.cyl(0.11, 0.11, 0.12, 8), skin, 0, 0.32, 0));
  rig.add(body);

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  for (const [g, s] of [[armL, -1], [armR, 1]]) {
    g.position.set(s * 0.32, 0.95, 0);
    g.add(mesh(G.capsule(0.075, 0.28), top, s * 0.03, -0.2, 0, { rz: s * 0.15 }));
    g.add(mesh(G.sphere(0.085, 10, 8), skin, s * 0.06, -0.42, 0));
    rig.add(g);
  }

  const head = new THREE.Group();
  head.position.y = 1.47;
  head.add(mesh(G.sphere(0.42, 20, 16), skin, 0, 0, 0));
  head.add(mesh(G.sphere(0.07, 8, 6), skin, -0.42, -0.02, 0, { s: [0.6, 1, 1] }));
  head.add(mesh(G.sphere(0.07, 8, 6), skin, 0.42, -0.02, 0, { s: [0.6, 1, 1] }));
  addHair(head, look);
  addFace(head, look, opts.sick);
  addHat(head, look);
  rig.add(head);

  if (look.bag) {
    body.add(mesh(G.box(0.4, 0.42, 0.2), look.bag, 0, 0.02, -0.34));
    body.add(mesh(G.box(0.3, 0.14, 0.08), look.bag, 0, -0.08, -0.47));
  }

  const ch = { root, rig, parts: { body, head, armL, armR, legL, legR }, phase: Math.random() * 6, sitting: false };
  addAccessory(ch, look);

  if (opts.kid) rig.scale.setScalar(0.78);
  root.traverse((o) => { if (o.isMesh) o.userData.dynamic = true; });
  return ch;
}

// 걷기·숨쉬기 애니메이션
export function animateCharacter(ch, dt, speed, t) {
  const { body, head, armL, armR, legL, legR } = ch.parts;
  if (ch.sitting) {
    legL.rotation.x = legR.rotation.x = -1.35;
    armL.rotation.x = armR.rotation.x = -0.9;
    body.position.y = 0.72;
    return;
  }
  const moving = speed > 0.2;
  const k = Math.min(1, speed / 5);
  ch.phase += dt * (moving ? 6 + speed * 1.4 : 2);
  const swing = moving ? Math.sin(ch.phase) * (0.35 + k * 0.45) : 0;
  const ease = 1 - Math.pow(0.001, dt);
  legL.rotation.x += (swing - legL.rotation.x) * ease;
  legR.rotation.x += (-swing - legR.rotation.x) * ease;
  armL.rotation.x += (-swing * 0.9 - armL.rotation.x) * ease;
  armR.rotation.x += (swing * 0.9 - armR.rotation.x) * ease;
  const bob = moving ? Math.abs(Math.sin(ch.phase)) * 0.06 : Math.sin(t * 2 + ch.phase) * 0.012;
  body.position.y = 0.72 + bob;
  head.position.y = 1.47 + bob;
  armL.position.y = armR.position.y = 0.95 + bob;
  head.rotation.z = moving ? Math.sin(ch.phase) * 0.04 : Math.sin(t * 0.8 + ch.phase) * 0.03;
  if (ch.talking) head.rotation.x = Math.sin(t * 14) * 0.05;
  else head.rotation.x *= 0.9;
}

// 부엉 박사 (안내자)
export function makeOwl() {
  const root = new THREE.Group();
  const rig = new THREE.Group();
  root.add(rig);
  const brown = '#9c6b45';
  const belly = '#f0d9b5';
  rig.add(mesh(G.sphere(0.62, 18, 14), brown, 0, 0.8, 0, { s: [1, 1.05, 0.95] }));
  rig.add(mesh(G.sphere(0.45, 16, 12), belly, 0, 0.72, 0.24, { s: [1, 1.1, 0.7] }));
  const head = new THREE.Group();
  head.position.y = 1.45;
  head.add(mesh(G.sphere(0.5, 18, 14), brown, 0, 0, 0, { s: [1.1, 0.95, 1] }));
  head.add(mesh(G.sphere(0.36, 16, 10), belly, 0, -0.04, 0.22, { s: [1.25, 0.9, 0.6] }));
  for (const s of [-1, 1]) {
    head.add(mesh(G.sphere(0.17, 14, 10), '#ffffff', s * 0.2, 0.02, 0.4, { s: [1, 1, 0.5], shadow: false }));
    head.add(mesh(G.sphere(0.085, 10, 8), BLACK, s * 0.2, 0.02, 0.48, { s: [1, 1, 0.5], shadow: false }));
    head.add(mesh(G.sphere(0.03, 6, 4), basic('#ffffff'), s * 0.2 + 0.03, 0.06, 0.52, { shadow: false }));
    head.add(mesh(G.torus(0.19, 0.022, 6, 18), '#c9a227', s * 0.2, 0.02, 0.47, { shadow: false }));
    head.add(mesh(G.cone(0.1, 0.3, 6), brown, s * 0.36, 0.42, -0.02, { rz: -s * 0.4 }));
  }
  head.add(mesh(G.box(0.08, 0.02, 0.02), '#c9a227', 0, 0.04, 0.5, { shadow: false }));
  head.add(mesh(G.cone(0.07, 0.18, 6), '#f4a261', 0, -0.13, 0.5, { rx: Math.PI / 2 + 0.6 }));
  // 작은 의사 모자
  head.add(mesh(G.box(0.5, 0.06, 0.5), '#2b2d42', 0, 0.48, 0, { ry: Math.PI / 4 }));
  head.add(mesh(G.cyl(0.16, 0.18, 0.14, 12), '#2b2d42', 0, 0.42, 0));
  head.add(mesh(G.cyl(0.015, 0.015, 0.3, 4), '#ffd166', 0.2, 0.36, 0.2, { rz: 0.3 }));
  rig.add(head);
  const wingL = new THREE.Group();
  const wingR = new THREE.Group();
  for (const [g, s] of [[wingL, -1], [wingR, 1]]) {
    g.position.set(s * 0.55, 1.0, 0);
    g.add(mesh(G.sphere(0.3, 12, 10), '#83563a', s * 0.06, -0.25, 0, { s: [0.45, 1, 0.8] }));
    rig.add(g);
  }
  for (const s of [-1, 1]) rig.add(mesh(G.sphere(0.1, 8, 6), '#f4a261', s * 0.2, 0.18, 0.15, { s: [1.2, 0.5, 1.4] }));
  // 청진기
  rig.add(mesh(G.torus(0.3, 0.025, 6, 18, Math.PI * 1.1), '#37474f', 0, 1.06, 0.28, { rx: Math.PI / 2.4, rz: Math.PI * 1.45 }));
  rig.add(mesh(G.cyl(0.06, 0.06, 0.03, 10), '#cfd8dc', 0.15, 0.82, 0.62, { rx: Math.PI / 2 }));
  root.traverse((o) => { if (o.isMesh) o.userData.dynamic = true; });
  const ch = { root, rig, parts: { head, wingL, wingR }, phase: 0, owl: true };
  return ch;
}

export function animateOwl(ch, dt, t) {
  const { head, wingL, wingR } = ch.parts;
  ch.rig.position.y = Math.abs(Math.sin(t * 2.2)) * 0.06;
  head.rotation.z = Math.sin(t * 1.3) * 0.12;
  const flap = ch.talking ? Math.sin(t * 12) * 0.5 : Math.sin(t * 2) * 0.08;
  wingL.rotation.z = -flap;
  wingR.rotation.z = flap;
}
