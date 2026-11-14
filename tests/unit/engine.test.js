import { describe, expect, it } from 'vitest';
import {
  IllegalActionError,
  applyAction,
  canAfford,
  computePayment,
  countTokens,
  createGame,
  currentPlayer,
  eligibleNobles,
  getBonuses,
  getCard,
  getLegalActions,
  getPoints,
  getWinner,
  isGameOver,
  validateAction,
} from '../../src/engine/index.js';
import { cardsOf, patch, removeCards, tokens } from '../helpers.js';

const base = () => createGame({ numPlayers: 2, seed: 123 });

/** Trouve une carte visible de niveau 1 et la renvoie avec son état. */
function firstMarketCard(state, level = 1) {
  return state.market[level][0];
}

describe('createGame', () => {
  it.each([
    [2, 4],
    [3, 5],
    [4, 7],
  ])('met en place %i joueurs avec %i jetons par couleur et 5 or', (n, perColor) => {
    const g = createGame({ numPlayers: n, seed: 1 });
    for (const c of ['white', 'blue', 'green', 'red', 'black']) expect(g.bank[c]).toBe(perColor);
    expect(g.bank.gold).toBe(5);
    expect(g.nobles).toHaveLength(n + 1);
    expect(g.players).toHaveLength(n);
    expect(g.current).toBe(0);
    expect(g.phase).toBe('play');
  });

  it('révèle 4 cartes par niveau et garde le reste en pioche', () => {
    const g = base();
    for (const level of [1, 2, 3]) expect(g.market[level]).toHaveLength(4);
    expect(g.decks[1]).toHaveLength(36);
    expect(g.decks[2]).toHaveLength(26);
    expect(g.decks[3]).toHaveLength(16);
    expect(g.market[1].every((id) => getCard(id).level === 1)).toBe(true);
  });

  it('est reproductible avec une graine et varie sinon', () => {
    expect(createGame({ numPlayers: 3, seed: 9 })).toEqual(createGame({ numPlayers: 3, seed: 9 }));
    expect(createGame({ numPlayers: 3, seed: 9 }).market).not.toEqual(createGame({ numPlayers: 3, seed: 10 }).market);
  });

  it('accepte des noms et des joueurs IA', () => {
    const g = createGame({ numPlayers: 2, seed: 1, names: ['Ada', ''], ai: [false, true] });
    expect(g.players[0].name).toBe('Ada');
    expect(g.players[1].name).toBe('Joueur 2');
    expect(g.players[1].ai).toBe(true);
  });

  it('refuse un nombre de joueurs invalide', () => {
    expect(() => createGame({ numPlayers: 1 })).toThrow(/entre 2 et 4/);
    expect(() => createGame({ numPlayers: 5 })).toThrow();
    expect(() => createGame()).toThrow();
  });

  it('renvoie un état immuable', () => {
    const g = base();
    expect(Object.isFrozen(g)).toBe(true);
    expect(Object.isFrozen(g.players[0].tokens)).toBe(true);
    expect(() => {
      g.bank.white = 99;
    }).toThrow();
  });
});

