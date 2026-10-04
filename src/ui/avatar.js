// 진료 카드에 쓰는 환자 얼굴 그림(SVG)
export function avatarSVG(look = {}, sick = null, healed = false) {
  const skin = look.skin || '#f1c9a5';
  const hair = look.hair || '#2b1d16';
  const top = look.top || '#5c8dd6';
  const style = look.style || 'short';
  const hat = look.hat || '';
  const parts = [];
  parts.push(`<circle cx="60" cy="60" r="58" fill="${healed ? '#dcf3e8' : '#e7f4fb'}"/>`);
  parts.push(`<path d="M22 118 C24 92 40 84 60 84 C80 84 96 92 98 118 Z" fill="${top}"/>`);
  // 뒷머리
  if (style === 'long' || style === 'bob') parts.push(`<path d="M28 58 C28 30 92 30 92 58 L94 ${style === 'long' ? 92 : 76} L26 ${style === 'long' ? 92 : 76} Z" fill="${hair}"/>`);
  if (style === 'afro') parts.push(`<circle cx="60" cy="44" r="34" fill="${hair}"/>`);
  if (style === 'bun') parts.push(`<circle cx="60" cy="18" r="9" fill="${hair}"/>`);
  if (style === 'twin') parts.push(`<circle cx="30" cy="52" r="8" fill="${hair}"/><circle cx="90" cy="52" r="8" fill="${hair}"/>`);
  parts.push(`<circle cx="60" cy="56" r="28" fill="${skin}"/>`);
  parts.push(`<circle cx="32" cy="58" r="5" fill="${skin}"/><circle cx="88" cy="58" r="5" fill="${skin}"/>`);
  // 앞머리
  if (style === 'bald') parts.push(`<path d="M33 52 Q34 40 40 36 M87 52 Q86 40 80 36" stroke="${hair}" stroke-width="5" fill="none" stroke-linecap="round"/>`);
  else if (style === 'perm') parts.push(`<g fill="${hair}"><circle cx="40" cy="36" r="9"/><circle cx="52" cy="30" r="9"/><circle cx="66" cy="30" r="9"/><circle cx="79" cy="36" r="9"/><circle cx="34" cy="46" r="7"/><circle cx="86" cy="46" r="7"/></g>`);
  else if (style !== 'afro') parts.push(`<path d="M31 54 C30 30 90 30 89 54 C82 42 70 40 60 46 C50 38 38 42 31 54 Z" fill="${hair}"/>`);
  if (style === 'pony') parts.push(`<circle cx="86" cy="40" r="6" fill="#e57373"/>`);
  // 모자
  const hats = {
    cap: `<path d="M32 46 C32 22 88 22 88 46 Z" fill="#e53935"/><rect x="52" y="42" width="40" height="6" rx="3" fill="#c62828"/>`,
    helmet: `<path d="M29 50 C29 18 91 18 91 50 Z" fill="#fdd835"/>`,
    straw: `<ellipse cx="60" cy="36" rx="44" ry="7" fill="#e9c46a"/><path d="M40 36 C40 18 80 18 80 36 Z" fill="#e9c46a"/><rect x="40" y="31" width="40" height="4" fill="#d62828"/>`,
    farmer: `<ellipse cx="60" cy="36" rx="44" ry="7" fill="#e9c46a"/><path d="M40 36 C40 18 80 18 80 36 Z" fill="#e9c46a"/><rect x="40" y="31" width="40" height="4" fill="#e76f51"/>`,
    sunhat: `<ellipse cx="60" cy="36" rx="44" ry="7" fill="#fff3c4"/><path d="M40 36 C40 18 80 18 80 36 Z" fill="#fff3c4"/>`,
    nurse: `<path d="M44 34 L76 34 L72 22 L48 22 Z" fill="#fff"/><path d="M58 25 h4 v6 h-4z M57 26 h6 v4 h-6z" fill="#4fb3a9"/>`,
    chef: `<rect x="40" y="18" width="40" height="18" rx="4" fill="#fff"/><circle cx="48" cy="16" r="10" fill="#fff"/><circle cx="72" cy="16" r="10" fill="#fff"/><circle cx="60" cy="12" r="11" fill="#fff"/>`,
    kufi: `<path d="M38 40 C38 26 82 26 82 40 Z" fill="#fafafa"/>`,
    ghutra: `<path d="M26 92 L28 50 C28 20 92 20 92 50 L94 92 L82 90 L80 56 C76 44 44 44 40 56 L38 90 Z" fill="#fafafa"/><ellipse cx="60" cy="34" rx="30" ry="5" fill="none" stroke="#2a2321" stroke-width="4"/>`,
    ghutra_red: `<path d="M26 92 L28 50 C28 20 92 20 92 50 L94 92 L82 90 L80 56 C76 44 44 44 40 56 L38 90 Z" fill="#e9a3a3"/><ellipse cx="60" cy="34" rx="30" ry="5" fill="none" stroke="#2a2321" stroke-width="4"/>`,
    scarf_teal: `<path d="M24 100 L28 50 C28 18 92 18 92 50 L96 100 L80 100 L80 58 C76 42 44 42 40 58 L40 100 Z" fill="#26a69a"/>`,
    scarf_pink: `<path d="M24 100 L28 50 C28 18 92 18 92 50 L96 100 L80 100 L80 58 C76 42 44 42 40 58 L40 100 Z" fill="#f48fb1"/>`,
    scarf_orange: `<path d="M24 100 L28 50 C28 18 92 18 92 50 L96 100 L80 100 L80 58 C76 42 44 42 40 58 L40 100 Z" fill="#ff8a65"/>`,
    headwrap: `<path d="M30 46 C26 16 94 16 90 46 C80 36 40 36 30 46 Z" fill="#ff9800"/><circle cx="70" cy="18" r="8" fill="#ff9800"/>`,
    headwrap_red: `<path d="M30 46 C26 16 94 16 90 46 C80 36 40 36 30 46 Z" fill="#e53935"/><circle cx="70" cy="18" r="8" fill="#e53935"/>`,
    non_la: `<path d="M14 40 L60 10 L106 40 Z" fill="#f2dfa7"/>`,
  };
  if (hats[hat]) parts.push(hats[hat]);
  // 얼굴
  const flushed = sick === 'flushed';
  parts.push(`<ellipse cx="49" cy="58" rx="3.6" ry="5" fill="#2a2321"/><ellipse cx="71" cy="58" rx="3.6" ry="5" fill="#2a2321"/>`);
  parts.push(`<circle cx="50.3" cy="56" r="1.3" fill="#fff"/><circle cx="72.3" cy="56" r="1.3" fill="#fff"/>`);
  parts.push(`<ellipse cx="42" cy="68" rx="6" ry="3.4" fill="${flushed ? '#ff5a5a' : '#ffaaa5'}" opacity="${flushed ? 0.8 : 0.6}"/><ellipse cx="78" cy="68" rx="6" ry="3.4" fill="${flushed ? '#ff5a5a' : '#ffaaa5'}" opacity="${flushed ? 0.8 : 0.6}"/>`);
  if (sick && !healed) parts.push(`<path d="M53 73 Q56.5 70 60 73 Q63.5 76 67 73" stroke="#2a2321" stroke-width="2" fill="none" stroke-linecap="round"/>`);
  else parts.push(`<path d="M54 71 Q60 77 66 71" stroke="#2a2321" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
  if (look.acc === 'glasses') parts.push(`<g stroke="#2a2321" stroke-width="2" fill="none"><circle cx="49" cy="58" r="7"/><circle cx="71" cy="58" r="7"/><path d="M56 58 h8"/></g>`);
  if (look.acc === 'beard') parts.push(`<path d="M40 70 C42 90 78 90 80 70 C74 80 46 80 40 70 Z" fill="#2b2622"/>`);
  if (!healed && sick) {
    if (sick === 'rash') parts.push(`<g fill="#e04848">${[[44, 48], [76, 47], [38, 62], [82, 63], [52, 80], [68, 81], [60, 44], [46, 76], [74, 74]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.8"/>`).join('')}</g>`);
    if (sick === 'pox') parts.push(`<g fill="#ff7b7b" stroke="#fff" stroke-width="0.8">${[[42, 46], [78, 50], [62, 42], [38, 64], [80, 66], [56, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.6"/>`).join('')}</g>`);
    if (sick === 'pale') parts.push(`<path d="M46 40 v6 M52 39 v7 M58 38 v7" stroke="#7a9ac2" stroke-width="2" stroke-linecap="round" opacity=".7"/>`);
    if (sick === 'flushed' || sick === 'pale') parts.push(`<path d="M88 30 C84 38 84 42 88 42 C92 42 92 38 88 30 Z" fill="#7cc7f2" stroke="#fff" stroke-width="1"/>`);
    parts.push(`<g transform="translate(92 70) rotate(25)"><rect x="-3" y="-16" width="6" height="26" rx="3" fill="#fff" stroke="#b0bec5"/><circle cx="0" cy="12" r="5" fill="#ff5252"/><rect x="-1.2" y="-6" width="2.4" height="16" fill="#ff5252"/></g>`);
  }
  if (healed) parts.push(`<path d="M94 22 c-4 -6 -12 -2 -8 5 l8 8 l8 -8 c4 -7 -4 -11 -8 -5z" fill="#ff6b81"/>`);
  return `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="환자 얼굴">${parts.join('')}</svg>`;
}
