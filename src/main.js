import './style.css';
import * as THREE from 'three';
import { World, IS_TOUCH } from './engine/world.js';
import { Zone } from './engine/zone.js';
import { Player } from './engine/player.js';
import { Input } from './engine/input.js';
import { Cutscene } from './engine/cutscene.js';
import { HUD } from './ui/hud.js';
import { Dialogue } from './ui/dialogue.js';
import { Clinic, entryCard } from './ui/clinic.js';
import { Notebook } from './ui/notebook.js';
import { TravelMap, tripInfo, hoursText } from './ui/travel.js';
import { REGIONS, REGION_ORDER, VEHICLES, DISEASE_REGION } from './data/regions.js';
import { DISEASES, DISEASE_ORDER } from './data/diseases.js';
import { loadSave, writeSave, freshSave, clearSave } from './save.js';
import { initAudio, sfx, playMusic, setSound } from './audio.js';
import { el, rich, sleep, todayString, clamp } from './util.js';

const SPEAKER_COLORS = { mentor: '#9c6b45', guide: '#f09a3e', patient: '#e86a6a', villager: '#4f9fd6', sign: '#7a9a52' };
const PITCH = { mentor: 0.8, guide: 1.15, patient: 0.95, villager: 1.05, sign: 1 };

class Game {
  constructor(hotData = {}) {
    this.canvas = document.getElementById('scene');
    this.ui = document.getElementById('ui');
    this.world = new World(this.canvas);
    this.input = new Input(this.ui);
    this.hud = new HUD(this.ui, {
      notebook: () => this.openNotebook(),
      map: () => this.openTravel(),
      sound: () => this.toggleSound(),
      action: () => this.input.emit('action'),
    });
    this.hud.setVisible(false);
    this.dialogue = new Dialogue(this.ui, this.input);
    this.clinic = new Clinic(this.ui, this.input, { discover: (d) => this.discover(d) });
    this.notebook = new Notebook(this.ui, this.input, this);
    this.travel = new TravelMap(this.ui, this.input);
    this.cutscene = new Cutscene(this.world);
    this.fader = el('div', { class: 'fader' });
    this.ui.append(this.fader);
    this.player = new Player();
    this.world.scene.add(this.player.group);
    this.mode = 'title';
    this.timer = new THREE.Timer();
    this.areaSeen = new Set();
    this.save = hotData.save || loadSave();

    this.input.on('action', () => {
      if (this.mode !== 'world') return false;
      this.onAction();
      return true;
    });
    this.input.on('menu', () => { if (this.mode === 'world') { this.openNotebook(); return true; } return false; });
    this.input.on('map', () => { if (this.mode === 'world') { this.openTravel(); return true; } return false; });
    window.addEventListener('wheel', (e) => {
      if (this.mode !== 'world' || e.target !== this.canvas) return;
      this.world.zoom = clamp(this.world.zoom + e.deltaY * 0.0008, 0.62, 1.45);
    }, { passive: true });
    window.addEventListener('resize', () => this.cutscene.resize());
    window.claude?.hot?.snapshot?.(() => ({ save: this.save }));

    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
    document.fonts?.ready?.then(() => this.boot(hotData));
    if (!document.fonts) this.boot(hotData);
  }

  // ───────── 시작 ─────────
  async boot(hotData) {
    if (this.booted) return;
    this.booted = true;
    if (hotData.save) {
      this.loadZone(this.save.region);
      this.enterWorld();
      return;
    }
    this.loadZone(this.save?.region || 'school');
    this.showTitle();
  }

