import { COLORS, GOLD, LEVELS, MAX_TOKENS } from './constants.js';
import { getCard, getNoble } from './cards.js';
import { computePayment, countTokens, currentPlayer, getBonuses, getLegalActions } from './game.js';

/** Jetons encore manquants pour acheter une carte (après bonus, jetons et or). */
function missingFor(player, card, bonuses, tokens = player.tokens) {
  let missing = 0;
  for (const c of COLORS) missing += Math.max(0, (card.cost[c] || 0) - bonuses[c] - tokens[c]);
  return Math.max(0, missing - tokens[GOLD]);
}

function cardValue(state, player, card, bonuses) {
  let value = card.points * 3 + 1;
  for (const nobleId of state.nobles) {
    const req = getNoble(nobleId).requirement;
    if ((req[card.bonus] || 0) > bonuses[card.bonus]) value += 0.5;
  }
  return value;
}

function visibleCards(state, player) {
  return [...LEVELS.flatMap((l) => state.market[l]), ...player.reserved].filter(Boolean).map(getCard);
}

/**
 * IA gloutonne simple : achète la meilleure carte possible, sinon prend
 * les jetons qui la rapprochent de ses cartes cibles, sinon réserve.
 * Fonction pure : renvoie une action légale pour l'état donné.
 */
export function chooseAiAction(state) {
  const player = currentPlayer(state);
  const legal = getLegalActions(state);
  if (legal.length === 1) return legal[0];
  const bonuses = getBonuses(player);

  if (state.phase === 'noble') return legal[0];

  if (state.phase === 'discard') {
    const targets = visibleCards(state, player);
    const need = Object.fromEntries(COLORS.map((c) => [c, 0]));
    for (const card of targets) for (const c of COLORS) need[c] += Math.max(0, (card.cost[c] || 0) - bonuses[c]);
    const options = legal.filter((a) => a.color !== GOLD);
    if (options.length === 0) return legal[0];
    options.sort((a, b) => player.tokens[b.color] - need[b.color] - (player.tokens[a.color] - need[a.color]));
    return options[0];
  }

  // 1. Acheter la carte la plus intéressante.
  const buys = legal.filter((a) => a.type === 'buy');
  if (buys.length > 0) {
    const scored = buys.map((a) => {
      const card = getCard(a.cardId);
      const payment = computePayment(player, card);
      return { a, score: cardValue(state, player, card, bonuses) * 10 - payment[GOLD] * 2 - countTokens(payment) * 0.1 };
    });
    scored.sort((x, y) => y.score - x.score);
    return scored[0].a;
  }

  // 2. Prendre des jetons utiles.
  const targets = visibleCards(state, player)
    .map((card) => ({ card, missing: missingFor(player, card, bonuses), value: cardValue(state, player, card, bonuses) }))
    .sort((x, y) => x.missing / x.value - y.missing / y.value)
    .slice(0, 3);
  const takes = legal.filter((a) => a.type === 'takeDifferent' || a.type === 'takeSame');
  const total = countTokens(player.tokens);
  let best = null;
  for (const a of takes) {
    const gained = a.type === 'takeSame' ? { [a.color]: 2 } : Object.fromEntries(a.colors.map((c) => [c, 1]));
    const count = a.type === 'takeSame' ? 2 : a.colors.length;
    const tokens = { ...player.tokens };
    for (const [c, n] of Object.entries(gained)) tokens[c] += n;
    let score = 0;
    targets.forEach((t, rank) => {
      score += ((t.missing - missingFor(player, t.card, bonuses, tokens)) * t.value) / (rank + 1);
    });
    if (total + count > MAX_TOKENS) score -= (total + count - MAX_TOKENS) * 2;
    if (!best || score > best.score) best = { a, score };
  }
  if (best && best.score > 0) return best.a;

  // 3. Réserver une carte de valeur.
  const reserves = legal.filter((a) => a.type === 'reserve' && a.cardId);
  if (reserves.length > 0 && total < MAX_TOKENS) {
    reserves.sort((x, y) => getCard(y.cardId).points - getCard(x.cardId).points);
    return reserves[0];
  }
  if (best) return best.a;
  return legal.find((a) => a.type === 'reserve') || legal[0];
}
