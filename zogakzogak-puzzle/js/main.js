// 화면 흐름: 첫 화면 → 퍼즐 준비 → 퍼즐 판 → 완성 → 기록
import { paint } from './art.js';
import { LEVELS, gridFor } from './jigsaw.js';
import { Game } from './game.js';
import { hash32, randomSeed } from './rng.js';
import * as store from './store.js';
import * as sound from './sound.js';

const $ = (sel) => document.querySelector(sel);

// ── 작은 도우미 ─────────────────────────────────────────────
function clock(sec) {
  sec = Math.floor(sec);
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function koTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return m ? `${m}분 ${s}초` : `${s}초`;
}

function localDay(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const dailySeed = (day) => hash32(`zogakzogak:${day}`) % 0x7fffffff;

function thumb(image, width = 480) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = Math.round((width * image.height) / image.width);
  c.getContext('2d').drawImage(image, 0, 0, c.width, c.height);
  return c;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// 알림은 popover로 띄워서 열린 창(dialog) 위에도 보이게 해요.
let toastTimer = 0;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.hidden = false;
  if (t.showPopover) {
    if (t.matches(':popover-open')) t.hidePopover();
    t.showPopover();
  }
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    if (t.hidePopover && t.matches(':popover-open')) t.hidePopover();
    t.hidden = true;
  }, 2600);
}

// 점수: 조각 수 × 100을 기준으로 정확도와 속도를 곱해요.
export function scoreOf({ pieces, seconds, mistakes, hintUsed }) {
  const accuracy = pieces / (pieces + mistakes);
  const par = pieces * 4 + 20; // 기준 시간(초)
  const speed = Math.min(2, Math.max(0.25, par / Math.max(1, seconds)));
  let score = pieces * 100 * (0.4 + 0.6 * accuracy) * speed;
  if (hintUsed) score *= 0.85;
  score = Math.round(score);
  const ratio = score / (pieces * 100);
  return { score, accuracy, par, stars: ratio >= 1.4 ? 3 : ratio >= 0.8 ? 2 : 1 };
}

// ── 상태 ───────────────────────────────────────────────────
// source: { kind: 'art', seed, daily? } | { kind: 'photo', cutSeed }
let current = null; // 지금 맞추는 퍼즐 { source, image, title, level }
let setup = null; // 준비 창에 띄운 퍼즐
let lastResult = null;

export const game = new Game($('#board'), {
  onProgress(placed, total) {
    $('#hudCount').textContent = `${placed}/${total}`;
    $('#hudBar').style.width = `${(placed / total) * 100}%`;
    if (placed) $('#live').textContent = `${total}조각 중 ${placed}조각을 맞췄어요.`;
  },
  onChange: saveSoon,
  onComplete,
});

sound.setMuted(store.pref('muted', false));

// ── 화면 전환 (휴대폰 뒤로 가기 버튼도 처리) ─────────────────
function show(name) {
  for (const id of ['home', 'game', 'records']) $('#' + id).hidden = id !== name;
  document.body.dataset.screen = name;
  window.scrollTo(0, 0);
}

function closeDialogs() {
  for (const d of document.querySelectorAll('dialog[open]')) d.close();
}

function enter(name) {
  if (history.state?.screen) history.replaceState({ screen: name }, '');
  else history.pushState({ screen: name }, '');
  show(name);
}

function goHome() {
  if (history.state?.screen) history.back();
  else showHome();
}

function showHome() {
  closeDialogs();
  if (current && !game.done) {
    game.pause();
    saveNow();
  }
  show('home');
  refreshHome();
}

addEventListener('popstate', () => {
  if (!history.state?.screen) showHome();
});

// ── 첫 화면 ────────────────────────────────────────────────
const today = localDay();
const daily = { kind: 'art', seed: dailySeed(today), daily: today };
const dailyArt = paint(daily.seed);
$('#dailyThumb').append(thumb(dailyArt.canvas));
$('#dailyTitle').textContent = dailyArt.title;
$('#dailyDate').textContent = `오늘의 퍼즐 · ${new Date().getMonth() + 1}월 ${new Date().getDate()}일`;