  showTitle() {
    this.mode = 'title';
    this.hud.setVisible(false);
    this.input.setTouchVisible(false);
    const letters = '감염병 원정대'.split('');
    const colors = ['#ff7b6b', '#ffb238', '#3fae8c', '', '#4f9fd6', '#a77bd6', '#f2645a'];
    const logo = el('h1', { class: 'logo', 'aria-label': '감염병 원정대' }, ...letters.map((ch, i) => (ch === ' ' ? el('span', { style: { width: '.25em' } }) : el('span', { style: { '--c': colors[i], '--i': i, '--rot': `${(i % 2 ? 1 : -1) * 4}deg` } }, ch))));
    const actions = el('div', { class: 'title-actions' });
    const node = el('div', { class: 'title' },
      logo,
      el('div', { class: 'sub' }, 'OUTBREAK QUEST'),
      el('p', { class: 'tagline' }, '세계 곳곳을 여행하며 환자를 진단하고, 알맞게 처방하고, 마을의 방역까지 책임지는 감염병 원정을 떠나요!'),
      actions,
      el('div', { class: 'disclaimer' }, '학습용 게임이에요. 의학 정보는 공개된 보건 자료를 쉽게 정리한 것이며, 실제 진료를 대신하지 않아요.'),
    );
    const startNew = async () => {
      initAudio();
      sfx('confirm');
      if (this.save) {
        const ok = await this.confirmBox('새로 시작할까요?', '지금까지의 원정 기록이 모두 지워져요.', '새로 시작', '취소');
        if (!ok) return;
        clearSave();
      }
      node.remove();
      this.askName();
    };
    const cont = () => {
      initAudio();
      sfx('confirm');
      node.remove();
      offs.forEach((f) => f());
      setSound(this.save.sound !== false);
      this.hud.setSound(this.save.sound !== false);
      this.enterWorld();
    };
    if (this.save) {
      actions.append(el('button', { class: 'btn sun', onclick: cont }, `▶ 이어하기 (${this.save.name})`), el('button', { class: 'btn ghost', onclick: () => { offs.forEach((f) => f()); startNew(); } }, '새로 시작'));
    } else {
      actions.append(el('button', { class: 'btn sun', onclick: () => { offs.forEach((f) => f()); startNew(); } }, '▶ 원정 시작하기'));
      actions.append(el('div', { class: 'press', style: { width: '100%' } }, IS_TOUCH ? '버튼을 눌러 주세요' : 'Enter 키를 눌러도 시작해요'));
    }
    const offs = [this.input.on('action', () => {
      offs.forEach((f) => f());
      if (this.save) cont();
      else startNew();
      return true;
    })];
    this.ui.append(node);
    playMusic('title');
  }

  askName() {
    const input = el('input', { id: 'player-name', maxlength: 8, placeholder: '이름 (최대 8자)', autocomplete: 'off', value: '' });
    const back = el('div', { class: 'modal-back' });
    const submit = () => {
      const name = input.value.trim() || '원정대원';
      back.remove();
      off();
      this.save = freshSave(name);
      this.persist();
      sfx('confirm');
      this.newGame();
    };
    const off = this.input.on('action', () => true);
    const form = el('form', { class: 'name-form', onsubmit: (e) => { e.preventDefault(); submit(); } },
      el('div', { style: { fontSize: '44px' } }, '🦉'),
      el('h3', { style: { margin: 0, fontFamily: 'var(--font-display)', fontWeight: 'normal', fontSize: '24px' } }, '원정대원의 이름을 알려 주세요'),
      input,
      el('button', { class: 'btn', type: 'submit' }, '확인'),
    );
    back.append(el('div', { class: 'sheet', style: { width: 'min(440px,100%)' } }, el('div', { class: 'sheet-body', style: { padding: '26px 20px' } }, form)));
    this.ui.append(back);
    setTimeout(() => input.focus(), 50);
  }

  async newGame() {
    await this.fade(true);
    this.loadZone('seoul');
    this.save.visited.seoul = todayString();
    this.persist();
    await this.fade(false);
    this.enterWorld({ skipIntro: true });
    this.mode = 'busy';
    await sleep(2400);
    await this.mentorIntro();
    this.mode = 'world';
  }

  enterWorld({ skipIntro = false } = {}) {
    this.mode = 'world';
    this.hud.setVisible(true);
    this.input.setTouchVisible(true);
    this.refreshHUD();
    playMusic(this.zone.region.id);
    this.hud.regionTitle(this.zone.region);
    if (!skipIntro) this.maybeGuideIntro();
  }

