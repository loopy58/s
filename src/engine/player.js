// 플레이어(원정대원) 이동과 탈것 타기
import * as THREE from 'three';
import { makeCharacter, animateCharacter } from './characters.js';
import { lerpAngle } from './zone.js';

export const PLAYER_LOOK = {
  skin: '#f1c9a5',
  hair: '#3b2a20',
  style: 'short',
  coat: true,
  inner: '#4fb3a9',
  bottom: '#3c4f76',
  acc: 'stethoscope',
  bag: '#f4a261',
};

export class Player {
  constructor() {
    this.group = new THREE.Group();
    this.ch = makeCharacter(PLAYER_LOOK);
    this.group.add(this.ch.root);
    this.vel = new THREE.Vector3();
    this.facing = Math.PI;
    this.riding = null;
    this.speed = 0;
    this.shadowBlob = null;
  }

  get position() {
    return this.group.position;
  }

  mount(vehicle) {
    this.riding = vehicle;
    const m = vehicle.model;
    m.parent && m.parent.remove(m);
    m.position.set(0, 0, 0);
    m.rotation.set(0, 0, 0);
    this.group.add(m);
    const u = m.userData;
    this.ch.root.position.set(u.seatX || 0, u.seatY || 0.6, u.seatZ || 0);
    this.ch.sitting = true;
    this.group.position.set(vehicle.pos.x, 0, vehicle.pos.z);
  }

  dismount(zone) {
    const v = this.riding;
    if (!v) return;
    this.group.remove(v.model);
    v.model.position.copy(this.group.position);
    v.model.rotation.y = this.group.rotation.y;
    zone.dynamic.add(v.model);
    v.pos = v.model.position;
    v.collider.x = v.model.position.x;
    v.collider.z = v.model.position.z;
    this.ch.root.position.set(0, 0, 0);
    this.ch.sitting = false;
    this.riding = null;
    // 탈것 옆으로 내려요
    const side = new THREE.Vector3(1.6, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.group.rotation.y);
    this.group.position.add(side);
    zone.resolve(this.group.position);
  }

  update(dt, t, input, zone) {
    const mv = input.move();
    const max = this.riding ? (this.riding.type === 'car' ? 13 : 11.5) : mv.run ? 8.6 : 5.2;
    const target = new THREE.Vector3(mv.x, 0, -mv.y).multiplyScalar(max);
    const accel = this.riding ? 4 : 12;
    this.vel.lerp(target, 1 - Math.exp(-accel * dt));
    const p = this.group.position;
    p.addScaledVector(this.vel, dt);
    if (zone) zone.resolve(p, this.riding ? (this.riding.type === 'car' ? 1.3 : 0.7) : 0.42);
    this.speed = this.vel.length();
    if (this.speed > 0.4) {
      this.facing = Math.atan2(this.vel.x, this.vel.z);
    }
    this.group.rotation.y = lerpAngle(this.group.rotation.y, this.facing, 1 - Math.pow(0.0005, dt));
    if (this.riding) {
      // 바퀴가 구르는 느낌으로 살짝 흔들려요
      this.riding.model.position.y = Math.abs(Math.sin(t * 18)) * 0.02 * Math.min(1, this.speed / 5);
      this.riding.model.rotation.z = -Math.sin(t * 2) * 0.01;
      animateCharacter(this.ch, dt, 0, t);
    } else {
      animateCharacter(this.ch, dt, this.speed, t);
    }
  }
}
