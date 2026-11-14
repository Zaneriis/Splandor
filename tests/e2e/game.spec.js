import { expect, test } from '@playwright/test';

const SEED = '42';

async function startGame(page, { players = 2, ai = [], seed = SEED, names = [] } = {}) {
  await page.goto('/?aiDelay=0');
  await expect(page.getByTestId('setup-screen')).toBeVisible();
  await page.getByTestId(`player-count-${players}`).check();
  for (const [i, name] of names.entries()) await page.getByTestId(`player-name-${i}`).fill(name);
  for (const i of ai) await page.getByTestId(`player-ai-${i}`).check();
  await page.getByTestId('seed-input').fill(seed);
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('game-screen')).toBeVisible();
}

const getState = (page) => page.evaluate(() => window.__splendor.getState());

/** Traduit une action de l'engine en clics dans l'interface. */
async function perform(page, action) {
  switch (action.type) {
    case 'takeDifferent':
      for (const c of action.colors) await page.getByTestId(`bank-token-${c}`).click();
      await page.getByTestId('confirm-take').click();
      break;
    case 'takeSame':
      await page.getByTestId(`bank-token-${action.color}`).click();
      await page.getByTestId(`bank-token-${action.color}`).click();
      await page.getByTestId('confirm-take').click();
      break;
    case 'reserve':
      if (action.cardId) await page.getByTestId(`card-${action.cardId}`).click();
      else await page.getByTestId(`deck-${action.level}`).click();
      await page.getByTestId('card-action-reserve').click();
      break;
    case 'buy': {
      const market = page.getByTestId(`card-${action.cardId}`);
      if (await market.count()) await market.click();
      else await page.getByTestId(`reserved-card-${action.cardId}`).click();
      await page.getByTestId('card-action-buy').click();
      break;
    }
    case 'discard':
      await page.getByTestId(`discard-token-${action.color}`).click();
      break;
    case 'chooseNoble':
      await page.getByTestId(`noble-choice-${action.nobleId}`).click();
      break;
    case 'pass':
      await page.getByTestId('pass-turn').click();
      break;
    default:
      throw new Error(`Action inconnue ${action.type}`);
  }
}

/** Joue un coup suggéré par l'IA, via l'interface, et vérifie que l'état a changé. */
async function playSuggested(page) {
  const before = await page.evaluate(() => window.__splendor.getState().log.length);
  const action = await page.evaluate(() => window.__splendor.aiAction());
  await perform(page, action);
  await expect.poll(() => page.evaluate(() => window.__splendor.getState().log.length)).toBeGreaterThan(before);
  return action;
}

test('affiche la mise en place d’une partie à 2 joueurs', async ({ page }) => {
  await startGame(page, { names: ['Alice', 'Bob'] });
  await expect(page.locator('[data-testid^="market-"] .card')).toHaveCount(12);
  await expect(page.locator('[data-testid="nobles"] .noble')).toHaveCount(3);
  for (const c of ['white', 'blue', 'green', 'red', 'black']) {
    await expect(page.getByTestId(`bank-token-${c}`).locator('.token__count')).toHaveText('4');
  }
  await expect(page.getByTestId('bank-token-gold').locator('.token__count')).toHaveText('5');
  await expect(page.getByTestId('current-player')).toContainText('Alice');
  await expect(page.getByTestId('player-panel-1')).toContainText('Bob');
});

test('prendre des jetons, avec messages d’erreur clairs', async ({ page }) => {
  await startGame(page);
  // 2 couleurs seulement : refusé.
  await page.getByTestId('bank-token-white').click();
  await page.getByTestId('bank-token-blue').click();
  await page.getByTestId('confirm-take').click();
  await expect(page.getByTestId('message')).toContainText('Vous devez prendre 3 jetons');
  // 3 couleurs différentes.
  await page.getByTestId('bank-token-green').click();
  await page.getByTestId('confirm-take').click();
  await expect(page.getByTestId('player-tokens-0-white')).toHaveText('1');
  await expect(page.getByTestId('player-tokens-0-blue')).toHaveText('1');
  await expect(page.getByTestId('player-tokens-0-green')).toHaveText('1');
  await expect(page.getByTestId('bank-token-white').locator('.token__count')).toHaveText('3');
  await expect(page.getByTestId('player-panel-1')).toHaveAttribute('aria-current', 'true');
  // Joueur 2 : 2 jetons identiques.
  await page.getByTestId('bank-token-red').click();
  await page.getByTestId('bank-token-red').click();
  await page.getByTestId('confirm-take').click();
  await expect(page.getByTestId('player-tokens-1-red')).toHaveText('2');
  // Joueur 1 : 2 blancs impossible (il en reste 3).
  await page.getByTestId('bank-token-white').click();
  await page.getByTestId('bank-token-white').click();
  await expect(page.getByTestId('message')).toContainText('au moins 4');
});

