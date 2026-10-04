// 진료실: 1단계 진단 → 2단계 처방 → 3단계 방역
import { el, rich, shuffle, josa, sleep } from '../util.js';
import { DISEASES, PATHOGEN_TYPES, ROUTES } from '../data/diseases.js';
import { CARDS, budgetFor } from '../data/cards.js';
import { avatarSVG } from './avatar.js';
import { sfx } from '../audio.js';

const routeText = (ids) => ids.map((r) => ROUTES[r].label).join('·');

// 도감 항목 카드 (발견 팝업과 수첩에서 같이 써요)
export function entryCard(d, { full = false } = {}) {
  const pt = PATHOGEN_TYPES[d.pathogenType];
  const facts = [
    el('div', { class: 'fact wide' }, el('span', { class: 'k' }, '정의'), d.definition),
    el('div', { class: 'fact' }, el('span', { class: 'k' }, '원인 병원체'), `${pt.icon} ${d.pathogen}`, el('br'), el('small', {}, `분류: ${pt.label}`)),
    el('div', { class: 'fact' }, el('span', { class: 'k' }, '전파 경로'), el('div', { class: 'routes' }, ...d.routes.map((r) => el('span', { class: 'route' }, `${ROUTES[r].icon} ${ROUTES[r].label}`)))),
    el('div', { class: 'fact' }, el('span', { class: 'k' }, '잠복기'), d.incubation),
    el('div', { class: 'fact' }, el('span', { class: 'k' }, '법정감염병 (국내)'), d.grade),
    el('div', { class: 'fact wide' }, el('span', { class: 'k' }, '주요 증상'), el('ul', {}, ...d.symptoms.map((s) => el('li', {}, s)))),
  ];
  if (full) {
    facts.push(
      el('div', { class: 'fact wide' }, el('span', { class: 'k' }, '치료'), d.treatmentSummary),
      el('div', { class: 'fact wide' }, el('span', { class: 'k' }, '예방·방역'), d.preventionSummary),
      el('div', { class: 'fact wide' }, el('span', { class: 'k' }, '알아 두면 좋은 이야기'), d.fact),
    );
  }
  return el('div', { class: 'entry' },
    el('div', { class: 'entry-title' },
      el('div', { class: 'big', 'aria-hidden': 'true' }, pt.icon),
      el('div', {}, el('h3', {}, d.name), el('div', { class: 'en' }, d.en)),
    ),
    el('div', { class: 'facts' }, ...facts),
  );
}

function genericWhy(card, d) {
  if (!card.blocks.length) return `${josa(card.name, '은/는')} 이 질병의 전파를 막는 데 도움이 되지 않아요.`;
  return `${josa(card.name, '은/는')} ${routeText(card.blocks)} 전파를 막는 방법이에요. ${josa(d.short, '은/는')} 주로 ${josa(routeText(d.routes), '으로/로')} 퍼져서 효과가 거의 없어요.`;
}

function maxReachable(cards, budget) {
  // 남은 예산으로 얻을 수 있는 최대 차단율 (작은 배낭 문제)
  const best = new Array(budget + 1).fill(0);
  for (const c of cards) for (let b = budget; b >= c.cost; b--) best[b] = Math.max(best[b], best[b - c.cost] + c.power);
  return best[budget];
}

export class Clinic {
  constructor(root, input, ui) {
    this.root = root;
    this.input = input;
    this.ui = ui;
  }

  async run(diseaseId, patient, { firstTime, best = 0 }) {
    const d = DISEASES[diseaseId];
    this.d = d;
    this.mistakes = [0, 0, 0];
    this.aborted = false;
    this.build(d, patient);
    try {
      await this.stageDiagnosis(d);
      if (firstTime) await this.ui.discover(d);
      await this.stageTreatment(d);
      await this.stagePrevention(d);
    } catch (e) {
      if (e !== 'abort') throw e;
      this.node.remove();
      return { aborted: true };
    }
    const stars = Math.max(1, 3 - this.mistakes.filter((m) => m > 0).length);
    this.setPatientHealed(patient);
    await this.summary(d, stars, best);
    this.node.remove();
    return { stars, mistakes: this.mistakes };
  }

