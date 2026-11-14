/**
 * Sprite SVG injecté une seule fois dans le document : gemmes taillées,
 * illustrations des cartes (mine, route marchande, joaillerie) et portraits
 * des nobles. Les éléments du jeu y font référence avec <use href="#…">, ce
 * qui garde le HTML rendu léger malgré les redessins complets.
 */

const r = (n) => Math.round(n * 100) / 100;

function polygon(n, rx, ry = rx, rot = -Math.PI / 2, cx = 20, cy = 20) {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / n;
    return [r(cx + rx * Math.cos(a)), r(cy + ry * Math.sin(a))];
  });
}

/** Polygone « émeraude » : rectangle aux coins coupés. */
function stepCut(w, h, c) {
  const x0 = 20 - w / 2;
  const y0 = 20 - h / 2;
  const x1 = 20 + w / 2;
  const y1 = 20 + h / 2;
  return [
    [x0 + c, y0],
    [x1 - c, y0],
    [x1, y0 + c],
    [x1, y1 - c],
    [x1 - c, y1],
    [x0 + c, y1],
    [x0, y1 - c],
    [x0, y0 + c],
  ];
}

const pts = (list) => list.map((p) => p.join(',')).join(' ');
const SHADES = ['#fff6', '#0003', '#fff3', '#0005', '#fff4', '#0002'];

/** Gemme facettée : couronne de facettes entre le contour et la table. */
function facetGem(id, outer, inner) {
  const facets = outer
    .map((p, i) => {
      const q = outer[(i + 1) % outer.length];
      const qi = inner[(i + 1) % inner.length];
      const pi = inner[i];
      return `<polygon points="${pts([p, q, qi, pi])}" fill="${SHADES[i % SHADES.length]}"/>`;
    })
    .join('');
  return `
    <symbol id="gem-${id}" viewBox="0 0 40 40">
      <polygon points="${pts(outer)}" fill="currentColor"/>
      ${facets}
      <polygon points="${pts(inner)}" fill="url(#gem-table)"/>
      <polygon points="${pts(outer)}" fill="none" stroke="#0007" stroke-width="1.2" stroke-linejoin="round"/>
      <path d="M14 13 l3 -1 l-2 3 z" fill="#fff" opacity=".9"/>
    </symbol>`;
}

const GEMS = [
  facetGem('white', polygon(8, 18, 18, -Math.PI / 8), polygon(8, 9, 9, -Math.PI / 8)),
  facetGem('blue', polygon(10, 14, 18), polygon(10, 7, 9.5)),
  facetGem('green', stepCut(26, 34, 7), stepCut(14, 20, 4)),
  facetGem('red', polygon(6, 18.5), polygon(6, 9)),
  facetGem('black', polygon(12, 17.5), polygon(12, 10)),
  facetGem('gold', polygon(5, 18.5), polygon(5, 8.5, 8.5, Math.PI / 2 + Math.PI)),
].join('');

