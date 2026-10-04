// 3단계(방역)에서 쓰는 예방 카드
// blocks: 이 카드가 주로 막는 전파 경로. 효과 없는 카드를 골랐을 때의 기본 설명에 씁니다.

export const CARDS = {
  negative_isolation: { name: '음압 격리', icon: '🏥', cost: 4, blocks: ['airborne'], desc: '공기 전파 환자를 음압 병실에 격리' },
  isolation: { name: '환자 격리·접촉주의', icon: '🚪', cost: 3, blocks: ['contact', 'blood'], desc: '1인실·치료센터 격리, 장갑·가운 사용' },
  mask: { name: '마스크 착용 권고', icon: '😷', cost: 2, blocks: ['droplet', 'airborne'], desc: '기침·비말을 가려요' },
  ppe: { name: '의료진 개인보호구', icon: '🥽', cost: 3, blocks: ['airborne', 'droplet', 'contact', 'blood'], desc: 'N95·가운·장갑·고글' },
  handwash: { name: '손씻기 교육', icon: '🧼', cost: 1, blocks: ['contact', 'water', 'droplet'], desc: '비누로 30초 이상' },
  cough: { name: '기침 예절 캠페인', icon: '🤧', cost: 1, blocks: ['droplet', 'airborne'], desc: '휴지·옷소매로 가리기' },
  vent: { name: '실내 환기', icon: '🪟', cost: 1, blocks: ['airborne', 'droplet'], desc: '창문을 자주 열어요' },
  stayhome: { name: '아프면 쉬기', icon: '🏠', cost: 1, blocks: ['droplet', 'airborne', 'contact'], desc: '등교·출근 중지' },
  vaccine: { name: '예방접종 캠페인', icon: '💉', cost: 4, blocks: [], desc: '백신으로 면역 만들기' },
  contact_trace: { name: '접촉자 추적·관리', icon: '🔍', cost: 3, blocks: ['droplet', 'airborne', 'contact', 'blood'], desc: '접촉자를 찾아 검사·관찰' },
  screening: { name: '조기 검진·검사 확대', icon: '🔬', cost: 2, blocks: [], desc: '숨은 환자를 일찍 찾기' },
  travel: { name: '해외 유입 검역·신고', icon: '🛂', cost: 2, blocks: [], desc: '공항 검역, 증상 시 1339' },
  water: { name: '안전한 식수 공급', icon: '🚰', cost: 3, blocks: ['water'], desc: '끓이기·정수·염소 소독' },
  food: { name: '음식 익혀 먹기', icon: '🍲', cost: 2, blocks: ['water'], desc: '날음식·얼음 조심' },
  sanitation: { name: '화장실·하수 위생 개선', icon: '🚽', cost: 3, blocks: ['water'], desc: '분변이 물을 오염시키지 않게' },
  carrier: { name: '보균자 조리 업무 제한', icon: '🧑‍🍳', cost: 2, blocks: ['water'], desc: '완치 확인 전 조리 금지' },
  bednet: { name: '살충 처리 모기장', icon: '🛏️', cost: 2, blocks: ['mosquito'], desc: '잘 때 모기 차단' },
  repellent: { name: '기피제·긴 옷 착용', icon: '🧴', cost: 2, blocks: ['mosquito', 'tick'], desc: '피부 노출 줄이기' },
  breeding: { name: '고인 물 없애기', icon: '🪣', cost: 2, blocks: ['mosquito'], desc: '모기 유충 서식지 제거' },
  screen: { name: '방충망 설치', icon: '🔲', cost: 1, blocks: ['mosquito'], desc: '집 안으로 못 들어오게' },
  fogging: { name: '살충제 방역', icon: '🌫️', cost: 2, blocks: ['mosquito'], desc: '성충 모기 줄이기' },
  grass: { name: '풀밭 행동 수칙 교육', icon: '🌾', cost: 1, blocks: ['tick'], desc: '돗자리 사용, 풀밭에 눕지 않기' },
  aftercare: { name: '귀가 후 샤워·진드기 확인', icon: '🚿', cost: 1, blocks: ['tick'], desc: '옷은 바로 세탁' },
  animal: { name: '동물 접촉·생식 자제', icon: '🐪', cost: 2, blocks: ['animal'], desc: '낙타·야생동물 주의' },
  safe_burial: { name: '안전한 장례', icon: '🕊️', cost: 2, blocks: ['blood', 'contact'], desc: '보호구 갖춘 전문 팀' },
  disinfect: { name: '환경 소독', icon: '🧽', cost: 2, blocks: ['contact', 'blood'], desc: '염소 소독제로 닦기' },
  condom: { name: '콘돔 사용 교육', icon: '🛡️', cost: 2, blocks: ['sexual'], desc: '올바른 사용법 교육' },
  needle: { name: '주사기 공유 금지·혈액 선별', icon: '🩸', cost: 2, blocks: ['blood'], desc: '안전한 주사·수혈' },
  prep: { name: '노출 전·후 예방요법', icon: '💊', cost: 3, blocks: ['sexual', 'blood'], desc: 'PrEP · PEP' },
  mother_art: { name: '산모 항레트로바이러스 치료', icon: '🤱', cost: 2, blocks: ['vertical'], desc: '수직감염 예방' },
  prophylaxis: { name: '예방약 복용', icon: '🧪', cost: 2, blocks: ['mosquito'], desc: '고위험군·여행자 예방약' },
  antibiotic_mass: { name: '주민 전체 항생제 투여', icon: '💊', cost: 3, blocks: [], desc: '모두에게 항생제를?' },
};

for (const [id, c] of Object.entries(CARDS)) c.id = id;

// 목표(100%)에 닿는 가장 싼 조합의 비용을 구합니다(작은 배낭 문제).
export function minCostToGoal(effective, goal = 100) {
  const items = Object.entries(effective).map(([id, e]) => ({ cost: CARDS[id].cost, power: e.power }));
  let best = Infinity;
  const n = items.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    let c = 0;
    let p = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) { c += items[i].cost; p += items[i].power; }
    if (p >= goal && c < best) best = c;
  }
  return best;
}

// 예산: 가장 효율적인 조합 비용 + 어떤 카드로든 실수 한 번은 만회할 수 있는 여유
export function budgetFor(disease) {
  const slack = Math.max(2, ...Object.keys(disease.prevention.distractors).map((k) => CARDS[k].cost));
  return minCostToGoal(disease.prevention.effective) + slack;
}