  build(d, patient) {
    const c = d.case;
    this.stepEls = ['진단', '처방', '방역'].map((s, i) => el('div', { class: 'step' }, el('b', {}, String(i + 1)), s));
    this.avatar = el('div', { html: avatarSVG(patient.look, patient.sick) });
    this.bubble = el('div', { class: 'bubble' }, c.complaint);
    this.stage = el('section', { class: 'stage', 'aria-live': 'polite' });
    const abort = el('button', { class: 'btn ghost', onclick: () => this.confirmAbort() }, '진료 중단');
    this.node = el('div', { class: 'clinic', role: 'dialog', 'aria-label': '진료실' },
      el('div', { class: 'clinic-top' }, el('h2', {}, '🩺 진료실'), el('div', { class: 'steps' }, ...this.stepEls), abort),
      el('div', { class: 'clinic-main' },
        el('aside', { class: 'patient-card' },
          this.avatar,
          el('div', {}, el('div', { class: 'pname' }, c.patient.name), el('div', { class: 'pmeta' }, `${c.patient.age}세 · ${c.patient.job}`)),
          this.bubble,
        ),
        this.stage,
      ),
    );
    this.root.append(this.node);
  }

  setPatientHealed(patient) {
    this.avatar.innerHTML = avatarSVG(patient.look, patient.sick, true);
  }

  setStep(i) {
    this.stepEls.forEach((s, j) => {
      s.classList.toggle('on', j === i);
      s.classList.toggle('done', j < i);
    });
    this.stage.innerHTML = '';
    this.stage.scrollTop = 0;
  }

  confirmAbort() {
    if (this.node.querySelector('.modal-back')) return;
    const back = el('div', { class: 'modal-back' });
    const sheet = el('div', { class: 'sheet', style: { width: 'min(420px,100%)' } },
      el('div', { class: 'sheet-body award' },
        el('h3', {}, '진료를 그만둘까요?'),
        el('p', {}, '이번 진료 기록은 저장되지 않아요. 환자에게 다시 말을 걸면 처음부터 진료할 수 있어요.'),
        el('div', { class: 'center-row' },
          el('button', { class: 'btn', onclick: () => back.remove() }, '계속 진료하기'),
          el('button', { class: 'btn berry', onclick: () => { back.remove(); this.aborted = true; this.abortFn && this.abortFn(); } }, '그만두기'),
        ),
      ),
    );
    back.append(sheet);
    this.node.append(back);
  }

  // 단계마다 '중단'으로 빠져나갈 수 있도록 Promise를 감쌉니다.
  wrap(executor) {
    return new Promise((resolve, reject) => {
      this.abortFn = () => reject('abort');
      executor(resolve);
    });
  }

  // ───── 1단계: 진단 ─────
  stageDiagnosis(d) {
    this.setStep(0);
    const c = d.case;
    const fb = el('div');
    const chart = el('div', { class: 'chart' }, ...c.clues.map((cl) => {
      if (!cl.lock) return el('div', { class: 'clue' }, el('span', { class: 'k' }, cl.k), el('span', {}, cl.t));
      const row = el('div', { class: 'clue locked' }, el('span', { class: 'k' }, cl.k));
      const btn = el('button', { class: 'btn ghost reveal', onclick: () => { sfx('select'); row.classList.remove('locked'); btn.replaceWith(el('span', {}, cl.t)); } }, '🔬 검사 결과 보기');
      row.append(btn);
      return row;
    }));
    const cands = el('div', { class: 'cands' });
    this.stage.append(
      el('h3', {}, el('span', { class: 'tag' }, '1단계'), '진단 · 정의와 증상'),
      el('p', { class: 'lead' }, '진료 차트의 증상, 발병 경과, 노출·여행력을 살펴보고 어떤 감염병인지 진단하세요. 검사 결과도 확인할 수 있어요.'),
      chart,
      el('h3', { style: { fontSize: '19px' } }, '이 환자의 진단명은?'),
      cands,
      fb,
    );
    return this.wrap((resolve) => {
      for (const id of shuffle(c.candidates)) {
        const cd = DISEASES[id];
        const b = el('button', { class: 'cand' }, cd.name, el('small', {}, cd.en));
        b.onclick = async () => {
          if (b.classList.contains('wrong') || b.classList.contains('right') || this.solved) return;
          if (id === d.id) {
            this.solved = true;
            b.classList.add('right');
            sfx('correct');
            fb.replaceChildren(el('div', { class: 'feedback good', html: rich(`<b>✅ 정답! ${d.name}</b>\n핵심 단서: ${d.keyClue}`) }));
            await sleep(1300);
            this.solved = false;
            resolve();
          } else {
            this.mistakes[0]++;
            b.classList.add('wrong');
            sfx('wrong');
            fb.replaceChildren(el('div', { class: 'feedback bad', html: rich(`<b>❌ ${josa(cd.name, '은/는')} 아니에요.</b>\n${cd.short}의 핵심 단서는 ${josa(`"${cd.keyClue}"`, '이에요/예요')}. 환자의 단서와 다시 비교해 보세요.`) }));
          }
        };
        cands.append(b);
      }
    });
  }