function refreshHome() {
  const best = store
    .getRecords()
    .filter((r) => r.daily === today)
    .sort((a, b) => b.score - a.score)[0];
  $('#dailyBest').hidden = !best;
  if (best) $('#dailyBest').textContent = `오늘 내 최고: ${best.score.toLocaleString()}점 (${LEVELS[best.level].name} · ${koTime(best.seconds)})`;

  let save = store.loadSave();
  if (save && !(Array.isArray(save.state?.pieces) && LEVELS[save.level] && save.source)) {
    store.clearSave();
    save = null;
  }
  $('#resume').hidden = !save;
  if (save) {
    const placed = save.state.pieces.filter((p) => p[2]).length;
    $('#resumeInfo').textContent = `${save.title} · ${LEVELS[save.level].name} · ${placed}/${save.state.pieces.length}조각 · ${clock(save.state.elapsed / 1000)}`;
    const box = $('#resumeThumb');
    box.replaceChildren();
    if (save.source.kind === 'art') box.append(thumb(paint(save.source.seed).canvas, 160));
    else {
      const data = store.loadPhoto();
      if (data) {
        const img = new Image();
        img.src = data;
        img.alt = '';
        box.append(img);
      }
    }
  }
}

$('#playDaily').addEventListener('click', () => openSetup(daily, dailyArt.canvas, `${dailyArt.title}`));
$('#playRandom').addEventListener('click', () => openRandom());
$('#playPhoto').addEventListener('click', () => $('#photoInput').click());
$('#openRecords').addEventListener('click', () => {
  enter('records');
  renderRecords(store.pref('level', 1));
});
$('#resume').addEventListener('click', resume);

function openRandom() {
  const seed = randomSeed();
  const art = paint(seed);
  openSetup({ kind: 'art', seed }, art.canvas, art.title);
}

// ── 내 사진 ────────────────────────────────────────────────
$('#photoInput').addEventListener('change', async (e) => {
  const file = e.target.files?.[0];
  e.target.value = '';
  if (!file) return;
  try {
    const image = await photoCanvas(file);
    openSetup({ kind: 'photo', cutSeed: randomSeed() }, image, '내 사진 퍼즐');
  } catch {
    toast('이 사진은 열 수 없어요. 다른 사진을 골라 주세요.');
  }
});