describe('prendre 3 jetons différents', () => {
  it('transfère un jeton de chaque couleur et passe au joueur suivant', () => {
    const g = applyAction(base(), { type: 'takeDifferent', colors: ['white', 'blue', 'green'] });
    expect(g.players[0].tokens).toMatchObject({ white: 1, blue: 1, green: 1 });
    expect(g.bank).toMatchObject({ white: 3, blue: 3, green: 3, red: 4 });
    expect(g.current).toBe(1);
  });

  it("ne modifie pas l'état d'origine", () => {
    const g = base();
    const snapshot = structuredClone(g);
    applyAction(g, { type: 'takeDifferent', colors: ['white', 'blue', 'green'] });
    expect(g).toEqual(snapshot);
  });

  it('refuse des couleurs identiques, de l’or, une couleur inconnue ou un mauvais nombre', () => {
    const g = base();
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['white', 'white', 'blue'] })).toThrow(/différentes/);
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['white', 'gold', 'blue'] })).toThrow(/or/);
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['white', 'pink', 'blue'] })).toThrow(/inconnue/);
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['white', 'blue'] })).toThrow(/3 jetons/);
    expect(() => applyAction(g, { type: 'takeDifferent' })).toThrow(IllegalActionError);
  });

  it('refuse une couleur épuisée', () => {
    const g = patch(base(), (s) => {
      s.bank.white = 0;
    });
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['white', 'blue', 'green'] })).toThrow(/plus de jeton/);
  });

  it("autorise moins de 3 jetons s'il reste moins de 3 couleurs", () => {
    const g = patch(base(), (s) => {
      s.bank.white = 0;
      s.bank.blue = 0;
      s.bank.green = 0;
    });
    const legal = getLegalActions(g).filter((a) => a.type === 'takeDifferent');
    expect(legal).toEqual([{ type: 'takeDifferent', colors: ['red', 'black'] }]);
    const next = applyAction(g, { type: 'takeDifferent', colors: ['red', 'black'] });
    expect(next.players[0].tokens).toMatchObject({ red: 1, black: 1 });
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['red'] })).toThrow(/2 jetons/);
  });

  it('refuse de prendre quand la réserve colorée est vide', () => {
    const g = patch(base(), (s) => {
      for (const c of ['white', 'blue', 'green', 'red', 'black']) s.bank[c] = 0;
    });
    expect(getLegalActions(g).some((a) => a.type === 'takeDifferent')).toBe(false);
    expect(() => applyAction(g, { type: 'takeDifferent', colors: [] })).toThrow(/aucun jeton/);
  });
});

describe('prendre 2 jetons identiques', () => {
  it("est possible s'il en reste au moins 4", () => {
    const g = applyAction(base(), { type: 'takeSame', color: 'red' });
    expect(g.players[0].tokens.red).toBe(2);
    expect(g.bank.red).toBe(2);
  });

  it("est refusé s'il en reste moins de 4", () => {
    const g = patch(base(), (s) => {
      s.bank.red = 3;
    });
    expect(() => applyAction(g, { type: 'takeSame', color: 'red' })).toThrow(/au moins 4/);
    expect(getLegalActions(g).some((a) => a.type === 'takeSame' && a.color === 'red')).toBe(false);
  });

  it('est refusé pour l’or ou une couleur inconnue', () => {
    expect(() => applyAction(base(), { type: 'takeSame', color: 'gold' })).toThrow(/or/);
    expect(() => applyAction(base(), { type: 'takeSame', color: 'pink' })).toThrow(/inconnue/);
  });
});