  // ───── 2단계: 처방 ─────
  stageTreatment(d) {
    this.setStep(1);
    const need = d.treatments.filter((t) => t.ok).length;
    const opts = shuffle(d.treatments);
    const locked = new Set();
    const selected = new Set();
    const count = el('span', { class: 'rx-count' });
    const submit = el('button', { class: 'btn', disabled: true }, '💊 처방하기');
    const fbList = el('div', { class: 'fb-list' });
    const grid = el('div', { class: 'rx-grid' });
    this.bubble.textContent = '어떤 치료를 받게 되나요?';
    const remain = () => need - locked.size;
    const update = () => {
      count.textContent = locked.size ? `남은 처방 ${remain() - selected.size}개` : `처방전 ${selected.size} / ${need}`;
      submit.disabled = selected.size !== remain();
    };
    const cards = opts.map((t) => {
      const b = el('button', { class: 'rx' }, el('span', { class: 'ico', 'aria-hidden': 'true' }, t.icon), el('span', {}, t.name));
      b.onclick = () => {
        if (b.classList.contains('wrong') || locked.has(t)) return;
        if (selected.has(t)) selected.delete(t);
        else if (selected.size < remain()) selected.add(t);
        else return;
        b.classList.toggle('sel', selected.has(t));
        sfx('select');
        update();
      };
      return { t, b };
    });
    grid.append(...cards.map((c) => c.b));
    update();
    this.stage.append(
      el('h3', {}, el('span', { class: 'tag' }, '2단계'), '처방 · 치료법'),
      el('p', { class: 'lead' }, `${d.short} 환자에게 알맞은 치료제와 간호 중재 ${need}가지를 골라 처방전을 완성하세요. 원인 병원체가 무엇인지 떠올려 보세요!`),
      grid,
      el('div', { class: 'rx-bar' }, count, submit),
      fbList,
    );
    return this.wrap((resolve) => {
      submit.onclick = () => {
        const msgs = [];
        let wrong = 0;
        for (const { t, b } of cards) {
          if (!selected.has(t)) continue;
          b.classList.remove('sel');
          if (t.ok) {
            locked.add(t);
            b.classList.add('right');
          } else {
            wrong++;
            b.classList.add('wrong');
            msgs.push(el('div', { class: 'feedback bad', html: rich(`<b>❌ ${t.name}</b>\n${t.why}`) }));
          }
        }
        selected.clear();
        if (wrong) {
          this.mistakes[1]++;
          sfx('wrong');
          msgs.unshift(el('div', { class: 'feedback bad', html: rich(`<b>처방전을 다시 확인해요.</b> 맞은 처방은 초록색으로 고정했어요. ${remain()}가지를 더 골라 주세요.`) }));
          fbList.replaceChildren(...msgs);
          update();
          return;
        }
        if (locked.size < need) { update(); return; }
        sfx('correct');
        fbList.replaceChildren(
          el('div', { class: 'feedback good', html: rich('<b>✅ 올바른 처방이에요!</b>') }),
          ...d.treatments.filter((t) => t.ok).map((t) => el('div', { class: 'feedback good', html: rich(`<b>${t.icon} ${t.name}</b>\n${t.why}`) })),
        );
        this.bubble.textContent = '처방해 주셔서 감사해요. 이제 우리 동네 사람들도 지켜 주세요!';
        const next = el('button', { class: 'btn sun', onclick: () => resolve() }, '다음: 방역 계획 세우기 →');
        submit.replaceWith(next);
        count.textContent = '처방 완료';
        next.focus();
      };
    });
  }

