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

/** Univers : la guilde remonte la chaîne du joyau, de la mine au palais. */
export const LEVEL_LORE = {
  1: { roman: 'I', name: 'Mines', line: 'On extrait la pierre brute.' },
  2: { roman: 'II', name: 'Routes marchandes', line: 'Navires et caravanes la portent au loin.' },
  3: { roman: 'III', name: 'Joailleries', line: 'Les maîtres artisans la sertissent.' },
};

/** Titres (fictifs) des nobles mécènes. */
export const NOBLE_TITLES = {
  N1: 'La Duchesse',
  N2: 'Le Doge',
  N3: 'Le Cardinal',
  N4: 'La Comtesse',
  N5: 'Le Prince',
  N6: 'Le Margrave',
  N7: 'La Marquise',
  N8: 'Le Baron',
  N9: 'L’Archiduc',
  N10: 'La Princesse',
};

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function plural(n, word) {
  return `${n} ${word}${n > 1 ? 's' : ''}`;
}

function gem(color, extra = '', letter = true) {
  return `<span class="gem gem--${color} ${extra}" aria-hidden="true"><svg viewBox="0 0 40 40"><use href="#gem-${color}"/></svg>${
    letter ? `<b class="gem__l">${GEM_LETTERS[color]}</b>` : ''
  }</span>`;
}

function costText(cost) {
  return COLORS.filter((c) => cost[c])
    .map((c) => `${cost[c]} ${COLOR_NAMES[c]}`)
    .join(', ');
}

/** Pile de jetons : une ombre par jeton pour donner de l'épaisseur. */
function stackShadow(count) {
  const layers = Math.min(Math.max(count - 1, 0), 6);
  const shadows = Array.from({ length: layers }, (_, i) => `0 ${(i + 1) * 3}px 0 -1px var(--edge)`);
  shadows.push(`0 ${layers * 3 + 6}px 14px #0009`);
  return shadows.join(',');
}

function chip(color, count) {
  return `<span class="token__chip" style="box-shadow:${stackShadow(count)}">${gem(color)}</span>`;
}

// ---------------------------------------------------------------------------
// Écran de configuration
// ---------------------------------------------------------------------------