  // ───────── 지역 ─────────
  loadZone(id) {
    if (this.zone) {
      this.world.scene.remove(this.zone.group);
      this.zone.dispose();
    }
    if (this.player.riding) {
      this.player.group.remove(this.player.riding.model);
      this.player.ch.root.position.set(0, 0, 0);
      this.player.ch.sitting = false;
      this.player.riding = null;
    }
    const region = REGIONS[id];
    this.zone = new Zone(region, this.stateView());
    this.world.scene.add(this.zone.group);
    this.world.setTheme(region.theme);
    this.player.group.position.copy(this.zone.spawn);
    this.player.group.rotation.y = Math.PI;
    this.player.facing = Math.PI;
    this.player.vel.set(0, 0, 0);
    this.world.follow(this.player.position, 0, true);
    this.areaSeen.clear();
    if (this.save) {
      this.save.region = id;
      this.persist();
    }
    this.refreshHUD();
  }

  stateView() {
    const s = this.save || freshSave();
    return { cleared: s.cleared, introSeen: s.introSeen, get mentorIntro() { return s.mentorIntro; } };
  }

  // ───────── 루프 ─────────
  loop(now) {
    requestAnimationFrame(this.loop);
    this.timer.update(now);
    const dt = Math.min(this.timer.getDelta(), 0.05);
    const t = this.timer.getElapsed();
    if (this.cutscene.active) {
      this.cutscene.update(dt);
      this.cutscene.render();
      return;
    }
    if (!this.zone) return;
    if (this.mode === 'world') this.player.update(dt, t, this.input, this.zone);
    else this.player.update(dt, t, { move: () => ({ x: 0, y: 0, run: false }) }, this.zone);
    this.zone.update(dt, t, this.player.position);
    if (this.mode === 'title') {
      const a = t * 0.05;
      this.world.camera.position.set(Math.sin(a) * 34, 17, Math.cos(a) * 34);
      this.world.camera.lookAt(0, 2, 0);
      this.world.sun.position.set(-22, 40, 18);
      this.world.sun.target.position.set(0, 0, 0);
      this.world.sky.position.copy(this.world.camera.position);
    } else {
      this.world.follow(this.player.position, dt);
    }
    if (this.mode === 'world') {
      this.target = this.findTarget();
      const label = this.target ? this.targetLabel(this.target) : null;
      const pos = this.target ? this.target.pos.clone().setY(this.target.kind === 'npc' ? this.target.npc.headY + 0.9 : this.target.kind === 'vehicle' && this.target.vehicle.type === 'plane' ? 4.5 : 2.6) : null;
      this.hud.showPrompt(pos, this.world.camera, label);
      this.checkAreas();
    } else this.hud.showPrompt(null);
    this.hud.drawMinimap(this.zone, this.player);
    this.world.render();
  }

  findTarget() {
    const p = this.player.position;
    let best = null;
    let bestD = Infinity;
    for (const it of this.zone.interactables) {
      if (it.active === false) continue;
      const d = Math.hypot(it.pos.x - p.x, it.pos.z - p.z);
      if (d < it.r && d < bestD) { best = it; bestD = d; }
    }
    return best;
  }

  targetLabel(t) {
    if (t.kind === 'npc') return t.npc.kind === 'patient' && !this.save.cleared[t.npc.def.disease] ? '진찰하기' : '말하기';
    return t.label;
  }

  checkAreas() {
    const p = this.player.position;
    for (const a of this.zone.areas) {
      const key = `${this.zone.region.id}:${a.x},${a.z}`;
      if (this.areaSeen.has(key)) continue;
      if (Math.hypot(p.x - a.x, p.z - a.z) < a.r) {
        this.areaSeen.add(key);
        this.hud.toast(a.msg, '', 5200);
      }
    }
  }

  // ───────── 상호작용 ─────────
  async onAction() {
    const target = this.findTarget();
    if (this.player.riding) {
      if (target && target.kind !== 'vehicle') {
        this.player.dismount(this.zone);
      } else {
        await this.busy(async () => {
          const c = await this.dialogue.ask({ name: this.save.name, role: '원정대원', color: '#3fae8c' }, `${this.player.riding.type === 'car' ? '자동차' : '바이크'}를 어떻게 할까요?`, ['여기서 내리기', '다른 지역으로 이동', '계속 타기']);
          this.dialogue.close();
          if (c === 0) this.player.dismount(this.zone);
          if (c === 1) await this.travelFlow();
        });
        return;
      }
    }
    if (!target) return;
    await this.busy(() => this.interact(target));
  }

