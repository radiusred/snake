# snake

A playable, browser-based Snake game with **no build step** — open
`index.html` directly, or serve the folder with any static server.

This is the M1 + M2 deliverable of Radius Red's
[engineering-loop demo](docs/introduction.md): a small four-agent team
(build → review → test → docs) shipping real features through reviewed
GitHub PRs. The full record of how each milestone was built — decisions,
trade-offs, rejected alternatives — is in
[`docs/milestones/1-playable-snake.md`](docs/milestones/1-playable-snake.md)
and
[`docs/milestones/2-persistent-best-progressive-difficulty.md`](docs/milestones/2-persistent-best-progressive-difficulty.md).

## Run

No install, no build:

```bash
git clone https://github.com/radiusred/snake.git
cd snake
```

Then either open `index.html` directly in a browser (`file://`), or serve
the folder with any trivial static server, e.g.:

```bash
python3 -m http.server
```

(`npx http-server .` also works, but the first run downloads and installs
the `http-server` package and asks for interactive confirmation — not a
"no install" option.)

## Play

- **Move** — arrow keys, WASD, or a swipe on a touchscreen.
- **Eat** — steer the snake onto the red food cell; it grows by one segment
  and the score goes up by one. The game speeds up progressively as the
  score grows, down to a floor, so a session gets harder as it goes.
- **Game over** — hitting a wall or the snake's own body ends the run and
  shows the final score in an overlay.
- **Restart** — click the Restart button, press Space / Enter while the
  overlay is showing, or tap the button on a touchscreen.

The score bar tracks the current score and the best score, which persists
across page reloads via `localStorage`. Directly reversing into the
snake's own neck (e.g. pressing Down while moving Up, or swiping back the
way you came) is ignored rather than ending the game.

## Tests

```bash
npm test
```

Runs the full suite via `node --test` (no dependencies to install) — 46
tests:

- `tests/game.test.js` (13 tests) — pure game-logic unit tests: movement,
  growth and scoring, reversal rejection, wall/self collision, food never
  placed on the snake, the vacating-tail edge case, and the `tickInterval`
  progressive-difficulty curve (base, decreasing, floor, bad-input
  guarding).
- `tests/bestscore.test.js` (12 tests) — unit tests for the persisted-best
  store: empty store reads as 0, a stored integer round-trips, garbage and
  negative values (including a numeric-prefix-then-garbage string) read as
  0, a new high is written, a lower score never overwrites a higher stored
  best, and a throwing storage is tolerated.
- `tests/browser.test.js` (21 tests) — dependency-free browser-integration
  tests: `index.html`/`game.js` served over a trivial static server, the
  page loading logic via a classic `<script src>` with no build markers,
  raw-source boot, live `#score` DOM updates, the game-over overlay with
  the exact final score, Restart resetting the DOM, a real `ArrowUp`
  keydown turning the snake, the best score surviving a simulated reload,
  the loop speeding up (and resetting on restart) as the score grows, and
  swipe gestures steering the snake alongside keyboard input.

## How it's built

- **`index.html`** — the page: a `<canvas>` grid, the score-driven game
  loop, keyboard and touch/swipe input, the score bar, and the game-over
  overlay. The controller script lives inline in the page (not a separate
  file — see
  [Decision 2](docs/milestones/1-playable-snake.md#decisions) in the M1
  milestone doc for why).
- **`game.js`** — pure, deterministic game logic (`createState`, `step`,
  `setDirection`, `placeFood`, `tickInterval`) with no DOM dependency.
  Loaded by the page via a plain `<script src="game.js">` and shared
  verbatim with the test suite via `require()` — the same code runs in
  both (see [Decision 1](docs/milestones/1-playable-snake.md#decisions)).
  `tickInterval(score)` maps the score to the loop's tick interval so the
  game speeds up progressively (see
  [Decision 1](docs/milestones/2-persistent-best-progressive-difficulty.md#decisions)
  in the M2 milestone doc).
- **`bestscore.js`** — a pure, dependency-free module (`loadBest`,
  `saveBest`) over an injectable storage, defaulting to the browser's
  `localStorage`, that persists the best score across page reloads and
  degrades gracefully when storage is unavailable or throws.

## License

See [LICENSE](LICENSE).
