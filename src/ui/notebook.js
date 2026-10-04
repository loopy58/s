// 원정 수첩: 질병 도감 · 여권 · 복습 퀴즈 · 도움말
import { el, rich, shuffle, josa } from '../util.js';
import { DISEASES, DISEASE_ORDER, ROUTES, PATHOGEN_TYPES } from '../data/diseases.js';
import { REGIONS, REGION_ORDER, DISEASE_REGION } from '../data/regions.js';
import { CARDS } from '../data/cards.js';
import { entryCard } from './clinic.js';
import { sfx } from '../audio.js';
import { IS_TOUCH } from '../engine/world.js';

const routeText = (ids) => ids.map((r) => ROUTES[r].label).join('·');

export class Notebook {
  constructor(root, input, game) {
    this.root = root;
    this.input = input;
    this.game = game;
  }

  open(tab = 'dex') {
    return new Promise((resolve) => {
      const save = this.game.save;
      const back = el('div', { class: 'modal-back' });
      const tabs = el('div', { class: 'tabs' });
      const body = el('div', { class: 'sheet-body' });
      const close = (result = null) => {
        offs.forEach((f) => f());
        back.remove();
        resolve(result);
      };
      const sheet = el('div', { class: 'sheet', role: 'dialog', 'aria-label': '원정 수첩' },
        el('div', { class: 'sheet-head' }, el('h2', {}, '📖 원정 수첩'), tabs, el('button', { class: 'close-x', 'aria-label': '닫기', onclick: () => { sfx('cancel'); close(); } }, '✕')),
        body,
      );
      back.append(sheet);
      back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
      this.root.append(back);
      const offs = [this.input.on('cancel', () => { close(); return true; }), this.input.on('action', () => false), this.input.on('menu', () => { close(); return true; })];

      const TABS = [['dex', '질병 도감'], ['passport', '여권'], ['quiz', '복습 퀴즈'], ['help', '도움말']];
      const show = (name) => {
        tab = name;
        tabs.replaceChildren(...TABS.map(([id, label]) => el('button', { class: `tab ${id === tab ? 'on' : ''}`, onclick: () => { sfx('select'); show(id); } }, label)));
        body.replaceChildren();
        body.scrollTop = 0;
        if (name === 'dex') this.renderDex(body, save, close);
        if (name === 'passport') this.renderPassport(body, save);
        if (name === 'quiz') this.renderQuiz(body, save);
        if (name === 'help') this.renderHelp(body);
      };
      show(tab);
    });
  }

  renderDex(body, save, close) {
    const found = DISEASE_ORDER.filter((id) => save.discovered[id]).length;
    body.append(el('p', { style: { margin: '0 0 12px', color: 'var(--ink-soft)' } }, `지금까지 ${DISEASE_ORDER.length}종 중 ${found}종을 기록했어요. 환자를 진단하면 도감에 새 감염병이 기록돼요.`));
    const grid = el('div', { class: 'dex' });
    DISEASE_ORDER.forEach((id, i) => {
      const d = DISEASES[id];
      const r = REGIONS[DISEASE_REGION[id]];
      const known = save.discovered[id];
      const stars = save.cleared[id] || 0;
      const tile = el('button', { class: `dex-tile ${known ? '' : 'unknown'}` },
        el('span', { class: 'no' }, `No.${String(i + 1).padStart(2, '0')} ${known ? PATHOGEN_TYPES[d.pathogenType].icon : ''}`),
        el('span', { class: 'nm' }, known ? d.short : '???'),
        el('span', { class: 'sub' }, `${r.flag} ${r.name}`),
        el('span', { class: 'dex-stars' }, stars ? '★'.repeat(stars) + '☆'.repeat(3 - stars) : known ? '진료 중' : ''),
      );
      tile.onclick = () => {
        sfx('select');
        if (!known) {
          this.game.hud.toast(`${r.flag} *${r.name}*에 가면 만날 수 있어요.`);
          return;
        }
        body.replaceChildren(
          el('div', { class: 'center-row', style: { justifyContent: 'space-between', paddingTop: 0, marginBottom: '10px' } },
            el('button', { class: 'btn ghost', onclick: () => { sfx('cancel'); body.replaceChildren(); this.renderDex(body, save, close); } }, '← 도감 목록'),
            stars ? el('button', { class: 'btn', onclick: () => close({ replay: id }) }, '🩺 다시 진료하기 (복습)') : null,
          ),
          entryCard(d, { full: !!stars }),
          stars ? null : el('p', { style: { color: 'var(--ink-soft)' } }, '치료와 예방법은 진료를 끝까지 마치면 기록돼요.'),
        );
        body.scrollTop = 0;
      };
      grid.append(tile);
    });
    body.append(grid);
  }

