import {
  COLORS,
  COLOR_NAMES,
  GOLD,
  GOLD_TOKENS,
  LEVELS,
  MARKET_SIZE,
  MAX_RESERVED,
  MAX_TOKENS,
  MIN_SAME_COLOR_STOCK,
  TOKEN_TYPES,
  TOKENS_PER_COLOR,
  WINNING_POINTS,
} from './constants.js';
import { CARDS, NOBLES, getCard, getNoble } from './cards.js';
import { createRng, shuffle } from './rng.js';

/** Erreur levée lorsqu'une action ne respecte pas les règles. */
export class IllegalActionError extends Error {
  constructor(message) {
    super(message);
    this.name = 'IllegalActionError';
  }
}

// ---------------------------------------------------------------------------
// Utilitaires
// ---------------------------------------------------------------------------

function deepFreeze(obj) {
  if (obj && typeof obj === 'object' && !Object.isFrozen(obj)) {
    Object.freeze(obj);
    for (const value of Object.values(obj)) deepFreeze(value);
  }
  return obj;
}

function clone(state) {
  return structuredClone(state);
}

function emptyTokens() {
  return Object.fromEntries(TOKEN_TYPES.map((t) => [t, 0]));
}

function fail(message) {
  throw new IllegalActionError(message);
}

export function countTokens(tokens) {
  return TOKEN_TYPES.reduce((sum, t) => sum + (tokens[t] || 0), 0);
}

/** Bonus (réductions permanentes) d'un joueur, par couleur. */
export function getBonuses(player) {
  const bonuses = Object.fromEntries(COLORS.map((c) => [c, 0]));
  for (const id of player.cards) bonuses[getCard(id).bonus] += 1;
  return bonuses;
}

/** Points de prestige d'un joueur (cartes + nobles). */
export function getPoints(player) {
  let points = 0;
  for (const id of player.cards) points += getCard(id).points;
  for (const id of player.nobles) points += getNoble(id).points;
  return points;
}

/**
 * Calcule le paiement d'une carte pour un joueur : jetons colorés d'abord,
 * puis or pour combler le manque. Renvoie null si la carte est inabordable.
 */
export function computePayment(player, card) {
  const bonuses = getBonuses(player);
  const payment = emptyTokens();
  let goldNeeded = 0;
  for (const color of COLORS) {
    const due = Math.max(0, (card.cost[color] || 0) - bonuses[color]);
    const fromColor = Math.min(due, player.tokens[color]);
    payment[color] = fromColor;
    goldNeeded += due - fromColor;
  }
  if (goldNeeded > player.tokens[GOLD]) return null;
  payment[GOLD] = goldNeeded;
  return payment;
}

export function canAfford(player, card) {
  return computePayment(player, card) !== null;
}

/** Nobles dont le joueur remplit les conditions (parmi ceux disponibles). */
export function eligibleNobles(state, player) {
  const bonuses = getBonuses(player);
  return state.nobles.filter((id) => {
    const req = getNoble(id).requirement;
    return COLORS.every((c) => bonuses[c] >= (req[c] || 0));
  });
}

