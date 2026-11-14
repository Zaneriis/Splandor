/** Couleurs de gemmes (hors or), dans l'ordre d'affichage. */
export const COLORS = Object.freeze(['white', 'blue', 'green', 'red', 'black']);
export const GOLD = 'gold';
export const TOKEN_TYPES = Object.freeze([...COLORS, GOLD]);
export const LEVELS = Object.freeze([1, 2, 3]);

export const MARKET_SIZE = 4;
export const MAX_RESERVED = 3;
export const MAX_TOKENS = 10;
export const WINNING_POINTS = 15;
export const GOLD_TOKENS = 5;
export const MIN_SAME_COLOR_STOCK = 4;

/** Nombre de jetons par couleur selon le nombre de joueurs. */
export const TOKENS_PER_COLOR = Object.freeze({ 2: 4, 3: 5, 4: 7 });

export const COLOR_NAMES = Object.freeze({
  white: 'diamant',
  blue: 'saphir',
  green: 'émeraude',
  red: 'rubis',
  black: 'onyx',
  gold: 'or',
});
