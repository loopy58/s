// 진행 상황 저장 (브라우저 localStorage — 실패해도 게임은 계속돼요)
const KEY = 'outbreak-quest-save-v1';

export function freshSave(name = '원정대원') {
  return {
    v: 1,
    name,
    region: 'seoul',
    mentorIntro: false,
    introSeen: {},
    discovered: {},
    cleared: {},
    badges: {},
    visited: {},
    sound: true,
    finished: false,
  };
}

export function loadSave() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.v !== 1) return null;
    return { ...freshSave(), ...data };
  } catch {
    return null;
  }
}

export function writeSave(data) {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    /* 저장 공간을 쓸 수 없는 환경이에요 */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* 무시 */
  }
}