// 너무 길쭉한 사진은 가운데를 잘라 2:1 안쪽으로 맞추고, 긴 변을 800~1600px로 맞춰요.
async function photoCanvas(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    if (!iw || !ih) throw new Error('empty image');
    let sw = iw;
    let sh = ih;
    if (sw / sh > 2) sw = sh * 2;
    if (sh / sw > 2) sh = sw * 2;
    const long = Math.max(sw, sh);
    const k = Math.min(1600 / long, Math.max(1, 800 / long));
    const c = document.createElement('canvas');
    c.width = Math.round(sw * k);
    c.height = Math.round(sh * k);
    c.getContext('2d').drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// ── 퍼즐 준비 창 ───────────────────────────────────────────
function openSetup(source, image, title, level = store.pref('level', 1)) {
  setup = { source, image, title };
  const preview = thumb(image, 720);
  preview.setAttribute('role', 'img');
  preview.setAttribute('aria-label', `${title} 그림`);
  $('#setupPreview').replaceChildren(preview);
  $('#setupTitle').textContent = title;
  $('#setupReroll').hidden = !(source.kind === 'art' && !source.daily);
  const box = $('#levels');
  box.querySelectorAll('label').forEach((l) => l.remove());
  LEVELS.forEach((lv, i) => {
    const { cols, rows } = gridFor(lv.n, image.width / image.height);
    const label = document.createElement('label');
    label.innerHTML = `<input type="radio" name="level" value="${i}"><span><b>${lv.name}</b><small>${cols * rows}조각</small></span>`;
    label.querySelector('input').checked = i === level;
    box.append(label);
  });
  const dlg = $('#setup');
  if (!dlg.open) dlg.showModal();
  $('#setupStart').focus();
}

$('#setupReroll').addEventListener('click', () => {
  const level = Number($('#levels input:checked')?.value ?? 1);
  const seed = randomSeed();
  const art = paint(seed);
  openSetup({ kind: 'art', seed }, art.canvas, art.title, level);
});
$('#setupCancel').addEventListener('click', () => $('#setup').close());
$('#setupStart').addEventListener('click', () => {
  const level = Number($('#levels input:checked')?.value ?? 1);
  if (store.loadSave() && !confirm('이어하던 퍼즐이 있어요. 새 퍼즐을 시작하면 그 퍼즐은 사라져요. 시작할까요?')) return;
  store.setPref('level', level);
  $('#setup').close();
  startGame(setup, level);
});

// ── 퍼즐 판 ────────────────────────────────────────────────
function startGame({ source, image, title }, level, state = null) {
  current = { source, image, title, level };
  const { cols, rows } = gridFor(LEVELS[level].n, image.width / image.height);
  // 그림 퍼즐은 seed와 난이도가 같으면 조각 모양도 같아요. (같은 퍼즐로 기록 겨루기)
  const seed = source.kind === 'art' ? (source.seed ^ Math.imul(level + 1, 0x9e3779b1)) >>> 0 : source.cutSeed;
  if (document.body.dataset.screen !== 'game') enter('game');
  $('#hudTitle').textContent = title;
  $('#hudLevel').textContent = `${LEVELS[level].name} · ${cols * rows}조각`;
  $('#ghostBtn').setAttribute('aria-pressed', 'false');
  $('#live').textContent = '';
  game.start({ image, cols, rows, seed, state });
  if (!state) {
    store.clearSave();
    if (source.kind === 'photo') store.savePhoto(image.toDataURL('image/jpeg', 0.86));
  }
  saveNow();
}

function saveNow() {
  if (!current || game.done || !game.P) return;
  store.writeSave({ v: 1, source: current.source, title: current.title, level: current.level, state: game.snapshot(), at: Date.now() });
}

let saveTimer = 0;
function saveSoon() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 400);
}

async function resume() {
  const save = store.loadSave();
  if (!save) return refreshHome();
  let image;
  try {
    if (save.source.kind === 'art') image = paint(save.source.seed).canvas;
    else {
      const data = store.loadPhoto();
      if (!data) throw new Error('no photo');
      const img = await loadImage(data);
      image = thumb(img, img.naturalWidth);
    }
  } catch {
    toast('저장된 사진을 찾지 못해서 이어할 수 없어요.');
    store.clearSave();
    return refreshHome();
  }
  startGame({ source: save.source, image, title: save.title }, save.level, save.state);
}

setInterval(() => {
  if (document.body.dataset.screen === 'game' && game.P) $('#hudTime').textContent = clock(game.time / 1000);
}, 250);

$('#menuBtn').addEventListener('click', openPause);
$('#previewBtn').addEventListener('click', () => {
  if (!current) return;
  $('#previewArt').replaceChildren(thumb(current.image, 1200));
  $('#preview').showModal();
});
$('#previewClose').addEventListener('click', () => $('#preview').close());
$('#preview').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
});
$('#ghostBtn').addEventListener('click', () => {
  if (!game.hintUsed && !game.ghost) toast('밑그림을 켰어요. 이번 퍼즐 점수는 15% 줄어요.');
  $('#ghostBtn').setAttribute('aria-pressed', String(game.toggleGhost()));
});
$('#shuffleBtn').addEventListener('click', () => game.reshuffle());

addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.body.dataset.screen === 'game' && !document.querySelector('dialog[open]') && !game.done) {
    e.preventDefault();
    openPause();
  }
});