  renderPassport(body, save) {
    body.append(el('p', { style: { margin: '0 0 12px', color: 'var(--ink-soft)' } }, '방문한 지역에는 입국 도장이, 모든 환자를 치료한 지역에는 원정 배지가 붙어요.'));
    const grid = el('div', { class: 'passport' });
    for (const id of REGION_ORDER) {
      const r = REGIONS[id];
      const v = save.visited[id];
      grid.append(el('div', { class: `stamp ${v ? 'on' : ''}` },
        el('div', {}, el('div', { class: 'flag' }, v ? r.flag : '?'), el('div', { class: 'nm' }, r.name), el('div', { class: 'dt' }, v || '미방문')),
        save.badges[id] ? el('span', { class: 'medal', title: r.badge.name }, r.badge.icon) : null,
      ));
    }
    body.append(grid);
  }

  makeQuestion(id, pool) {
    const d = DISEASES[id];
    const others = shuffle(DISEASE_ORDER.filter((x) => x !== id));
    const kinds = ['symptom', 'pathogen', 'route', 'treat', 'prevent'];
    const kind = kinds[Math.floor(Math.random() * kinds.length)];
    const pick3 = (arr) => arr.slice(0, 3);
    switch (kind) {
      case 'symptom':
        return {
          q: `"${d.symptoms.slice(0, 3).join(', ')}" 같은 증상을 보이고 ${josa(routeText(d.routes), '으로/로')} 전파되는 감염병은?`,
          opts: shuffle([d.name, ...pick3(others).map((o) => DISEASES[o].name)]),
          a: d.name,
          why: `${d.name}: ${d.keyClue}`,
        };
      case 'pathogen':
        return {
          q: `${d.name}의 원인 병원체는?`,
          opts: shuffle([d.pathogen, ...pick3(others).map((o) => DISEASES[o].pathogen)]),
          a: d.pathogen,
          why: `${d.short}의 병원체는 ${PATHOGEN_TYPES[d.pathogenType].label}인 ${d.pathogen}이에요.`,
        };
      case 'route': {
        const right = routeText(d.routes);
        const wrong = [...new Set(others.map((o) => routeText(DISEASES[o].routes)).filter((r) => r !== right))];
        return { q: `${d.name}의 주요 전파 경로는?`, opts: shuffle([right, ...pick3(wrong)]), a: right, why: d.preventionSummary };
      }
      case 'treat': {
        const ok = shuffle(d.treatments.filter((t) => t.ok))[0];
        const bad = shuffle(d.treatments.filter((t) => !t.ok)).slice(0, 3);
        return { q: `${d.name} 환자에게 알맞은 처방은?`, opts: shuffle([ok.name, ...bad.map((b) => b.name)]), a: ok.name, why: ok.why };
      }
      default: {
        const eff = Object.entries(d.prevention.effective).sort((a, b) => b[1].power - a[1].power)[0];
        const dis = Object.keys(d.prevention.distractors);
        const extra = shuffle(Object.keys(CARDS).filter((k) => !d.prevention.effective[k] && !dis.includes(k)));
        const wrong = [...dis, ...extra].slice(0, 3).map((k) => CARDS[k].name);
        return { q: `${d.name}의 전파를 막는 데 가장 효과적인 방역은?`, opts: shuffle([CARDS[eff[0]].name, ...wrong]), a: CARDS[eff[0]].name, why: eff[1].why };
      }
    }
  }

  renderQuiz(body, save) {
    const pool = DISEASE_ORDER.filter((id) => save.cleared[id]);
    if (pool.length < 2) {
      body.append(el('div', { class: 'help' }, el('h4', {}, '복습 퀴즈'), el('p', {}, '진료를 끝까지 마친 감염병이 2종 이상 모이면 복습 퀴즈를 풀 수 있어요. 지금까지 배운 정의·병원체·전파 경로·치료·예방을 섞어서 5문제가 나와요.')));
      return;
    }
    const qs = Array.from({ length: 5 }, () => this.makeQuestion(pool[Math.floor(Math.random() * pool.length)], pool));
    let i = 0;
    let score = 0;
    const box = el('div', { class: 'quiz' });
    body.append(box);
    const next = () => {
      box.replaceChildren();
      if (i >= qs.length) {
        sfx(score >= 4 ? 'fanfare' : 'confirm');
        box.append(
          el('div', { class: 'award' },
            el('div', { class: 'medal-big' }, score >= 4 ? '🏆' : '📚'),
            el('h3', {}, `5문제 중 ${score}문제 정답!`),
            el('p', {}, score === 5 ? '완벽해요! 감염병 박사가 다 됐네요.' : '틀린 문제는 도감에서 다시 확인해 보세요.'),
            el('button', { class: 'btn', onclick: () => { body.replaceChildren(); this.renderQuiz(body, save); } }, '한 번 더 풀기'),
          ),
        );
        return;
      }
      const q = qs[i];
      const fb = el('div');
      const opts = el('div', { class: 'quiz-opts' });
      let answered = false;
      q.opts.forEach((o) => {
        const b = el('button', { class: 'quiz-opt' }, o);
        b.onclick = () => {
          if (answered) return;
          answered = true;
          const right = o === q.a;
          if (right) score++;
          sfx(right ? 'correct' : 'wrong');
          [...opts.children].forEach((c) => { if (c.textContent === q.a) c.classList.add('right'); });
          if (!right) b.classList.add('wrong');
          fb.replaceChildren(
            el('div', { class: `feedback ${right ? 'good' : 'bad'}`, html: rich(`<b>${right ? '⭕ 정답!' : `❌ 정답: ${q.a}`}</b>\n${q.why}`) }),
            el('div', { class: 'center-row' }, el('button', { class: 'btn', onclick: () => { i++; next(); } }, i < qs.length - 1 ? '다음 문제 →' : '결과 보기')),
          );
        };
        opts.append(b);
      });
      box.append(el('div', { class: 'chip', style: { justifySelf: 'start' } }, `문제 ${i + 1} / ${qs.length}`), el('div', { class: 'quiz-q' }, q.q), opts, fb);
    };
    next();
  }

