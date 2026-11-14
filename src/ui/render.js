import {
  COLORS,
  COLOR_NAMES,
  GOLD,
  LEVELS,
  MAX_TOKENS,
  TOKEN_TYPES,
  WINNING_POINTS,
  canAfford,
  countTokens,
  getBonuses,
  getCard,
  getNoble,
  getPoints,
  getWinner,
} from '../engine/index.js';

/** Lettre affichée sur chaque gemme (aide pour daltoniens). */
export const GEM_LETTERS = { white: 'D', blue: 'S', green: 'E', red: 'R', black: 'O', gold: 'Or' };

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

function gem(color, content = GEM_LETTERS[color], extra = '') {
  return `<span class="gem gem--${color} ${extra}" aria-hidden="true">${content}</span>`;
}

function costText(cost) {
  return COLORS.filter((c) => cost[c])
    .map((c) => `${cost[c]} ${COLOR_NAMES[c]}`)
    .join(', ');
}

// ---------------------------------------------------------------------------
// Écran de configuration
// ---------------------------------------------------------------------------

export function renderSetup(config) {
  const count = config.numPlayers;
  const rows = Array.from({ length: 4 }, (_, i) => {
    const hidden = i >= count ? 'hidden' : '';
    return `
      <div class="setup__player" ${hidden}>
        <label for="player-name-${i}">Nom du joueur ${i + 1}</label>
        <input id="player-name-${i}" data-testid="player-name-${i}" type="text" maxlength="20"
          value="${escapeHtml(config.names[i])}" data-index="${i}" class="js-name" />
        <label class="setup__ai">
          <input type="checkbox" data-testid="player-ai-${i}" data-index="${i}" class="js-ai" ${config.ai[i] ? 'checked' : ''} />
          Ordinateur
        </label>
      </div>`;
  }).join('');

  return `
  <main id="main" class="setup" data-testid="setup-screen">
    <h1 class="title">Splendor <span class="title__sub">Web</span></h1>
    <p class="setup__intro">Collectionnez des gemmes, achetez des développements et attirez les nobles.
      Le premier à ${WINNING_POINTS} points de prestige déclenche la fin de la partie.</p>
    <form class="setup__form js-setup">
      <fieldset class="setup__count">
        <legend>Nombre de joueurs</legend>
        ${[2, 3, 4]
          .map(
            (n) => `<label class="pill"><input type="radio" name="count" value="${n}" data-testid="player-count-${n}" ${
              n === count ? 'checked' : ''
            } /> ${n} joueurs</label>`,
          )
          .join('')}
      </fieldset>
      <fieldset class="setup__players">
        <legend>Joueurs</legend>
        ${rows}
      </fieldset>
      <div class="setup__seed">
        <label for="seed-input">Graine (facultatif, pour rejouer la même mise en place)</label>
        <input id="seed-input" data-testid="seed-input" type="text" inputmode="numeric" value="${escapeHtml(config.seed ?? '')}" />
      </div>
      <button type="submit" class="btn btn--primary" data-testid="start-game">Commencer la partie</button>
    </form>
    <details class="rules">
      <summary>Rappel des règles</summary>
      <ul>
        <li>À votre tour, faites <strong>une seule</strong> action :
          <ul>
            <li>prendre 3 jetons de couleurs différentes ;</li>
            <li>prendre 2 jetons de la même couleur (s'il en reste au moins 4) ;</li>
            <li>réserver une carte (visible ou dessus de pioche) et prendre 1 or ; 3 réservations maximum ;</li>
            <li>acheter une carte visible ou réservée. Vos bonus réduisent le coût, l'or remplace n'importe quelle couleur.</li>
          </ul>
        </li>
        <li>Vous ne pouvez pas garder plus de ${MAX_TOKENS} jetons en fin de tour.</li>
        <li>Un noble vous rend visite (3 points) dès que vos bonus remplissent ses conditions.</li>
        <li>À ${WINNING_POINTS} points, on termine le tour : le plus de points gagne, puis le moins de cartes.</li>
      </ul>
      <p>Clavier : <kbd>Tab</kbd> pour naviguer, <kbd>Entrée</kbd>/<kbd>Espace</kbd> pour choisir, <kbd>Échap</kbd> pour annuler la sélection.</p>
    </details>
  </main>`;
}