describe('réserver', () => {
  it('réserve une carte visible, la remplace et donne 1 or', () => {
    const g = base();
    const cardId = firstMarketCard(g);
    const topDeck = g.decks[1][0];
    const next = applyAction(g, { type: 'reserve', cardId });
    expect(next.players[0].reserved).toEqual([cardId]);
    expect(next.players[0].tokens.gold).toBe(1);
    expect(next.bank.gold).toBe(4);
    expect(next.market[1][0]).toBe(topDeck);
    expect(next.decks[1]).toHaveLength(35);
  });

  it('réserve le dessus de la pioche', () => {
    const g = base();
    const top = g.decks[3][0];
    const next = applyAction(g, { type: 'reserve', level: 3 });
    expect(next.players[0].reserved).toEqual([top]);
    expect(next.decks[3]).toHaveLength(15);
    expect(next.market[3]).toEqual(g.market[3]);
  });

  it('refuse une 4e réservation', () => {
    const g = patch(base(), (s) => {
      s.players[0].reserved = s.decks[1].splice(0, 3);
    });
    expect(() => applyAction(g, { type: 'reserve', level: 1 })).toThrow(/plus de 3/);
    expect(getLegalActions(g).some((a) => a.type === 'reserve')).toBe(false);
  });

  it("réserve sans or quand il n'en reste plus", () => {
    const g = patch(base(), (s) => {
      s.bank.gold = 0;
    });
    const next = applyAction(g, { type: 'reserve', level: 1 });
    expect(next.players[0].reserved).toHaveLength(1);
    expect(next.players[0].tokens.gold).toBe(0);
    expect(next.bank.gold).toBe(0);
    expect(next.log.at(-1).text).toMatch(/plus d’or/);
  });

  it('refuse de réserver dans une pioche vide', () => {
    const g = patch(base(), (s) => {
      s.decks[2] = [];
    });
    expect(() => applyAction(g, { type: 'reserve', level: 2 })).toThrow(/vide/);
    expect(getLegalActions(g).some((a) => a.type === 'reserve' && a.level === 2)).toBe(false);
  });

  it('laisse un emplacement vide si la pioche est épuisée', () => {
    const g = patch(base(), (s) => {
      s.decks[1] = [];
    });
    const next = applyAction(g, { type: 'reserve', cardId: g.market[1][2] });
    expect(next.market[1][2]).toBeNull();
    expect(getLegalActions(next).filter((a) => a.type === 'reserve' && a.cardId).length).toBe(11);
  });

  it('refuse une carte absente du plateau ou une cible manquante', () => {
    const g = base();
    expect(() => applyAction(g, { type: 'reserve', cardId: g.decks[1][5] })).toThrow(/pas visible/);
    expect(() => applyAction(g, { type: 'reserve' })).toThrow(/Choisissez/);
    expect(() => applyAction(g, { type: 'reserve', level: 7 })).toThrow(/Choisissez/);
  });
});

