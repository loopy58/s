// 지역 데이터로 3D 맵(지형·건물·주민·소품)을 조립합니다.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { toon, basic, G, mesh, canvasTexture, bakeStatic, FONT_UI } from './toon.js';
import { makeTree, makeRock, makeBuilding, makeSignpost, makeVehicle, makeAnimal, animateAnimal } from './props.js';
import { makeCharacter, animateCharacter, makeOwl, animateOwl } from './characters.js';
import { mulberry32, hashString } from '../util.js';

export const R_PLAY = 30;
const HALF = 40;

const SPECIAL = new Set(['paddy', 'tallgrass', 'pen', 'chickens', 'oasis', 'river', 'swamp', 'puddles', 'tires', 'lanterns', 'scooter']);

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = Math.max(0, Math.min(1, t));
  const x = ax + dx * t - px;
  const z = az + dz * t - pz;
  return Math.sqrt(x * x + z * z);
}

const markerTex = {};
function markerTexture(kind) {
  if (markerTex[kind]) return markerTex[kind];
  const t = canvasTexture(128, 128, (ctx) => {
    const col = { patient: '#ff4d4d', guide: '#ffc93c', done: '#4caf50' }[kind];
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(66, 68, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(64, 64, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `78px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kind === 'done' ? '♥' : '!', 64, 70);
  });
  markerTex[kind] = t;
  return t;
}

export class Zone {
  constructor(region, state) {
    this.region = region;
    this.state = state;
    this.theme = region.theme;
    this.group = new THREE.Group();
    this.dynamic = new THREE.Group();
    this.group.add(this.dynamic);
    this.colliders = [];
    this.interactables = [];
    this.npcs = [];
    this.animals = [];
    this.swarms = [];
    this.updaters = [];
    this.areas = [];
    this.vehicles = [];
    this.avoid = [];
    this.mini = { boxes: [], water: [], trees: [] };
    this.rand = mulberry32(hashString(region.id));
    this.spawn = new THREE.Vector3(0, 0, 19);
    this.build();
  }

  // ───── 배치 가능 여부 ─────
  isFree(x, z, margin = 1.2) {
    for (const p of this.region.paths) {
      for (let i = 0; i < p.pts.length - 1; i++) {
        const [ax, az] = p.pts[i];
        const [bx, bz] = p.pts[i + 1];
        if (distToSeg(x, z, ax, az, bx, bz) < p.w / 2 + margin) return false;
      }
    }
    for (const a of this.avoid) {
      if (a.type === 'circle') {
        if (Math.hypot(x - a.x, z - a.z) < a.r + margin) return false;
      } else if (Math.abs(x - a.x) < a.hw + margin && Math.abs(z - a.z) < a.hd + margin) return false;
    }
    return true;
  }

  addBox(x, z, hw, hd, collide = true) {
    const b = { type: 'box', x, z, hw, hd };
    this.avoid.push(b);
    if (collide) this.colliders.push(b);
    this.mini.boxes.push(b);
    return b;
  }

  addCircle(x, z, r, collide = true) {
    const c = { type: 'circle', x, z, r };
    this.avoid.push(c);
    if (collide) this.colliders.push(c);
    return c;
  }

  build() {
    const r = this.region;
    const t = this.theme;
    const rand = this.rand;
    const statics = new THREE.Group();

    // 키 지점 예약
    this.avoid.push({ type: 'circle', x: this.spawn.x, z: this.spawn.z, r: 3.5 });
    const npcSpots = [r.guide.pos, ...r.patients.map((p) => p.pos), ...r.villagers.map((v) => v.pos), ...(r.signs || []).map((s) => s.pos)];
    if (r.mentor) npcSpots.push(r.mentor.pos);
    for (const [x, z] of npcSpots) this.avoid.push({ type: 'circle', x, z, r: 2.6 });
    for (const v of r.vehicles) this.avoid.push({ type: 'circle', x: v.pos[0], z: v.pos[1], r: v.type === 'plane' ? 7 : 2.6 });

    this.buildGround(statics);

    // 건물·특수 지형
    for (const def of r.buildings) {
      if (SPECIAL.has(def.type)) this.buildSpecial(def, statics);
      else this.placeBuilding(def, statics);
    }

    // 표지판
    for (const s of r.signs || []) {
      const sp = makeSignpost();
      sp.position.set(s.pos[0], 0, s.pos[1]);
      statics.add(sp);
      this.addCircle(s.pos[0], s.pos[1], 0.5);
      this.interactables.push({ kind: 'sign', def: s, pos: new THREE.Vector3(s.pos[0], 1.4, s.pos[1]), r: 2.2, label: '살펴보기' });
    }

    // 나무와 바위
    const kinds = t.trees;
    const pickKind = () => {
      let x = rand();
      for (const [k, w] of kinds) { if ((x -= w) <= 0) return k; }
      return kinds[0][0];
    };
    let placed = 0;
    for (let tries = 0; tries < 900 && placed < t.treeCount; tries++) {
      const a = rand() * Math.PI * 2;
      const d = 6 + Math.sqrt(rand()) * 22;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!this.isFree(x, z, 1.6)) continue;
      const tr = makeTree(pickKind(), rand, t);
      tr.position.set(x, 0, z);
      statics.add(tr);
      this.addCircle(x, z, tr.userData.radius * tr.scale.x + 0.15);
      this.mini.trees.push([x, z]);
      placed++;
    }
    // 가장자리 숲 (경계)
    for (let i = 0; i < 110; i++) {
      const a = (i / 110) * Math.PI * 2 + rand() * 0.05;
      const d = 31.5 + rand() * 9;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (z > 26 && Math.abs(x) < 4) continue;
      const tr = t.trees[0][0] === 'palm' && r.id === 'middleeast' && rand() < 0.6 ? makeRock(rand, '#c9a26a') : makeTree(pickKind(), rand, t);
      tr.position.set(x, 0, z);
      if (rand() < 0.3) tr.scale.multiplyScalar(1.3);
      statics.add(tr);
    }
    for (let i = 0; i < 18; i++) {
      const a = rand() * Math.PI * 2;
      const d = 8 + rand() * 21;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (!this.isFree(x, z, 1)) continue;
      const rk = makeRock(rand, r.id === 'middleeast' ? '#c49a62' : '#a4a4a4');
      rk.position.set(x, 0, z);
      rk.scale.setScalar(0.5 + rand() * 0.6);
      statics.add(rk);
      this.addCircle(x, z, 0.5 * rk.scale.x);
    }

    this.buildScenery(statics);
    this.buildGrass();

    // 탈것
    for (const v of r.vehicles) {
      const model = makeVehicle(v.type, v.color);
      model.position.set(v.pos[0], v.type === 'plane' ? 1.75 : 0, v.pos[1]);
      model.rotation.y = v.rot ?? (v.type === 'plane' ? -Math.PI / 2.4 : Math.PI);
      model.traverse((o) => { if (o.isMesh) o.userData.dynamic = true; });
      this.dynamic.add(model);
      const entry = { type: v.type, model, pos: model.position, parked: true };
      entry.collider = this.addCircle(v.pos[0], v.pos[1], v.type === 'plane' ? 3.2 : v.type === 'car' ? 1.6 : 0.9);
      this.vehicles.push(entry);
      this.interactables.push({ kind: 'vehicle', vehicle: entry, get pos() { return entry.model.position; }, r: v.type === 'plane' ? 6 : 2.4, label: v.type === 'plane' ? '비행기 타기' : '타기', get active() { return entry.parked; } });
      if (v.type === 'plane') {
        // 활주로 표시
        const strip = mesh(G.box(5, 0.04, 26), '#7d8288', v.pos[0], 0.02, v.pos[1], { ry: model.rotation.y, receive: true, shadow: false });
        statics.add(strip);
        for (let i = -4; i <= 4; i++) {
          const dash = mesh(G.box(0.3, 0.05, 1.4), '#ffffff', 0, 0.03, 0, { shadow: false });
          dash.position.set(v.pos[0] + Math.sin(model.rotation.y) * i * 2.8, 0.03, v.pos[1] + Math.cos(model.rotation.y) * i * 2.8);
          dash.rotation.y = model.rotation.y;
          statics.add(dash);
        }
        const sock = new THREE.Group();
        sock.add(mesh(G.cyl(0.05, 0.05, 3, 6), '#9e9e9e', 0, 1.5, 0));
        sock.add(mesh(G.cone(0.3, 1.2, 8), '#ff7043', 0.6, 2.9, 0, { rz: Math.PI / 2 }));
        sock.position.set(v.pos[0] + 5, 0, v.pos[1] - 4);
        statics.add(sock);
      }
    }

    // 주민
    if (r.mentor) this.addNPC('mentor', { name: '부엉 박사' }, r.mentor.pos);
    this.addNPC('guide', r.guide, r.guide.pos);
    for (const p of r.patients) this.addNPC('patient', p, p.pos);
    for (const v of r.villagers) this.addNPC('villager', v, v.pos);

    const baked = bakeStatic(statics, mergeGeometries);
    this.group.add(baked);

    this.buildWeather();
    this.buildMinimap();
  }

  // ───── 지면 ─────
  buildGround(statics) {
    const t = this.theme;
    const r = this.region;
    const S = 1024;
    const k = S / (HALF * 2);
    const W = (x) => (x + HALF) * k;
    const rand = mulberry32(hashString(r.id + 'g'));
    const tex = canvasTexture(S, S, (ctx) => {
      ctx.fillStyle = t.ground;
      ctx.fillRect(0, 0, S, S);
      for (let i = 0; i < 260; i++) {
        ctx.fillStyle = t.ground2;
        ctx.globalAlpha = 0.25 + rand() * 0.35;
        ctx.beginPath();
        ctx.ellipse(rand() * S, rand() * S, 8 + rand() * 40, 6 + rand() * 26, rand() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      // 강둑 모래
      for (const b of r.buildings) {
        if (b.type === 'river') {
          ctx.fillStyle = '#d9c38f';
          ctx.fillRect(W(b.pos[0] - b.w / 2 - 1.6), 0, (b.w + 3.2) * k, S);
        }
        if (b.type === 'paddy') {
          ctx.fillStyle = '#9b7a52';
          ctx.fillRect(W(b.pos[0] - b.w / 2 - 0.5), W(b.pos[1] - b.d / 2 - 0.5), (b.w + 1) * k, (b.d + 1) * k);
        }
        if (b.type === 'swamp' || b.type === 'oasis') {
          ctx.fillStyle = b.type === 'swamp' ? '#5f7d3a' : '#c9b37a';
          ctx.beginPath();
          ctx.arc(W(b.pos[0]), W(b.pos[1]), (b.r + 1.4) * k, 0, Math.PI * 2);
          ctx.fill();
        }
        if (b.type === 'tallgrass') {
          ctx.fillStyle = '#5d8f37';
          ctx.beginPath();
          ctx.arc(W(b.pos[0]), W(b.pos[1]), (b.r + 0.6) * k, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      // 길
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      for (const p of r.paths) {
        ctx.beginPath();
        p.pts.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), W(z)) : ctx.moveTo(W(x), W(z))));
        ctx.strokeStyle = t.road ? '#cfd6dc' : t.pathEdge;
        ctx.lineWidth = (p.w + (t.road ? 1.6 : 0.5)) * k;
        ctx.stroke();
        ctx.strokeStyle = t.path;
        ctx.lineWidth = p.w * k;
        ctx.stroke();
        if (t.road) {
          ctx.setLineDash([2 * k, 1.6 * k]);
          ctx.strokeStyle = '#f5f5f5';
          ctx.lineWidth = 0.18 * k;
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }
      if (t.road) {
        // 횡단보도
        ctx.fillStyle = '#f5f5f5';
        for (let i = -2; i <= 2; i++) ctx.fillRect(W(-2.2 + i * 0.9), W(9), 0.5 * k, 2 * k);
      }
      // 가장자리를 먼 땅 색으로 자연스럽게
      const grad = ctx.createRadialGradient(S / 2, S / 2, 33 * k, S / 2, S / 2, 40 * k);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, t.far);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, S, S);
    });
    tex.anisotropy = 8;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(HALF * 2, HALF * 2), new THREE.MeshToonMaterial({ map: tex, gradientMap: toon('#fff').gradientMap }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    ground.userData.dynamic = true;
    this.group.add(ground);
    const far = new THREE.Mesh(new THREE.CircleGeometry(800, 48), toon(t.far));
    far.rotation.x = -Math.PI / 2;
    far.position.y = -0.03;
    far.receiveShadow = false;
    far.userData.dynamic = true;
    this.group.add(far);
  }

  placeBuilding(def, statics) {
    const b = makeBuilding(def, this.rand);
    const [x, z] = def.pos;
    b.position.set(x, 0, z);
    const rot = def.rot || 0;
    b.rotation.y = rot;
    statics.add(b);
    let [w, d] = b.userData.size;
    if (Math.abs(Math.sin(rot)) > 0.5) [w, d] = [d, w];
    if (def.type === 'lamp') this.addCircle(x, z, 0.3);
    else if (def.type === 'bigtree') this.addCircle(x, z, 1.1);
    else if (def.type === 'playground') this.addBox(x, z, 2.6, 2.4);
    else if (!b.userData.noCollide) this.addBox(x, z, w / 2, d / 2);

    if (def.type === 'clinic') {
      const door = new THREE.Vector3(x, 1.2, z + d / 2 + 0.6);
      this.clinicDoor = door;
      this.interactables.push({ kind: 'clinic', def, pos: door, r: 2.4, label: '들어가기' });
    }
    if (def.type === 'flower_shop') this.addSwarm(x - 1.2, 0.8, z + 1.6, 14);
    if (def.type === 'bigtree') this.addBats(x, z);
  }

  buildSpecial(def, statics) {
    const [x, z] = def.pos;
    const rand = this.rand;
    const waterMat = toon('#5bb4d8', { opacity: 0.85 });
    switch (def.type) {
      case 'paddy': {
        const water = mesh(G.box(def.w, 0.05, def.d), toon('#8cc9b5', { opacity: 0.92 }), x, 0.04, z, { shadow: false, receive: true });
        statics.add(water);
        for (let i = 0; i < def.w - 0.6; i += 0.8) {
          for (let j = 0; j < def.d - 0.6; j += 0.8) {
            statics.add(mesh(G.cone(0.12, 0.6, 4), toon('#7cc242', { flat: true }), x - def.w / 2 + 0.5 + i, 0.32, z - def.d / 2 + 0.5 + j));
          }
        }
        this.addBox(x, z, def.w / 2, def.d / 2);
        this.mini.water.push({ type: 'box', x, z, hw: def.w / 2, hd: def.d / 2, color: '#8cc9b5' });
        break;
      }
      case 'tallgrass': {
        const n = 220;
        const geo = new THREE.ConeGeometry(0.07, 1.2, 3);
        geo.translate(0, 0.6, 0);
        const im = new THREE.InstancedMesh(geo, toon('#4f8a2c', { flat: true }), n);
        const m = new THREE.Matrix4();
        const q = new THREE.Quaternion();
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2;
          const d = Math.sqrt(rand()) * def.r;
          q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4));
          const s = 0.7 + rand() * 0.8;
          m.compose(new THREE.Vector3(x + Math.cos(a) * d, 0, z + Math.sin(a) * d), q, new THREE.Vector3(s, s, s));
          im.setMatrixAt(i, m);
        }
        im.castShadow = true;
        im.userData.dynamic = true;
        this.dynamic.add(im);
        this.areas.push({ type: 'tick', x, z, r: def.r, msg: '⚠️ 진드기가 사는 풀숲이에요! 진드기는 풀잎 끝에 있다가 옷에 달라붙어요. 긴 옷과 기피제를 잊지 마세요.' });
        this.avoid.push({ type: 'circle', x, z, r: def.r });
        break;
      }
      case 'pen': {
        const hw = def.w / 2;
        const hd = def.d / 2;
        const posts = [];
        for (let i = -hw; i <= hw + 0.01; i += 1.25) posts.push([x + i, z - hd], [x + i, z + hd]);
        for (let j = -hd + 1.25; j < hd; j += 1.25) posts.push([x - hw, z + j], [x + hw, z + j]);
        for (const [px, pz] of posts) statics.add(mesh(G.box(0.14, 1.0, 0.14), '#a1887f', px, 0.5, pz));
        for (const [w, d, ox, oz] of [[def.w, 0.08, 0, -hd], [def.w, 0.08, 0, hd], [0.08, def.d, -hw, 0], [0.08, def.d, hw, 0]]) {
          statics.add(mesh(G.box(w, 0.1, d), '#a1887f', x + ox, 0.75, z + oz));
          statics.add(mesh(G.box(w, 0.1, d), '#a1887f', x + ox, 0.4, z + oz));
        }
        this.addBox(x, z - hd, hw, 0.2);
        this.addBox(x, z + hd, hw, 0.2);
        this.addBox(x - hw, z, 0.2, hd);
        this.addBox(x + hw, z, 0.2, hd);
        this.avoid.push({ type: 'box', x, z, hw, hd });
        this.mini.boxes.push({ type: 'box', x, z, hw, hd, color: '#c8b38a' });
        if (def.animal === 'camel') statics.add(mesh(G.box(1.6, 0.4, 0.6), '#8d6e63', x + hw - 1.2, 0.2, z - hd + 0.8));
        for (let i = 0; i < (def.count || 2); i++) this.addAnimal(def.animal, x + (rand() - 0.5) * (def.w - 2), z + (rand() - 0.5) * (def.d - 2), { box: { x, z, hw: hw - 0.9, hd: hd - 0.9 } });
        break;
      }
      case 'chickens':
        for (let i = 0; i < (def.count || 3); i++) this.addAnimal('chicken', x + (rand() - 0.5) * 3, z + (rand() - 0.5) * 3, { circle: { x, z, r: 3.2 } });
        break;
      case 'oasis': {
        statics.add(mesh(G.circle(def.r, 28), waterMat, x, 0.05, z, { rx: -Math.PI / 2, shadow: false }));
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + 0.4;
          const tr = makeTree('palm', rand);
          tr.position.set(x + Math.cos(a) * (def.r + 1.2), 0, z + Math.sin(a) * (def.r + 1.2));
          statics.add(tr);
        }
        this.addCircle(x, z, def.r + 0.4);
        this.avoid.push({ type: 'circle', x, z, r: def.r + 2.2 });
        this.mini.water.push({ type: 'circle', x, z, r: def.r, color: '#5bb4d8' });
        break;
      }
      case 'river': {
        const water = mesh(G.box(def.w, 0.06, 90), waterMat, x, 0.03, z, { shadow: false, receive: true });
        water.userData.dynamic = true;
        this.dynamic.add(water);
        this.river = water;
        this.addBox(x, z, def.w / 2 + 0.2, 45);
        this.mini.water.push({ type: 'box', x, z, hw: def.w / 2, hd: 45, color: '#5bb4d8' });
        for (let i = 0; i < 14; i++) statics.add(mesh(G.cyl(0.04, 0.04, 1.2, 4), '#6d8f3a', x - def.w / 2 - 0.4 + rand() * 0.4, 0.5, -28 + i * 4 + rand() * 2));
        break;
      }
      case 'swamp': {
        statics.add(mesh(G.circle(def.r, 24), toon('#4d6b3a', { opacity: 0.95 }), x, 0.05, z, { rx: -Math.PI / 2, shadow: false }));
        for (let i = 0; i < 16; i++) {
          const a = rand() * Math.PI * 2;
          const d = def.r * (0.7 + rand() * 0.45);
          statics.add(mesh(G.cyl(0.04, 0.05, 1.0 + rand(), 4), '#7c9a4c', x + Math.cos(a) * d, 0.6, z + Math.sin(a) * d));
        }
        this.addCircle(x, z, def.r * 0.85);
        this.avoid.push({ type: 'circle', x, z, r: def.r + 1.5 });
        this.mini.water.push({ type: 'circle', x, z, r: def.r, color: '#4d6b3a' });
        this.addSwarm(x, 1.0, z, 26, 3.2);
        this.areas.push({ type: 'mosquito', x, z, r: def.r + 3, msg: '🦟 늪과 웅덩이는 얼룩날개모기의 산란 장소예요! 말라리아 모기는 주로 밤에 물어요.' });
        break;
      }
      case 'puddles': {
        for (let i = 0; i < 5; i++) {
          const a = rand() * Math.PI * 2;
          const d = rand() * def.r;
          statics.add(mesh(G.circle(0.5 + rand() * 0.6, 16), waterMat, x + Math.cos(a) * d, 0.04, z + Math.sin(a) * d, { rx: -Math.PI / 2, shadow: false, s: [1, 0.7, 1] }));
        }
        statics.add(mesh(G.cyl(0.35, 0.28, 0.25, 10), '#bf8a5a', x + 1.5, 0.12, z - 1));
        statics.add(mesh(G.cyl(0.32, 0.32, 0.02, 10), waterMat, x + 1.5, 0.24, z - 1));
        statics.add(mesh(G.cyl(0.4, 0.35, 0.5, 10), '#78909c', x - 1.2, 0.25, z + 1.4));
        this.addSwarm(x, 0.9, z, 18, 2.5);
        this.areas.push({ type: 'mosquito', x, z, r: def.r + 2, msg: '🦟 고인 물에 모기 유충이 꿈틀거려요! 숲모기는 작은 웅덩이·화분 받침에도 알을 낳아요.' });
        break;
      }
      case 'tires': {
        for (let i = 0; i < 4; i++) {
          const ox = (i % 2) * 1.1 - 0.5;
          const oz = Math.floor(i / 2) * 1.1 - 0.5;
          const h = i === 0 ? 2 : 1;
          for (let j = 0; j < h; j++) statics.add(mesh(G.torus(0.42, 0.18, 8, 16), '#2b2b2b', x + ox, 0.18 + j * 0.34, z + oz, { rx: Math.PI / 2 }));
          statics.add(mesh(G.circle(0.3, 12), waterMat, x + ox, 0.2 + (h - 1) * 0.34, z + oz, { rx: -Math.PI / 2, shadow: false }));
        }
        this.addCircle(x, z, 1.4);
        this.addSwarm(x, 1.0, z, 16, 1.8);
        this.areas.push({ type: 'mosquito', x, z, r: 4, msg: '🦟 버려진 폐타이어 속 빗물은 숲모기가 가장 좋아하는 산란 장소예요!' });
        break;
      }
      case 'lanterns': {
        const len = def.len || 12;
        for (const sx of [-1, 1]) {
          statics.add(mesh(G.cyl(0.1, 0.12, 4.2, 8), '#8d2c1e', x + sx * len / 2, 2.1, z));
          this.addCircle(x + sx * len / 2, z, 0.3);
        }
        statics.add(mesh(G.box(len, 0.04, 0.04), '#5d4037', x, 3.9, z));
        for (let i = 0; i < 7; i++) {
          const lx = x - len / 2 + ((i + 1) * len) / 8;
          const sag = Math.sin(((i + 1) / 8) * Math.PI) * 0.5;
          statics.add(mesh(G.sphere(0.32, 12, 10), toon('#e53935', { emissive: '#ff5252', emissiveIntensity: 0.4 }), lx, 3.5 - sag, z, { s: [1, 1.15, 1] }));
          statics.add(mesh(G.cyl(0.16, 0.16, 0.08, 8), '#ffd54f', lx, 3.88 - sag, z));
        }
        break;
      }
      case 'scooter': {
        const v = makeVehicle('bike', def.color);
        v.position.set(x, 0, z);
        v.rotation.y = this.rand() * Math.PI * 2;
        statics.add(v);
        this.addCircle(x, z, 0.9);
        break;
      }
      default:
        break;
    }
  }

  // ───── 원경 ─────
  buildScenery(statics) {
    const t = this.theme;
    const rand = this.rand;
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2 + rand() * 0.3;
      const d = 150 + rand() * 110;
      const h = 30 + rand() * 50;
      const rad = 30 + rand() * 30;
      const m = mesh(G.cone(rad, h, 6), toon(t.mountain, { flat: true }), Math.cos(a) * d, h / 2 - 2, Math.sin(a) * d, { ry: rand() * 3, shadow: false });
      statics.add(m);
      if (t.mountainSnow || h > 70) statics.add(mesh(G.cone(rad * 0.32, h * 0.32, 6), toon('#f4f8fb', { flat: true }), Math.cos(a) * d, h - h * 0.16 - 2, Math.sin(a) * d, { ry: m.rotation.y, shadow: false }));
    }
    this.clouds = new THREE.Group();
    for (let i = 0; i < 12; i++) {
      const c = new THREE.Group();
      const n = 3 + Math.floor(rand() * 3);
      for (let j = 0; j < n; j++) c.add(mesh(G.ico(3 + rand() * 3, 1), toon('#ffffff', { flat: true }), j * 3.5 - n * 1.6, rand() * 1.5, rand() * 2, { s: [1.3, 0.75, 1], shadow: false }));
      const a = rand() * Math.PI * 2;
      const d = 70 + rand() * 120;
      c.position.set(Math.cos(a) * d, 45 + rand() * 25, Math.sin(a) * d);
      c.userData.speed = 0.6 + rand() * 0.8;
      c.traverse((o) => { if (o.isMesh) o.userData.dynamic = true; });
      this.clouds.add(c);
    }
    this.dynamic.add(this.clouds);
  }

  buildGrass() {
    const t = this.theme;
    const rand = mulberry32(hashString(this.region.id + 'grass'));
    if (t.tuft) {
      const n = 520;
      const geo = new THREE.ConeGeometry(0.12, 0.42, 3);
      geo.translate(0, 0.2, 0);
      const im = new THREE.InstancedMesh(geo, toon(t.tuft, { flat: true }), n);
      const m = new THREE.Matrix4();
      let c = 0;
      for (let i = 0; i < n * 3 && c < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * 31;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        if (!this.isFree(x, z, 0.4)) continue;
        const s = 0.7 + rand() * 0.9;
        m.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rand() * 3, 0)), new THREE.Vector3(s, s, s));
        im.setMatrixAt(c++, m);
      }
      im.count = c;
      im.userData.dynamic = true;
      this.dynamic.add(im);
    }
    if (t.flowers) {
      const n = 160;
      const geo = new THREE.IcosahedronGeometry(0.11, 0);
      geo.translate(0, 0.14, 0);
      const im = new THREE.InstancedMesh(geo, new THREE.MeshToonMaterial({ color: '#ffffff', gradientMap: toon('#fff').gradientMap }), n);
      const m = new THREE.Matrix4();
      const col = new THREE.Color();
      let c = 0;
      for (let i = 0; i < n * 4 && c < n; i++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * 30;
        const x = Math.cos(a) * d;
        const z = Math.sin(a) * d;
        if (!this.isFree(x, z, 0.3)) continue;
        m.makeTranslation(x, 0, z);
        im.setMatrixAt(c, m);
        im.setColorAt(c, col.set(t.flowers[c % t.flowers.length]));
        c++;
      }
      im.count = c;
      im.userData.dynamic = true;
      this.dynamic.add(im);
    }
  }

  // ───── 날씨 입자 ─────
  buildWeather() {
    const w = this.theme.weather;
    this.weather = null;
    if (!w || w === 'none') return;
    const N = w === 'rain' ? 700 : w === 'dust' ? 220 : 520;
    const pos = new Float32Array(N * 3);
    const rand = this.rand;
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (rand() - 0.5) * 60;
      pos[i * 3 + 1] = rand() * 26;
      pos[i * 3 + 2] = (rand() - 0.5) * 60;
    }
    let obj;
    if (w === 'rain') {
      const lp = new Float32Array(N * 6);
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(lp, 3));
      obj = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#cfe3f2', transparent: true, opacity: 0.55 }));
      obj.userData.base = pos;
    } else {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      const color = { snow: '#ffffff', petals: '#ffb3cc', dust: '#f3dcae' }[w];
      const size = { snow: 0.28, petals: 0.26, dust: 0.18 }[w];
      obj = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity: w === 'dust' ? 0.55 : 0.95, depthWrite: false }));
    }
    obj.frustumCulled = false;
    obj.userData.dynamic = true;
    this.dynamic.add(obj);
    this.weather = { kind: w, obj, pos, N };
  }

  addSwarm(x, y, z, n = 16, spread = 1.4) {
    const pos = new Float32Array(n * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: '#2b2b2b', size: 0.13 }));
    pts.frustumCulled = false;
    pts.userData.dynamic = true;
    this.dynamic.add(pts);
    const seeds = Array.from({ length: n }, () => [Math.random() * 6, Math.random() * 6, Math.random() * 6, 0.5 + Math.random()]);
    this.swarms.push({ pts, pos, seeds, x, y, z, spread });
  }

  addBats(x, z) {
    const bats = new THREE.Group();
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group();
      const wl = mesh(G.box(0.5, 0.03, 0.22), '#2b2b2b', -0.25, 0, 0, { shadow: false });
      const wr = mesh(G.box(0.5, 0.03, 0.22), '#2b2b2b', 0.25, 0, 0, { shadow: false });
      const pl = new THREE.Group();
      const pr = new THREE.Group();
      pl.add(wl);
      pr.add(wr);
      b.add(pl, pr, mesh(G.sphere(0.1, 6, 4), '#3e2723', 0, 0, 0, { shadow: false }));
      b.userData = { pl, pr, a: (i / 5) * Math.PI * 2, r: 2.5 + Math.random() * 1.5, h: 5.5 + Math.random() * 1.5, s: 0.8 + Math.random() * 0.5 };
      bats.add(b);
    }
    bats.traverse((o) => { if (o.isMesh) o.userData.dynamic = true; });
    bats.position.set(x, 0, z);
    this.dynamic.add(bats);
    this.updaters.push((dt, t) => {
      for (const b of bats.children) {
        const u = b.userData;
        u.a += dt * u.s;
        b.position.set(Math.cos(u.a) * u.r, u.h + Math.sin(t * 2 + u.a) * 0.4, Math.sin(u.a) * u.r);
        b.rotation.y = -u.a;
        const f = Math.sin(t * 18 + u.a) * 0.7;
        u.pl.rotation.z = f;
        u.pr.rotation.z = -f;
      }
    });
  }

  addAnimal(kind, x, z, bounds) {
    const a = makeAnimal(kind);
    a.position.set(x, 0, z);
    a.rotation.y = Math.random() * Math.PI * 2;
    a.userData.bounds = bounds;
    a.userData.wait = Math.random() * 3;
    a.userData.seed = Math.random() * 10;
    this.dynamic.add(a);
    this.animals.push(a);
  }

  // ───── 주민 ─────
  addNPC(kind, def, pos) {
    const healed = kind === 'patient' && this.state.cleared[def.disease];
    const ch = kind === 'mentor' ? makeOwl() : makeCharacter(def.look, { kid: def.kid, sick: kind === 'patient' && !healed ? def.sick : null });
    ch.root.position.set(pos[0], 0, pos[1]);
    ch.root.rotation.y = Math.atan2(this.spawn.x - pos[0], this.spawn.z - pos[1]) * 0.6;
    this.dynamic.add(ch.root);
    const npc = {
      kind,
      def,
      ch,
      home: new THREE.Vector3(pos[0], 0, pos[1]),
      target: null,
      wait: 1 + Math.random() * 3,
      speed: 0,
      wander: kind === 'villager' ? 3 : kind === 'patient' ? 1.2 : 0,
      marker: null,
      headY: def.kid ? 2.05 : kind === 'mentor' ? 2.45 : 2.45,
    };
    const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('patient'), depthTest: false, transparent: true }));
    marker.scale.set(0.9, 0.9, 0.9);
    marker.renderOrder = 10;
    marker.visible = false;
    ch.root.add(marker);
    marker.position.y = npc.headY + 0.35;
    npc.marker = marker;
    this.npcs.push(npc);
    this.interactables.push({ kind: 'npc', npc, get pos() { return npc.ch.root.position; }, r: 2.3, label: '말하기' });
    this.refreshMarker(npc);
    return npc;
  }

  refreshMarker(npc) {
    let kind = null;
    if (npc.kind === 'patient' && !this.state.cleared[npc.def.disease]) kind = 'patient';
    if (npc.kind === 'guide' && !this.state.introSeen[this.region.id]) kind = 'guide';
    if (npc.kind === 'mentor' && !this.state.mentorIntro) kind = 'guide';
    npc.marker.visible = !!kind;
    if (kind) npc.marker.material.map = markerTexture(kind);
  }

  refreshMarkers() {
    for (const n of this.npcs) this.refreshMarker(n);
  }

  healPatient(diseaseId) {
    const npc = this.npcs.find((n) => n.kind === 'patient' && n.def.disease === diseaseId);
    if (!npc) return;
    const old = npc.ch;
    const ch = makeCharacter(npc.def.look, { kid: npc.def.kid });
    ch.root.position.copy(old.root.position);
    ch.root.rotation.copy(old.root.rotation);
    old.root.remove(npc.marker);
    ch.root.add(npc.marker);
    this.dynamic.remove(old.root);
    this.dynamic.add(ch.root);
    npc.ch = ch;
    this.refreshMarker(npc);
    // 회복 하트
    const heart = new THREE.Sprite(new THREE.SpriteMaterial({ map: markerTexture('done'), depthTest: false, transparent: true }));
    heart.scale.setScalar(0.8);
    heart.position.y = npc.headY + 0.4;
    heart.renderOrder = 11;
    ch.root.add(heart);
    let life = 0;
    const fn = (dt) => {
      life += dt;
      heart.position.y = npc.headY + 0.4 + life * 0.8;
      heart.material.opacity = Math.max(0, 1 - life / 2.4);
      if (life > 2.4) {
        ch.root.remove(heart);
        this.updaters.splice(this.updaters.indexOf(fn), 1);
      }
    };
    this.updaters.push(fn);
  }

  // ───── 미니맵 ─────
  buildMinimap() {
    const S = 220;
    const span = 34;
    const k = S / (span * 2);
    const W = (v) => (v + span) * k;
    const t = this.theme;
    const c = document.createElement('canvas');
    c.width = S;
    c.height = S;
    const ctx = c.getContext('2d');
    ctx.fillStyle = t.ground;
    ctx.fillRect(0, 0, S, S);
    for (const wtr of this.mini.water) {
      ctx.fillStyle = wtr.color;
      if (wtr.type === 'box') ctx.fillRect(W(wtr.x - wtr.hw), W(wtr.z - wtr.hd), wtr.hw * 2 * k, wtr.hd * 2 * k);
      else { ctx.beginPath(); ctx.arc(W(wtr.x), W(wtr.z), wtr.r * k, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const p of this.region.paths) {
      ctx.beginPath();
      p.pts.forEach(([x, z], i) => (i ? ctx.lineTo(W(x), W(z)) : ctx.moveTo(W(x), W(z))));
      ctx.strokeStyle = t.path;
      ctx.lineWidth = p.w * k;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(40,70,40,0.35)';
    for (const [x, z] of this.mini.trees) { ctx.beginPath(); ctx.arc(W(x), W(z), 1.1 * k, 0, Math.PI * 2); ctx.fill(); }
    for (const b of this.mini.boxes) {
      ctx.fillStyle = b.color || 'rgba(255,255,255,0.92)';
      ctx.strokeStyle = 'rgba(60,60,60,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(W(b.x - b.hw), W(b.z - b.hd), b.hw * 2 * k, b.hd * 2 * k, 3);
      ctx.fill();
      ctx.stroke();
    }
    if (this.clinicDoor) {
      ctx.fillStyle = '#43a047';
      const cx = W(this.clinicDoor.x);
      const cz = W(this.clinicDoor.z - 3.6);
      ctx.fillRect(cx - 6, cz - 2, 12, 4);
      ctx.fillRect(cx - 2, cz - 6, 4, 12);
    }
    const g = ctx.createRadialGradient(S / 2, S / 2, S * 0.36, S / 2, S / 2, S * 0.5);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, t.far);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
    this.minimap = { canvas: c, span, size: S };
  }

  // ───── 매 프레임 ─────
  update(dt, t, playerPos) {
    for (const npc of this.npcs) this.updateNPC(npc, dt, t, playerPos);
    for (const a of this.animals) this.updateAnimal(a, dt, t);
    for (const fn of this.updaters.slice()) fn(dt, t);
    if (this.clouds) for (const c of this.clouds.children) { c.position.x += c.userData.speed * dt; if (c.position.x > 200) c.position.x = -200; }
    for (const s of this.swarms) {
      const d = Math.hypot(playerPos.x - s.x, playerPos.z - s.z);
      if (d > 45) continue;
      for (let i = 0; i < s.seeds.length; i++) {
        const [a, b, c, sp] = s.seeds[i];
        s.pos[i * 3] = s.x + Math.sin(t * 2.3 * sp + a) * s.spread * Math.cos(t * 0.7 + b);
        s.pos[i * 3 + 1] = s.y + Math.sin(t * 3.1 * sp + b) * 0.5;
        s.pos[i * 3 + 2] = s.z + Math.cos(t * 1.9 * sp + c) * s.spread * Math.sin(t * 0.5 + a);
      }
      s.pts.geometry.attributes.position.needsUpdate = true;
    }
    if (this.river) this.river.position.y = 0.03 + Math.sin(t * 1.5) * 0.01;
    this.updateWeather(dt, t, playerPos);
    for (const n of this.npcs) if (n.marker.visible) n.marker.position.y = n.headY + 0.35 + Math.sin(t * 3) * 0.1;
  }

  updateWeather(dt, t, p) {
    const w = this.weather;
    if (!w) return;
    const { pos, N, kind, obj } = w;
    const fall = { snow: 1.6, petals: 0.9, rain: 16, dust: 0.1 }[kind];
    for (let i = 0; i < N; i++) {
      const j = i * 3;
      pos[j + 1] -= fall * dt * (0.7 + (i % 5) * 0.12);
      if (kind === 'snow') pos[j] += Math.sin(t + i) * dt * 0.4;
      if (kind === 'petals') { pos[j] += (Math.sin(t * 0.8 + i) + 0.6) * dt * 0.9; pos[j + 2] += Math.cos(t * 0.6 + i) * dt * 0.5; }
      if (kind === 'dust') { pos[j] += dt * 2.2; pos[j + 1] += Math.sin(t + i) * dt * 0.2; }
      if (pos[j + 1] < 0) pos[j + 1] += 26;
      if (pos[j + 1] > 26) pos[j + 1] -= 26;
      // 플레이어 주변으로 감싸기
      const dx = pos[j] - p.x;
      const dz = pos[j + 2] - p.z;
      if (dx > 30) pos[j] -= 60; else if (dx < -30) pos[j] += 60;
      if (dz > 30) pos[j + 2] -= 60; else if (dz < -30) pos[j + 2] += 60;
    }
    if (kind === 'rain') {
      const lp = obj.geometry.attributes.position.array;
      for (let i = 0; i < N; i++) {
        lp[i * 6] = pos[i * 3];
        lp[i * 6 + 1] = pos[i * 3 + 1];
        lp[i * 6 + 2] = pos[i * 3 + 2];
        lp[i * 6 + 3] = pos[i * 3] + 0.05;
        lp[i * 6 + 4] = pos[i * 3 + 1] + 0.7;
        lp[i * 6 + 5] = pos[i * 3 + 2];
      }
      obj.geometry.attributes.position.needsUpdate = true;
    } else obj.geometry.attributes.position.needsUpdate = true;
  }

  updateNPC(npc, dt, t, playerPos) {
    const root = npc.ch.root;
    const p = root.position;
    const dToPlayer = Math.hypot(playerPos.x - p.x, playerPos.z - p.z);
    let speed = 0;
    if (npc.frozen || dToPlayer < 3.2) {
      // 플레이어를 바라봐요
      const want = Math.atan2(playerPos.x - p.x, playerPos.z - p.z);
      root.rotation.y = lerpAngle(root.rotation.y, want, 1 - Math.pow(0.002, dt));
      npc.target = null;
    } else if (npc.wander > 0) {
      if (!npc.target) {
        npc.wait -= dt;
        if (npc.wait <= 0) {
          const a = Math.random() * Math.PI * 2;
          const d = Math.random() * npc.wander;
          npc.target = new THREE.Vector3(npc.home.x + Math.cos(a) * d, 0, npc.home.z + Math.sin(a) * d);
        }
      } else {
        const dx = npc.target.x - p.x;
        const dz = npc.target.z - p.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.15) {
          npc.target = null;
          npc.wait = 2 + Math.random() * 4;
        } else {
          speed = npc.kind === 'patient' ? 0.9 : 1.6;
          p.x += (dx / d) * speed * dt;
          p.z += (dz / d) * speed * dt;
          root.rotation.y = lerpAngle(root.rotation.y, Math.atan2(dx, dz), 1 - Math.pow(0.001, dt));
        }
      }
    }
    if (npc.ch.owl) animateOwl(npc.ch, dt, t);
    else animateCharacter(npc.ch, dt, speed, t);
  }

  updateAnimal(a, dt, t) {
    const u = a.userData;
    let speed = 0;
    if (!u.target) {
      u.wait -= dt;
      if (u.wait <= 0) {
        if (u.bounds.box) {
          const b = u.bounds.box;
          u.target = new THREE.Vector3(b.x + (Math.random() * 2 - 1) * b.hw, 0, b.z + (Math.random() * 2 - 1) * b.hd);
        } else {
          const c = u.bounds.circle;
          const ang = Math.random() * Math.PI * 2;
          const d = Math.random() * c.r;
          u.target = new THREE.Vector3(c.x + Math.cos(ang) * d, 0, c.z + Math.sin(ang) * d);
        }
      }
    } else {
      const dx = u.target.x - a.position.x;
      const dz = u.target.z - a.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.1) { u.target = null; u.wait = 2 + Math.random() * 5; }
      else {
        speed = u.speed;
        a.position.x += (dx / d) * speed * dt;
        a.position.z += (dz / d) * speed * dt;
        a.rotation.y = lerpAngle(a.rotation.y, Math.atan2(dx, dz), 1 - Math.pow(0.01, dt));
      }
    }
    animateAnimal(a, dt, speed, t);
  }

  // 플레이어 충돌 처리 (원·상자)
  resolve(pos, radius = 0.42) {
    for (const c of this.colliders) {
      if (c.type === 'circle') {
        const dx = pos.x - c.x;
        const dz = pos.z - c.z;
        const d = Math.hypot(dx, dz);
        const m = c.r + radius;
        if (d < m && d > 1e-5) {
          pos.x = c.x + (dx / d) * m;
          pos.z = c.z + (dz / d) * m;
        }
      } else {
        const cx = Math.max(c.x - c.hw, Math.min(pos.x, c.x + c.hw));
        const cz = Math.max(c.z - c.hd, Math.min(pos.z, c.z + c.hd));
        const dx = pos.x - cx;
        const dz = pos.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < radius) {
          if (d > 1e-5) {
            pos.x = cx + (dx / d) * radius;
            pos.z = cz + (dz / d) * radius;
          } else {
            // 상자 안에 들어간 경우 가장 가까운 면으로 밀어내요
            const px = c.hw - Math.abs(pos.x - c.x);
            const pz = c.hd - Math.abs(pos.z - c.z);
            if (px < pz) pos.x = c.x + Math.sign(pos.x - c.x || 1) * (c.hw + radius);
            else pos.z = c.z + Math.sign(pos.z - c.z || 1) * (c.hd + radius);
          }
        }
      }
    }
    for (const npc of this.npcs) {
      const p = npc.ch.root.position;
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d = Math.hypot(dx, dz);
      const m = radius + (npc.kind === 'mentor' ? 0.6 : 0.4);
      if (d < m && d > 1e-5) { pos.x = p.x + (dx / d) * m; pos.z = p.z + (dz / d) * m; }
    }
    for (const a of this.animals) {
      const p = a.position;
      const dx = pos.x - p.x;
      const dz = pos.z - p.z;
      const d = Math.hypot(dx, dz);
      const m = radius + a.userData.radius;
      if (d < m && d > 1e-5) { pos.x = p.x + (dx / d) * m; pos.z = p.z + (dz / d) * m; }
    }
    const d = Math.hypot(pos.x, pos.z);
    if (d > R_PLAY) { pos.x *= R_PLAY / d; pos.z *= R_PLAY / d; }
  }

  dispose() {
    // 합쳐서 새로 만든 지오메트리만 해제해요(공유 지오메트리는 다른 지역에서 다시 씁니다).
    this.group.traverse((o) => {
      if (o.userData.baked && o.geometry) o.geometry.dispose();
      if ((o.isPoints || o.isLineSegments) && o.geometry) o.geometry.dispose();
    });
  }
}

export function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}