// ---------------------------------------------------------------------------
// Plateau
// ---------------------------------------------------------------------------

function renderNoble(nobleId, { button = false, testid = `noble-${nobleId}` } = {}) {
  const noble = getNoble(nobleId);
  const req = COLORS.filter((c) => noble.requirement[c]);
  const label = `Noble, ${noble.points} points, demande ${req.map((c) => `${noble.requirement[c]} bonus ${COLOR_NAMES[c]}`).join(', ')}`;
  const inner = `
    <span class="noble__points">${noble.points}</span>
    <span class="noble__req">${req.map((c) => `<span class="req req--${c}">${noble.requirement[c]}</span>`).join('')}</span>`;
  return button
    ? `<button type="button" class="noble noble--choice" data-testid="${testid}" data-noble="${nobleId}" aria-label="${label}">${inner}</button>`
    : `<div class="noble" data-testid="${testid}" role="img" aria-label="${label}">${inner}</div>`;
}

export function renderCard(cardId, { player, selected, highlight, testid = `card-${cardId}`, small = false } = {}) {
  const card = getCard(cardId);
  const affordable = player ? canAfford(player, card) : false;
  const label = `Carte niveau ${card.level}, bonus ${COLOR_NAMES[card.bonus]}, ${plural(card.points, 'point')}, coût : ${costText(card.cost)}${
    highlight && affordable ? '. Vous pouvez l’acheter' : ''
  }`;
  const classes = ['card', `card--${card.bonus}`, small ? 'card--small' : '', highlight && affordable ? 'is-affordable' : '', selected ? 'is-selected' : '']
    .filter(Boolean)
    .join(' ');
  return `
    <button type="button" class="${classes}" data-testid="${testid}" data-card="${cardId}" aria-label="${label}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="card__head">
        <span class="card__points">${card.points || ''}</span>
        ${gem(card.bonus, GEM_LETTERS[card.bonus], 'gem--bonus')}
      </span>
      <span class="card__cost">
        ${COLORS.filter((c) => card.cost[c])
          .map((c) => `<span class="cost cost--${c}">${card.cost[c]}</span>`)
          .join('')}
      </span>
    </button>`;
}

function renderCardBack(level, testid) {
  return `<div class="card card--back card--small" data-testid="${testid}" role="img" aria-label="Carte réservée de niveau ${level}, cachée">
      <span class="card__level">${'•'.repeat(level)}</span></div>`;
}

function renderMarket(game, ui, interactive) {
  const player = game.players[game.current];
  return [...LEVELS]
    .reverse()
    .map((level) => {
      const deckCount = game.decks[level].length;
      const deckSelected = ui.selectedDeck === level;
      const canReserveDeck = interactive && deckCount > 0 && player.reserved.length < 3;
      const deck = `
        <button type="button" class="deck deck--l${level} ${deckSelected ? 'is-selected' : ''} ${canReserveDeck ? 'is-actionable' : ''}"
          data-testid="deck-${level}" data-deck="${level}" ${deckCount === 0 ? 'disabled' : ''}
          aria-pressed="${deckSelected}" aria-label="Pioche de niveau ${level}, ${plural(deckCount, 'carte')}">
          <span class="deck__level">${'•'.repeat(level)}</span>
          <span class="deck__count">${deckCount}</span>
        </button>`;
      const cards = game.market[level]
        .map((id, index) =>
          id
            ? `<div class="slot" data-testid="market-${level}-${index}">${renderCard(id, {
                player,
                selected: ui.selectedCard === id,
                highlight: interactive,
              })}</div>`
            : `<div class="slot slot--empty" data-testid="market-${level}-${index}" aria-label="Emplacement vide"></div>`,
        )
        .join('');
      return `<div class="market__row" role="group" aria-label="Cartes de niveau ${level}">${deck}${cards}</div>`;
    })
    .join('');
}