export function renderSetup(config) {
  const count = config.numPlayers;
  const rows = Array.from({ length: 4 }, (_, i) => {
    const hidden = i >= count ? 'hidden' : '';
    return `
      <div class="setup__player" ${hidden} style="--i:${i}">
        <span class="setup__crest" aria-hidden="true"><svg viewBox="0 0 40 40"><use href="#crest"/></svg><b>${i + 1}</b></span>
        <label class="sr-only" for="player-name-${i}">Nom du joueur ${i + 1}</label>
        <input id="player-name-${i}" data-testid="player-name-${i}" type="text" maxlength="20" placeholder="Nom du joueur ${i + 1}"
          value="${escapeHtml(config.names[i])}" data-index="${i}" class="js-name" autocomplete="off" />
        <label class="switch">
          <input type="checkbox" data-testid="player-ai-${i}" data-index="${i}" class="js-ai" ${config.ai[i] ? 'checked' : ''} />
          <span class="switch__track" aria-hidden="true"></span>
          Ordinateur
        </label>
      </div>`;
  }).join('');

  const pillars = LEVELS.map(
    (l) => `
      <li class="pillar" style="--i:${l}">
        <span class="pillar__art" aria-hidden="true"><svg viewBox="0 0 120 70"><use href="#art-${l}"/></svg></span>
        <span class="pillar__roman">${LEVEL_LORE[l].roman}</span>
        <strong>${LEVEL_LORE[l].name}</strong>
        <span>${LEVEL_LORE[l].line}</span>
      </li>`,
  ).join('');

  return `
  <main id="main" class="setup" data-testid="setup-screen">
    <header class="hero">
      <p class="hero__kicker">Florence · Venise · Bruges — XV<sup>e</sup> siècle</p>
      <h1 class="title"><span class="title__main" data-text="Splendor">Splendor</span> <span class="title__sub">Web</span></h1>
      <p class="hero__lore">Vous dirigez une guilde de marchands. Achetez des mines, affrétez des navires, ouvrez des joailleries…
        et attirez la faveur des nobles. Le premier à <strong>${WINNING_POINTS} points de prestige</strong> annonce la dernière manche.</p>
      <ol class="pillars">${pillars}</ol>
    </header>
    <form class="setup__form glass js-setup">
      <fieldset class="setup__count">
        <legend>Nombre de joueurs</legend>
        <div class="segmented">
        ${[2, 3, 4]
          .map(
            (n) => `<label class="segmented__opt"><input type="radio" name="count" value="${n}" data-testid="player-count-${n}" ${
              n === count ? 'checked' : ''
            } /><span>${n} joueurs</span></label>`,
          )
          .join('')}
        </div>
      </fieldset>
      <fieldset class="setup__players">
        <legend>Les maisons marchandes</legend>
        ${rows}
      </fieldset>
      <div class="setup__seed">
        <label for="seed-input">Graine <small>(facultatif, pour rejouer la même mise en place)</small></label>
        <input id="seed-input" data-testid="seed-input" type="text" inputmode="numeric" placeholder="Aléatoire" value="${escapeHtml(config.seed ?? '')}" />
      </div>
      <button type="submit" class="btn btn--primary btn--hero" data-testid="start-game"><span>Commencer la partie</span></button>
    </form>
    <details class="rules glass">
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
  const title = NOBLE_TITLES[nobleId] ?? 'Noble';
  const req = COLORS.filter((c) => noble.requirement[c]);
  const label = `${title}, noble, ${noble.points} points, demande ${req.map((c) => `${noble.requirement[c]} bonus ${COLOR_NAMES[c]}`).join(', ')}`;
  const inner = `
    <span class="noble__portrait" aria-hidden="true"><svg viewBox="0 0 60 60"><use href="#noble-bust"/></svg></span>
    <span class="noble__points">${noble.points}</span>
    <span class="noble__name">${title}</span>
    <span class="noble__req">${req.map((c) => `<span class="req req--${c}">${noble.requirement[c]}</span>`).join('')}</span>`;
  return button
    ? `<button type="button" class="noble noble--choice" data-testid="${testid}" data-noble="${nobleId}" aria-label="${label}">${inner}</button>`
    : `<div class="noble" data-testid="${testid}" data-noble-id="${nobleId}" role="img" aria-label="${label}">${inner}</div>`;
}

export function renderCard(cardId, { player, selected, highlight, testid = `card-${cardId}`, small = false } = {}) {
  const card = getCard(cardId);
  const affordable = player ? canAfford(player, card) : false;
  const label = `Carte niveau ${card.level}, bonus ${COLOR_NAMES[card.bonus]}, ${plural(card.points, 'point')}, coût : ${costText(card.cost)}${
    highlight && affordable ? '. Vous pouvez l’acheter' : ''
  }`;
  const classes = [
    'card',
    `card--${card.bonus}`,
    `card--l${card.level}`,
    small ? 'card--small' : '',
    highlight && affordable ? 'is-affordable' : '',
    selected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return `
    <button type="button" class="${classes}" data-testid="${testid}" data-card="${cardId}" aria-label="${label}" aria-pressed="${selected ? 'true' : 'false'}">
      <span class="card__face">
        <span class="card__head">
          <span class="card__points">${card.points || ''}</span>
          ${gem(card.bonus, 'gem--bonus')}
        </span>
        <span class="card__art" aria-hidden="true"><svg viewBox="0 0 120 70" preserveAspectRatio="xMidYMax slice"><use href="#art-${card.level}"/></svg></span>
        <span class="card__cost">
          ${COLORS.filter((c) => card.cost[c])
            .map((c) => `<span class="cost cost--${c}">${card.cost[c]}</span>`)
            .join('')}
        </span>
        <span class="card__level" aria-hidden="true">${LEVEL_LORE[card.level].roman}</span>
      </span>
      <span class="card__glare" aria-hidden="true"></span>
    </button>`;
}

function renderCardBack(level, testid) {
  return `<div class="card card--back card--small card--l${level}" data-testid="${testid}" role="img" aria-label="Carte réservée de niveau ${level}, cachée">
      <span class="card__back-mark">${LEVEL_LORE[level].roman}</span></div>`;
}

function renderMarket(game, ui, interactive) {
  const player = game.players[game.current];
  return [...LEVELS]
    .reverse()
    .map((level) => {
      const deckCount = game.decks[level].length;
      const deckSelected = ui.selectedDeck === level;
      const canReserveDeck = interactive && deckCount > 0 && player.reserved.length < 3;
      const lore = LEVEL_LORE[level];
      const deck = `
        <button type="button" class="deck deck--l${level} ${deckSelected ? 'is-selected' : ''} ${canReserveDeck ? 'is-actionable' : ''}"
          data-testid="deck-${level}" data-deck="${level}" ${deckCount === 0 ? 'disabled' : ''}
          aria-pressed="${deckSelected}" aria-label="Pioche de niveau ${level} (${lore.name}), ${plural(deckCount, 'carte')}">
          <span class="deck__layers" aria-hidden="true"></span>
          <span class="deck__roman" aria-hidden="true">${lore.roman}</span>
          <span class="deck__name" aria-hidden="true">${lore.name}</span>
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
      return `<div class="market__row market__row--l${level}" role="group" aria-label="Cartes de niveau ${level} : ${lore.name}">${deck}${cards}</div>`;
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
        ${chip(t, count)}<span class="token__count">${count}</span><span class="token__name" aria-hidden="true">Or</span></div>`;
    }
    return `<button type="button" class="token token--${t} ${picked ? 'is-picked' : ''} ${interactive && count > 0 ? 'is-actionable' : ''}"
        data-testid="bank-token-${t}" data-token="${t}" ${count === 0 || !interactive ? 'disabled' : ''}
        aria-label="${plural(count, 'jeton')} ${name}${picked ? `, ${picked} sélectionné${picked > 1 ? 's' : ''}` : ''}">
        ${chip(t, count - picked)}<span class="token__count">${count}</span>${picked ? `<span class="token__picked">+${picked}</span>` : ''}
        <span class="token__name" aria-hidden="true">${name}</span>
      </button>`;
  }).join('');
}

function renderActionBar(game, ui, interactive, legal) {
  const player = game.players[game.current];
  if (!interactive) {
    if (game.phase === 'over') return '';
    return `<section class="action-bar action-bar--waiting" aria-label="Action en cours">
      <p class="action-bar__hint"><span class="thinking" aria-hidden="true"><i></i><i></i><i></i></span>
      ${escapeHtml(player.name)} examine ses comptes…</p></section>`;
  }
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
                aria-label="Défausser 1 ${COLOR_NAMES[t]} (vous en avez ${player.tokens[t]})">${chip(t, player.tokens[t])}<span class="token__count">${
                  player.tokens[t]
                }</span></button>`,
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
        <span class="action-bar__label">Jetons choisis</span>
        <span class="action-bar__gems">${ui.selection.map((c) => gem(c, 'gem--pop')).join('')}</span>
        <span class="sr-only">${ui.selection.map((c) => COLOR_NAMES[c]).join(', ')}</span>
        <span class="action-bar__buttons">
          <button type="button" class="btn btn--primary" data-testid="confirm-take" data-action="take">Prendre ces jetons</button>
          <button type="button" class="btn" data-testid="clear-selection" data-action="clear">Annuler</button>
        </span>
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
      desc = `${gem(card.bonus)} Carte ${COLOR_NAMES[card.bonus]} — ${LEVEL_LORE[card.level].name} (${plural(card.points, 'point')})${
        reservedByMe ? ', dans votre réserve' : ''
      }`;
    } else {
      desc = `Dessus de la pioche ${LEVEL_LORE[ui.selectedDeck].roman} — ${LEVEL_LORE[ui.selectedDeck].name}`;
    }
    parts.push(`
      <div class="action-bar__group">
        <span class="action-bar__label">${desc}</span>
        <span class="action-bar__buttons">
          ${ui.selectedCard ? `<button type="button" class="btn btn--primary ${canBuy ? '' : 'is-unavailable'}" data-testid="card-action-buy" data-action="buy">Acheter</button>` : ''}
          ${canReserve ? `<button type="button" class="btn" data-testid="card-action-reserve" data-action="reserve">Réserver${game.bank.gold > 0 ? ' (+1 or)' : ''}</button>` : ''}
          <button type="button" class="btn" data-testid="clear-selection" data-action="clear">Annuler</button>
        </span>
      </div>`);
  } else if (parts.length === 0) {
    parts.push(`<p class="action-bar__hint">Choisissez des jetons dans la réserve, ou une carte à acheter ou réserver.
      Les cartes que vous pouvez acheter scintillent.</p>`);
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
  const progress = Math.min(points / WINNING_POINTS, 1);
  const reserved = player.reserved
    .map((id) =>
      showReserved
        ? renderCard(id, { player, selected: ui.selectedCard === id, highlight: true, testid: `reserved-card-${id}`, small: true })
        : renderCardBack(getCard(id).level, `reserved-back-${index}`),
    )
    .join('');
  return `
    <section class="player ${isCurrent ? 'is-current' : ''}" data-testid="player-panel-${index}" data-player="${index}" aria-label="${escapeHtml(player.name)}" ${
      isCurrent ? 'aria-current="true"' : ''
    } style="--seat:${index}">
      <header class="player__head">
        <span class="player__crest" aria-hidden="true"><svg viewBox="0 0 40 40"><use href="#crest"/></svg><b>${escapeHtml(
          (player.name.trim()[0] ?? '?').toUpperCase(),
        )}</b></span>
        <h3 class="player__name">${escapeHtml(player.name)}${player.ai ? ' <span class="badge">IA</span>' : ''}</h3>
        <span class="player__points" data-testid="player-points-${index}" aria-label="${plural(points, 'point')}">${points}<small> pts</small></span>
      </header>
      <div class="gauge" style="--p:${progress}" aria-hidden="true"><span></span></div>
      <div class="player__row" aria-label="Jetons (${total})">
        <span class="player__label">Jetons <span data-testid="player-token-total-${index}">${total}</span>/${MAX_TOKENS}</span>
        ${TOKEN_TYPES.map(
          (t) => `<span class="mini mini--${t} ${player.tokens[t] ? '' : 'is-zero'}" data-testid="player-tokens-${index}-${t}" title="${COLOR_NAMES[t]}"
            aria-label="${player.tokens[t]} ${COLOR_NAMES[t]}">${player.tokens[t]}</span>`,
        ).join('')}
      </div>
      <div class="player__row" aria-label="Bonus">
        <span class="player__label">Bonus</span>
        ${COLORS.map(
          (c) => `<span class="mini mini--bonus mini--${c} ${bonuses[c] ? '' : 'is-zero'}" data-testid="player-bonus-${index}-${c}" title="bonus ${COLOR_NAMES[c]}"
            aria-label="${bonuses[c]} bonus ${COLOR_NAMES[c]}">${bonuses[c]}</span>`,
        ).join('')}
      </div>
      <div class="player__row player__row--stats">
        <span class="stat"><span class="player__label">Nobles</span><span data-testid="player-nobles-${index}">${player.nobles.length}</span></span>
        <span class="stat"><span class="player__label">Cartes</span><span data-testid="player-cards-${index}">${player.cards.length}</span></span>
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
      <div class="overlay__rays" aria-hidden="true"></div>
      <div class="overlay__box glass">
        <span class="overlay__crown" aria-hidden="true"><svg viewBox="0 0 60 60"><use href="#noble-bust"/></svg></span>
        <h2 id="end-title">${result.winners.length > 1 ? 'Égalité parfaite !' : 'Victoire !'}</h2>
        <p class="winner" data-testid="winner-name">${names.join(' et ')}</p>
        <p class="overlay__lore">La guilde la plus prestigieuse de la Renaissance.</p>
        <ol class="ranking">
          ${result.ranking
            .map(
              (r, i) =>
                `<li data-testid="ranking-${r.player}" style="--i:${i}"><span class="ranking__pos">${i + 1}</span><span class="ranking__name">${escapeHtml(
                  game.players[r.player].name,
                )}</span><span class="ranking__score">${plural(r.points, 'point')}, ${plural(r.cards, 'carte')}</span></li>`,
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
    <header class="topbar glass">
      <h1 class="title title--small"><span class="title__main">Splendor</span> <span class="title__sub">Web</span></h1>
      <p class="turn" data-testid="current-player" aria-live="polite">
        ${
          over
            ? `Partie terminée après ${game.round} manche${game.round > 1 ? 's' : ''}`
            : `<span class="turn__round">Manche ${game.round}</span> <span class="turn__sep">—</span> au tour de <strong>${escapeHtml(player.name)}</strong>${
                player.ai ? ' (réfléchit…)' : ''
              }`
        }
      </p>
      ${game.finalRound && !over ? `<p class="final-round" data-testid="final-round">Dernière manche !</p>` : ''}
      <button type="button" class="btn btn--ghost" data-action="quit" data-testid="quit">Quitter</button>
    </header>
    <div class="layout">
      <div class="board">
        <section class="nobles nobles--court" aria-label="Nobles" data-testid="nobles">${game.nobles.map((id) => renderNoble(id)).join('')}</section>
        <section class="market table" aria-label="Cartes développement">${renderMarket(game, ui, playable)}</section>
        <section class="bank" aria-label="Réserve de jetons" data-testid="bank">${renderBank(game, ui, playable)}</section>
        ${message}
        ${renderActionBar(game, ui, interactive, legal)}
      </div>
      <aside class="players" aria-label="Joueurs">
        <div class="players__list">${game.players.map((_, i) => renderPlayer(game, i, ui)).join('')}</div>
        <details class="log glass" open><summary class="log__title">Chronique</summary><ol data-testid="log">${log}</ol></details>
      </aside>
    </div>
    ${over ? renderEnd(game) : ''}
  </main>`;
}
