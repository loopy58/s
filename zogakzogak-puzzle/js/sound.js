// 효과음은 Web Audio로 그때그때 만들어요. 소리 파일이 필요 없어요.
let ac = null;
let muted = false;

export const isMuted = () => muted;
export function setMuted(v) {
  muted = !!v;
}

function audio() {
  if (!ac) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ac = new AC();
  }
  if (ac.state === 'suspended') ac.resume();
  return ac;
}

function tone(freq, dur, type = 'sine', gain = 0.12, when = 0, slideTo = 0) {
  if (muted) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime + when;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.03);
}

export const pick = () => tone(520, 0.05, 'triangle', 0.05);
export function snap() {
  tone(660, 0.09, 'triangle', 0.14);
  tone(990, 0.14, 'sine', 0.08, 0.05);
}
export const miss = () => tone(200, 0.16, 'sine', 0.1, 0, 120);
export function win() {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.11));
  tone(1568, 0.5, 'sine', 0.06, 0.48);
}
