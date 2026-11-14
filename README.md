# Splendor Web

Adaptation web **non officielle** et jouable du jeu de société *Splendor*, en HTML, CSS et JavaScript vanilla
(modules ES). 2 à 4 joueurs en local (hot-seat), avec une IA simple pour jouer contre l'ordinateur.

> Projet de fan, sans affiliation avec l'éditeur. Aucune image ni logo officiel : le design (gemmes, cartes,
> nobles) est entièrement réalisé en CSS.

## Installation

Prérequis : Node.js 20 ou plus récent.

```bash
npm install
```

## Lancer le jeu

```bash
npm run dev        # serveur de développement Vite (http://localhost:5173)
npm run build      # build de production dans dist/
npm run preview    # sert le build de production
```

Options d'URL : `?aiDelay=0` fait jouer l'IA sans délai (700 ms par défaut).

## Tester

```bash
npm run lint              # ESLint
npm test                  # tests unitaires + intégration (Vitest)
npm run test:unit         # tests unitaires seuls
npm run test:integration  # simulations de parties complètes
npm run test:coverage     # couverture de src/engine (seuil : 90 %)
npm run test:e2e          # tests end-to-end (Playwright)
npm run test:all          # tout
```

Avant le premier `test:e2e`, installez le navigateur : `npx playwright install chromium`.
Pour utiliser un Chromium déjà présent sur la machine : `PW_CHROMIUM_PATH=/chemin/vers/chrome npm run test:e2e`.

La CI GitHub Actions (`.github/workflows/ci.yml`) lance lint, tests unitaires, intégration, couverture et e2e à
chaque push.

## Comment jouer

1. Choisissez le nombre de joueurs (2 à 4), leurs noms, cochez « Ordinateur » pour les joueurs contrôlés par l'IA,
   et éventuellement une graine pour rejouer exactement la même mise en place.
2. À votre tour, faites **une seule** action :
   - **Prendre 3 jetons de couleurs différentes** : cliquez sur 3 jetons de la réserve puis sur « Prendre ces jetons ».
   - **Prendre 2 jetons identiques** : cliquez deux fois sur la même couleur (seulement s'il en reste au moins 4).
   - **Réserver** : cliquez sur une carte visible ou sur une pioche, puis « Réserver ». Vous recevez 1 or s'il en
     reste. 3 cartes réservées au maximum.
   - **Acheter** : cliquez sur une carte visible ou une de vos cartes réservées, puis « Acheter ». Les bonus de vos
     cartes réduisent le coût et l'or remplace n'importe quelle couleur. Les cartes achetables sont entourées en vert.
3. Au-delà de 10 jetons, un panneau vous demande de défausser l'excédent.
4. Les nobles (3 points) viennent automatiquement en fin de tour quand vos bonus remplissent leurs conditions
   (un seul par tour ; vous choisissez s'il y en a plusieurs).
5. Dès qu'un joueur atteint 15 points, on termine la manche pour que chacun ait joué le même nombre de tours.
   Le plus de points gagne ; en cas d'égalité, celui qui a le moins de cartes développement.

Clavier : <kbd>Tab</kbd> pour naviguer, <kbd>Entrée</kbd> ou <kbd>Espace</kbd> pour choisir, <kbd>Échap</kbd> pour
annuler la sélection. Chaque gemme porte aussi une lettre (D, S, E, R, O, Or) pour ne pas dépendre des couleurs.

## Architecture

```
src/
  data/       cards.json (90 cartes), nobles.json (10 nobles)
  engine/     logique pure et immuable, sans DOM
    game.js     createGame, getLegalActions, applyAction, validateAction, isGameOver, getWinner…
    ai.js       chooseAiAction : IA gloutonne
    rng.js      générateur pseudo-aléatoire à graine (mulberry32) + mélange
  ui/         rendu DOM (render.js) et contrôleur / gestion des clics (app.js)
  main.js     point d'entrée
tests/
  unit/        règles, cas limites, données, IA
  integration/ parties complètes simulées avec graine fixe + vérification d'invariants
  e2e/         Playwright : parcours complet dans le navigateur
```

L'état de jeu est un objet JSON gelé (`Object.freeze` en profondeur). `applyAction(state, action)` renvoie un
nouvel état ou lève une `IllegalActionError` avec un message en français. Actions :

| Action | Forme |
| --- | --- |
| 3 jetons différents | `{ type: 'takeDifferent', colors: ['white', 'blue', 'green'] }` |
| 2 jetons identiques | `{ type: 'takeSame', color: 'red' }` |
| Réserver | `{ type: 'reserve', cardId }` ou `{ type: 'reserve', level }` |
| Acheter | `{ type: 'buy', cardId }` |
| Défausser (phase `discard`) | `{ type: 'discard', color }` |
| Choisir un noble (phase `noble`) | `{ type: 'chooseNoble', nobleId }` |
| Passer (si aucune autre action possible) | `{ type: 'pass' }` |

Couleurs : `white` (diamant), `blue` (saphir), `green` (émeraude), `red` (rubis), `black` (onyx), `gold` (or).

## Données des cartes

La liste des 90 cartes provient de deux jeux de données ouverts indépendants qui concordent exactement
(`bouk/splendimax` et `Zo-ZerOs/splendor-ai` sur GitHub). Un test vérifie l'intégrité : 40/30/20 cartes par
niveau, 18 par couleur, 10 nobles, totaux de points par niveau.

## Choix d'interprétation et limites

- S'il reste moins de 3 couleurs dans la réserve, l'action « couleurs différentes » prend une gemme de chaque
  couleur restante.
- Le paiement est calculé automatiquement : jetons de couleur d'abord, or seulement pour le manque.
- La défausse se fait jeton par jeton et peut inclure de l'or.
- Si un joueur n'a aucune action possible (cas extrêmement rare), il peut passer son tour.
- En hot-seat, les cartes réservées des autres joueurs sont affichées face cachée.
- L'IA est volontairement simple (gloutonne) : elle n'anticipe pas les coups adverses.