/* Illustrations au trait (encre sur parchemin teinté), une par niveau. */
const ART = `
  <symbol id="art-1" viewBox="0 0 120 70">
    <path d="M0 70 L22 30 L34 42 L54 12 L74 40 L86 28 L120 70 Z" fill="currentColor" opacity=".18"/>
    <path d="M0 70 L22 30 L34 42 L54 12 L74 40 L86 28 L120 70" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M44 70 V52 a12 12 0 0 1 24 0 V70" fill="#0005" stroke="currentColor" stroke-width="1.6"/>
    <path d="M40 52 H72 M44 52 L42 46 M68 52 L70 46" stroke="currentColor" stroke-width="1.6"/>
    <path d="M20 66 H100 M28 62 V70 M44 62 V70 M76 62 V70 M92 62 V70" stroke="currentColor" stroke-width="1.2" opacity=".7"/>
    <path d="M82 60 h12 l-2 5 h-8 z" fill="currentColor" opacity=".55"/>
    <path d="M51 22 l3 -5 l3 5 l-3 3 z M92 44 l2 -3 l2 3 l-2 2 z" fill="#fff" opacity=".85"/>
  </symbol>
  <symbol id="art-2" viewBox="0 0 120 70">
    <path d="M0 58 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0 V70 H0 Z" fill="currentColor" opacity=".2"/>
    <path d="M0 58 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0 t20 0" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M28 48 H92 L84 58 H36 Z" fill="currentColor" opacity=".55" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
    <path d="M60 48 V8 M44 48 V20" stroke="currentColor" stroke-width="1.6"/>
    <path d="M62 10 q20 14 0 34 Z" fill="currentColor" opacity=".25" stroke="currentColor" stroke-width="1.4"/>
    <path d="M46 22 q14 10 0 22 Z" fill="currentColor" opacity=".2" stroke="currentColor" stroke-width="1.2"/>
    <path d="M60 8 l10 3 l-10 3" fill="currentColor"/>
    <circle cx="100" cy="16" r="6" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".6"/>
  </symbol>
  <symbol id="art-3" viewBox="0 0 120 70">
    <path d="M14 70 V34 H106 V70" fill="currentColor" opacity=".16"/>
    <path d="M10 34 H110 M14 34 V70 M106 34 V70 M8 70 H112" stroke="currentColor" stroke-width="1.6"/>
    <path d="M40 34 a20 20 0 0 1 40 0" fill="currentColor" opacity=".3" stroke="currentColor" stroke-width="1.6"/>
    <path d="M60 14 V6 M56 9 H64" stroke="currentColor" stroke-width="1.4"/>
    <g fill="#0005" stroke="currentColor" stroke-width="1.2">
      <path d="M22 70 V52 a6 6 0 0 1 12 0 V70"/>
      <path d="M52 70 V50 a8 8 0 0 1 16 0 V70"/>
      <path d="M86 70 V52 a6 6 0 0 1 12 0 V70"/>
    </g>
    <path d="M14 42 H106" stroke="currentColor" stroke-width="1" opacity=".6"/>
    <path d="M58 58 l2 -4 l2 4 l-2 2 z" fill="#fff" opacity=".9"/>
  </symbol>`;

const NOBLE = `
  <symbol id="noble-bust" viewBox="0 0 60 60">
    <path d="M10 60 C10 44 20 38 30 38 C40 38 50 44 50 60 Z" fill="currentColor" opacity=".9"/>
    <path d="M18 60 C20 50 24 44 30 44 C36 44 40 50 42 60" fill="none" stroke="#f3d48b" stroke-width="1.5" opacity=".8"/>
    <circle cx="30" cy="26" r="10" fill="currentColor"/>
    <path d="M18 16 L21 6 L26 12 L30 3 L34 12 L39 6 L42 16 Z" fill="#f3d48b" stroke="#7a5a1c" stroke-width="1"/>
    <circle cx="30" cy="9" r="1.6" fill="#c62f2f"/>
    <path d="M20 38 q10 6 20 0" fill="none" stroke="#f3d48b" stroke-width="2"/>
  </symbol>
  <symbol id="crest" viewBox="0 0 40 40">
    <path d="M20 2 L36 8 V20 C36 30 28 36 20 38 C12 36 4 30 4 20 V8 Z" fill="currentColor"/>
    <path d="M20 6 L32 10.5 V20 C32 27.5 26 32 20 34 C14 32 8 27.5 8 20 V10.5 Z" fill="none" stroke="#0005" stroke-width="1.4"/>
  </symbol>`;

export const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">
  <defs>
    <linearGradient id="gem-table" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fff" stop-opacity=".75"/>
      <stop offset=".45" stop-color="#fff" stop-opacity=".15"/>
      <stop offset="1" stop-color="#fff" stop-opacity=".35"/>
    </linearGradient>
  </defs>
  ${GEMS}${ART}${NOBLE}
</svg>`;

export function injectSprite(doc = document) {
  if (doc.getElementById('splendor-sprite')) return;
  const holder = doc.createElement('div');
  holder.id = 'splendor-sprite';
  holder.innerHTML = SPRITE;
  doc.body.prepend(holder);
}
