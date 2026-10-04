// 여행 지도: 목적지와 이동수단(바이크·자동차 / 여객기·제트기)을 고릅니다.
import { el } from '../util.js';
import { REGIONS, REGION_ORDER, VEHICLES, INCHEON } from '../data/regions.js';
import { DISEASES } from '../data/diseases.js';
import { CONTINENTS, KOREA, pointInPoly, haversineKm } from '../data/geo.js';
import { sfx } from '../audio.js';

const VIEWS = {
  world: { lon: [-28, 152], lat: [-42, 60], step: 2.2, polys: CONTINENTS, dot: 0.42 },
  korea: { lon: [121.8, 134.2], lat: [32.8, 41.0], step: 0.17, polys: KOREA, dot: 0.42 },
};

export function tripInfo(fromId, toId) {
  const a = REGIONS[fromId];
  const b = REGIONS[toId];
  const air = !(a.domestic && b.domestic);
  let km;
  let fromCode;
  let toCode;
  if (!air) {
    km = Math.round(haversineKm(a.lonlat, b.lonlat) * 1.3);
  } else {
    const p1 = a.domestic ? INCHEON.lonlat : a.lonlat;
    const p2 = b.domestic ? INCHEON.lonlat : b.lonlat;
    km = Math.round(haversineKm(p1, p2));
    fromCode = a.domestic ? INCHEON.code : a.airport;
    toCode = b.domestic ? INCHEON.code : b.airport;
  }
  return { air, km, fromCode, toCode, from: a, to: b };
}

export function hoursText(h) {
  const hh = Math.floor(h);
  const mm = Math.round((h - hh) * 60);
  if (hh === 0) return `약 ${Math.max(5, mm)}분`;
  return mm ? `약 ${hh}시간 ${mm}분` : `약 ${hh}시간`;
}

export class TravelMap {
  constructor(root, input) {
    this.root = root;
    this.input = input;
  }

