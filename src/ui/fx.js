/**
 * Motion design : l'interface est redessinée entièrement à chaque changement
 * (innerHTML). Pour animer malgré tout, on photographie la position des
 * éléments clés avant le rendu, puis on fait voler les anciens nœuds (détachés)
 * vers leur nouvelle place dans une couche fixe au-dessus de la page.
 * Tout est purement décoratif : rien ne bloque les clics ni l'état du jeu.
 */

import { COLORS, TOKEN_TYPES, getPoints } from '../engine/index.js';

const EASE_OUT = 'cubic-bezier(.16,1,.3,1)';
const EASE_IN_OUT = 'cubic-bezier(.65,0,.35,1)';

const TRACKED = [
  '[data-testid^="bank-token-"]',
  '.card[data-card]',
  '.noble[data-noble-id]',
  '.deck[data-deck]',
  '[data-testid^="player-tokens-"]',
];

function stripIds(node) {
  node.removeAttribute('data-testid');
  node.removeAttribute('id');
  node.querySelectorAll('[data-testid],[id]').forEach((el) => {
    el.removeAttribute('data-testid');
    el.removeAttribute('id');
  });
  return node;
}

function keyOf(el) {
  if (el.dataset.card) return `card:${el.dataset.card}`;
  if (el.dataset.nobleId) return `noble:${el.dataset.nobleId}`;
  if (el.dataset.deck) return `deck:${el.dataset.deck}`;
  return el.dataset.testid;
}