describe('acheter', () => {
  const blackCard = 'L1-white-1'; // coût : 1 bleu, 1 vert, 1 rouge, 1 noir

  function withCardInMarket(fn) {
    return patch(base(), (s) => {
      removeCards(s, [blackCard]);
      s.market[1][0] = blackCard;
      fn?.(s);
    });
  }

  it('paie le coût en jetons et remplace la carte', () => {
    const g = withCardInMarket((s) => {
      s.players[0].tokens = tokens({ blue: 1, green: 1, red: 1, black: 2 });
      s.bank.blue -= 1;
      s.bank.green -= 1;
      s.bank.red -= 1;
      s.bank.black -= 2;
    });
    const top = g.decks[1][0];
    const next = applyAction(g, { type: 'buy', cardId: blackCard });
    expect(next.players[0].cards).toEqual([blackCard]);
    expect(next.players[0].tokens).toEqual(tokens({ black: 1 }));
    expect(next.bank).toMatchObject({ blue: 4, green: 4, red: 4, black: 3 });
    expect(next.market[1][0]).toBe(top);
  });

  it('déduit les bonus des cartes possédées', () => {
    const owned = cardsOf((c) => c.level === 1 && (c.bonus === 'blue' || c.bonus === 'green')).slice(0, 16);
    const g = withCardInMarket((s) => {
      removeCards(s, owned);
      s.players[0].cards = owned;
      s.players[0].tokens = tokens({ red: 1, black: 1 });
    });
    expect(getBonuses(g.players[0])).toMatchObject({ blue: 8, green: 8 });
    const payment = computePayment(g.players[0], getCard(blackCard));
    expect(payment).toEqual(tokens({ red: 1, black: 1 }));
    const next = applyAction(g, { type: 'buy', cardId: blackCard });
    expect(next.players[0].tokens).toEqual(tokens());
  });

  it("utilise l'or pour compléter n'importe quelle couleur", () => {
    const g = withCardInMarket((s) => {
      s.players[0].tokens = tokens({ blue: 1, green: 1, gold: 3 });
      s.bank.gold = 2;
    });
    const payment = computePayment(g.players[0], getCard(blackCard));
    expect(payment).toEqual(tokens({ blue: 1, green: 1, gold: 2 }));
    const next = applyAction(g, { type: 'buy', cardId: blackCard });
    expect(next.players[0].tokens).toEqual(tokens({ gold: 1 }));
    expect(next.bank.gold).toBe(4);
  });

  it('refuse un achat inabordable', () => {
    const g = withCardInMarket((s) => {
      s.players[0].tokens = tokens({ blue: 1, gold: 1 });
    });
    expect(canAfford(g.players[0], getCard(blackCard))).toBe(false);
    expect(() => applyAction(g, { type: 'buy', cardId: blackCard })).toThrow(/pas assez/);
  });

  it('achète une carte réservée', () => {
    const g = patch(base(), (s) => {
      removeCards(s, [blackCard]);
      s.players[0].reserved = [blackCard];
      s.players[0].tokens = tokens({ gold: 4 });
    });
    const next = applyAction(g, { type: 'buy', cardId: blackCard });
    expect(next.players[0].reserved).toEqual([]);
    expect(next.players[0].cards).toEqual([blackCard]);
    expect(next.market).toEqual(g.market);
  });

  it("ne peut pas acheter la réserve d'un autre joueur ni une carte cachée", () => {
    const g = patch(base(), (s) => {
      removeCards(s, [blackCard]);
      s.players[1].reserved = [blackCard];
      s.players[0].tokens = tokens({ gold: 5 });
    });
    expect(() => applyAction(g, { type: 'buy', cardId: blackCard })).toThrow(/ni sur le plateau/);
    expect(() => applyAction(g, { type: 'buy', cardId: g.decks[2][0] })).toThrow(/ni sur le plateau/);
  });

  it('laisse un emplacement vide quand la pioche est vide', () => {
    const g = withCardInMarket((s) => {
      s.decks[1] = [];
      s.players[0].tokens = tokens({ gold: 4 });
    });
    const next = applyAction(g, { type: 'buy', cardId: blackCard });
    expect(next.market[1][0]).toBeNull();
  });

  it('ne propose que les achats abordables', () => {
    const g = withCardInMarket((s) => {
      s.players[0].tokens = tokens({ blue: 1, green: 1, red: 1, black: 1 });
    });
    const buys = getLegalActions(g).filter((a) => a.type === 'buy');
    expect(buys.map((a) => a.cardId)).toContain(blackCard);
    for (const a of buys) expect(canAfford(g.players[0], getCard(a.cardId))).toBe(true);
  });
});

describe('limite de 10 jetons', () => {
  const nineTokens = (s) => {
    s.players[0].tokens = tokens({ white: 2, blue: 2, green: 2, red: 2, black: 1 });
    for (const c of ['white', 'blue', 'green', 'red']) s.bank[c] -= 2;
    s.bank.black -= 1;
  };

  it('oblige à défausser l’excédent avant de finir le tour', () => {
    let g = applyAction(patch(base(), nineTokens), { type: 'takeDifferent', colors: ['white', 'blue', 'green'] });
    expect(countTokens(g.players[0].tokens)).toBe(12);
    expect(g.phase).toBe('discard');
    expect(g.current).toBe(0);
    expect(getLegalActions(g).every((a) => a.type === 'discard')).toBe(true);
    expect(() => applyAction(g, { type: 'takeDifferent', colors: ['white', 'blue', 'green'] })).toThrow(/défaussez/);
    g = applyAction(g, { type: 'discard', color: 'white' });
    expect(g.phase).toBe('discard');
    g = applyAction(g, { type: 'discard', color: 'blue' });
    expect(countTokens(g.players[0].tokens)).toBe(10);
    expect(g.phase).toBe('play');
    expect(g.current).toBe(1);
    expect(g.bank.white).toBe(2);
  });

  it('autorise exactement 10 jetons sans défausse', () => {
    const g = applyAction(patch(base(), nineTokens), { type: 'reserve', level: 1 });
    expect(countTokens(g.players[0].tokens)).toBe(10);
    expect(g.current).toBe(1);
  });

  it("permet de défausser de l'or et refuse un jeton non possédé", () => {
    let g = applyAction(patch(base(), nineTokens), { type: 'takeDifferent', colors: ['white', 'blue', 'green'] });
    g = applyAction(g, { type: 'discard', color: 'red' });
    expect(() => applyAction(g, { type: 'discard', color: 'gold' })).toThrow(/pas de jeton or/);
    expect(() => applyAction(g, { type: 'discard', color: 'pink' })).toThrow(/inconnue/);
    const withGold = patch(base(), (s) => {
      nineTokens(s);
      s.players[0].tokens.gold = 1;
      s.bank.gold = 4;
    });
    const r = applyAction(applyAction(withGold, { type: 'takeDifferent', colors: ['white', 'blue', 'green'] }), { type: 'discard', color: 'gold' });
    expect(r.players[0].tokens.gold).toBe(0);
    expect(r.bank.gold).toBe(5);
  });

  it('refuse la défausse hors phase de défausse', () => {
    expect(() => applyAction(base(), { type: 'discard', color: 'white' })).toThrow(/plus de 10/);
  });
});

