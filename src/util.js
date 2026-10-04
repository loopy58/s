// 공용 도우미: 난수, 한국어 조사, DOM 생성 등

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function shuffle(arr, rand = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 받침 유무에 따라 조사를 고릅니다. 괄호나 기호로 끝나는 단어는 그 앞 글자를 봅니다.
export function josa(word, pair) {
  const [withBatchim, withoutBatchim] = pair.split('/');
  const clean = String(word).replace(/\([^)]*\)\s*$/, '').replace(/[^가-힣A-Za-z0-9]+$/, '');
  const last = clean.charCodeAt(clean.length - 1);
  let has = false;
  if (last >= 0xac00 && last <= 0xd7a3) {
    const jong = (last - 0xac00) % 28;
    // '으로/로' 는 ㄹ 받침일 때 '로'
    if (pair === '으로/로') has = jong !== 0 && jong !== 8;
    else has = jong !== 0;
  } else if (/[0-9]$/.test(clean)) {
    has = '013678'.includes(clean.slice(-1));
  } else if (/[A-Za-z]$/.test(clean)) {
    has = /[lmnrLMNR]$/.test(clean);
  }
  return word + (has ? withBatchim : withoutBatchim);
}

export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'style' && typeof v === 'object') {
      for (const [sk, sv] of Object.entries(v)) {
        if (sk.startsWith('--')) node.style.setProperty(sk, sv);
        else node.style[sk] = sv;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// *강조* 표기를 <b class="em"> 로 바꿉니다. 이스케이프한 뒤 <b> 태그만 되살려요.
export function rich(text) {
  const esc = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return esc
    .replace(/&lt;(\/?)b&gt;/g, '<$1b>')
    .replace(/\*([^*]+)\*/g, '<b class="em">$1</b>')
    .replace(/\n/g, '<br>');
}

export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}