  async busy(fn) {
    this.mode = 'busy';
    this.input.setTouchVisible(false);
    try {
      await fn();
    } finally {
      this.dialogue.close();
      for (const n of this.zone.npcs) { n.frozen = false; n.ch.talking = false; }
      if (this.mode === 'busy') this.mode = 'world';
      this.input.setTouchVisible(true);
      this.persist();
      this.refreshHUD();
    }
  }

  speaker(kind, name, role) {
    return { name, role, color: SPEAKER_COLORS[kind], pitch: PITCH[kind] };
  }

  async talk(npc, fn) {
    npc.frozen = true;
    npc.ch.talking = true;
    try { await fn(); } finally { npc.ch.talking = false; }
  }

  async interact(t) {
    if (t.kind === 'sign') {
      sfx('select');
      await this.dialogue.run(this.speaker('sign', t.def.title), t.def.lines);
      return;
    }
    if (t.kind === 'clinic') {
      const r = this.zone.region;
      const waiting = r.patients.filter((p) => !this.save.cleared[p.disease]).length;
      const sp = this.speaker('sign', t.def.name || '진료소');
      await this.dialogue.say(sp, '원정대가 쓰는 진료소예요. 환자에게 말을 걸면 이곳 진료실에서 진료가 시작돼요.');
      const c = await this.dialogue.ask(sp, waiting ? `이 지역에는 아직 진료를 기다리는 환자가 *${waiting}명* 있어요.` : '이 지역 환자는 모두 나았어요! 도감에서 배운 내용을 복습해 볼까요?', ['원정 수첩 보기', '나가기']);
      this.dialogue.close();
      if (c === 0) await this.openNotebook(true);
      return;
    }
    if (t.kind === 'vehicle') {
      const v = t.vehicle;
      const sp = { name: this.save.name, role: '원정대원', color: '#3fae8c' };
      if (v.type === 'plane') {
        const c = await this.dialogue.ask(sp, '비행기를 타고 다른 나라나 대한민국으로 떠날 수 있어요.', ['🗺️ 지도 열기', '그만두기']);
        this.dialogue.close();
        if (c === 0) await this.travelFlow();
        return;
      }
      const name = v.type === 'car' ? '자동차' : '바이크';
      if (v.type === 'car' && Object.keys(this.save.badges).length < VEHICLES.car.need) {
        await this.dialogue.say(sp, `자동차는 원정 배지를 *${VEHICLES.car.need}개* 모으면 탈 수 있어요. 지금은 바이크를 타 볼까요?`);
        return;
      }
      const c = await this.dialogue.ask(sp, `${name}에 탈까요?`, ['타고 달리기', '다른 지역으로 이동', '그만두기']);
      this.dialogue.close();
      if (c === 0) {
        sfx('engine');
        v.parked = false;
        this.player.mount(v);
        this.hud.toast(`${name}를 탔어요! ${IS_TOUCH ? 'A 버튼' : 'E 키'}로 내릴 수 있어요.`);
      } else if (c === 1) await this.travelFlow(v.type);
      return;
    }
    if (t.kind === 'npc') {
      const npc = t.npc;
      await this.talk(npc, async () => {
        if (npc.kind === 'mentor') await this.talkMentor();
        else if (npc.kind === 'guide') await this.talkGuide(npc);
        else if (npc.kind === 'patient') await this.talkPatient(npc);
        else await this.dialogue.run(this.speaker('villager', npc.def.name), npc.def.lines);
      });
    }
  }

