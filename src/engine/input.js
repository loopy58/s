// 키보드와 터치(가상 조이스틱) 입력
import { IS_TOUCH } from './world.js';

export class Input {
  constructor(uiRoot) {
    this.keys = new Set();
    this.joy = { x: 0, y: 0, active: false };
    this.handlers = { action: [], cancel: [], menu: [], map: [], up: [], down: [] };
    this.enabled = true;

    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const k = e.key.toLowerCase();
      // 버튼에 초점이 있으면 Space·Enter는 그 버튼을 누르는 데 써요.
      if (e.target instanceof HTMLButtonElement && (k === ' ' || k === 'enter')) return;
      if (!e.repeat) {
        if (k === ' ' || k === 'enter' || k === 'e' || k === 'z') this.emit('action', e);
        else if (k === 'escape' || k === 'x' || k === 'backspace') this.emit('cancel', e);
        else if (k === 'tab' || k === 'b') this.emit('menu', e);
        else if (k === 'm') this.emit('map', e);
      }
      if (k === 'arrowup' || k === 'w') this.emit('up', e);
      if (k === 'arrowdown' || k === 's') this.emit('down', e);
      if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'tab'].includes(k)) e.preventDefault();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());

    if (IS_TOUCH) this.buildTouch(uiRoot);
  }

  on(name, fn) {
    this.handlers[name].push(fn);
    return () => { this.handlers[name] = this.handlers[name].filter((f) => f !== fn); };
  }

  emit(name, e) {
    const list = this.handlers[name];
    // 가장 나중에 등록한 처리기가 먼저 받아요(열린 창이 우선).
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i](e) === true) {
        e?.preventDefault?.();
        return;
      }
    }
  }

  move() {
    let x = 0;
    let y = 0;
    const k = this.keys;
    if (k.has('arrowleft') || k.has('a')) x -= 1;
    if (k.has('arrowright') || k.has('d')) x += 1;
    if (k.has('arrowup') || k.has('w')) y += 1;
    if (k.has('arrowdown') || k.has('s')) y -= 1;
    let run = k.has('shift');
    if (this.joy.active) {
      x = this.joy.x;
      y = this.joy.y;
      run = Math.hypot(x, y) > 0.92;
    }
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, run };
  }

  buildTouch(root) {
    const zone = document.createElement('div');
    zone.className = 'joy-zone';
    const base = document.createElement('div');
    base.className = 'joy-base';
    const knob = document.createElement('div');
    knob.className = 'joy-knob';
    base.append(knob);
    zone.append(base);
    root.append(zone);
    this.touchEls = { zone };
    let id = null;
    let cx = 0;
    let cy = 0;
    const R = 52;
    zone.addEventListener('pointerdown', (e) => {
      if (!this.enabled) return;
      id = e.pointerId;
      zone.setPointerCapture(id);
      const r = zone.getBoundingClientRect();
      cx = e.clientX;
      cy = e.clientY;
      base.style.left = `${cx - r.left}px`;
      base.style.top = `${cy - r.top}px`;
      base.classList.add('on');
      this.joy.active = true;
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.joy.x = dx / R;
      this.joy.y = -dy / R;
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      base.classList.remove('on');
      this.joy = { x: 0, y: 0, active: false };
    };
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
  }

  setTouchVisible(v) {
    if (this.touchEls) this.touchEls.zone.hidden = !v;
    if (!v) this.joy = { x: 0, y: 0, active: false };
  }
}
