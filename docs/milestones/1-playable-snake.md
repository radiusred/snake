# M1 — Playable browser-based Snake

Milestone issue: [radiusred/snake#2](https://github.com/radiusred/snake/issues/2)

## Goal

Ship a playable, browser-based Snake game with no build step: opens directly
(`file://` or a trivial static server), classic arrow-key mechanics with
growth-on-eat and collision game-over, and a live score with a
game-over/restart affordance.

## Outcome

Delivered as two build PRs plus this doc PR. [PR #4](https://github.com/radiusred/snake/pull/4)
(closing task [#3](https://github.com/radiusred/snake/issues/3)) landed
[`index.html`](../../index.html) (canvas UI, game loop, keyboard input, score
bar, game-over overlay) and [`game.js`](../../game.js) (pure, deterministic
game state — `createState`/`step`/`setDirection`/`placeFood`), loaded by the
page via a plain `<script src="game.js">` and shared verbatim with a 10-test
`node:test` suite ([Decision 1](#decisions)). PR #4 also folded in the
project's CI and commit-lint workflows as a bootstrap-gap fix
([Deviation 1](#deviations)).

QA's [first verdict pass](https://github.com/radiusred/snake/issues/2#issuecomment-5463706286)
(2026-08-29T17:02:21Z) found **M1-R2 satisfied** but **M1-R1 and M1-R3 not
satisfied** — not because the behavior was wrong (an independent probe
confirmed the page loads, scores, and restarts correctly), but because the
shipped suite exercised only `game.js` in Node and never loaded `index.html`
or the live DOM/score/overlay/restart wiring the requirements actually name
(finding on [#3](https://github.com/radiusred/snake/issues/3#issuecomment-5463706207)).
[PR #6](https://github.com/radiusred/snake/pull/6) (closing task
[#5](https://github.com/radiusred/snake/issues/5)) closed that regression
gap with a dependency-free browser-integration suite ([Decision 2](#decisions)),
growing the suite to 17 tests; it went through one changes-requested review
round that tightened two assertions ([PR #6 review round](#pr-6-review-round)).
QA's [second, superseding verdict pass](https://github.com/radiusred/snake/issues/2#issuecomment-5463839595)
(2026-08-29T17:29:42Z), against merged `main` at `cd0a729` (17/17 green),
found **M1-R1, M1-R2 and M1-R3 all satisfied**.

## Requirement outcomes

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| M1-R1 | Runs by opening `index.html` directly (or via a trivial static server) — no build tooling required | Satisfied — after browser-integration coverage closed the QA gap ([PR #6](https://github.com/radiusred/snake/pull/6)) | [QA verdict](https://github.com/radiusred/snake/issues/2#issuecomment-5463839595), 2026-08-29T17:29:42Z |
| M1-R2 | Classic Snake mechanics: arrow-key movement, growth on eating food, game ends on wall or self-collision | Satisfied | [QA verdict](https://github.com/radiusred/snake/issues/2#issuecomment-5463839595), 2026-08-29T17:29:42Z (confirms the [first-pass verdict](https://github.com/radiusred/snake/issues/2#issuecomment-5463706286) with fresh evidence) |
| M1-R3 | A live score display and a game-over/restart affordance | Satisfied — after browser-integration coverage closed the QA gap ([PR #6](https://github.com/radiusred/snake/pull/6)) | [QA verdict](https://github.com/radiusred/snake/issues/2#issuecomment-5463839595), 2026-08-29T17:29:42Z |

## Decisions

Each decision below is a `**Decision:**` comment recorded on the issue
cited; trade-offs and rejected alternatives are as recorded, not
reconstructed.

1. **Game logic shared verbatim between browser and tests, as a plain
   script.** [Decision on #3, 2026-08-29T16:36:58Z](https://github.com/radiusred/snake/issues/3#issuecomment-5463585041):
   `game.js` is loaded by `index.html` via `<script src>` and `require()`d
   by Node's built-in `node:test` — the same code runs in both, and the
   only npm script is `test`. **Trade-off:** keeps M1-R1 ("no build step")
   intact for the game itself — `index.html` still opens directly over
   `file://` with zero tooling — while still shipping real unit tests with
   the PR (reviewer convention, upstream PR #46). Tests need Node; running
   the game does not. **Rejected:** (a) ES modules or a bundler — would
   break direct `file://` opening and add build tooling; (b) inlining all
   logic in `index.html` — leaves the mechanics untestable; (c) a browser
   test harness (Jest/jsdom/Playwright) — pulls in a dependency install the
   "no build tooling" constraint is meant to avoid.

2. **Browser delivery path covered with a dependency-free harness, not
   jsdom/Playwright.** [Decision on #5, 2026-08-29T17:08:36Z](https://github.com/radiusred/snake/issues/5#issuecomment-5463737292):
   a hand-rolled DOM/canvas stub plus Node's `vm` module extracts the inline
   `<script>` controller from `index.html` and runs `game.js` then the
   controller in document order — the same load order the browser uses —
   mirroring QA's independent probe. **Trade-off:** less faithful than a
   real browser, but stays true to the standing "no build tooling / no deps
   to run or test the game" constraint ([Decision 1](#decisions)).
   **Rejected:** (a) extracting the inline controller into its own `.js`
   file to make it importable — would change how the game *ships* to
   satisfy a test, which the task explicitly ruled out; (b) a headless-browser
   dev dependency — violates the no-deps constraint and needs an
   install/build step.

## Deviations

1. **Added CI and commit-lint workflows to the M1 build PR.**
   [Deviation on #3, 2026-08-29T16:48:10Z](https://github.com/radiusred/snake/issues/3#issuecomment-5463638263):
   `gh codecrew task finish 3` refused with `NO_CHECKS` — the repo's
   `require-lint` ruleset requires a "Lint commit messages" status check,
   but `radiusred/snake` had no `.github/workflows` at all, so that
   required context could never report and PR #4 sat permanently blocked.
   **Why:** a `pull_request` workflow must exist on the PR head branch to
   run, so the fix had to land on that branch; the canonical org workflows
   already used on `radiusred/numberguess` were adapted to Snake
   (`node --check game.js`; `node --test`). **Consequence:** the
   `protect-main` ruleset's `dismiss_stale_reviews_on_push` dismissed
   Checky's existing approval, requiring a re-review (recorded on the same
   comment) before `task finish` could run; no hand-merge occurred.

### PR #6 review round

Not a `**Deviation:**` comment, but material to the outcome: Checky's
[changes-requested review](https://github.com/radiusred/snake/pull/6#pullrequestreview-5058697880)
(2026-08-29T17:13:49Z) found two of PR #6's assertions weaker than the task
#5 plan promised — a loose `/^Score: \d+$/` game-over match instead of the
deterministic `Score: 1`, and an ArrowUp check that only asserted the score
stayed `0` rather than observing the head actually move up. Cody's
[fix](https://github.com/radiusred/snake/pull/6#issuecomment-5463789260)
seeded the sandbox's `Math.random` to make the wall-run score deterministic
and captured canvas `fillRect` calls to make head position observable,
tightening both assertions to pin the exact promised behavior. Checky
[re-reviewed and approved](https://github.com/radiusred/snake/pull/6#pullrequestreview-5058716626)
at the fixed head (`c1c26e5`); no production code changed, and PR #6
remained test-only throughout.

## Sources

- Milestone: [#2](https://github.com/radiusred/snake/issues/2)
- Task issues: [#3](https://github.com/radiusred/snake/issues/3) (build),
  [#5](https://github.com/radiusred/snake/issues/5) (browser-integration
  tests), [#7](https://github.com/radiusred/snake/issues/7) (this record)
- PRs: [#1](https://github.com/radiusred/snake/pull/1) (CodeCrew bootstrap,
  precedes the milestone), [#4](https://github.com/radiusred/snake/pull/4)
  (game), [#6](https://github.com/radiusred/snake/pull/6) (browser-integration
  tests)