describe('nobles', () => {
  /** Donne au joueur 0 les bonus requis par le noble `nobleId` moins une carte. */
  function nearNoble(nobleIds, extra) {
    return patch(base(), (s) => {
      s.nobles = [...nobleIds, ...s.nobles.filter((id) => !nobleIds.includes(id))].slice(0, 3);
      extra(s);
    });
  }

  it("attribue automatiquement un noble en fin de tour et +3 points", () => {
    // N7 : 4 diamants + 4 saphirs
    const owned = [...cardsOf((c) => c.level === 1 && c.bonus === 'white').slice(0, 4), ...cardsOf((c) => c.level === 1 && c.bonus === 'blue').slice(0, 4)];
    const g = nearNoble(['N7'], (s) => {
      removeCards(s, owned);
      s.players[0].cards = owned;
    });
    expect(eligibleNobles(g, g.players[0])).toEqual(['N7']);
    const pointsBefore = getPoints(g.players[0]);
    const next = applyAction(g, { type: 'takeSame', color: 'red' });
    expect(next.players[0].nobles).toEqual(['N7']);
    expect(next.nobles).not.toContain('N7');
    expect(getPoints(next.players[0])).toBe(pointsBefore + 3);
    expect(next.current).toBe(1);
  });

  it("fait choisir s'il y a plusieurs nobles, un seul par tour", () => {
    // N7 (4 diamants + 4 saphirs) et N10 (4 diamants + 4 onyx)
    const owned = ['white', 'blue', 'black'].flatMap((col) => cardsOf((c) => c.level === 1 && c.bonus === col).slice(0, 4));
    const g = nearNoble(['N7', 'N10'], (s) => {
      removeCards(s, owned);
      s.players[0].cards = owned;
    });
    let next = applyAction(g, { type: 'takeSame', color: 'red' });
    expect(next.phase).toBe('noble');
    expect(next.current).toBe(0);
    expect([...next.pendingNobles].sort()).toEqual(['N10', 'N7']);
    expect(getLegalActions(next)).toHaveLength(2);
    expect(() => applyAction(next, { type: 'chooseNoble', nobleId: 'N1' })).toThrow(/ne peut pas/);
    expect(() => applyAction(next, { type: 'takeSame', color: 'red' })).toThrow(/Choisissez le noble/);
    next = applyAction(next, { type: 'chooseNoble', nobleId: 'N10' });
    expect(next.players[0].nobles).toEqual(['N10']);
    expect(next.nobles).toContain('N7');
    expect(next.phase).toBe('play');
    expect(next.current).toBe(1);
    // Le joueur 1 joue, puis le joueur 0 reçoit le second noble au tour suivant.
    next = applyAction(next, { type: 'takeSame', color: 'green' });
    next = applyAction(next, { type: 'takeSame', color: 'blue' });
    expect(next.players[0].nobles).toEqual(['N10', 'N7']);
  });

  it('refuse chooseNoble hors phase', () => {
    expect(() => applyAction(base(), { type: 'chooseNoble', nobleId: 'N1' })).toThrow(/Aucun noble/);
  });

  it("n'attribue pas un noble non révélé", () => {
    const owned = [...cardsOf((c) => c.level === 1 && c.bonus === 'white').slice(0, 4), ...cardsOf((c) => c.level === 1 && c.bonus === 'blue').slice(0, 4)];
    const g = patch(base(), (s) => {
      s.nobles = s.nobles.filter((id) => id !== 'N7');
      removeCards(s, owned);
      s.players[0].cards = owned;
    });
    const next = applyAction(g, { type: 'takeSame', color: 'red' });
    expect(next.players[0].nobles).toEqual([]);
  });
});

