// 이어하기·기록·설정은 모두 이 기기의 브라우저(localStorage)에만 저장돼요.
const KEY = {
  save: 'zogak:save',
  photo: 'zogak:photo',
  records: 'zogak:records',
  prefs: 'zogak:prefs',
};

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function remove(...keys) {
  try {
    for (const k of keys) localStorage.removeItem(k);
  } catch {
    /* 저장소를 쓸 수 없는 환경 */
  }
}

export const pref = (name, fallback) => read(KEY.prefs, {})[name] ?? fallback;
export function setPref(name, value) {
  const p = read(KEY.prefs, {});
  p[name] = value;
  write(KEY.prefs, p);
}

// 진행 중인 퍼즐
export const loadSave = () => read(KEY.save, null);
export const writeSave = (s) => write(KEY.save, s);
export const clearSave = () => remove(KEY.save, KEY.photo);

// 내 사진 퍼즐을 이어하려면 사진도 남겨 둬야 해요. 용량이 모자라면 조용히 포기해요.
export function savePhoto(dataURL) {
  try {
    localStorage.setItem(KEY.photo, dataURL);
    return true;
  } catch {
    return false;
  }
}
export function loadPhoto() {
  try {
    return localStorage.getItem(KEY.photo);
  } catch {
    return null;
  }
}

// 완성 기록: 최근 기록 + 난이도별 상위 10개는 꼭 남겨요.
export const getRecords = () => read(KEY.records, []);

export function addRecord(rec) {
  const all = getRecords();
  const prevBest = all.filter((r) => r.level === rec.level).reduce((m, r) => Math.max(m, r.score), 0);
  all.push(rec);
  const keep = new Set(
    [...all]
      .sort((a, b) => b.at - a.at)
      .slice(0, 60)
      .map((r) => r.id),
  );
  for (const level of new Set(all.map((r) => r.level))) {
    all
      .filter((r) => r.level === level)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .forEach((r) => keep.add(r.id));
  }
  let list = all.filter((r) => keep.has(r.id));
  if (!write(KEY.records, list)) {
    // 공간이 모자라면 오래된 기록의 썸네일부터 비워요.
    list = list.map((r, i) => (i < list.length - 10 ? { ...r, thumb: null } : r));
    write(KEY.records, list);
  }
  return { isBest: rec.score > prevBest, prevBest };
}

export const clearRecords = () => remove(KEY.records);