const center = (rect) => ({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
const visible = (rect) => rect && rect.width > 0 && rect.height > 0;

export function createFx({ enabled = true } = {}) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const isOn = () => enabled && !reduce?.matches;

  let layer = null;
  function getLayer() {
    if (!layer || !layer.isConnected) {
      layer = document.createElement('div');
      layer.className = 'fx-layer';
      layer.setAttribute('aria-hidden', 'true');
      document.body.append(layer);
    }
    return layer;
  }

  // -------------------------------------------------------------------------
  // Capture avant rendu
  // -------------------------------------------------------------------------

  function snapshot(root) {
    const snap = new Map();
    if (!isOn()) return snap;
    root.querySelectorAll(TRACKED.join(',')).forEach((el) => {
      const key = keyOf(el);
      if (key && !snap.has(key)) {
        const chip = el.querySelector('.token__chip');
        snap.set(key, { el, rect: el.getBoundingClientRect(), chip, chipRect: chip?.getBoundingClientRect() });
      }
    });
    return snap;
  }

  // -------------------------------------------------------------------------
  // Primitives
  // -------------------------------------------------------------------------

  /** Fait voler `node` (détaché) du rectangle `from` vers le rectangle `to`. */
  function fly(node, from, to, { delay = 0, duration = 650, arc = -60, endScale, spin = 0, fade = true, className = '' } = {}) {
    if (!visible(from) || !visible(to)) return null;
    const ghost = stripIds(node);
    ghost.classList.add('fx-ghost');
    if (className) ghost.classList.add(...className.split(' '));
    Object.assign(ghost.style, {
      left: `${from.left}px`,
      top: `${from.top}px`,
      width: `${from.width}px`,
      height: `${from.height}px`,
    });
    getLayer().append(ghost);
    const a = center(from);
    const b = center(to);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const scale = endScale ?? Math.max(0.25, Math.min(1.2, to.width / from.width));
    const anim = ghost.animate(
      [
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1, offset: 0 },
        { transform: `translate(${dx * 0.5}px, ${dy * 0.5 + arc}px) scale(${(1 + scale) / 2 + 0.1}) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotate(${spin}deg)`, opacity: fade ? 0 : 1, offset: 1 },
      ],
      { duration, delay, easing: EASE_IN_OUT, fill: 'both' },
    );
    anim.finished.then(() => ghost.remove(), () => ghost.remove());
    return anim;
  }

  function pop(el, { delay = 0, scale = 1.35 } = {}) {
    if (!el) return;
    el.animate([{ transform: 'scale(1)' }, { transform: `scale(${scale})`, filter: 'brightness(1.6)' }, { transform: 'scale(1)' }], {
      duration: 420,
      delay,
      easing: EASE_OUT,
    });
  }

  /** Gerbe de petites gemmes depuis un point de l'écran. */
  function burst(x, y, { colors = TOKEN_TYPES, count = 16, spread = 140, delay = 0 } = {}) {
    if (!isOn()) return;
    const host = getLayer();
    for (let i = 0; i < count; i++) {
      const color = colors[i % colors.length];
      const p = document.createElement('span');
      p.className = `fx-spark gem gem--${color}`;
      p.innerHTML = `<svg viewBox="0 0 40 40"><use href="#gem-${color}"/></svg>`;
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      host.append(p);
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const dist = spread * (0.5 + Math.random() * 0.6);
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist;
      const anim = p.animate(
        [
          { transform: 'translate(-50%,-50%) scale(.2) rotate(0deg)', opacity: 0 },
          { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1) rotate(${dx}deg)`, opacity: 1, offset: 0.4 },
          { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 60}px)) scale(.6) rotate(${dx * 2}deg)`, opacity: 0 },
        ],
        { duration: 900 + Math.random() * 500, delay: delay + Math.random() * 120, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' },
      );
      anim.finished.then(() => p.remove(), () => p.remove());
    }
  }

  // -------------------------------------------------------------------------
  // Transitions de jeu
  // -------------------------------------------------------------------------

  const q = (root, testid) => root.querySelector(`[data-testid="${testid}"]`);
  const rectOf = (el) => (el ? el.getBoundingClientRect() : null);

  function tokenFlights(root, snap, prev, next, p) {
    const before = prev.players[p].tokens;
    const after = next.players[p].tokens;
    let n = 0;
    for (const t of TOKEN_TYPES) {
      const diff = after[t] - before[t];
      if (diff > 0) {
        // Banque → joueur
        const src = snap.get(`bank-token-${t}`);
        const target = q(root, `player-tokens-${p}-${t}`);
        for (let i = 0; i < diff && src?.chip; i++) {
          fly(src.chip.cloneNode(true), src.chipRect, rectOf(target), { delay: n * 90, spin: 360, className: 'token' });
          pop(target, { delay: 600 + n * 90 });
          n++;
        }
      } else if (diff < 0) {
        // Joueur → banque (paiement ou défausse)
        const src = snap.get(`player-tokens-${p}-${t}`);
        const target = q(root, `bank-token-${t}`);
        for (let i = 0; i < -diff && i < 4; i++) {
          if (!src) break;
          fly(src.el.cloneNode(true), src.rect, rectOf(target?.querySelector('.token__chip') ?? target), { delay: n * 70, arc: -30, duration: 560 });
          n++;
        }
        if (target) pop(target.querySelector('.token__chip'), { delay: 500 + n * 70, scale: 1.12 });
      }
    }
  }

  function dealNewCards(root, prev, next, { initial = false } = {}) {
    const prevIds = new Set(prev ? Object.values(prev.market).flat() : []);
    let i = 0;
    for (const level of [3, 2, 1]) {
      const deck = q(root, `deck-${level}`);
      const deckRect = rectOf(deck);
      next.market[level].forEach((id) => {
        if (!id || prevIds.has(id)) return;
        const el = root.querySelector(`.slot .card[data-card="${id}"]`);
        if (!el) return;
        const r = el.getBoundingClientRect();
        const dx = deckRect ? deckRect.left - r.left : -80;
        const dy = deckRect ? deckRect.top - r.top : 0;
        el.animate(
          [
            { transform: `translate(${dx}px, ${dy}px) rotateY(-180deg) scale(.9)`, opacity: 0.4 },
            { transform: `translate(${dx * 0.3}px, ${dy * 0.3 - 20}px) rotateY(-90deg) scale(1.05)`, opacity: 1, offset: 0.5 },
            { transform: 'none', opacity: 1 },
          ],
          { duration: 700, delay: initial ? 200 + i * 70 : 350, easing: EASE_OUT, fill: 'backwards' },
        );
        i++;
      });
    }
  }

  function intro(root, game) {
    if (!isOn()) return;
    dealNewCards(root, null, game, { initial: true });
    root.querySelectorAll('.nobles .noble').forEach((el, i) => {
      el.animate(
        [
          { transform: 'translateY(-40px) rotateX(70deg)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 800, delay: 900 + i * 110, easing: EASE_OUT, fill: 'backwards' },
      );
    });
    root.querySelectorAll('.bank .token').forEach((el, i) => {
      el.animate(
        [
          { transform: 'translateY(60px) scale(.6)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 700, delay: 1100 + i * 70, easing: EASE_OUT, fill: 'backwards' },
      );
    });
    root.querySelectorAll('.player').forEach((el, i) => {
      el.animate(
        [
          { transform: 'translateX(40px)', opacity: 0 },
          { transform: 'none', opacity: 1 },
        ],
        { duration: 700, delay: 300 + i * 120, easing: EASE_OUT, fill: 'backwards' },
      );
    });
  }

  /** Anime le passage de `prev` à `next` suite à `action`. */
  function transition(root, snap, { prev, next, action }) {
    if (!isOn() || !prev || !next) return;
    const p = prev.current;

    if (action.type === 'buy' || action.type === 'reserve') {
      const reserved = action.type === 'reserve';
      const src = action.cardId ? snap.get(`card:${action.cardId}`) : snap.get(`deck:${action.level}`);
      const target = reserved ? q(root, `player-reserved-${p}`) : q(root, `player-panel-${p}`);
      if (src) {
        let node = src.el;
        if (!action.cardId) {
          node = document.createElement('div');
          node.className = `card card--back card--l${action.level}`;
        }
        const to = rectOf(target);
        const toBox = to && { left: to.left + to.width / 2 - 20, top: to.top + to.height / 2 - 28, width: 40, height: 56 };
        fly(node, src.rect, toBox, { duration: 800, arc: -90, spin: reserved ? -8 : 0, className: 'fx-card' });
        if (!reserved && target) {
          const bonus = next.players[p].cards.length ? q(root, `player-bonus-${p}-${prevCardBonus(src.el)}`) : null;
          pop(bonus, { delay: 780 });
        }
      }
    }

    tokenFlights(root, snap, prev, next, p);
    dealNewCards(root, prev, next);

    // Visite d'un noble
    const gained = next.players[p].nobles.filter((id) => !prev.players[p].nobles.includes(id));
    for (const id of gained) {
      const src = snap.get(`noble:${id}`);
      const panel = q(root, `player-panel-${p}`);
      const to = rectOf(panel);
      if (src && to) {
        const toBox = { left: to.left + to.width / 2 - 30, top: to.top + 10, width: 60, height: 60 };
        fly(src.el, src.rect, toBox, { duration: 1100, delay: 300, arc: -120, fade: true, className: 'fx-noble' });
        const c = center(toBox);
        burst(c.x, c.y, { colors: ['gold', 'white', 'gold'], count: 22, delay: 1250 });
      }
    }

    // Points et joueur suivant
    const before = getPoints(prev.players[p]);
    const after = getPoints(next.players[p]);
    if (after > before) {
      const pts = q(root, `player-points-${p}`);
      pop(pts, { delay: 750, scale: 1.6 });
      const r = rectOf(pts);
      if (r) burst(r.left + r.width / 2, r.top + r.height / 2, { colors: ['gold'], count: 8, spread: 60, delay: 800 });
    }
    if (next.current !== prev.current && next.phase !== 'over') {
      const panel = q(root, `player-panel-${next.current}`);
      panel?.animate(
        [
          { boxShadow: '0 0 0 0 #f3d48b00' },
          { boxShadow: '0 0 0 6px #f3d48b88, 0 0 40px #f3d48b66' },
          { boxShadow: '0 0 0 0 #f3d48b00' },
        ],
        { duration: 1000, delay: 500, easing: EASE_OUT },
      );
      revealPanel(root, next.current);
    }
  }

  function prevCardBonus(el) {
    return COLORS.find((c) => el.classList.contains(`card--${c}`)) ?? 'white';
  }

  /** Sur mobile, les joueurs défilent horizontalement : on centre le joueur actif. */
  function revealPanel(root, index) {
    const list = root.querySelector('.players__list');
    const panel = q(root, `player-panel-${index}`);
    if (!list || !panel || list.scrollWidth <= list.clientWidth) return;
    list.scrollTo({ left: panel.offsetLeft - (list.clientWidth - panel.clientWidth) / 2, behavior: isOn() ? 'smooth' : 'auto' });
  }

  function victory(root) {
    if (!isOn()) return;
    const box = root.querySelector('.overlay__box');
    const r = rectOf(box);
    if (!r) return;
    for (let wave = 0; wave < 4; wave++) {
      burst(r.left + r.width * (0.2 + Math.random() * 0.6), r.top + r.height * 0.25, { count: 24, spread: 260, delay: 300 + wave * 450 });
    }
  }

  // -------------------------------------------------------------------------
  // Inclinaison 3D des cartes au survol (souris uniquement)
  // -------------------------------------------------------------------------

  function attachTilt(root) {
    const fine = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    let current = null;
    const reset = (el) => {
      el.style.removeProperty('--rx');
      el.style.removeProperty('--ry');
      el.style.removeProperty('--mx');
      el.style.removeProperty('--my');
    };
    root.addEventListener('pointermove', (event) => {
      if (!isOn() || !fine?.matches) return;
      const el = event.target.closest?.('.card:not(.card--back), .noble, .deck');
      if (current && current !== el) reset(current);
      current = el;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const x = (event.clientX - r.left) / r.width;
      const y = (event.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${(0.5 - y) * 14}deg`);
      el.style.setProperty('--ry', `${(x - 0.5) * 16}deg`);
      el.style.setProperty('--mx', `${x * 100}%`);
      el.style.setProperty('--my', `${y * 100}%`);
    });
    root.addEventListener('pointerleave', () => {
      if (current) reset(current);
      current = null;
    });
  }

  return { snapshot, transition, intro, victory, burst, attachTilt, revealPanel, isOn };
}
