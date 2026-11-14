import cardsData from '../data/cards.json';
import noblesData from '../data/nobles.json';

export const CARDS = Object.freeze(cardsData.map((c) => Object.freeze({ ...c, cost: Object.freeze({ ...c.cost }) })));
export const NOBLES = Object.freeze(
  noblesData.map((n) => Object.freeze({ ...n, requirement: Object.freeze({ ...n.requirement }) })),
);

const CARD_BY_ID = new Map(CARDS.map((c) => [c.id, c]));
const NOBLE_BY_ID = new Map(NOBLES.map((n) => [n.id, n]));

export function getCard(id) {
  const card = CARD_BY_ID.get(id);
  if (!card) throw new Error(`Carte inconnue : ${id}`);
  return card;
}

export function getNoble(id) {
  const noble = NOBLE_BY_ID.get(id);
  if (!noble) throw new Error(`Noble inconnu : ${id}`);
  return noble;
}
