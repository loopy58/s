// 카툰 셰이딩 재질과 기본 도형 도우미
import * as THREE from 'three';

const gradient = (() => {
  const data = new Uint8Array([110, 185, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
})();

const matCache = new Map();

// 같은 색·옵션의 재질은 하나만 만들어 공유합니다(정적 메시 합치기에도 유리).
export function toon(color, opts = {}) {
  const key = `${color}|${opts.flat ? 1 : 0}|${opts.emissive || ''}|${opts.opacity ?? 1}|${opts.side || 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshToonMaterial({
      color: new THREE.Color(color),
      gradientMap: gradient,
      emissive: opts.emissive ? new THREE.Color(opts.emissive) : new THREE.Color(0x000000),
      emissiveIntensity: opts.emissive ? (opts.emissiveIntensity ?? 0.6) : 0,
      transparent: (opts.opacity ?? 1) < 1,
      opacity: opts.opacity ?? 1,
      side: opts.side || THREE.FrontSide,
    });
    // 툰 재질은 flatShading을 지원하지 않아서, 정적 메시를 합칠 때 면 법선을 다시 계산해요.
    m.userData.flat = !!opts.flat;
    m.userData.shared = true;
    matCache.set(key, m);
  }
  return m;
}

export function texturedToon(texture, color = '#ffffff') {
  return new THREE.MeshToonMaterial({ map: texture, color: new THREE.Color(color), gradientMap: gradient });
}

export function basic(color, opts = {}) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color), ...opts });
}

const geoCache = new Map();
function cached(key, make) {
  let g = geoCache.get(key);
  if (!g) {
    g = make();
    g.userData.shared = true;
    geoCache.set(key, g);
  }
  return g;
}

// 지역을 바꿀 때 그 지역에서만 쓰던 지오메트리·재질·텍스처를 해제해요(공유 자원은 남겨 둠).
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    for (const m of mats) {
      if (m.userData?.shared) continue;
      if (m.map && !m.map.userData?.shared) m.map.dispose();
      m.dispose();
    }
  });
}

export const G = {
  box: (w, h, d) => cached(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  sphere: (r, ws = 16, hs = 12) => cached(`sph${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
  cyl: (rt, rb, h, s = 12) => cached(`cyl${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s)),
  cone: (r, h, s = 12) => cached(`cone${r},${h},${s}`, () => new THREE.ConeGeometry(r, h, s)),
  ico: (r, d = 0) => cached(`ico${r},${d}`, () => new THREE.IcosahedronGeometry(r, d)),
  dodeca: (r) => cached(`dod${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  torus: (r, t, rs = 8, ts = 20, arc = Math.PI * 2) => cached(`tor${r},${t},${rs},${ts},${arc}`, () => new THREE.TorusGeometry(r, t, rs, ts, arc)),
  capsule: (r, l, cs = 6, rs = 10) => cached(`cap${r},${l},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, l, cs, rs)),
  circle: (r, s = 24) => cached(`cir${r},${s}`, () => new THREE.CircleGeometry(r, s)),
};

export function mesh(geo, material, x = 0, y = 0, z = 0, opts = {}) {
  const m = new THREE.Mesh(geo, typeof material === 'string' ? toon(material) : material);
  m.position.set(x, y, z);
  if (opts.rx) m.rotation.x = opts.rx;
  if (opts.ry) m.rotation.y = opts.ry;
  if (opts.rz) m.rotation.z = opts.rz;
  if (opts.s) {
    if (Array.isArray(opts.s)) m.scale.set(...opts.s);
    else m.scale.setScalar(opts.s);
  }
  m.castShadow = opts.shadow !== false;
  m.receiveShadow = !!opts.receive;
  return m;
}

// 삼각기둥 지붕: 너비(x) w, 높이 h, 길이(z) len
export function gableGeo(w, h, len) {
  return cached(`gable${w},${h},${len}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, 0);
    s.lineTo(w / 2, 0);
    s.lineTo(0, h);
    s.lineTo(-w / 2, 0);
    const g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    return g;
  });
}

// 사각뿔 지붕(모임지붕)
export function hipGeo(w, h, d) {
  return cached(`hip${w},${h},${d}`, () => {
    const g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4, 1);
    g.rotateY(Math.PI / 4);
    g.scale(w, h, d);
    g.translate(0, h / 2, 0);
    return g;
  });
}

// 글자·그림을 그린 캔버스 텍스처
export function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export const FONT_UI = '"Jua", "Gowun Dodum", "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", "WenQuanYi Zen Hei", sans-serif';

export function signTexture(text, { bg = '#ffffff', fg = '#333333', w = 512, h = 128, border = null, size = 72 } = {}) {
  return canvasTexture(w, h, (ctx) => {
    ctx.fillStyle = bg;
    const r = h * 0.22;
    ctx.beginPath();
    ctx.roundRect(4, 4, w - 8, h - 8, r);
    ctx.fill();
    if (border) {
      ctx.lineWidth = 8;
      ctx.strokeStyle = border;
      ctx.stroke();
    }
    ctx.fillStyle = fg;
    ctx.font = `${size}px ${FONT_UI}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    let s = size;
    while (ctx.measureText(text).width > w - 40 && s > 20) {
      s -= 4;
      ctx.font = `${s}px ${FONT_UI}`;
    }
    ctx.fillText(text, w / 2, h / 2 + 4);
  });
}

// 정적 메시를 재질별로 합쳐서 드로우콜을 줄입니다.
export function bakeStatic(root, mergeFn) {
  root.updateMatrixWorld(true);
  const groups = new Map();
  const keep = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.dynamic) return;
    const key = o.material.uuid + (o.castShadow ? 's' : '') + (o.receiveShadow ? 'r' : '');
    let arr = groups.get(key);
    if (!arr) { arr = { material: o.material, cast: o.castShadow, receive: o.receiveShadow, geos: [] }; groups.set(key, arr); }
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    if (!o.material.map) g.deleteAttribute('uv');
    if (g.attributes.uv1) g.deleteAttribute('uv1');
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    if (o.material.userData.flat) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    arr.geos.push(g);
    keep.push(o);
  });
  for (const o of keep) o.parent && o.parent.remove(o);
  const out = new THREE.Group();
  for (const { material, cast, receive, geos } of groups.values()) {
    const merged = mergeFn(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, material);
    m.castShadow = cast;
    m.receiveShadow = receive;
    m.userData.baked = true;
    out.add(m);
    geos.forEach((g) => g.dispose());
  }
  return out;
}
