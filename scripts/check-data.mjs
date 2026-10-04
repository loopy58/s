// 게임 데이터가 서로 맞물리는지 검사합니다:  npm run check
import { DISEASES, DISEASE_ORDER, ROUTES, PATHOGEN_TYPES } from '../src/data/diseases.js';
import { REGIONS, REGION_ORDER, VEHICLES } from '../src/data/regions.js';
import { CARDS, minCostToGoal, budgetFor } from '../src/data/cards.js';

const errors = [];
const fail = (msg) => errors.push(msg);

const ids = Object.keys(DISEASES);
if (ids.length !== DISEASE_ORDER.length || !ids.every((id) => DISEASE_ORDER.includes(id))) fail('DISEASE_ORDER 가 DISEASES 와 다릅니다');
if (Object.keys(REGIONS).length !== REGION_ORDER.length) fail('REGION_ORDER 가 REGIONS 와 다릅니다');

const seen = {};
for (const r of Object.values(REGIONS)) {
  for (const d of r.diseases) {
    if (!DISEASES[d]) fail(`${r.id}: 없는 질병 ${d}`);
    if (seen[d]) fail(`${d} 가 두 지역(${seen[d]}, ${r.id})에 있습니다`);
    seen[d] = r.id;
    if (!r.patients.find((p) => p.disease === d)) fail(`${r.id}: ${d} 환자가 없습니다`);
  }
  for (const p of r.patients) if (!r.diseases.includes(p.disease)) fail(`${r.id}: 환자 ${p.name} 의 질병이 지역 목록에 없습니다`);
  if (!r.guide?.intro?.length || !r.guide?.done?.length || !r.guide?.idle?.length) fail(`${r.id}: 안내원 대사가 비었습니다`);
  if (!r.vehicles.length) fail(`${r.id}: 탈것이 없습니다`);
  if (!r.badge?.name) fail(`${r.id}: 배지가 없습니다`);
}
for (const id of ids) if (!seen[id]) fail(`${id} 가 어느 지역에도 없습니다`);

for (const d of Object.values(DISEASES)) {
  const tag = d.id;
  if (!PATHOGEN_TYPES[d.pathogenType]) fail(`${tag}: 병원체 분류 오류`);
  for (const r of d.routes) if (!ROUTES[r]) fail(`${tag}: 없는 전파 경로 ${r}`);
  const c = d.case;
  if (!c.candidates.includes(tag)) fail(`${tag}: 후보에 정답이 없습니다`);
  if (new Set(c.candidates).size !== 4) fail(`${tag}: 진단 후보는 서로 다른 4개여야 합니다`);
  for (const x of c.candidates) if (!DISEASES[x]) fail(`${tag}: 없는 후보 ${x}`);
  if (c.clues.length < 3) fail(`${tag}: 단서가 부족합니다`);
  const ok = d.treatments.filter((t) => t.ok).length;
  if (ok < 1 || ok > 3) fail(`${tag}: 정답 처방은 1~3개여야 합니다 (${ok})`);
  if (d.treatments.length !== 6) fail(`${tag}: 처방 카드는 6장이어야 합니다`);
  for (const t of d.treatments) if (!t.why) fail(`${tag}: ${t.name} 설명이 없습니다`);
  const eff = d.prevention.effective;
  const dis = d.prevention.distractors;
  for (const k of [...Object.keys(eff), ...Object.keys(dis)]) if (!CARDS[k]) fail(`${tag}: 없는 방역 카드 ${k}`);
  for (const k of Object.keys(dis)) if (eff[k]) fail(`${tag}: ${k} 가 효과·무효 양쪽에 있습니다`);
  const hand = Object.keys(eff).length + Object.keys(dis).length;
  if (hand < 6 || hand > 8) fail(`${tag}: 방역 카드는 6~8장이어야 합니다 (${hand})`);
  const min = minCostToGoal(eff);
  if (!Number.isFinite(min)) fail(`${tag}: 차단율 100%에 도달할 수 없습니다`);
  const budget = budgetFor(d);
  // 무효 카드를 모두 쓰고도 이길 수 있으면 너무 쉬워요
  const wasteAll = Object.keys(dis).reduce((s, k) => s + CARDS[k].cost, 0);
  if (wasteAll + min <= budget) fail(`${tag}: 무효 카드를 모두 써도 이길 수 있습니다`);
  console.log(`${tag.padEnd(13)} 예산 ${String(budget).padStart(2)} (최소 ${min}) · 처방 ${ok}/6 · 방역 ${Object.keys(eff).length}+${Object.keys(dis).length}`);
}

for (const v of Object.values(VEHICLES)) if (!(v.speed > 0)) fail(`${v.name}: 속도 오류`);

if (errors.length) {
  console.error(`\n❌ ${errors.length}개 문제:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log(`\n✅ 질병 ${ids.length}종 · 지역 ${REGION_ORDER.length}곳 · 방역 카드 ${Object.keys(CARDS).length}장 검사 통과`);