  async mentorIntro() {
    const sp = this.speaker('mentor', '부엉 박사', '원정대 대장');
    const n = this.save.name;
    const lines = [
      `호오~ 반가워요, *${n}* 대원! 나는 세계 감염병 원정대의 대장, *부엉 박사*예요.`,
      '지금 세계 곳곳에서 낯선 감염병 때문에 사람들이 고통받고 있어요. 대원의 도움이 필요해요!',
      '환자를 만나면 진료실에서 *진단 → 처방 → 방역*, 세 단계로 도와주면 돼요.',
      '머리 위에 *빨간 느낌표(!)*가 떠 있는 사람이 환자예요. *노란 느낌표*는 그 지역을 안내해 줄 사람이고요.',
      '가까운 국내 지역은 *바이크*나 *자동차*로, 먼 나라는 *비행기*로 갈 수 있어요. 마을의 탈것에 다가가거나 오른쪽 위 *지도*를 눌러 봐요.',
      '처음 만난 감염병은 *원정 수첩*의 도감에 기록돼요. 14종을 모두 기록하면... 호호, 특별한 선물이 있답니다!',
    ];
    const owl = this.zone.npcs.find((x) => x.kind === 'mentor');
    if (owl) { owl.frozen = true; owl.ch.talking = true; }
    await this.dialogue.run(sp, lines);
    const c = await this.dialogue.ask(sp, '준비됐나요?', ['출발해요!', '조작법을 알려 주세요']);
    if (c === 1) {
      await this.dialogue.run(sp, IS_TOUCH
        ? ['화면 왼쪽을 누른 채로 끌면 걸을 수 있어요. 끝까지 밀면 달려요!', '사람이나 표지판 가까이에서 *A 버튼*을 누르면 말을 걸거나 살펴볼 수 있어요.']
        : ['*WASD*나 *방향키*로 걷고, *Shift*를 누르면 달려요.', '사람이나 표지판 가까이에서 *E*나 *Space*를 누르면 말을 걸 수 있어요. *Tab*은 수첩, *M*은 지도예요.']);
    }
    await this.dialogue.say(sp, '그럼 먼저 이 동네의 환자부터 도와줘요. 행운을 빌어요, 호호!');
    this.dialogue.close();
    if (owl) { owl.frozen = false; owl.ch.talking = false; }
    this.save.mentorIntro = true;
    this.zone.refreshMarkers();
    this.persist();
  }

  async talkMentor() {
    if (!this.save.mentorIntro) { await this.mentorIntro(); return; }
    const sp = this.speaker('mentor', '부엉 박사', '원정대 대장');
    const found = DISEASE_ORDER.filter((d) => this.save.discovered[d]).length;
    const badges = Object.keys(this.save.badges).length;
    const tips = [
      `지금까지 감염병 *${found}종*을 도감에 기록했어요. ${found < 14 ? `남은 건 ${14 - found}종!` : '모두 모았군요!'}`,
      '바이러스에는 항생제가 듣지 않아요. *원인 병원체*를 먼저 떠올리는 게 진료의 첫걸음이에요.',
      '방역 카드는 *전파 경로*에 맞춰 골라야 해요. 공기로 퍼지는 병과 물로 퍼지는 병은 막는 방법이 전혀 달라요.',
      badges >= VEHICLES.jet.need ? '배지를 많이 모았군요! 이제 *제트기*로 더 빨리 날아갈 수 있어요.' : badges >= VEHICLES.car.need ? `배지를 모아서 이제 *자동차*도 탈 수 있어요. 배지 ${VEHICLES.jet.need}개면 제트기도 열려요!` : `원정 배지를 *${VEHICLES.car.need}개* 모으면 자동차를 탈 수 있어요.`,
    ];
    await this.dialogue.run(sp, [tips[0], tips[1 + Math.floor(Math.random() * 3)]]);
  }

  async talkGuide(npc) {
    const r = this.zone.region;
    const g = r.guide;
    const sp = this.speaker('guide', g.name, g.role);
    if (!this.save.introSeen[r.id]) {
      await this.dialogue.run(sp, g.intro);
      this.save.introSeen[r.id] = true;
      this.zone.refreshMarkers();
      return;
    }
    if (this.save.badges[r.id]) {
      await this.dialogue.run(sp, [g.done[0], g.idle[Math.floor(Math.random() * g.idle.length)]]);
      return;
    }
    await this.dialogue.say(sp, g.idle[Math.floor(Math.random() * g.idle.length)]);
  }

  async maybeGuideIntro() {
    const r = this.zone.region;
    if (this.save.introSeen[r.id] || (r.id === 'seoul' && !this.save.mentorIntro)) return;
    await sleep(2600);
    // 그사이 다른 일을 시작했거나 지역을 옮겼다면 건너뛰어요.
    if (this.mode !== 'world' || this.zone.region !== r || this.save.introSeen[r.id]) return;
    const npc = this.zone.npcs.find((n) => n.kind === 'guide');
    await this.busy(() => this.talk(npc, () => this.talkGuide(npc)));
  }

