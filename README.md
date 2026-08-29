# snake

A playable, browser-based Snake game with **no build step** — open
`index.html` directly, or serve the folder with any static server.

This is the M1 deliverable of Radius Red's
[engineering-loop demo](docs/introduction.md): a small four-agent team
(build → review → test → docs) shipping real features through reviewed
GitHub PRs. The full record of how M1 was built — decisions, trade-offs,
rejected alternatives — is in
[`docs/milestones/1-playable-snake.md`](docs/milestones/1-playable-snake.md).

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

- **Move** — arrow keys or WASD.
- **Eat** — steer the snake onto the red food cell; it grows by one segment
  and the score goes up by one.
- **Game over** — hitting a wall or the snake's own body ends the run and
  shows the final score in an overlay.
- **Restart** — click the Restart button, or press Space / Enter while the
  overlay is showing.

The score bar tracks the current score and the best score seen this
session (best is not persisted across page reloads). Directly reversing
into the snake's own neck (e.g. pressing Down while moving Up) is ignored
rather than ending the game.

## Tests

```bash
npm test
```

Runs the full suite via `node --test` (no dependencies to install) — 17
tests:

- `tests/game.test.js` (10 tests) — pure game-logic unit tests: movement,
  growth and scoring, reversal rejection, wall/self collision, food never
  placed on the snake, and the vacating-tail edge case.
- `tests/browser.test.js` (7 tests) — dependency-free browser-integration
  tests: `index.html`/`game.js` served over a trivial static server, the
  page loading logic via a classic `<script src>` with no build markers,
  raw-source boot, live `#score` DOM updates, the game-over overlay with
  the exact final score, Restart resetting the DOM, and a real `ArrowUp`
  keydown turning the snake.

## How it's built

- **`index.html`** — the page: a `<canvas>` grid, the fixed-interval game
  loop, keyboard input, the score bar, and the game-over overlay. The
  controller script lives inline in the page (not a separate file — see
  [Decision 2](docs/milestones/1-playable-snake.md#decisions) in the
  milestone doc for why).
- **`game.js`** — pure, deterministic game logic (`createState`, `step`,
  `setDirection`, `placeFood`) with no DOM dependency. Loaded by the page
  via a plain `<script src="game.js">` and shared verbatim with the test
  suite via `require()` — the same code runs in both (see
  [Decision 1](docs/milestones/1-playable-snake.md#decisions)).

## License

See [LICENSE](LICENSE).
