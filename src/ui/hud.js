// 화면 위 정보(배지·도감 수, 미니맵, 상호작용 안내, 토스트, 지역 제목)
import * as THREE from 'three';
import { el, rich } from '../util.js';
import { IS_TOUCH } from '../engine/world.js';

export class HUD {
  constructor(root, handlers) {
    this.root = root;
    this.handlers = handlers;
    this.who = el('div', { class: 'who' });
    this.badgeIcon = el('div', { class: 'hud-badge', 'aria-hidden': 'true' }, '🩺');
    this.stats = el('div', { class: 'hud-stats' });
    this.quest = el('div', { class: 'hud-quest' });
    this.left = el('div', { class: 'hud-left' }, el('div', { class: 'hud-card' }, this.badgeIcon, this.who), this.stats, this.quest);
    this.soundBtn = el('button', { class: 'icon-btn', 'aria-label': '소리 켜고 끄기', onclick: (e) => { e.currentTarget.blur(); handlers.sound(); } }, '🔊', el('span', {}, '소리'));
    this.right = el('div', { class: 'hud-right' },
      el('button', { class: 'icon-btn', 'aria-label': '원정 수첩 열기', onclick: (e) => { e.currentTarget.blur(); handlers.notebook(); } }, '📖', el('span', {}, '수첩')),
      el('button', { class: 'icon-btn', 'aria-label': '지도 열기', onclick: (e) => { e.currentTarget.blur(); handlers.map(); } }, '🗺️', el('span', {}, '지도')),
      this.soundBtn,
    );
    this.miniCanvas = el('canvas', { width: 220, height: 220 });
    this.minimap = el('div', { class: 'minimap' }, this.miniCanvas);
    this.clock = el('span', { class: 'clock' });
    this.miniLabel = el('div', { class: 'mini-label' }, this.clock);
    this.prompt = el('div', { class: 'prompt', hidden: true });
    this.toasts = el('div', { class: 'toasts', 'aria-live': 'polite' });
    this.node = el('div', { class: 'hud' }, this.left, this.right, this.miniLabel, this.minimap, this.prompt);
    this.node.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    for (const c of this.node.children) c.style.pointerEvents = c === this.minimap ? 'none' : 'auto';
    this.left.style.pointerEvents = 'none';
    if (IS_TOUCH) {
      this.aBtn = el('button', { class: 'a-btn', 'aria-label': '상호작용', onclick: (e) => { e.currentTarget.blur(); handlers.action(); } }, 'A');
      this.node.append(this.aBtn);
    }
    root.append(this.node, this.toasts);
    this.v = new THREE.Vector3();
    setInterval(() => this.tickClock(), 10000);
    this.tickClock();
  }

  setVisible(v) {
    this.node.hidden = !v;
  }

  tickClock() {
    const d = new Date();
    this.clock.textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  }

  setPlayer(save, counts) {
    this.who.innerHTML = '';
    this.who.append(save.name, el('small', {}, '감염병 원정대원'));
    this.stats.innerHTML = '';
    this.stats.append(
      el('span', { class: 'chip', title: '원정 배지' }, '🏅 ', `${counts.badges}/${counts.regions}`),
      el('span', { class: 'chip', title: '도감에 기록한 감염병' }, '📖 ', `${counts.discovered}/${counts.diseases}`),
      el('span', { class: 'chip', title: '모은 별' }, '⭐ ', `${counts.stars}`),
    );
  }

  setQuest(html) {
    this.quest.hidden = !html;
    this.quest.innerHTML = html ? rich(html) : '';
  }

  setSound(on) {
    this.soundBtn.firstChild.textContent = on ? '🔊' : '🔇';
  }

  // 상호작용 대상 위에 안내 말풍선
  showPrompt(target, camera, label) {
    if (!target) {
      this.prompt.hidden = true;
      if (this.aBtn) this.aBtn.style.opacity = '0.55';
      return;
    }
    this.v.copy(target).project(camera);
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    if (this.v.z > 1) { this.prompt.hidden = true; return; }
    if (this.prompt.dataset.label !== label) {
      this.prompt.innerHTML = '';
      this.prompt.append(el('span', { class: 'key' }, IS_TOUCH ? 'A' : 'E'), label);
      this.prompt.dataset.label = label;
    }
    this.prompt.style.left = `${x}px`;
    this.prompt.style.top = `${y}px`;
    this.prompt.hidden = false;
    if (this.aBtn) this.aBtn.style.opacity = '1';
  }

  drawMinimap(zone, player) {
    const mm = zone.minimap;
    const ctx = this.miniCanvas.getContext('2d');
    const S = 220;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(mm.canvas, 0, 0, S, S);
    const k = S / (mm.span * 2);
    const W = (v) => (v + mm.span) * k;
    for (const npc of zone.npcs) {
      const p = npc.ch.root.position;
      const sick = npc.kind === 'patient' && npc.marker.visible;
      ctx.fillStyle = sick ? '#ff4d4d' : npc.marker.visible ? '#ffc93c' : '#ffffff';
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(W(p.x), W(p.z), sick || npc.marker.visible ? 6 : 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      if (sick) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('!', W(p.x), W(p.z) + 0.5);
      }
    }
    for (const v of zone.vehicles) {
      if (!v.parked) continue;
      ctx.font = '16px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(v.type === 'plane' ? '✈️' : v.type === 'car' ? '🚗' : '🛵', W(v.pos.x), W(v.pos.z));
    }
    // 플레이어 화살표
    const p = player.position;
    ctx.save();
    ctx.translate(W(p.x), W(p.z));
    ctx.rotate(-player.group.rotation.y + Math.PI);
    ctx.fillStyle = '#ffd23f';
    ctx.strokeStyle = '#7a4b00';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, 7);
    ctx.lineTo(0, 3);
    ctx.lineTo(-7, 7);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  toast(text, kind = '', ms = 3600) {
    const t = el('div', { class: `toast ${kind}`, html: rich(text) });
    this.toasts.append(t);
    while (this.toasts.children.length > 3) this.toasts.firstChild.remove();
    setTimeout(() => t.remove(), ms);
  }

  regionTitle(region) {
    this.root.querySelector('.region-title')?.remove();
    const n = el('div', { class: 'region-title' },
      el('div', { class: 'country' }, `${region.flag} ${region.country}`),
      el('h1', {}, region.name),
      el('div', { class: 'line' }),
      el('p', {}, region.subtitle),
    );
    this.root.append(n);
    setTimeout(() => n.remove(), 3800);
  }
}