  async talkPatient(npc) {
    const p = npc.def;
    const d = DISEASES[p.disease];
    const sp = this.speaker('patient', p.name, this.save.cleared[p.disease] ? '회복 중' : '환자');
    if (this.save.cleared[p.disease]) {
      const c = await this.dialogue.ask(sp, d.healed, ['다행이에요!', '다시 진료하기 (복습)']);
      this.dialogue.close();
      if (c === 1) await this.runCase(p.disease);
      return;
    }
    for (const line of p.pre) await this.dialogue.say(sp, line);
    const c = await this.dialogue.ask(sp, '진료를 받을 수 있을까요?', ['진료실로 가요!', '조금 이따가요']);
    this.dialogue.close();
    if (c !== 0) return;
    const res = await this.runCase(p.disease);
    if (res && res.firstClear) {
      await this.dialogue.say(this.speaker('patient', p.name, '회복 중'), d.healed);
      this.dialogue.close();
      await this.checkRegionComplete();
    }
  }

  patientDef(diseaseId) {
    return REGIONS[DISEASE_REGION[diseaseId]].patients.find((p) => p.disease === diseaseId);
  }

  async runCase(diseaseId) {
    const def = this.patientDef(diseaseId);
    const first = !this.save.discovered[diseaseId];
    const best = this.save.cleared[diseaseId] || 0;
    this.hud.setVisible(false);
    this.mode = 'busy';
    playMusic('title');
    let res;
    try {
      res = await this.clinic.run(diseaseId, def, { firstTime: first, best });
    } finally {
      this.hud.setVisible(true);
      playMusic(this.zone.region.id);
    }
    if (res.aborted) return null;
    this.save.discovered[diseaseId] = true;
    this.save.cleared[diseaseId] = Math.max(best, res.stars);
    this.persist();
    this.refreshHUD();
    const firstClear = !best;
    if (firstClear && DISEASE_REGION[diseaseId] === this.zone.region.id) {
      this.zone.healPatient(diseaseId);
      sfx('heal');
    }
    if (!firstClear && res.stars > best) this.hud.toast(`최고 기록 갱신! ${'★'.repeat(res.stars)}`, 'good');
    return { ...res, firstClear };
  }

  discover(d) {
    return new Promise((resolve) => {
      sfx('discover');
      this.save.discovered[d.id] = true;
      this.persist();
      const back = el('div', { class: 'modal-back' });
      const btn = el('button', { class: 'btn sun', onclick: () => { sfx('confirm'); off(); back.remove(); resolve(); } }, '📖 도감에 기록하고 계속하기');
      const off = this.input.on('action', () => true);
      back.append(el('div', { class: 'sheet discover', role: 'dialog', 'aria-label': '새로운 감염병 발견' },
        el('div', { class: 'ribbon' }, '✨ 새로운 감염병을 도감에 기록했어요!'),
        el('div', { class: 'sheet-body', style: { paddingTop: '16px' } }, entryCard(d), el('div', { class: 'center-row', style: { marginTop: '14px' } }, btn)),
      ));
      this.ui.append(back);
      btn.focus();
    });
  }

  async checkRegionComplete() {
    const r = this.zone.region;
    if (this.save.badges[r.id] || !r.diseases.every((d) => this.save.cleared[d])) return;
    const before = Object.keys(this.save.badges).length;
    this.save.badges[r.id] = todayString();
    this.persist();
    this.refreshHUD();
    await this.award(r);
    const g = r.guide;
    await this.dialogue.run(this.speaker('guide', g.name, g.role), g.done);
    this.dialogue.close();
    const after = before + 1;
    for (const [id, v] of Object.entries(VEHICLES)) {
      if (v.need === after && v.need > 0) this.hud.toast(`🎉 새 이동수단 해금: ${v.icon} *${v.name}*을(를) 탈 수 있어요!`, 'good', 5200);
    }
    if (DISEASE_ORDER.every((d) => this.save.cleared[d]) && !this.save.finished) {
      this.save.finished = true;
      this.persist();
      await this.ending();
    } else {
      const left = REGION_ORDER.filter((id) => !this.save.badges[id]).length;
      this.hud.toast(`남은 원정지 ${left}곳! 오른쪽 위 *지도*를 열어 다음 지역으로 떠나 보세요.`, '', 5200);
    }
  }