  // ───── 3단계: 방역 ─────
  stagePrevention(d) {
    this.setStep(2);
    this.bubble.textContent = '우리 동네에 더 퍼지지 않게 막아 주세요!';
    const eff = d.prevention.effective;
    const dis = d.prevention.distractors;
    const budget = budgetFor(d);
    const ids = shuffle([...Object.keys(eff), ...Object.keys(dis)]);
    let spent;
    let blocked;
    let wrongPlayed;
    const meterFill = el('i');
    const pct = el('span');
    const left = el('span');
    const pips = el('div', { class: 'budget', 'aria-label': '남은 예산' });
    const village = el('div', { class: 'village', 'aria-hidden': 'true' });
    const hand = el('div', { class: 'hand' });
    const log = el('div', { class: 'log' });
    const people = ['🧑', '👩', '👨', '👧', '👦', '👵', '👴', '🧒'];
    for (let i = 0; i < 24; i++) village.append(el('span', {}, people[i % people.length]));

    this.stage.append(
      el('h3', {}, el('span', { class: 'tag' }, '3단계'), '방역 · 예방법'),
      el('p', { class: 'lead' }, `예산 ${budget}점 안에서 방역 카드를 골라 지역사회 전파 차단율 100%를 만드세요. 효과 없는 카드를 쓰면 예산만 줄어요!`),
      el('div', { class: 'routes' }, el('b', { style: { fontFamily: 'var(--font-display)', fontWeight: 'normal' } }, `${d.short}의 전파 경로`), ...d.routes.map((r) => el('span', { class: 'route' }, `${ROUTES[r].icon} ${ROUTES[r].label}`))),
      el('div', { class: 'meters' },
        el('div', {}, el('div', { class: 'meter-label' }, el('span', {}, '전파 차단율'), pct), el('div', { class: 'meter' }, meterFill)),
        el('div', {}, el('div', { class: 'meter-label' }, el('span', {}, '예산'), left), pips),
      ),
      village,
      hand,
      log,
    );

    return this.wrap((resolve) => {
      const render = () => {
        const remain = budget - spent;
        meterFill.style.width = `${Math.min(100, blocked)}%`;
        pct.textContent = `${Math.min(100, blocked)}%`;
        left.textContent = `${remain} / ${budget}`;
        pips.replaceChildren(...Array.from({ length: budget }, (_, i) => el('span', { class: `pip ${i < spent ? 'used' : ''}` })));
        const sick = Math.round(24 * 0.6 * (1 - Math.min(100, blocked) / 100));
        [...village.children].forEach((s, i) => { s.textContent = i * 7 % 24 < sick ? '🤒' : people[i % people.length]; });
        for (const b of hand.children) {
          const card = CARDS[b.dataset.id];
          b.classList.toggle('cant', !b.classList.contains('used') && card.cost > remain);
        }
      };
      const reset = () => {
        spent = 0;
        blocked = 0;
        wrongPlayed = false;
        log.replaceChildren();
        hand.replaceChildren(...ids.map((id) => {
          const card = CARDS[id];
          const b = el('button', { class: 'card', dataset: { id } },
            el('span', { class: 'cost', title: '비용' }, String(card.cost)),
            el('span', { class: 'ico', 'aria-hidden': 'true' }, card.icon),
            el('span', { class: 'nm' }, card.name),
            el('span', { class: 'ds' }, card.desc),
          );
          b.onclick = () => play(id, b);
          return b;
        }));
        render();
      };
      const play = (id, b) => {
        const card = CARDS[id];
        if (b.classList.contains('used') || blocked >= 100) return;
        if (card.cost > budget - spent) {
          sfx('cancel');
          return;
        }
        spent += card.cost;
        b.classList.add('used');
        if (eff[id]) {
          blocked += eff[id].power;
          b.classList.add('ok');
          sfx('card');
          log.prepend(el('div', { class: 'feedback good', html: rich(`<b>${card.icon} ${card.name} +${eff[id].power}%</b>\n${eff[id].why}`) }));
        } else {
          wrongPlayed = true;
          sfx('wrong');
          log.prepend(el('div', { class: 'feedback bad', html: rich(`<b>${card.icon} ${card.name} · 효과 미미</b>\n${dis[id] || genericWhy(card, d)}`) }));
        }
        render();
        if (blocked >= 100) {
          if (wrongPlayed) this.mistakes[2]++;
          sfx('fanfare');
          this.bubble.textContent = '이제 마을이 안전해졌어요. 정말 고마워요!';
          const done = el('div', { class: 'feedback good', html: rich(`<b>🎉 지역사회 전파 차단 성공!</b>\n남은 예산 ${budget - spent}점. ${d.preventionSummary}`) });
          const next = el('button', { class: 'btn sun', onclick: () => resolve() }, '진료 마치기 →');
          log.prepend(done, el('div', { class: 'center-row' }, next));
          for (const c of hand.children) if (!c.classList.contains('used')) c.classList.add('cant');
          next.focus();
          return;
        }
        const remainCards = Object.keys(eff).filter((k) => ![...hand.children].find((x) => x.dataset.id === k).classList.contains('used')).map((k) => ({ cost: CARDS[k].cost, power: eff[k].power }));
        if (blocked + maxReachable(remainCards, budget - spent) < 100) {
          this.mistakes[2]++;
          const retry = el('button', { class: 'btn berry', onclick: () => { sfx('confirm'); reset(); } }, '다시 도전');
          log.prepend(
            el('div', { class: 'feedback bad', html: rich(`<b>예산이 부족해요!</b>\n남은 예산으로는 차단율 100%를 만들 수 없어요. ${josa(d.short, '이/가')} 어떤 경로(${routeText(d.routes)})로 퍼지는지 떠올리며 다시 계획해 보세요.`) }),
            el('div', { class: 'center-row' }, retry),
          );
          for (const c of hand.children) if (!c.classList.contains('used')) c.classList.add('cant');
          retry.focus();
        }
      };
      reset();
    });
  }