// ── 일시정지 ───────────────────────────────────────────────
function soundLabel() {
  $('#pauseSound').textContent = sound.isMuted() ? '🔇 소리 꺼짐' : '🔊 소리 켜짐';
}

function openPause() {
  if (game.done) return;
  game.pause();
  saveNow();
  $('#pauseInfo').textContent = `${game.placedCount}/${game.total}조각 · ${clock(game.time / 1000)} · 실수 ${game.mistakes}번`;
  soundLabel();
  $('#pause').showModal();
}

$('#pause').addEventListener('close', () => {
  if (document.body.dataset.screen === 'game' && !document.hidden) game.resume();
});
$('#pauseResume').addEventListener('click', () => $('#pause').close());
$('#pauseRestart').addEventListener('click', () => {
  if (!confirm('맞춘 조각을 모두 흩어 놓고 처음부터 할까요?')) return;
  $('#pause').close();
  startGame(current, current.level);
});
$('#pauseSound').addEventListener('click', () => {
  sound.setMuted(!sound.isMuted());
  store.setPref('muted', sound.isMuted());
  soundLabel();
});
$('#pauseHome').addEventListener('click', goHome);

document.addEventListener('visibilitychange', () => {
  if (document.body.dataset.screen !== 'game') return;
  if (document.hidden) {
    game.pause();
    saveNow();
  } else if (!document.querySelector('dialog[open]')) game.resume();
});
addEventListener('pagehide', saveNow);

// ── 완성 ───────────────────────────────────────────────────
function onComplete(stats) {
  const r = scoreOf(stats);
  const rec = {
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    level: current.level,
    pieces: stats.pieces,
    title: current.title,
    kind: current.source.kind,
    seed: current.source.kind === 'art' ? current.source.seed : null,
    daily: current.source.daily || null,
    seconds: stats.seconds,
    mistakes: stats.mistakes,
    accuracy: r.accuracy,
    score: r.score,
    hint: stats.hintUsed,
    thumb: thumb(current.image, 160).toDataURL('image/jpeg', 0.7),
  };
  const { isBest, prevBest } = store.addRecord(rec);
  store.clearSave();
  lastResult = { ...rec, stars: r.stars };
  if (document.body.dataset.screen !== 'game') return; // 연출 중에 나가 버렸으면 기록만 남겨요.

  $('#doneArt').replaceChildren(thumb(current.image, 720));
  $('#doneStars').textContent = '★'.repeat(r.stars) + '☆'.repeat(3 - r.stars);
  $('#doneStars').setAttribute('aria-label', `별 ${r.stars}개`);
  $('#doneBest').hidden = !isBest;
  $('#doneBest').textContent = prevBest ? `🏅 ${LEVELS[current.level].name} 새 최고 기록! (이전 ${prevBest.toLocaleString()}점)` : `🏅 ${LEVELS[current.level].name} 첫 기록!`;
  $('#doneTime').textContent = koTime(stats.seconds);
  $('#doneAcc').textContent = `${Math.round(r.accuracy * 100)}%`;
  $('#doneScore').textContent = r.score.toLocaleString();
  const notes = [`실수 ${stats.mistakes}번`, `기준 시간 ${koTime(r.par)}`];
  if (stats.hintUsed) notes.push('밑그림 사용 (−15%)');
  $('#doneNote').textContent = notes.join(' · ');
  $('#done').showModal();
}

$('#doneAgain').addEventListener('click', () => {
  $('#done').close();
  startGame(current, current.level);
});
$('#doneHome').addEventListener('click', () => {
  $('#done').close();
  goHome();
});
$('#done').addEventListener('cancel', (e) => {
  e.preventDefault();
  $('#done').close();
  goHome();
});
$('#doneShare').addEventListener('click', share);

function shareURL(source, level) {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  if (source?.kind === 'art') {
    url.searchParams.set('seed', source.seed);
    url.searchParams.set('level', level);
  }
  return url.toString();
}

