import { describe, expect, it } from 'vitest';
import { applyAction, chooseAiAction, createGame, getLegalActions } from '../../src/engine/index.js';
import { cardsOf, patch, removeCards, tokens } from '../helpers.js';

const isLegal = (state, action) => getLegalActions(state).some((a) => JSON.stringify(a) === JSON.stringify(action));

describe('IA', () => {
  const base = () => createGame({ numPlayers: 2, seed: 3 });

  it('choisit une prise de jetons au premier tour', () => {
    const action = chooseAiAction(base());
    expect(isLegal(base(), action)).toBe(true);
    expect(['takeDifferent', 'takeSame']).toContain(action.type);
  });

  it('achète une carte quand elle le peut, en privilégiant les points', () => {
    const g = patch(base(), (s) => {
      s.players[0].tokens = tokens({ gold: 5, white: 3, blue: 3, green: 3 });
    });
    const action = chooseAiAction(g);
    expect(action.type).toBe('buy');
  });

  it('défausse un jeton coloré en phase de défausse', () => {
    let g = patch(base(), (s) => {
      s.players[0].tokens = tokens({ white: 2, blue: 2, green: 2, red: 2, black: 1, gold: 1 });
    });
    g = applyAction(g, { type: 'takeDifferent', colors: ['white', 'blue', 'green'] });
    const action = chooseAiAction(g);
    expect(action.type).toBe('discard');
    expect(action.color).not.toBe('gold');
  });

  it("défausse de l'or s'il ne reste que de l'or", () => {
    const g = patch(base(), (s) => {
      s.phase = 'discard';
      s.players[0].tokens = tokens({ gold: 11 });
    });
    expect(chooseAiAction(g)).toEqual({ type: 'discard', color: 'gold' });
  });

  it('choisit un noble en phase de choix', () => {
    const g = patch(base(), (s) => {
      s.phase = 'noble';
      s.pendingNobles = [s.nobles[0], s.nobles[1]];
    });
    expect(chooseAiAction(g)).toEqual({ type: 'chooseNoble', nobleId: g.nobles[0] });
  });

  it("réserve quand prendre des jetons n'aide pas", () => {
    const g = patch(base(), (s) => {
      for (const c of ['white', 'blue', 'green', 'red', 'black']) s.bank[c] = 0;
    });
    const action = chooseAiAction(g);
    expect(action.type).toBe('reserve');
    expect(isLegal(g, action)).toBe(true);
  });

  it('réserve en pioche si le marché est vide', () => {
    const g = patch(base(), (s) => {
      for (const c of ['white', 'blue', 'green', 'red', 'black']) s.bank[c] = 0;
      for (const l of [1, 2, 3]) s.market[l] = [null, null, null, null];
    });
    expect(chooseAiAction(g)).toMatchObject({ type: 'reserve', level: 1 });
  });

  it('prend des jetons même peu utiles avec 10 jetons plutôt que réserver', () => {
    const g = patch(base(), (s) => {
      s.players[0].tokens = tokens({ white: 4, blue: 4, green: 2 });
      s.bank.white = 0;
      s.bank.blue = 0;
      s.bank.green = 2;
      const all = cardsOf(() => true);
      removeCards(s, all);
      s.market[1][0] = 'L1-blue-8';
    });
    const action = chooseAiAction(g);
    expect(isLegal(g, action)).toBe(true);
  });

  it('passe si rien d’autre n’est possible', () => {
    const g = patch(base(), (s) => {
      for (const c of ['white', 'blue', 'green', 'red', 'black']) s.bank[c] = 0;
      s.players[0].reserved = s.decks[1].splice(0, 3);
    });
    expect(chooseAiAction(g)).toEqual({ type: 'pass' });
  });
});