  summary(d, stars, best) {
    this.stepEls.forEach((s) => { s.classList.remove('on'); s.classList.add('done'); });
    return new Promise((resolve) => {
      const back = el('div', { class: 'modal-back' });
      const starRow = el('div', { class: 'stars', 'aria-label': `별 ${stars}개` }, ...[0, 1, 2].map((i) => el('span', { class: i < stars ? '' : 'off' }, '★')));
      const sheet = el('div', { class: 'sheet', style: { width: 'min(620px,100%)' } },
        el('div', { class: 'sheet-head' }, el('h2', {}, '진료 완료!')),
        el('div', { class: 'sheet-body' },
          starRow,
          el('p', { style: { textAlign: 'center', margin: '4px 0 14px', color: 'var(--ink-soft)' } }, stars === 3 ? '실수 없이 완벽하게 해냈어요!' : '단계마다 실수 없이 풀면 별을 더 받을 수 있어요.' + (best ? ` (최고 기록 ★${best})` : '')),
          el('div', { class: 'learned' },
            el('div', { class: 'row' }, el('b', {}, '진단'), el('span', {}, `${d.name}: ${d.keyClue}`)),
            el('div', { class: 'row' }, el('b', {}, '치료'), el('span', {}, d.treatmentSummary)),
            el('div', { class: 'row' }, el('b', {}, '예방'), el('span', {}, d.preventionSummary)),
          ),
          el('div', { class: 'center-row', style: { marginTop: '14px' } }, el('button', { class: 'btn', onclick: () => { back.remove(); resolve(); } }, '마을로 돌아가기')),
        ),
      );
      back.append(sheet);
      this.node.append(back);
      sfx('heal');
    });
  }
}