  renderHelp(body) {
    body.append(el('div', { class: 'help' },
      el('h4', {}, '게임 진행'),
      el('p', { html: rich('머리 위에 *빨간 느낌표(!)*가 떠 있는 사람이 환자예요. 말을 걸면 진료실에서 3단계로 진료해요.') }),
      el('ul', {},
        el('li', { html: rich('*1단계 진단* — 증상·잠복기·여행력 같은 단서로 감염병을 맞혀요. 처음 만난 감염병은 정의와 병원체가 도감에 기록돼요.') }),
        el('li', { html: rich('*2단계 처방* — 병원체에 맞는 치료제와 간호 중재를 골라요. 틀리면 왜 효과가 없는지 알려 줘요.') }),
        el('li', { html: rich('*3단계 방역* — 예산 안에서 전파 경로에 맞는 방역 카드를 써서 차단율 100%를 만들어요.') }),
      ),
      el('p', { html: rich('단계마다 실수 없이 풀면 별을 받아요(최대 ★3). 한 지역의 환자를 모두 치료하면 *원정 배지*를 받고, 배지를 모으면 새 이동수단(자동차 1개, 제트기 3개)이 열려요.') }),
      el('h4', {}, '이동'),
      el('p', {}, '가까운 국내 지역은 바이크나 자동차로, 먼 나라는 여객기나 제트기로 이동해요. 마을에 세워진 탈것에 다가가거나 오른쪽 위 지도 버튼을 누르세요. 바이크와 자동차는 마을 안에서 타고 달릴 수도 있어요.'),
      el('h4', {}, '조작법'),
      IS_TOUCH
        ? el('div', { class: 'keys' }, el('span', { class: 'kbd' }, '화면 왼쪽 드래그'), el('span', {}, '이동 (끝까지 밀면 달리기)'), el('span', { class: 'kbd' }, 'A 버튼'), el('span', {}, '말하기 · 살펴보기 · 타기'))
        : el('div', { class: 'keys' },
          el('span', {}, el('span', { class: 'kbd' }, 'W A S D'), ' ', el('span', { class: 'kbd' }, '방향키')), el('span', {}, '이동 (Shift 누르면 달리기)'),
          el('span', {}, el('span', { class: 'kbd' }, 'E'), ' ', el('span', { class: 'kbd' }, 'Space'), ' ', el('span', { class: 'kbd' }, 'Enter')), el('span', {}, '말하기 · 대화 넘기기 · 선택'),
          el('span', {}, el('span', { class: 'kbd' }, 'Esc')), el('span', {}, '닫기 · 마지막 선택지'),
          el('span', {}, el('span', { class: 'kbd' }, 'Tab'), ' ', el('span', { class: 'kbd' }, 'M')), el('span', {}, '원정 수첩 · 지도'),
          el('span', {}, el('span', { class: 'kbd' }, '마우스 휠')), el('span', {}, '카메라 확대·축소'),
        ),
      el('h4', {}, '알려 드려요'),
      el('p', {}, '게임 속 의학 정보는 질병관리청과 세계보건기구(WHO)가 공개한 일반적인 내용을 학습용으로 단순화한 것이에요. 등장인물과 사례는 학습을 위해 만든 이야기예요. 실제로 아플 때는 꼭 의료기관에서 진료를 받으세요. 감염병이 의심되면 질병관리청 콜센터(국번 없이 1339)에 문의할 수 있어요.'),
    ));
  }
}