describe('fin de partie', () => {
  const highCards = cardsOf((c) => c.level === 3 && c.points >= 4);

  function nearWin(fn) {
    return patch(base(), (s) => {
      s.nobles = [];
      removeCards(s, highCards);
      fn(s);
    });
  }

  it('termine le tour en cours dès 15 points puis déclare le gagnant', () => {
    // Joueur 0 : 4 cartes de 4/5 points (≥ 16 points) atteintes à son tour.
    let g = nearWin((s) => {
      s.players[0].cards = highCards.slice(0, 4);
    });
    expect(getPoints(g.players[0])).toBeGreaterThanOrEqual(15);
    g = applyAction(g, { type: 'takeSame', color: 'red' });
    expect(g.finalRound).toBe(true);
    expect(isGameOver(g)).toBe(false);
    expect(getWinner(g)).toBeNull();
    g = applyAction(g, { type: 'takeSame', color: 'blue' });
    expect(isGameOver(g)).toBe(true);
    expect(getLegalActions(g)).toEqual([]);
    expect(getWinner(g).winners).toEqual([0]);
    expect(() => applyAction(g, { type: 'takeSame', color: 'green' })).toThrow(/terminée/);
  });

  it("laisse le dernier joueur jouer et peut le faire gagner", () => {
    let g = nearWin((s) => {
      s.players[0].cards = highCards.slice(0, 3); // 12-15 points
      s.players[1].cards = highCards.slice(3, 7);
    });
    g = applyAction(g, { type: 'takeSame', color: 'red' });
    const p0 = getPoints(g.players[0]);
    const p1 = getPoints(g.players[1]);
    g = applyAction(g, { type: 'takeSame', color: 'blue' });
    expect(isGameOver(g)).toBe(true);
    const winner = getWinner(g);
    expect(winner.winners).toEqual([p1 > p0 ? 1 : 0]);
  });

  it("à égalité de points, gagne celui qui a le moins de cartes", () => {
    const fives = cardsOf((c) => c.level === 3 && c.points === 5); // 5 cartes
    const threes = cardsOf((c) => c.level === 3 && c.points === 3);
    let g = nearWin((s) => {
      removeCards(s, [...fives, ...threes]);
      s.players[0].cards = fives.slice(0, 3); // 15 pts, 3 cartes
      s.players[1].cards = [...threes.slice(0, 5)]; // 15 pts, 5 cartes
    });
    g = applyAction(g, { type: 'takeSame', color: 'red' });
    g = applyAction(g, { type: 'takeSame', color: 'blue' });
    const result = getWinner(g);
    expect(result.winners).toEqual([0]);
    expect(result.ranking.map((r) => r.points)).toEqual([15, 15]);
  });

  it('déclare plusieurs gagnants en cas d’égalité parfaite', () => {
    const fives = cardsOf((c) => c.level === 3 && c.points === 5); // 5 cartes de 5 pts
    const fours = cardsOf((c) => c.level === 3 && c.points === 4);
    let g = nearWin((s) => {
      removeCards(s, [...fives, ...fours]);
      s.players[0].cards = fives.slice(0, 3); // 15 pts, 3 cartes
      s.players[1].cards = [fives[3], fours[0], cardsOf((c) => c.level === 2 && c.points === 1)[0]]; // 10 pts
    });
    g = applyAction(g, { type: 'takeSame', color: 'red' });
    g = applyAction(g, { type: 'takeSame', color: 'blue' });
    expect(getWinner(g).winners).toEqual([0]);
    const tie = patch(g, (s) => {
      // 5 + 5 + 2 points de cartes + 3 points de noble = 15 points, 3 cartes.
      s.players[1].cards = [fives[3], fives[4], cardsOf((c) => c.level === 2 && c.points === 2)[0]];
      s.players[1].nobles = ['N1'];
    });
    expect(getPoints(tie.players[1])).toBe(15);
    expect(getWinner(tie).winners).toEqual([0, 1]);
  });

  it('ne termine pas la partie avant la fin du tour même si un joueur suivant atteint 15', () => {
    const g3 = patch(createGame({ numPlayers: 3, seed: 5 }), (s) => {
      s.nobles = [];
      removeCards(s, highCards);
      s.players[1].cards = highCards.slice(0, 4);
    });
    let g = applyAction(g3, { type: 'takeSame', color: 'red' });
    g = applyAction(g, { type: 'takeSame', color: 'blue' });
    expect(g.finalRound).toBe(true);
    expect(isGameOver(g)).toBe(false);
    g = applyAction(g, { type: 'takeSame', color: 'green' });
    expect(isGameOver(g)).toBe(true);
    expect(g.round).toBe(1);
  });
});