async function share() {
  const r = lastResult;
  const url = shareURL(current.source, current.level);
  const what = current.source.kind === 'art' ? `"${current.title}" ${r.pieces}조각` : `내 사진 퍼즐 ${r.pieces}조각`;
  const text = `조각조각 퍼즐 ${what}을 ${koTime(r.seconds)} 만에 맞췄어요! ${r.score.toLocaleString()}점 ${'★'.repeat(r.stars)}`;
  if (navigator.share) {
    try {
      await navigator.share({ title: '조각조각 퍼즐', text, url });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    toast('자랑할 문구와 링크를 복사했어요.');
  } catch {
    window.prompt('아래 링크를 복사해 주세요.', `${text} ${url}`);
  }
}

// ── 기록 ───────────────────────────────────────────────────
let recordLevel = 1;

function recItem(r, rank) {
  const li = document.createElement('li');
  li.className = 'rec';
  const when = new Date(r.at);
  const img = r.thumb ? `<img src="${r.thumb}" alt="">` : '<span class="noimg" aria-hidden="true">🧩</span>';
  li.innerHTML = `
    <span class="rank">${rank ?? ''}</span>${img}
    <span class="rec-main"><b></b><small></small></span>
    <span class="rec-score">${r.score.toLocaleString()}<small>점</small></span>`;
  li.querySelector('b').textContent = r.title;
  li.querySelector('.rec-main small').textContent =
    `${LEVELS[r.level]?.name ?? ''} ${r.pieces}조각 · ${koTime(r.seconds)} · 정확도 ${Math.round(r.accuracy * 100)}%${r.hint ? ' · 밑그림' : ''} · ${when.getMonth() + 1}/${when.getDate()}`;
  return li;
}

function renderRecords(level) {
  recordLevel = level;
  const tabs = $('#recordTabs');
  tabs.replaceChildren(
    ...LEVELS.map((lv, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.role = 'tab';
      b.className = 'btn';
      b.textContent = `${lv.name} ${lv.n}`;
      b.setAttribute('aria-selected', String(i === level));
      b.addEventListener('click', () => renderRecords(i));
      return b;
    }),
  );
  const all = store.getRecords();
  const best = all
    .filter((r) => r.level === level)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);
  const empty = (text) => Object.assign(document.createElement('li'), { className: 'empty', textContent: text });
  $('#bestList').replaceChildren(...(best.length ? best.map((r, i) => recItem(r, i + 1)) : [empty(`아직 ${LEVELS[level].name} 기록이 없어요. 첫 기록을 세워 보세요!`)]));
  const recent = [...all].sort((a, b) => b.at - a.at).slice(0, 10);
  $('#recentList').replaceChildren(...(recent.length ? recent.map((r) => recItem(r)) : [empty('완성한 퍼즐이 여기에 모여요.')]));
}

$('#recordsBack').addEventListener('click', goHome);
$('#clearRecords').addEventListener('click', () => {
  if (!confirm('이 기기에 저장된 기록을 모두 지울까요?')) return;
  store.clearRecords();
  renderRecords(recordLevel);
});

// ── 앱 설치 (PWA) ──────────────────────────────────────────
let installPrompt = null;
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e;
  $('#install').hidden = false;
});
$('#install').addEventListener('click', async () => {
  if (!installPrompt) return;
  installPrompt.prompt();
  await installPrompt.userChoice;
  installPrompt = null;
  $('#install').hidden = true;
});
addEventListener('appinstalled', () => ($('#install').hidden = true));

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// ── 시작 ───────────────────────────────────────────────────
// 친구가 공유한 링크(?seed=…&level=…)로 들어오면 그 퍼즐을 바로 띄워요.
const params = new URLSearchParams(location.search);
history.replaceState(null, '', location.pathname);
show('home');
refreshHome();
if (params.has('seed')) {
  const seed = Number(params.get('seed')) >>> 0;
  const level = Math.min(LEVELS.length - 1, Math.max(0, Number(params.get('level')) || 0));
  const art = paint(seed);
  openSetup({ kind: 'art', seed }, art.canvas, art.title, level);
}
