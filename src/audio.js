// 효과음과 잔잔한 배경음을 Web Audio로 직접 만들어요(외부 파일 없음).
let ctx = null;
let master = null;
let musicGain = null;
let enabled = true;
let musicTimer = null;
let musicState = null;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume();
    return;
  }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = enabled ? 0.6 : 0;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
  } catch {
    ctx = null;
  }
}

export function setSound(on) {
  enabled = on;
  if (master) master.gain.setTargetAtTime(on ? 0.6 : 0, ctx.currentTime, 0.05);
}

export const soundOn = () => enabled;

function tone(freq, start, dur, { type = 'triangle', vol = 0.2, attack = 0.005, release = 0.08, dest = master, slide = 0 } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, start);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, start + dur);
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur + release);
  o.connect(g);
  g.connect(dest);
  o.start(start);
  o.stop(start + dur + release + 0.02);
}

function noise(start, dur, { vol = 0.15, freq = 1200, q = 0.8, type = 'bandpass' } = {}) {
  if (!ctx) return;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, start);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(f);
  f.connect(g);
  g.connect(master);
  src.start(start);
}

// 대화할 때 나는 웅얼웅얼 소리
export function blip(pitch = 1) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime;
  const base = 330 * pitch * (0.85 + Math.random() * 0.35);
  tone(base, t, 0.035, { type: 'square', vol: 0.045, release: 0.03, slide: 1.15 });
}

export function sfx(name) {
  if (!ctx || !enabled) return;
  const t = ctx.currentTime + 0.01;
  switch (name) {
    case 'confirm':
      tone(660, t, 0.06, { vol: 0.15 });
      tone(990, t + 0.06, 0.08, { vol: 0.15 });
      break;
    case 'cancel':
      tone(520, t, 0.06, { vol: 0.12 });
      tone(350, t + 0.06, 0.08, { vol: 0.12 });
      break;
    case 'select':
      tone(880, t, 0.03, { vol: 0.08, type: 'sine' });
      break;
    case 'correct':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.07, 0.12, { vol: 0.16 }));
      break;
    case 'wrong':
      tone(220, t, 0.18, { type: 'sawtooth', vol: 0.08, slide: 0.7 });
      tone(165, t + 0.12, 0.22, { type: 'sawtooth', vol: 0.07, slide: 0.7 });
      break;
    case 'card':
      noise(t, 0.12, { vol: 0.12, freq: 2400, q: 0.6 });
      tone(740, t + 0.04, 0.06, { vol: 0.08, type: 'sine' });
      break;
    case 'stamp':
      noise(t, 0.15, { vol: 0.35, freq: 180, q: 0.7, type: 'lowpass' });
      tone(110, t, 0.12, { type: 'sine', vol: 0.3, slide: 0.6 });
      break;
    case 'discover':
      [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.09, 0.2, { vol: 0.13, type: 'sine' }));
      break;
    case 'fanfare':
      [[523, 0], [659, 0.12], [784, 0.24], [1047, 0.4], [988, 0.56], [1047, 0.7]].forEach(([f, d]) => tone(f, t + d, d > 0.6 ? 0.5 : 0.12, { vol: 0.15 }));
      [262, 330, 392].forEach((f) => tone(f, t + 0.7, 0.6, { vol: 0.08, type: 'sine' }));
      break;
    case 'heal':
      [659, 784, 988].forEach((f, i) => tone(f, t + i * 0.1, 0.25, { vol: 0.1, type: 'sine' }));
      break;
    case 'engine':
      tone(70, t, 1.2, { type: 'sawtooth', vol: 0.05, slide: 1.8 });
      noise(t, 1.2, { vol: 0.05, freq: 300 });
      break;
    case 'plane':
      noise(t, 2.4, { vol: 0.16, freq: 500, q: 0.4 });
      tone(120, t, 2.2, { type: 'sawtooth', vol: 0.03, slide: 1.4 });
      break;
    case 'step':
      noise(t, 0.05, { vol: 0.05, freq: 900 });
      break;
    default:
      break;
  }
}

// ── 배경음: 지역마다 음계와 빠르기가 조금씩 달라요 ──
const SCALES = {
  major: [0, 2, 4, 7, 9],
  minor: [0, 3, 5, 7, 10],
  arabic: [0, 1, 4, 5, 7, 8, 11],
  asian: [0, 2, 4, 7, 9],
};
const MUSIC = {
  title: { root: 60, scale: 'major', bpm: 92, chords: [0, 5, 7, 0] },
  seoul: { root: 62, scale: 'major', bpm: 88, chords: [0, 9, 5, 7] },
  school: { root: 65, scale: 'major', bpm: 100, chords: [0, 5, 9, 7] },
  rural: { root: 60, scale: 'major', bpm: 80, chords: [0, 5, 0, 7] },
  middleeast: { root: 62, scale: 'arabic', bpm: 84, chords: [0, 0, 5, 7] },
  guangdong: { root: 64, scale: 'asian', bpm: 86, chords: [0, 9, 5, 7] },
  southasia: { root: 60, scale: 'minor', bpm: 82, chords: [0, 5, 3, 7] },
  seasia: { root: 67, scale: 'asian', bpm: 96, chords: [0, 5, 9, 7] },
  westafrica: { root: 62, scale: 'major', bpm: 104, chords: [0, 5, 7, 5] },
  southafrica: { root: 64, scale: 'major', bpm: 98, chords: [0, 5, 7, 0] },
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export function playMusic(id) {
  if (!ctx) return;
  const m = MUSIC[id] || MUSIC.title;
  if (musicState && musicState.id === id) return;
  stopMusic();
  musicState = { id, m, step: 0, next: ctx.currentTime + 0.2, mel: 2 };
  const beat = 60 / m.bpm / 2;
  const sc = SCALES[m.scale];
  musicTimer = setInterval(() => {
    if (!ctx || !musicState) return;
    while (musicState.next < ctx.currentTime + 0.3) {
      const s = musicState.step;
      const t = musicState.next;
      const bar = Math.floor(s / 8) % m.chords.length;
      const chordRoot = m.root + m.chords[bar] - 12;
      if (s % 8 === 0) {
        tone(midi(chordRoot - 12), t, beat * 6, { type: 'sine', vol: 0.18, dest: musicGain, attack: 0.02, release: 0.3 });
      }
      if (s % 2 === 0) {
        const arp = [0, 4, 7, 12][(s / 2) % 4];
        tone(midi(chordRoot + arp), t, beat * 0.8, { type: 'triangle', vol: 0.06, dest: musicGain, release: 0.15 });
      }
      // 멜로디: 음계 안에서 천천히 걸어 다녀요
      if (Math.random() < 0.55) {
        musicState.mel = Math.max(0, Math.min(sc.length * 2 - 1, musicState.mel + Math.floor(Math.random() * 3) - 1));
        const deg = musicState.mel;
        const note = m.root + sc[deg % sc.length] + 12 * Math.floor(deg / sc.length);
        tone(midi(note), t, beat * 0.9, { type: 'sine', vol: 0.09, dest: musicGain, release: 0.2 });
      }
      musicState.step++;
      musicState.next += beat;
    }
  }, 100);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
  musicState = null;
}