test('réserver une carte visible et le dessus d’une pioche', async ({ page }) => {
  await startGame(page);
  const state = await getState(page);
  const cardId = state.market[2][1];
  await page.getByTestId(`card-${cardId}`).click();
  await page.getByTestId('card-action-reserve').click();
  await expect(page.getByTestId('player-reserved-0')).toContainText('Réserve 1/3');
  await expect(page.getByTestId('player-tokens-0-gold')).toHaveText('1');
  await expect(page.getByTestId('bank-token-gold').locator('.token__count')).toHaveText('4');
  await expect(page.getByTestId(`card-${cardId}`)).toHaveCount(0);
  // Joueur 2 réserve la pioche de niveau 3.
  await page.getByTestId('deck-3').click();
  await page.getByTestId('card-action-reserve').click();
  await expect(page.getByTestId('player-reserved-1')).toContainText('Réserve 1/3');
  await expect(page.getByTestId('deck-3')).toContainText('15');
  // La carte réservée du joueur 1 est visible à son tour, celle du joueur 2 est cachée.
  await expect(page.getByTestId(`reserved-card-${cardId}`)).toBeVisible();
  await expect(page.getByTestId('reserved-back-1')).toBeVisible();
});

test('acheter une carte', async ({ page }) => {
  await startGame(page);
  let bought = false;
  for (let i = 0; i < 40 && !bought; i++) {
    const action = await playSuggested(page);
    bought = action.type === 'buy';
  }
  expect(bought).toBe(true);
  const state = await getState(page);
  const buyer = state.players.findIndex((p) => p.cards.length > 0);
  await expect(page.getByTestId(`player-cards-${buyer}`)).toHaveText('1');
  await expect(page.getByTestId('message')).toContainText('achète');
});

test('défausser au-delà de 10 jetons', async ({ page }) => {
  await startGame(page);
  const take3 = async (colors) => perform(page, { type: 'takeDifferent', colors });
  await take3(['white', 'blue', 'green']); // J1 : 3
  await perform(page, { type: 'reserve', level: 1 }); // J2
  await take3(['red', 'black', 'white']); // J1 : 6
  await perform(page, { type: 'reserve', level: 1 }); // J2
  await take3(['blue', 'green', 'red']); // J1 : 9
  await perform(page, { type: 'reserve', level: 2 }); // J2
  await take3(['white', 'blue', 'black']); // J1 : 12
  await expect(page.getByTestId('discard-panel')).toBeVisible();
  await expect(page.getByTestId('discard-panel')).toContainText('Défaussez-en 2');
  await expect(page.getByTestId('player-token-total-0')).toHaveText('12');
  // Impossible de jouer autre chose : la réserve est désactivée.
  await expect(page.getByTestId('bank-token-red')).toBeDisabled();
  await page.getByTestId('discard-token-white').click();
  await expect(page.getByTestId('discard-panel')).toContainText('Défaussez-en 1');
  await page.getByTestId('discard-token-blue').click();
  await expect(page.getByTestId('discard-panel')).toHaveCount(0);
  await expect(page.getByTestId('player-token-total-0')).toHaveText('10');
  await expect(page.getByTestId('player-panel-1')).toHaveAttribute('aria-current', 'true');
});

test('jouer une partie complète jusqu’à l’écran de victoire', async ({ page }) => {
  test.setTimeout(180_000);
  await startGame(page, { names: ['Alice', 'Bob'] });
  for (let i = 0; i < 400; i++) {
    if (await page.getByTestId('end-screen').count()) break;
    await playSuggested(page);
  }
  await expect(page.getByTestId('end-screen')).toBeVisible();
  const state = await getState(page);
  expect(state.phase).toBe('over');
  const points = state.players.map((_, i) => page.getByTestId(`player-points-${i}`).innerText());
  const values = (await Promise.all(points)).map((t) => Number.parseInt(t, 10));
  expect(Math.max(...values)).toBeGreaterThanOrEqual(15);
  await expect(page.getByTestId('winner-name')).toHaveText(/Alice|Bob/);
  // Nouvelle partie : retour à l'écran de configuration.
  await page.getByTestId('new-game').click();
  await expect(page.getByTestId('setup-screen')).toBeVisible();
});

test("l'IA joue seule contre l'ordinateur jusqu'à la fin", async ({ page }) => {
  test.setTimeout(120_000);
  await startGame(page, { ai: [0, 1] });
  await expect(page.getByTestId('end-screen')).toBeVisible({ timeout: 60_000 });
  await expect(page.getByTestId('winner-name')).not.toBeEmpty();
});

test("un humain contre l'IA : l'ordinateur répond automatiquement", async ({ page }) => {
  await startGame(page, { ai: [1] });
  await perform(page, { type: 'takeDifferent', colors: ['white', 'blue', 'green'] });
  await expect(page.getByTestId('current-player')).toContainText('Joueur 1');
  await expect.poll(async () => (await getState(page)).log.length).toBe(2);
});

test('navigation au clavier', async ({ page }) => {
  await startGame(page);
  await page.getByTestId('bank-token-white').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('bank-token-white')).toHaveClass(/is-picked/);
  await expect(page.getByTestId('bank-token-white')).toBeFocused();
  await page.getByTestId('bank-token-blue').focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('selection')).toHaveCount(0);
});
