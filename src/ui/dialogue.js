// 동물의 숲 느낌의 말풍선 대화창 (한 글자씩 출력 + 선택지)
import { el, rich } from '../util.js';
import { blip, sfx } from '../audio.js';

export class Dialogue {
  constructor(root, input) {
    this.root = root;
    this.input = input;
    this.node = null;
    this.busy = false;
  }

  get open() {
    return !!this.node;
  }

  ensure(speaker) {
    if (!this.node) {
      this.nameEl = el('div', { class: 'dlg-name' });
      this.textEl = el('div', { class: 'dlg-text' });
      this.nextEl = el('div', { class: 'dlg-next', hidden: true });
      this.box = el('div', { class: 'dlg-box', role: 'dialog', 'aria-live': 'polite' }, this.nameEl, this.textEl, this.nextEl);
      this.choiceEl = el('div', { class: 'dlg-choices', hidden: true });
      this.node = el('div', { class: 'dialogue' }, this.choiceEl, this.box);
      this.root.append(this.node);
    }
    this.nameEl.hidden = !speaker?.name;
    this.nameEl.style.background = speaker?.color || '#f09a3e';
    this.nameEl.innerHTML = '';
    if (speaker?.name) {
      this.nameEl.append(speaker.name);
      if (speaker.role) this.nameEl.append(el('small', {}, speaker.role));
    }
  }

  // 글자 하나하나를 span으로 감싸 두고 차례로 보이게 해요(줄바꿈 위치가 흔들리지 않음).
  typeText(text, pitch = 1) {
    const html = rich(text);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const chars = [];
    const wrap = (node) => {
      for (const child of [...node.childNodes]) {
        if (child.nodeType === 3) {
          const frag = document.createDocumentFragment();
          for (const ch of child.textContent) {
            const s = document.createElement('span');
            s.textContent = ch;
            s.style.visibility = 'hidden';
            frag.append(s);
            chars.push(s);
          }
          child.replaceWith(frag);
        } else if (child.nodeType === 1) wrap(child);
      }
    };
    wrap(tmp);
    this.textEl.innerHTML = '';
    this.textEl.append(...tmp.childNodes);
    this.nextEl.hidden = true;
    return new Promise((resolve) => {
      let i = 0;
      const finish = () => {
        clearInterval(this.timer);
        this.timer = null;
        chars.forEach((c) => (c.style.visibility = 'visible'));
        this.skipTyping = null;
        resolve();
      };
      this.skipTyping = finish;
      this.timer = setInterval(() => {
        for (let k = 0; k < 2 && i < chars.length; k++, i++) {
          chars[i].style.visibility = 'visible';
          if (i % 3 === 0 && chars[i].textContent.trim()) blip(pitch);
        }
        if (i >= chars.length) finish();
      }, 28);
    });
  }

  waitAdvance() {
    return new Promise((resolve) => {
      const done = () => {
        off();
        this.box.removeEventListener('click', onClick);
        sfx('select');
        resolve();
      };
      const onClick = () => done();
      const off = this.input.on('action', () => { done(); return true; });
      this.box.addEventListener('click', onClick);
    });
  }

  async say(speaker, text) {
    this.ensure(speaker);
    this.choiceEl.hidden = true;
    const typing = this.typeText(text, speaker?.pitch || 1);
    const skipOff = this.input.on('action', () => { if (this.skipTyping) { this.skipTyping(); return true; } return false; });
    const onClick = () => this.skipTyping && this.skipTyping();
    this.box.addEventListener('click', onClick);
    await typing;
    skipOff();
    this.box.removeEventListener('click', onClick);
    this.nextEl.hidden = false;
    await this.waitAdvance();
  }

  async ask(speaker, text, choices) {
    this.ensure(speaker);
    this.choiceEl.hidden = true;
    const typing = this.typeText(text, speaker?.pitch || 1);
    const skipOff = this.input.on('action', () => { if (this.skipTyping) { this.skipTyping(); return true; } return false; });
    const onClick = () => this.skipTyping && this.skipTyping();
    this.box.addEventListener('click', onClick);
    await typing;
    skipOff();
    this.box.removeEventListener('click', onClick);
    return new Promise((resolve) => {
      let sel = 0;
      this.choiceEl.innerHTML = '';
      const btns = choices.map((c, i) => el('button', { class: 'dlg-choice', onclick: () => pick(i), onpointerenter: () => setSel(i) }, c));
      this.choiceEl.append(...btns);
      this.choiceEl.hidden = false;
      const setSel = (i) => {
        sel = (i + choices.length) % choices.length;
        btns.forEach((b, j) => b.classList.toggle('sel', j === sel));
      };
      setSel(0);
      const offs = [
        this.input.on('up', () => { setSel(sel - 1); sfx('select'); return true; }),
        this.input.on('down', () => { setSel(sel + 1); sfx('select'); return true; }),
        this.input.on('action', () => { pick(sel); return true; }),
        this.input.on('cancel', () => { pick(choices.length - 1); return true; }),
      ];
      const pick = (i) => {
        offs.forEach((f) => f());
        this.choiceEl.hidden = true;
        sfx(i === choices.length - 1 && choices.length > 1 ? 'cancel' : 'confirm');
        resolve(i);
      };
    });
  }

  async run(speaker, lines) {
    for (const line of lines) await this.say(speaker, line);
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    this.node?.remove();
    this.node = null;
  }
}