  open(currentId, save) {
    return new Promise((resolve) => {
      const cur = REGIONS[currentId];
      const badges = Object.keys(save.badges).length;
      let view = cur.domestic ? 'korea' : 'world';
      let selected = null;
      let vehicle = null;
      const back = el('div', { class: 'modal-back' });
      const canvas = el('canvas', { width: 960, height: 600 });
      const pins = el('div');
      const mapWrap = el('div', { class: 'map-wrap' }, canvas, pins);
      const tabs = el('div', { class: 'tabs' });
      const list = el('div', { class: 'dest-list' });
      const depart = el('div', { class: 'depart' });
      const close = () => {
        offs.forEach((f) => f());
        back.remove();
        resolve(null);
      };
      const sheet = el('div', { class: 'sheet travel', role: 'dialog', 'aria-label': '여행 지도' },
        el('div', { class: 'sheet-head' }, el('h2', {}, '🗺️ 어디로 떠날까요?'), tabs, el('button', { class: 'close-x', 'aria-label': '닫기', onclick: () => { sfx('cancel'); close(); } }, '✕')),
        el('div', { class: 'sheet-body' }, el('div', { class: 'travel-body' }, el('div', {}, mapWrap, depart), list)),
      );
      back.append(sheet);
      back.addEventListener('pointerdown', (e) => { if (e.target === back) close(); });
      this.root.append(back);
      const offs = [this.input.on('cancel', () => { close(); return true; }), this.input.on('action', () => false)];

      const progress = (r) => {
        const done = r.diseases.filter((d) => save.cleared[d]).length;
        return { done, total: r.diseases.length };
      };

      const drawMap = () => {
        const v = VIEWS[view];
        const ctx = canvas.getContext('2d');
        const W = canvas.width;
        const H = canvas.height;
        const sea = ctx.createLinearGradient(0, 0, 0, H);
        sea.addColorStop(0, '#8fd3f4');
        sea.addColorStop(1, '#6cc2ee');
        ctx.fillStyle = sea;
        ctx.fillRect(0, 0, W, H);
        const [l0, l1] = v.lon;
        const [a0, a1] = v.lat;
        const px = (lon) => ((lon - l0) / (l1 - l0)) * W;
        const py = (lat) => ((a1 - lat) / (a1 - a0)) * H;
        const cell = (v.step / (l1 - l0)) * W;
        for (let lat = a1; lat >= a0; lat -= v.step) {
          for (let lon = l0; lon <= l1; lon += v.step) {
            if (v.polys.some((p) => pointInPoly(lon, lat, p))) {
              ctx.fillStyle = '#fff8e3';
              ctx.beginPath();
              ctx.arc(px(lon), py(lat), cell * v.dot, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
        if (selected && selected !== currentId) {
          const a = REGIONS[currentId];
          const b = REGIONS[selected];
          let p1 = a.lonlat;
          let p2 = b.lonlat;
          if (view === 'world') {
            if (a.domestic) p1 = INCHEON.lonlat;
            if (b.domestic) p2 = INCHEON.lonlat;
          }
          const x1 = px(p1[0]);
          const y1 = py(p1[1]);
          const x2 = px(p2[0]);
          const y2 = py(p2[1]);
          const mx = (x1 + x2) / 2;
          const my = Math.min(y1, y2) - Math.hypot(x2 - x1, y2 - y1) * 0.25;
          ctx.setLineDash([10, 8]);
          ctx.lineWidth = 4;
          ctx.strokeStyle = '#e0623a';
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.quadraticCurveTo(mx, my, x2, y2);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        // 핀
        pins.replaceChildren();
        const place = (lonlat, label, icon, cls, onClick) => {
          const x = ((lonlat[0] - l0) / (l1 - l0)) * 100;
          const y = ((a1 - lonlat[1]) / (a1 - a0)) * 100;
          const b = el('button', { class: `pin ${cls}`, style: { left: `${x}%`, top: `${y}%` }, onclick: onClick, 'aria-label': label }, el('i', {}, el('em', {}, icon)), el('span', {}, label));
          pins.append(b);
        };
        if (view === 'world') {
          for (const id of REGION_ORDER) {
            const r = REGIONS[id];
            if (r.domestic) continue;
            const p = progress(r);
            place(r.lonlat, r.city, p.done === p.total ? '★' : r.flag, `${p.done === p.total ? 'done' : ''} ${id === currentId ? 'here' : ''} ${id === selected ? 'sel' : ''}`, () => select(id));
          }
          const kd = REGION_ORDER.filter((id) => REGIONS[id].domestic);
          const done = kd.every((id) => progress(REGIONS[id]).done === progress(REGIONS[id]).total);
          place([127.5, 36.8], '대한민국', done ? '★' : '🇰🇷', `${done ? 'done' : ''} ${cur.domestic ? 'here' : ''}`, () => { view = 'korea'; renderTabs(); drawMap(); });
        } else {
          for (const id of REGION_ORDER) {
            const r = REGIONS[id];
            if (!r.domestic) continue;
            const p = progress(r);
            place(r.lonlat, r.city, p.done === p.total ? '★' : '📍', `${p.done === p.total ? 'done' : ''} ${id === currentId ? 'here' : ''} ${id === selected ? 'sel' : ''}`, () => select(id));
          }
          // 서울 핀과 겹치지 않도록 조금 서쪽 바다에 표시해요.
          place([125.3, 37.1], '인천공항', '✈️', '', () => { view = 'world'; renderTabs(); drawMap(); });
        }
      };

      const renderTabs = () => {
        tabs.replaceChildren(
          el('button', { class: `tab ${view === 'korea' ? 'on' : ''}`, onclick: () => { view = 'korea'; renderTabs(); drawMap(); } }, '🇰🇷 국내'),
          el('button', { class: `tab ${view === 'world' ? 'on' : ''}`, onclick: () => { view = 'world'; renderTabs(); drawMap(); } }, '🌏 해외'),
        );
      };

      const renderList = () => {
        list.replaceChildren();
        for (const id of REGION_ORDER) {
          const r = REGIONS[id];
          const p = progress(r);
          const names = r.diseases.map((d) => (save.discovered[d] ? DISEASES[d].short : '???')).join(', ');
          list.append(el('button', { class: `dest ${id === selected ? 'sel' : ''} ${id === currentId ? 'here' : ''}`, onclick: () => select(id) },
            el('span', { class: 'fl', 'aria-hidden': 'true' }, r.flag),
            el('span', {}, el('div', { class: 'nm' }, r.name), el('div', { class: 'sub' }, `${r.country} · ${names}`)),
            el('span', { class: 'prog' }, id === currentId ? '현재 위치' : p.done === p.total ? '✔ 완료' : `${p.done}/${p.total}`),
          ));
        }
      };

      const renderDepart = () => {
        depart.replaceChildren();
        if (!selected) {
          depart.append(el('div', { class: 'route-line' }, `📍 현재 위치: ${cur.name}`), el('div', { style: { fontSize: '14px', color: 'var(--ink-soft)', lineHeight: '1.6' } }, '지도나 목록에서 목적지를 고르세요. 가까운 국내 지역은 바이크·자동차로, 먼 나라는 비행기로 이동해요.'));
          return;
        }
        if (selected === currentId) {
          depart.append(el('div', { class: 'route-line' }, `지금 ${cur.name}에 있어요.`));
          return;
        }
        const info = tripInfo(currentId, selected);
        const opts = info.air ? ['plane', 'jet'] : ['bike', 'car'];
        if (!vehicle || !opts.includes(vehicle)) vehicle = opts.find((o) => badges >= VEHICLES[o].need);
        const to = REGIONS[selected];
        depart.append(
          el('div', { class: 'route-line' }, `${cur.name} → ${to.flag} ${to.name}`),
          el('div', { style: { fontSize: '14px', color: 'var(--ink-soft)' } }, info.air ? `✈️ ${info.fromCode} → ${info.toCode} · 비행 거리 약 ${info.km.toLocaleString()}km` : `🛣️ 도로 거리 약 ${info.km.toLocaleString()}km`),
          el('div', { class: 'vehicles' }, ...opts.map((o) => {
            const V = VEHICLES[o];
            const locked = badges < V.need;
            const h = info.km / V.speed + (info.air ? 0.5 : 0);
            return el('button', { class: `veh ${vehicle === o ? 'sel' : ''}`, disabled: locked, onclick: () => { vehicle = o; sfx('select'); renderDepart(); } },
              el('span', { class: 'vi', 'aria-hidden': 'true' }, locked ? '🔒' : V.icon), V.name,
              el('small', {}, locked ? `원정 배지 ${V.need}개 필요` : hoursText(h)),
            );
          })),
          el('button', { class: 'btn sun', onclick: () => { offs.forEach((f) => f()); back.remove(); sfx('confirm'); resolve({ dest: selected, vehicle }); } }, '출발!'),
        );
      };

      const select = (id) => {
        selected = id;
        sfx('select');
        const r = REGIONS[id];
        if (r.domestic && view === 'world' && cur.domestic) view = 'korea';
        if (!r.domestic) view = 'world';
        renderTabs();
        renderList();
        renderDepart();
        drawMap();
      };

      renderTabs();
      renderList();
      renderDepart();
      drawMap();
    });
  }
}