describe('divers', () => {
  it('compte les manches', () => {
    let g = applyAction(base(), { type: 'takeSame', color: 'red' });
    g = applyAction(g, { type: 'takeSame', color: 'blue' });
    expect(g.round).toBe(2);
    expect(currentPlayer(g)).toBe(g.players[0]);
  });

  it('autorise « passer » seulement sans autre action possible', () => {
    expect(() => applyAction(base(), { type: 'pass' })).toThrow(/aucune autre action/);
    const stuck = patch(base(), (s) => {
      for (const c of ['white', 'blue', 'green', 'red', 'black']) s.bank[c] = 0;
      s.players[0].reserved = s.decks[1].splice(0, 3);
    });
    expect(getLegalActions(stuck)).toEqual([{ type: 'pass' }]);
    const next = applyAction(stuck, { type: 'pass' });
    expect(next.current).toBe(1);
  });

  it('refuse les actions inconnues ou mal formées', () => {
    expect(() => applyAction(base(), null)).toThrow(/invalide/);
    expect(() => applyAction(base(), { type: 'fly' })).toThrow(/inconnue/);
  });

  it('validateAction renvoie un message sans lever', () => {
    expect(validateAction(base(), { type: 'takeSame', color: 'red' })).toEqual({ ok: true });
    const r = validateAction(base(), { type: 'takeDifferent', colors: ['red'] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/3 jetons/);
  });

  it('validateAction relance les erreurs non liées aux règles', () => {
    const broken = patch(base(), (s) => {
      s.players[0].cards = ['inexistante'];
      s.market[1][0] = 'L1-white-1';
    });
    expect(() => validateAction(broken, { type: 'buy', cardId: 'L1-white-1' })).toThrow(/inconnue/);
  });

  it('liste un grand nombre d’actions au premier tour', () => {
    const legal = getLegalActions(base());
    expect(legal.filter((a) => a.type === 'takeDifferent')).toHaveLength(10);
    expect(legal.filter((a) => a.type === 'takeSame')).toHaveLength(5);
    expect(legal.filter((a) => a.type === 'reserve')).toHaveLength(15);
    expect(legal.filter((a) => a.type === 'buy')).toHaveLength(0);
  });
});