function renderBank(game, ui, interactive) {
  return TOKEN_TYPES.map((t) => {
    const count = game.bank[t];
    const picked = ui.selection.filter((c) => c === t).length;
    const name = COLOR_NAMES[t];
    if (t === GOLD) {
      return `<div class="token token--gold" data-testid="bank-token-gold" role="img" aria-label="${plural(count, 'jeton')} ${name} (joker, obtenu en réservant)">
        ${gem('gold')}<span class="token__count">${count}</span></div>`;
    }
    return `<button type="button" class="token token--${t} ${picked ? 'is-picked' : ''} ${interactive && count > 0 ? 'is-actionable' : ''}"
        data-testid="bank-token-${t}" data-token="${t}" ${count === 0 || !interactive ? 'disabled' : ''}
        aria-label="${plural(count, 'jeton')} ${name}${picked ? `, ${picked} sélectionné${picked > 1 ? 's' : ''}` : ''}">
        ${gem(t)}<span class="token__count">${count}</span>${picked ? `<span class="token__picked">+${picked}</span>` : ''}
      </button>`;
  }).join('');
}

function renderActionBar(game, ui, interactive, legal) {
  const player = game.players[game.current];
  if (!interactive) return '';
  if (game.phase === 'discard') {
    const excess = countTokens(player.tokens) - MAX_TOKENS;
    return `
      <section class="action-bar action-bar--alert" data-testid="discard-panel" aria-labelledby="discard-title">
        <h2 id="discard-title" class="action-bar__title">Trop de jetons ! Défaussez-en ${excess}.</h2>
        <p>Vous ne pouvez garder que ${MAX_TOKENS} jetons. Choisissez les jetons à remettre dans la réserve.</p>
        <div class="action-bar__tokens">
          ${TOKEN_TYPES.filter((t) => player.tokens[t] > 0)
            .map(
              (t) => `<button type="button" class="token token--${t} is-actionable" data-testid="discard-token-${t}" data-discard="${t}"
                aria-label="Défausser 1 ${COLOR_NAMES[t]} (vous en avez ${player.tokens[t]})">${gem(t)}<span class="token__count">${player.tokens[t]}</span></button>`,
            )
            .join('')}
        </div>
      </section>`;
  }
  if (game.phase === 'noble') {
    return `
      <section class="action-bar action-bar--alert" data-testid="noble-choice" aria-labelledby="noble-title">
        <h2 id="noble-title" class="action-bar__title">Plusieurs nobles veulent vous rendre visite : choisissez-en un.</h2>
        <div class="nobles">${game.pendingNobles.map((id) => renderNoble(id, { button: true, testid: `noble-choice-${id}` })).join('')}</div>
      </section>`;
  }

  const parts = [];
  if (legal.length === 1 && legal[0].type === 'pass') {
    parts.push(`<p>Aucune action n'est possible.</p>
      <button type="button" class="btn" data-testid="pass-turn" data-action="pass">Passer le tour</button>`);
  }
  if (ui.selection.length > 0) {
    parts.push(`
      <div class="action-bar__group" data-testid="selection">
        <span>Jetons choisis :</span>
        ${ui.selection.map((c) => gem(c)).join('')}
        <span class="sr-only">${ui.selection.map((c) => COLOR_NAMES[c]).join(', ')}</span>
        <button type="button" class="btn btn--primary" data-testid="confirm-take" data-action="take">Prendre ces jetons</button>
        <button type="button" class="btn" data-testid="clear-selection" data-action="clear">Annuler</button>
      </div>`);
  } else if (ui.selectedCard || ui.selectedDeck) {
    let desc;
    let canBuy = false;
    let canReserve = player.reserved.length < 3;
    if (ui.selectedCard) {
      const card = getCard(ui.selectedCard);
      const reservedByMe = player.reserved.includes(ui.selectedCard);
      canBuy = canAfford(player, card);
      canReserve = canReserve && !reservedByMe;
      desc = `Carte ${COLOR_NAMES[card.bonus]} de niveau ${card.level} (${plural(card.points, 'point')})${reservedByMe ? ', dans votre réserve' : ''}`;
    } else {
      desc = `Dessus de la pioche de niveau ${ui.selectedDeck}`;
    }
    parts.push(`
      <div class="action-bar__group">
        <span>${desc}</span>
        ${ui.selectedCard ? `<button type="button" class="btn btn--primary ${canBuy ? '' : 'is-unavailable'}" data-testid="card-action-buy" data-action="buy">Acheter</button>` : ''}
        ${canReserve ? `<button type="button" class="btn" data-testid="card-action-reserve" data-action="reserve">Réserver${game.bank.gold > 0 ? ' (+1 or)' : ''}</button>` : ''}
        <button type="button" class="btn" data-testid="clear-selection" data-action="clear">Annuler</button>
      </div>`);
  } else if (parts.length === 0) {
    parts.push(`<p class="action-bar__hint">Choisissez des jetons dans la réserve, ou une carte à acheter ou réserver.
      Les cartes que vous pouvez acheter sont entourées.</p>`);
  }
  return `<section class="action-bar" aria-label="Action en cours">${parts.join('')}</section>`;
}