  award(r) {
    return new Promise((resolve) => {
      sfx('fanfare');
      const back = el('div', { class: 'modal-back' });
      const off = this.input.on('action', () => { done(); return true; });
      const done = () => { off(); back.remove(); resolve(); };
      back.append(el('div', { class: 'sheet', style: { width: 'min(460px,100%)' } }, el('div', { class: 'award' },
        el('div', { class: 'medal-big', 'aria-hidden': 'true' }, r.badge.icon),
        el('h3', {}, `${r.badge.name} 획득!`),
        el('p', {}, `${r.name}의 환자를 모두 치료하고 마을을 지켜 냈어요.`),
        el('button', { class: 'btn sun', onclick: done }, '받기'),
      )));
      this.ui.append(back);
    });
  }

  ending() {
    return new Promise((resolve) => {
      sfx('fanfare');
      const stars = Object.values(this.save.cleared).reduce((a, b) => a + b, 0);
      const back = el('div', { class: 'modal-back' });
      const close = () => { back.remove(); resolve(); };
      back.append(el('div', { class: 'sheet', style: { width: 'min(620px,100%)' } }, el('div', { class: 'sheet-body' },
        el('div', { class: 'cert' },
          el('div', { style: { fontSize: '56px' } }, '🦉🏅'),
          el('h3', {}, '세계 보건 마스터 인증서'),
          el('div', { class: 'nm' }, this.save.name),
          el('p', { style: { lineHeight: '1.7', margin: 0 } }, `위 대원은 ${REGION_ORDER.length}개 지역을 여행하며 ${DISEASE_ORDER.length}종의 감염병을 진단·치료하고 지역사회 방역을 성공적으로 이끌었기에 이 인증서를 드립니다.`),
          el('p', { style: { margin: 0, fontFamily: 'var(--font-display)', fontSize: '20px' } }, `모은 별 ★ ${stars} / ${DISEASE_ORDER.length * 3}`),
          el('p', { style: { margin: 0, color: 'var(--ink-soft)' } }, `${todayString()} · 세계 감염병 원정대장 부엉 박사`),
        ),
        el('p', { style: { textAlign: 'center', lineHeight: '1.6' } }, '축하해요! 수첩의 복습 퀴즈와 다시 진료하기로 별 3개에 도전해 보세요.'),
        el('div', { class: 'center-row' }, el('button', { class: 'btn', onclick: close }, '계속 탐험하기')),
      )));
      this.ui.append(back);
    });
  }

  // ───────── 메뉴 ─────────
  async openNotebook(inside = false) {
    if (!inside && this.mode !== 'world') return;
    const run = async () => {
      const res = await this.notebook.open();
      if (res && res.replay) await this.runCase(res.replay);
    };
    if (inside) await run();
    else await this.busy(run);
  }

  async openTravel() {
    if (this.mode !== 'world') return;
    await this.busy(() => this.travelFlow());
  }

  async travelFlow() {
    const res = await this.travel.open(this.zone.region.id, this.save);
    if (!res) return;
    await this.travelTo(res.dest, res.vehicle);
  }

