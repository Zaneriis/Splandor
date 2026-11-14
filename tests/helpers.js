import { CARDS } from '../src/engine/cards.js';

/** Copie modifiable d'un état, modifiée par `fn`. */
export function patch(state, fn) {
  const s = structuredClone(state);
  fn(s);
  return s;
}

export function tokens(partial = {}) {
  return { white: 0, blue: 0, green: 0, red: 0, black: 0, gold: 0, ...partial };
}

export function cardsOf(predicate) {
  return CARDS.filter(predicate).map((c) => c.id);
}

/** Retire les cartes listées de toutes les zones de l'état (pioches, marché). */
export function removeCards(s, ids) {
  for (const level of [1, 2, 3]) {
    s.decks[level] = s.decks[level].filter((id) => !ids.includes(id));
    s.market[level] = s.market[level].map((id) => (ids.includes(id) ? null : id));
  }
}