function renderPlayer(game, index, ui) {
  const player = game.players[index];
  const isCurrent = index === game.current && game.phase !== 'over';
  const bonuses = getBonuses(player);
  const points = getPoints(player);
  const showReserved = isCurrent && !player.ai;
  const total = countTokens(player.tokens);
  const reserved = player.reserved
    .map((id) =>
      showReserved
        ? renderCard(id, { player, selected: ui.selectedCard === id, highlight: true, testid: `reserved-card-${id}`, small: true })
        : renderCardBack(getCard(id).level, `reserved-back-${index}`),
    )
    .join('');
  return `
    <section class="player ${isCurrent ? 'is-current' : ''}" data-testid="player-panel-${index}" aria-label="${escapeHtml(player.name)}" ${
      isCurrent ? 'aria-current="true"' : ''
    }>
      <header class="player__head">
        <h3 class="player__name">${escapeHtml(player.name)}${player.ai ? ' <span class="badge">IA</span>' : ''}</h3>
        <span class="player__points" data-testid="player-points-${index}" aria-label="${plural(points, 'point')}">${points}<small> pts</small></span>
      </header>
      <div class="player__row" aria-label="Jetons (${total})">
        <span class="player__label">Jetons <span data-testid="player-token-total-${index}">${total}</span>/${MAX_TOKENS}</span>
        ${TOKEN_TYPES.map(
          (t) => `<span class="mini mini--${t}" data-testid="player-tokens-${index}-${t}" title="${COLOR_NAMES[t]}"
            aria-label="${player.tokens[t]} ${COLOR_NAMES[t]}">${player.tokens[t]}</span>`,
        ).join('')}
      </div>
      <div class="player__row" aria-label="Bonus">
        <span class="player__label">Bonus</span>
        ${COLORS.map(
          (c) => `<span class="mini mini--bonus mini--${c}" data-testid="player-bonus-${index}-${c}" title="bonus ${COLOR_NAMES[c]}"
            aria-label="${bonuses[c]} bonus ${COLOR_NAMES[c]}">${bonuses[c]}</span>`,
        ).join('')}
      </div>
      <div class="player__row">
        <span class="player__label">Nobles</span><span data-testid="player-nobles-${index}">${player.nobles.length}</span>
        <span class="player__label">Cartes</span><span data-testid="player-cards-${index}">${player.cards.length}</span>
      </div>
      <div class="player__reserved" data-testid="player-reserved-${index}" aria-label="Réserve : ${plural(player.reserved.length, 'carte')}">
        <span class="player__label">Réserve ${player.reserved.length}/3</span>
        <div class="player__reserved-cards">${reserved}</div>
      </div>
    </section>`;
}