  async travelTo(dest, vehicle) {
    const info = tripInfo(this.zone.region.id, dest);
    const V = VEHICLES[vehicle];
    this.mode = 'cutscene';
    this.hud.setVisible(false);
    this.input.setTouchVisible(false);
    await this.fade(true);
    const hours = info.km / V.speed + (info.air ? 0.5 : 0);
    const track = el('i');
    const icon = el('b', {}, V.icon);
    const remain = el('span');
    const fromName = info.air ? info.fromCode : info.from.city;
    const toName = info.air ? info.toCode : info.to.city;
    const hudNode = el('div', { class: 'trip' },
      el('div', { class: 'trip-route' },
        el('span', {}, info.air ? info.from.domestic ? '인천' : info.from.city : info.from.name, el('span', { class: 'code' }, fromName)),
        el('div', { class: 'trip-track' }, track, icon),
        el('span', { style: { textAlign: 'right' } }, info.to.domestic && info.air ? `인천 → ${info.to.city}` : info.to.city, el('span', { class: 'code' }, toName)),
      ),
      el('div', { class: 'trip-info' }, el('span', {}, `${V.icon} ${V.name} · ${hoursText(hours)}`), remain),
      el('div', { class: 'trip-tip', html: rich(`<b>여행 건강 팁</b> · ${info.to.tip}`) }),
    );
    const skip = el('button', { class: 'btn ghost skip', onclick: () => this.cutscene.finish && this.cutscene.finish() }, '건너뛰기 ⏭');
    const offSkip = this.input.on('action', () => { this.cutscene.finish && this.cutscene.finish(); return true; });
    const onProgress = (p) => {
      track.style.width = `${p * 100}%`;
      icon.style.left = `${p * 100}%`;
      remain.textContent = `남은 거리 ${Math.round(info.km * (1 - p)).toLocaleString()}km`;
    };
    const playing = this.cutscene.play({
      kind: info.air ? 'air' : 'road',
      vehicle,
      theme: REGIONS[dest].theme,
      duration: info.air ? (vehicle === 'jet' ? 4.2 : 5.6) : vehicle === 'car' ? 3.6 : 4.4,
      onProgress,
    });
    this.ui.append(hudNode, skip);
    sfx(info.air ? 'plane' : 'engine');
    playMusic(dest);
    await this.fade(false);
    await playing;
    offSkip();
    await this.fade(true);
    this.cutscene.stop();
    hudNode.remove();
    skip.remove();
    this.loadZone(dest);
    const firstVisit = !this.save.visited[dest];
    if (firstVisit) this.save.visited[dest] = todayString();
    this.persist();
    await this.fade(false);
    this.enterWorld({ skipIntro: true });
    if (firstVisit) {
      setTimeout(() => {
        sfx('stamp');
        this.hud.toast(`🛂 ${REGIONS[dest].flag} *${REGIONS[dest].name}* 방문 도장을 여권에 찍었어요!`, 'good');
      }, 900);
    }
    this.maybeGuideIntro();
  }

  fade(on) {
    this.fader.classList.toggle('on', on);
    return sleep(480);
  }

  confirmBox(title, text, yes, no) {
    return new Promise((resolve) => {
      const back = el('div', { class: 'modal-back' });
      const done = (v) => { back.remove(); resolve(v); };
      back.append(el('div', { class: 'sheet', style: { width: 'min(420px,100%)' } }, el('div', { class: 'sheet-body award' },
        el('h3', {}, title), el('p', {}, text),
        el('div', { class: 'center-row' }, el('button', { class: 'btn berry', onclick: () => done(true) }, yes), el('button', { class: 'btn ghost', onclick: () => done(false) }, no)),
      )));
      this.ui.append(back);
    });
  }

  toggleSound() {
    initAudio();
    const on = !(this.save?.sound !== false);
    if (this.save) this.save.sound = on;
    setSound(on);
    this.hud.setSound(on);
    if (on) playMusic(this.zone.region.id);
    this.persist();
  }

  refreshHUD() {
    if (!this.save || !this.zone) return;
    const s = this.save;
    this.hud.setPlayer(s, {
      badges: Object.keys(s.badges).length,
      regions: REGION_ORDER.length,
      discovered: DISEASE_ORDER.filter((d) => s.discovered[d]).length,
      diseases: DISEASE_ORDER.length,
      stars: Object.values(s.cleared).reduce((a, b) => a + b, 0),
    });
    const r = this.zone.region;
    const done = r.diseases.filter((d) => s.cleared[d]).length;
    this.hud.setQuest(done < r.diseases.length
      ? `🩺 *${r.name}* 환자 ${done}/${r.diseases.length} 치료\n빨간 느낌표(!)가 뜬 주민에게 말을 걸어 보세요.`
      : `✔ *${r.name}* 환자를 모두 치료했어요!\n지도를 열어 다음 원정지로 떠나요.`);
  }

  persist() {
    if (this.save) writeSave(this.save);
  }
}

const start = (data) => {
  window.__game = new Game(data || {});
};
window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
