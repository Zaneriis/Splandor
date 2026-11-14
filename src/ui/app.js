import {
  COLOR_NAMES,
  applyAction,
  chooseAiAction,
  createGame,
  getLegalActions,
  isGameOver,
  validateAction,
} from '../engine/index.js';
import { createFx } from './fx.js';
import { renderGame, renderSetup } from './render.js';

const DEFAULT_CONFIG = {
  numPlayers: 2,
  names: ['Joueur 1', 'Joueur 2', 'Joueur 3', 'Joueur 4'],
  ai: [false, false, false, false],
  seed: '',
};

/**
 * Contrôleur de l'interface : garde l'état de jeu (immuable) et l'état
 * d'interface (sélection, message), et redessine à chaque changement.
 */
export function createApp(root, { aiDelay = 700, fx = createFx() } = {}) {
  const store = {
    config: structuredClone(DEFAULT_CONFIG),
    game: null,
    ui: emptyUi(),
  };
  let aiTimer = null;
  /** Transition à animer au prochain rendu : { prev, next, action } ou 'intro'. */
  let pending = null;
  let screen = null;

  function emptyUi(message = null) {
    return { selection: [], selectedCard: null, selectedDeck: null, message };
  }

  // -------------------------------------------------------------------------
  // Rendu
  // -------------------------------------------------------------------------

  function render() {
    const focused = document.activeElement?.dataset?.testid;
    const snap = fx.snapshot(root);
    const scrollLeft = root.querySelector('.players__list')?.scrollLeft ?? 0;
    root.innerHTML = store.game
      ? renderGame(store.game, store.ui, getLegalActions(store.game))
      : renderSetup(store.config);
    const list = root.querySelector('.players__list');
    if (list) list.scrollLeft = scrollLeft;
    if (focused) root.querySelector(`[data-testid="${CSS.escape(focused)}"]`)?.focus({ preventScroll: true });
    announceScreen();
    const transition = pending;
    pending = null;
    if (transition === 'intro') {
      fx.intro(root, store.game);
      fx.revealPanel(root, store.game.current);
    } else if (transition) {
      fx.transition(root, snap, transition);
      if (isGameOver(transition.next)) {
        fx.victory(root);
        window.dispatchEvent(new CustomEvent('splendor:victory'));
      }
    }
    scheduleAi();
  }

  /** Prévient le décor 3D de l'écran affiché (accueil ou partie). */
  function announceScreen() {
    const mode = store.game ? 'game' : 'setup';
    if (mode === screen) return;
    screen = mode;
    document.documentElement.dataset.screen = mode;
    window.dispatchEvent(new CustomEvent('splendor:screen', { detail: { mode } }));
  }

  function setMessage(type, text) {
    store.ui.message = { type, text };
  }

  // -------------------------------------------------------------------------
  // Jeu
  // -------------------------------------------------------------------------

  function play(action) {
    const check = validateAction(store.game, action);
    if (!check.ok) {
      setMessage('error', check.error);
      render();
      return false;
    }
    const prev = store.game;
    store.game = applyAction(store.game, action);
    const last = store.game.log.at(-1);
    store.ui = emptyUi(last ? { type: 'info', text: `${prev.players[last.player].name} ${last.text}.` } : null);
    pending = { prev, next: store.game, action };
    render();
    return true;
  }

  function scheduleAi() {
    clearTimeout(aiTimer);
    const game = store.game;
    if (!game || isGameOver(game) || !game.players[game.current].ai) return;
    aiTimer = setTimeout(() => {
      if (store.game !== game) return;
      play(chooseAiAction(game));
    }, aiDelay);
  }

  function startGame() {
    const { numPlayers, names, ai, seed } = store.config;
    const parsed = Number.parseInt(seed, 10);
    store.config.lastSeed = Number.isFinite(parsed) ? parsed : Math.floor(Math.random() * 2 ** 31);
    store.game = createGame({
      numPlayers,
      seed: store.config.lastSeed,
      names: names.slice(0, numPlayers).map((n, i) => n.trim() || `Joueur ${i + 1}`),
      ai: ai.slice(0, numPlayers),
    });
    store.ui = emptyUi({ type: 'info', text: `Nouvelle partie (graine ${store.config.lastSeed}). À ${store.game.players[0].name} de commencer.` });
    pending = 'intro';
    render();
    root.querySelector('[data-testid="current-player"]')?.focus?.();
  }

  // -------------------------------------------------------------------------
  // Sélection
  // -------------------------------------------------------------------------

  function toggleToken(color) {
    const ui = store.ui;
    ui.selectedCard = null;
    ui.selectedDeck = null;
    ui.message = null;
    const sel = ui.selection;
    const isPair = sel.length === 2 && sel[0] === sel[1];
    if (sel.includes(color)) {
      if (sel.length === 1) {
        if (store.game.bank[color] < 4) {
          setMessage('error', `Impossible de prendre 2 ${COLOR_NAMES[color]} : il en faut au moins 4 dans la réserve (il en reste ${store.game.bank[color]}).`);
        } else sel.push(color);
      } else {
        sel.splice(sel.lastIndexOf(color), 1);
      }
    } else if (isPair) {
      setMessage('error', 'Vous prenez déjà 2 jetons identiques : annulez pour choisir d’autres couleurs.');
    } else if (sel.length >= 3) {
      setMessage('error', 'Vous ne pouvez prendre que 3 jetons de couleurs différentes.');
    } else {
      sel.push(color);
    }
    render();
  }

  function confirmTake() {
    const sel = store.ui.selection;
    const action = sel.length === 2 && sel[0] === sel[1] ? { type: 'takeSame', color: sel[0] } : { type: 'takeDifferent', colors: [...sel] };
    play(action);
  }

  function selectCard(cardId) {
    store.ui = emptyUi();
    store.ui.selectedCard = cardId;
    render();
  }

  function selectDeck(level) {
    store.ui = emptyUi();
    store.ui.selectedDeck = level;
    render();
  }

  function clearSelection() {
    store.ui = emptyUi();
    render();
  }

  // -------------------------------------------------------------------------
  // Événements
  // -------------------------------------------------------------------------

  root.addEventListener('click', (event) => {
    const el = event.target.closest('button');
    if (!el || el.disabled || !root.contains(el)) return;
    const game = store.game;
    if (!game) return;
    const humanTurn = !isGameOver(game) && !game.players[game.current].ai;
    const { token, card, deck, discard, noble, action } = el.dataset;

    if (action === 'quit') {
      clearTimeout(aiTimer);
      store.game = null;
      render();
      return;
    }
    if (action === 'new-game') {
      store.game = null;
      render();
      return;
    }
    if (action === 'replay') {
      store.config.seed = '';
      startGame();
      return;
    }
    if (!humanTurn) return;

    if (discard) play({ type: 'discard', color: discard });
    else if (noble) play({ type: 'chooseNoble', nobleId: noble });
    else if (game.phase !== 'play') return;
    else if (token) toggleToken(token);
    else if (card) selectCard(card);
    else if (deck) selectDeck(Number(deck));
    else if (action === 'take') confirmTake();
    else if (action === 'clear') clearSelection();
    else if (action === 'pass') play({ type: 'pass' });
    else if (action === 'buy') play({ type: 'buy', cardId: store.ui.selectedCard });
    else if (action === 'reserve') {
      play(store.ui.selectedCard ? { type: 'reserve', cardId: store.ui.selectedCard } : { type: 'reserve', level: store.ui.selectedDeck });
    }
  });

  fx.attachTilt(root);

  root.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && store.game) clearSelection();
  });

  root.addEventListener('change', (event) => {
    const el = event.target;
    if (el.name === 'count') {
      store.config.numPlayers = Number(el.value);
      render();
    } else if (el.classList.contains('js-ai')) {
      store.config.ai[Number(el.dataset.index)] = el.checked;
    }
  });

  root.addEventListener('input', (event) => {
    const el = event.target;
    if (el.classList.contains('js-name')) store.config.names[Number(el.dataset.index)] = el.value;
    else if (el.id === 'seed-input') store.config.seed = el.value;
  });

  root.addEventListener('submit', (event) => {
    event.preventDefault();
    startGame();
  });

  // Accès en lecture pour le débogage et les tests end-to-end.
  window.__splendor = {
    getState: () => store.game,
    aiAction: () => (store.game && !isGameOver(store.game) ? chooseAiAction(store.game) : null),
  };

  render();
  return store;
}
