// 이동 장면: 구름 위를 나는 비행기, 길을 달리는 바이크·자동차
import * as THREE from 'three';
import { toon, G, mesh, canvasTexture, texturedToon, disposeTree } from './toon.js';
import { makeVehicle, makeTree } from './props.js';
import { makeCharacter } from './characters.js';
import { PLAYER_LOOK } from './player.js';

function skyDome(top, bottom) {
  return new THREE.Mesh(
    new THREE.SphereGeometry(500, 24, 12),
    new THREE.ShaderMaterial({
      uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
      vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top;
uniform vec3 bottom;
varying vec3 vP;
void main() {
  float h = clamp(vP.y * 1.4 + 0.3, 0.0, 1.0);
  gl_FragColor = vec4(mix(bottom, top, h), 1.0);
  #include <colorspace_fragment>
}`,
    }),
  );
}

export class Cutscene {
  constructor(world) {
    this.world = world;
    this.active = false;
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.3, 1200);
  }

  build(kind, vehicle, theme) {
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight('#ffffff', '#9fb6c9', 1.6));
    const sun = new THREE.DirectionalLight('#fff1d6', 2.2);
    sun.position.set(-10, 20, 8);
    scene.add(sun);
    const items = [];
    if (kind === 'air') {
      scene.add(skyDome('#4f9fe0', '#ffe2c4'));
      scene.fog = new THREE.Fog('#ffe9d2', 60, 260);
      const n = 260;
      const geo = new THREE.IcosahedronGeometry(1, 1);
      const im = new THREE.InstancedMesh(geo, toon('#ffffff', { flat: true }), n);
      const data = [];
      for (let i = 0; i < n; i++) {
        data.push({ x: (Math.random() - 0.5) * 160, y: -9 - Math.random() * 4, z: -260 + Math.random() * 300, s: 4 + Math.random() * 7 });
      }
      im.userData.data = data;
      scene.add(im);
      items.push({ type: 'clouds', im, data, speed: vehicle === 'jet' ? 90 : 60 });
      const plane = makeVehicle(vehicle === 'jet' ? 'jet' : 'plane');
      plane.rotation.y = Math.PI;
      scene.add(plane);
      items.push({ type: 'plane', obj: plane });
      // 비행운
      const trail = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.6, 30, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.35, depthWrite: false }));
      trail.rotation.x = Math.PI / 2;
      trail.position.set(0, 0, 19);
      plane.add(trail);
    } else {
      const t = theme;
      scene.add(skyDome(t.sky[0], t.sky[1]));
      scene.fog = new THREE.Fog(t.fog, 40, 160);
      const ground = mesh(new THREE.PlaneGeometry(400, 400), toon(t.ground), 0, 0, 0, { rx: -Math.PI / 2, shadow: false });
      scene.add(ground);
      const dash = canvasTexture(64, 256, (ctx, w, h) => {
        ctx.fillStyle = '#5f6670';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f5f5f5';
        ctx.fillRect(w / 2 - 3, 0, 6, h * 0.5);
      });
      dash.wrapS = dash.wrapT = THREE.RepeatWrapping;
      dash.repeat.set(1, 40);
      const road = new THREE.Mesh(new THREE.PlaneGeometry(6, 400), texturedToon(dash));
      road.rotation.x = -Math.PI / 2;
      road.position.y = 0.02;
      scene.add(road);
      items.push({ type: 'road', tex: dash, speed: vehicle === 'car' ? 0.9 : 0.7 });
      const kinds = t.trees.map(([k]) => k);
      const side = new THREE.Group();
      for (let i = 0; i < 40; i++) {
        const tr = makeTree(kinds[i % kinds.length]);
        const s = i % 2 ? 1 : -1;
        tr.position.set(s * (6 + Math.random() * 14), 0, -180 + i * 9 + Math.random() * 4);
        side.add(tr);
      }
      for (let i = 0; i < 24; i++) {
        const pole = mesh(G.cyl(0.08, 0.08, 2.6, 6), '#9e9e9e', 4, 1.3, -180 + i * 15);
        side.add(pole);
      }
      scene.add(side);
      items.push({ type: 'side', obj: side, speed: vehicle === 'car' ? 40 : 30 });
      const v = makeVehicle(vehicle);
      const rider = makeCharacter(PLAYER_LOOK);
      rider.sitting = true;
      rider.parts.legL.rotation.x = rider.parts.legR.rotation.x = -1.35;
      rider.parts.armL.rotation.x = rider.parts.armR.rotation.x = -0.9;
      rider.root.position.set(v.userData.seatX || 0, v.userData.seatY || 0.6, v.userData.seatZ || 0);
      v.add(rider.root);
      v.rotation.y = Math.PI;
      scene.add(v);
      items.push({ type: 'ride', obj: v });
    }
    return { scene, items };
  }

  play({ kind, vehicle, theme, duration, onProgress }) {
    const built = this.build(kind, vehicle, theme);
    this.scene = built.scene;
    this.items = built.items;
    this.kind = kind;
    this.t = 0;
    this.duration = duration;
    this.onProgress = onProgress;
    this.active = true;
    this.ended = false;
    this.resize();
    return new Promise((resolve) => {
      // 끝나도 화면이 하얗게 덮일 때까지는 계속 그려요(stop()에서 멈춤).
      this.finish = () => {
        if (this.ended) return;
        this.ended = true;
        resolve();
      };
    });
  }

  stop() {
    this.active = false;
    if (this.scene) disposeTree(this.scene);
    this.scene = null;
    this.items = [];
  }

  resize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.fov = window.innerWidth < window.innerHeight ? 62 : 45;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    if (!this.active) return;
    this.t += dt;
    const t = this.t;
    const p = Math.min(1, t / this.duration);
    this.onProgress && this.onProgress(p);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    for (const it of this.items) {
      if (it.type === 'clouds') {
        it.data.forEach((c, i) => {
          c.z += it.speed * dt;
          if (c.z > 40) { c.z -= 300; c.x = (Math.random() - 0.5) * 160; }
          m.compose(new THREE.Vector3(c.x, c.y, c.z), q, new THREE.Vector3(c.s, c.s * 0.45, c.s * 0.8));
          it.im.setMatrixAt(i, m);
        });
        it.im.instanceMatrix.needsUpdate = true;
      } else if (it.type === 'plane') {
        it.obj.position.y = Math.sin(t * 1.4) * 0.4;
        it.obj.rotation.z = Math.sin(t * 0.9) * 0.12;
        it.obj.rotation.x = Math.sin(t * 0.7) * 0.03;
        const a = -0.9 + t * 0.18;
        this.camera.position.set(Math.sin(a) * 16, 4 + Math.sin(t * 0.5), Math.cos(a) * 16 - 2);
        this.camera.lookAt(0, 0, -2);
      } else if (it.type === 'road') {
        it.tex.offset.y += dt * it.speed * 4;
      } else if (it.type === 'side') {
        for (const c of it.obj.children) {
          c.position.z += it.speed * dt;
          if (c.position.z > 40) c.position.z -= 220;
        }
      } else if (it.type === 'ride') {
        it.obj.position.y = Math.abs(Math.sin(t * 16)) * 0.03;
        it.obj.rotation.z = Math.sin(t * 1.3) * 0.03;
        const a = 0.9 - t * 0.12;
        this.camera.position.set(Math.sin(a) * 9, 3.2, Math.cos(a) * 9 - 1);
        this.camera.lookAt(0, 1, -1.5);
      }
    }
    if (t >= this.duration && !this.ended) this.finish();
  }

  render() {
    this.world.renderer.render(this.scene, this.camera);
  }
}
