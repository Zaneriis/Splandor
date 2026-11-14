import { describe, expect, it } from 'vitest';
import {
  CARDS,
  NOBLES,
  TOKEN_TYPES,
  applyAction,
  chooseAiAction,
  countTokens,
  createGame,
  createRng,
  getLegalActions,
  getPoints,
  getWinner,
  isGameOver,
} from '../../src/engine/index.js';

const MAX_STEPS = 5000;

function checkInvariants(state, initialBank) {
  // Jetons : jamais négatifs, total conservé par type.
  for (const t of TOKEN_TYPES) {
    expect(state.bank[t]).toBeGreaterThanOrEqual(0);
    let total = state.bank[t];
    for (const p of state.players) {
      expect(p.tokens[t]).toBeGreaterThanOrEqual(0);
      total += p.tokens[t];
    }
    expect(total).toBe(initialBank[t]);
  }
  // Cartes : 90 au total, sans doublon.
  const all = [
    ...[1, 2, 3].flatMap((l) => state.decks[l]),
    ...[1, 2, 3].flatMap((l) => state.market[l]).filter(Boolean),
    ...state.players.flatMap((p) => [...p.cards, ...p.reserved]),
  ];
  expect(all).toHaveLength(CARDS.length);
  expect(new Set(all).size).toBe(CARDS.length);
  // Marché : 4 emplacements, vide seulement si la pioche est vide.
  for (const l of [1, 2, 3]) {
    expect(state.market[l]).toHaveLength(4);
    if (state.market[l].includes(null)) expect(state.decks[l]).toHaveLength(0);
  }
  // Nobles : conservés, sans doublon.
  const nobles = [...state.nobles, ...state.players.flatMap((p) => p.nobles)];
  expect(nobles).toHaveLength(state.numPlayers + 1);
  expect(new Set(nobles).size).toBe(nobles.length);
  for (const id of nobles) expect(NOBLES.some((n) => n.id === id)).toBe(true);
  for (const p of state.players) expect(p.reserved.length).toBeLessThanOrEqual(3);
  // Hors défausse, personne n'a plus de 10 jetons.
  if (state.phase !== 'discard') for (const p of state.players) expect(countTokens(p.tokens)).toBeLessThanOrEqual(10);
}

/** Joue une partie complète ; `pick` choisit l'action à chaque étape. */
function playGame(numPlayers, seed, pick) {
  let state = createGame({ numPlayers, seed });
  const initialBank = { ...state.bank };
  const turnsPerPlayer = Array(numPlayers).fill(0);
  let steps = 0;
  while (!isGameOver(state) && steps < MAX_STEPS) {
    const legal = getLegalActions(state);
    expect(legal.length).toBeGreaterThan(0);
    const action = pick(state, legal);
    const before = state.current;
    const wasPlay = state.phase === 'play';
    state = applyAction(state, action);
    if (wasPlay) turnsPerPlayer[before] += 1;
    checkInvariants(state, initialBank);
    steps += 1;
  }
  return { state, steps, turnsPerPlayer };
}

const aiPick = (state) => chooseAiAction(state);

function mixedPick(seed) {
  const rng = createRng(seed);
  return (state, legal) => {
    if (rng() < 0.5) return chooseAiAction(state);
    const buys = legal.filter((a) => a.type === 'buy');
    if (buys.length && rng() < 0.7) return buys[Math.floor(rng() * buys.length)];
    return legal[Math.floor(rng() * legal.length)];
  };
}

describe('simulations de parties complètes', () => {
  for (const numPlayers of [2, 3, 4]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      it(`IA contre IA : ${numPlayers} joueurs, graine ${seed}`, () => {
        const { state, turnsPerPlayer } = playGame(numPlayers, seed, aiPick);
        expect(isGameOver(state)).toBe(true);
        // Tous les joueurs ont joué le même nombre de tours.
        expect(new Set(turnsPerPlayer).size).toBe(1);
        const result = getWinner(state);
        expect(result.winners.length).toBeGreaterThanOrEqual(1);
        const best = result.ranking[0];
        expect(best.points).toBeGreaterThanOrEqual(15);
        expect(getPoints(state.players[result.winners[0]])).toBe(best.points);
        for (const r of result.ranking.slice(1)) {
          expect(r.points < best.points || (r.points === best.points && r.cards >= best.cards)).toBe(true);
        }
      });
    }
  }

  for (const seed of [11, 12, 13, 14, 15, 16]) {
    it(`joueurs semi-aléatoires sans état illégal (graine ${seed})`, () => {
      const { state, steps } = playGame(2 + (seed % 3), seed, mixedPick(seed * 7));
      expect(steps).toBeGreaterThan(0);
      if (isGameOver(state)) expect(getWinner(state)).not.toBeNull();
    });
  }

  it('est reproductible avec la même graine', () => {
    const a = playGame(3, 99, aiPick).state;
    const b = playGame(3, 99, aiPick).state;
    expect(a).toEqual(b);
  });
});