export function currentPlayer(state) {
  return state.players[state.current];
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------

/**
 * Crée une nouvelle partie.
 * @param {object} options
 * @param {number} options.numPlayers 2 à 4
 * @param {number} [options.seed] graine du mélange
 * @param {string[]} [options.names] noms des joueurs
 * @param {boolean[]} [options.ai] joueurs contrôlés par l'IA
 */
export function createGame({ numPlayers, seed = Date.now(), names, ai } = {}) {
  if (!Number.isInteger(numPlayers) || numPlayers < 2 || numPlayers > 4) {
    throw new Error('Le nombre de joueurs doit être compris entre 2 et 4.');
  }
  const rng = createRng(seed);
  const perColor = TOKENS_PER_COLOR[numPlayers];
  const bank = { ...Object.fromEntries(COLORS.map((c) => [c, perColor])), [GOLD]: GOLD_TOKENS };

  const decks = {};
  const market = {};
  for (const level of LEVELS) {
    const deck = shuffle(
      CARDS.filter((c) => c.level === level).map((c) => c.id),
      rng,
    );
    market[level] = deck.splice(0, MARKET_SIZE);
    decks[level] = deck;
  }
  const nobles = shuffle(
    NOBLES.map((n) => n.id),
    rng,
  ).slice(0, numPlayers + 1);

  const players = Array.from({ length: numPlayers }, (_, i) => ({
    name: names?.[i] || `Joueur ${i + 1}`,
    ai: Boolean(ai?.[i]),
    tokens: emptyTokens(),
    cards: [],
    reserved: [],
    nobles: [],
  }));

  return deepFreeze({
    numPlayers,
    seed,
    bank,
    decks,
    market,
    nobles,
    players,
    current: 0,
    phase: 'play', // 'play' | 'discard' | 'noble' | 'over'
    pendingNobles: [],
    finalRound: false,
    round: 1,
    log: [],
  });
}

// ---------------------------------------------------------------------------
// Actions légales
// ---------------------------------------------------------------------------

function combinations(items, k) {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [first, ...rest] = items;
  return [...combinations(rest, k - 1).map((c) => [first, ...c]), ...combinations(rest, k)];
}

/** Nombre de couleurs à prendre pour l'action « couleurs différentes ». */
function requiredDifferentCount(state) {
  const available = COLORS.filter((c) => state.bank[c] > 0).length;
  return Math.min(3, available);
}

function findCardLocation(state, player, cardId) {
  for (const level of LEVELS) {
    const index = state.market[level].indexOf(cardId);
    if (index !== -1) return { where: 'market', level, index };
  }
  const index = player.reserved.indexOf(cardId);
  if (index !== -1) return { where: 'reserved', index };
  return null;
}

/** Liste toutes les actions légales pour le joueur courant. */
export function getLegalActions(state) {
  const player = currentPlayer(state);
  const actions = [];
  if (state.phase === 'over') return actions;

  if (state.phase === 'discard') {
    for (const t of TOKEN_TYPES) if (player.tokens[t] > 0) actions.push({ type: 'discard', color: t });
    return actions;
  }
  if (state.phase === 'noble') {
    return state.pendingNobles.map((nobleId) => ({ type: 'chooseNoble', nobleId }));
  }

  const k = requiredDifferentCount(state);
  if (k > 0) {
    const available = COLORS.filter((c) => state.bank[c] > 0);
    for (const colors of combinations(available, k)) actions.push({ type: 'takeDifferent', colors });
  }
  for (const color of COLORS) {
    if (state.bank[color] >= MIN_SAME_COLOR_STOCK) actions.push({ type: 'takeSame', color });
  }
  if (player.reserved.length < MAX_RESERVED) {
    for (const level of LEVELS) {
      for (const cardId of state.market[level]) if (cardId) actions.push({ type: 'reserve', cardId });
      if (state.decks[level].length > 0) actions.push({ type: 'reserve', level });
    }
  }
  const buyable = [...LEVELS.flatMap((l) => state.market[l]), ...player.reserved].filter(Boolean);
  for (const cardId of buyable) if (canAfford(player, getCard(cardId))) actions.push({ type: 'buy', cardId });

  if (actions.length === 0) actions.push({ type: 'pass' });
  return actions;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/**
 * Vérifie une action sans la jouer.
 * @returns {{ok: true} | {ok: false, error: string}}
 */
export function validateAction(state, action) {
  try {
    applyAction(state, action);
    return { ok: true };
  } catch (err) {
    if (err instanceof IllegalActionError) return { ok: false, error: err.message };
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Application des actions
// ---------------------------------------------------------------------------

function takeDifferent(s, player, colors) {
  if (!Array.isArray(colors)) fail('Choisissez des couleurs de jetons.');
  if (new Set(colors).size !== colors.length) fail('Les jetons doivent être de couleurs différentes.');
  for (const c of colors) {
    if (!COLORS.includes(c)) fail(c === GOLD ? "On ne peut pas prendre d'or directement." : `Couleur inconnue : ${c}.`);
    if (s.bank[c] <= 0) fail(`Il ne reste plus de jeton ${COLOR_NAMES[c]}.`);
  }
  const required = requiredDifferentCount(s);
  if (required === 0) fail('Il ne reste aucun jeton de couleur à prendre.');
  if (colors.length !== required) {
    fail(`Vous devez prendre ${required} jeton${required > 1 ? 's' : ''} de couleurs différentes.`);
  }
  for (const c of colors) {
    s.bank[c] -= 1;
    player.tokens[c] += 1;
  }
  return `prend ${colors.map((c) => COLOR_NAMES[c]).join(', ')}`;
}

function takeSame(s, player, color) {
  if (!COLORS.includes(color)) fail(color === GOLD ? "On ne peut pas prendre d'or directement." : 'Couleur inconnue.');
  if (s.bank[color] < MIN_SAME_COLOR_STOCK) {
    fail(
      `Pour prendre 2 jetons ${COLOR_NAMES[color]}, il faut qu'il en reste au moins ${MIN_SAME_COLOR_STOCK} (il en reste ${s.bank[color]}).`,
    );
  }
  s.bank[color] -= 2;
  player.tokens[color] += 2;
  return `prend 2 ${COLOR_NAMES[color]}`;
}

function refillMarket(s, level, index) {
  s.market[level][index] = s.decks[level].length > 0 ? s.decks[level].shift() : null;
}

function reserve(s, player, action) {
  if (player.reserved.length >= MAX_RESERVED) fail(`Vous ne pouvez pas réserver plus de ${MAX_RESERVED} cartes.`);
  let cardId;
  if (action.cardId) {
    const loc = findCardLocation(s, player, action.cardId);
    if (!loc || loc.where !== 'market') fail("Cette carte n'est pas visible sur le plateau.");
    cardId = action.cardId;
    refillMarket(s, loc.level, loc.index);
  } else if (LEVELS.includes(action.level)) {
    if (s.decks[action.level].length === 0) fail(`La pioche de niveau ${action.level} est vide.`);
    cardId = s.decks[action.level].shift();
  } else {
    fail('Choisissez une carte ou une pioche à réserver.');
  }
  player.reserved.push(cardId);
  let goldMsg = ' (plus d’or disponible)';
  if (s.bank[GOLD] > 0) {
    s.bank[GOLD] -= 1;
    player.tokens[GOLD] += 1;
    goldMsg = ' et prend 1 or';
  }
  return `réserve une carte de niveau ${getCard(cardId).level}${goldMsg}`;
}

function buy(s, player, cardId) {
  const loc = findCardLocation(s, player, cardId);
  if (!loc) fail("Cette carte n'est ni sur le plateau ni dans votre réserve.");
  const card = getCard(cardId);
  const payment = computePayment(player, card);
  if (!payment) fail("Vous n'avez pas assez de jetons (ni d'or) pour acheter cette carte.");
  for (const t of TOKEN_TYPES) {
    player.tokens[t] -= payment[t];
    s.bank[t] += payment[t];
  }
  if (loc.where === 'market') refillMarket(s, loc.level, loc.index);
  else player.reserved.splice(loc.index, 1);
  player.cards.push(cardId);
  return `achète une carte ${COLOR_NAMES[card.bonus]} de niveau ${card.level} (${card.points} pt)`;
}

function discard(s, player, color) {
  if (!TOKEN_TYPES.includes(color)) fail('Couleur inconnue.');
  if (player.tokens[color] <= 0) fail(`Vous n'avez pas de jeton ${COLOR_NAMES[color]} à défausser.`);
  player.tokens[color] -= 1;
  s.bank[color] += 1;
  return `défausse 1 ${COLOR_NAMES[color]}`;
}

function awardNoble(s, player, nobleId) {
  s.nobles = s.nobles.filter((id) => id !== nobleId);
  player.nobles.push(nobleId);
  s.pendingNobles = [];
}

/** Enchaîne la fin de tour : défausse, nobles, passage au joueur suivant. */
function continueEndOfTurn(s) {
  const player = s.players[s.current];
  if (countTokens(player.tokens) > MAX_TOKENS) {
    s.phase = 'discard';
    return;
  }
  if (s.phase !== 'noble-done') {
    const eligible = eligibleNobles(s, player);
    if (eligible.length === 1) {
      awardNoble(s, player, eligible[0]);
      s.log.push({ player: s.current, text: 'reçoit la visite d’un noble (+3)' });
    } else if (eligible.length > 1) {
      s.phase = 'noble';
      s.pendingNobles = eligible;
      return;
    }
  }
  if (getPoints(player) >= WINNING_POINTS) s.finalRound = true;
  const next = (s.current + 1) % s.numPlayers;
  if (next === 0) {
    if (s.finalRound) {
      s.phase = 'over';
      return;
    }
    s.round += 1;
  }
  s.current = next;
  s.phase = 'play';
}

/**
 * Applique une action et renvoie un nouvel état (l'état d'origine n'est pas modifié).
 * @throws {IllegalActionError}
 */
export function applyAction(state, action) {
  if (!action || typeof action !== 'object') fail('Action invalide.');
  if (state.phase === 'over') fail('La partie est terminée.');
  const s = clone(state);
  const player = s.players[s.current];
  let text;

  if (s.phase === 'discard') {
    if (action.type !== 'discard') fail(`Vous avez plus de ${MAX_TOKENS} jetons : défaussez d'abord l'excédent.`);
    text = discard(s, player, action.color);
  } else if (s.phase === 'noble') {
    if (action.type !== 'chooseNoble') fail('Choisissez le noble qui vous rend visite.');
    if (!s.pendingNobles.includes(action.nobleId)) fail('Ce noble ne peut pas vous rendre visite.');
    awardNoble(s, player, action.nobleId);
    s.phase = 'noble-done';
    text = 'reçoit la visite d’un noble (+3)';
  } else {
    switch (action.type) {
      case 'takeDifferent':
        text = takeDifferent(s, player, action.colors);
        break;
      case 'takeSame':
        text = takeSame(s, player, action.color);
        break;
      case 'reserve':
        text = reserve(s, player, action);
        break;
      case 'buy':
        text = buy(s, player, action.cardId);
        break;
      case 'pass': {
        const legal = getLegalActions(state);
        if (legal.length !== 1 || legal[0].type !== 'pass') fail('Vous ne pouvez passer que si aucune autre action n’est possible.');
        text = 'passe son tour';
        break;
      }
      case 'discard':
        fail(`Vous ne pouvez défausser que si vous avez plus de ${MAX_TOKENS} jetons.`);
        break;
      case 'chooseNoble':
        fail("Aucun noble n'est à choisir pour le moment.");
        break;
      default:
        fail(`Action inconnue : ${action.type}.`);
    }
  }
  s.log.push({ player: s.current, text });
  continueEndOfTurn(s);
  return deepFreeze(s);
}

// ---------------------------------------------------------------------------
// Fin de partie
// ---------------------------------------------------------------------------

export function isGameOver(state) {
  return state.phase === 'over';
}

/**
 * Classement final. Le plus de points gagne ; en cas d'égalité, le moins de
 * cartes développement. Plusieurs gagnants si l'égalité persiste.
 * @returns {{winners: number[], ranking: {player: number, points: number, cards: number}[]} | null}
 */
export function getWinner(state) {
  if (!isGameOver(state)) return null;
  const ranking = state.players
    .map((p, i) => ({ player: i, name: p.name, points: getPoints(p), cards: p.cards.length }))
    .sort((a, b) => b.points - a.points || a.cards - b.cards);
  const best = ranking[0];
  const winners = ranking.filter((r) => r.points === best.points && r.cards === best.cards).map((r) => r.player);
  return { winners, ranking };
}