function renderEnd(game) {
  const result = getWinner(game);
  const names = result.winners.map((i) => escapeHtml(game.players[i].name));
  return `
    <div class="overlay" role="dialog" aria-modal="true" aria-labelledby="end-title" data-testid="end-screen">
      <div class="overlay__box">
        <h2 id="end-title">${result.winners.length > 1 ? 'Égalité parfaite !' : 'Victoire !'}</h2>
        <p class="winner" data-testid="winner-name">${names.join(' et ')}</p>
        <ol class="ranking">
          ${result.ranking
            .map(
              (r) =>
                `<li data-testid="ranking-${r.player}">${escapeHtml(game.players[r.player].name)} — ${plural(r.points, 'point')}, ${plural(
                  r.cards,
                  'carte',
                )}</li>`,
            )
            .join('')}
        </ol>
        <div class="overlay__actions">
          <button type="button" class="btn btn--primary" data-testid="replay" data-action="replay">Rejouer</button>
          <button type="button" class="btn" data-testid="new-game" data-action="new-game">Nouvelle partie</button>
        </div>
      </div>
    </div>`;
}

export function renderGame(game, ui, legal) {
  const player = game.players[game.current];
  const over = game.phase === 'over';
  const interactive = !over && !player.ai;
  const playable = interactive && game.phase === 'play';
  const message = ui.message
    ? `<p class="message message--${ui.message.type}" data-testid="message" role="${ui.message.type === 'error' ? 'alert' : 'status'}">${escapeHtml(
        ui.message.text,
      )}</p>`
    : `<p class="message" data-testid="message" role="status"></p>`;
  const log = game.log
    .slice(-6)
    .reverse()
    .map((e) => `<li><strong>${escapeHtml(game.players[e.player].name)}</strong> ${escapeHtml(e.text)}</li>`)
    .join('');

  return `
  <main id="main" class="game" data-testid="game-screen" data-phase="${game.phase}">
    <header class="topbar">
      <h1 class="title title--small">Splendor <span class="title__sub">Web</span></h1>
      <p class="turn" data-testid="current-player" aria-live="polite">
        ${
          over
            ? `Partie terminée après ${game.round} manche${game.round > 1 ? 's' : ''}`
            : `Manche ${game.round} — au tour de <strong>${escapeHtml(player.name)}</strong>${player.ai ? ' (réfléchit…)' : ''}`
        }
      </p>
      ${game.finalRound && !over ? `<p class="final-round" data-testid="final-round">Dernière manche !</p>` : ''}
      <button type="button" class="btn btn--ghost" data-action="quit" data-testid="quit">Quitter</button>
    </header>
    <div class="layout">
      <div class="board">
        <section class="nobles" aria-label="Nobles" data-testid="nobles">${game.nobles.map((id) => renderNoble(id)).join('')}</section>
        <section class="market" aria-label="Cartes développement">${renderMarket(game, ui, playable)}</section>
        <section class="bank" aria-label="Réserve de jetons" data-testid="bank">${renderBank(game, ui, playable)}</section>
        ${message}
        ${renderActionBar(game, ui, interactive, legal)}
      </div>
      <aside class="players" aria-label="Joueurs">
        ${game.players.map((_, i) => renderPlayer(game, i, ui)).join('')}
        <section class="log" aria-label="Historique"><h2 class="log__title">Historique</h2><ol data-testid="log">${log}</ol></section>
      </aside>
    </div>
    ${over ? renderEnd(game) : ''}
  </main>`;
}
