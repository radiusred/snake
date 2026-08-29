# M2 — Persistent best score & progressive difficulty

Milestone issue: [radiusred/snake#9](https://github.com/radiusred/snake/issues/9)

## Goal

Round out the play experience with score persistence, rising difficulty, and
touch support: the best score must survive a page reload, the game must get
harder as the score grows instead of staying flat, and touch/swipe controls
must make the game playable on a touchscreen alongside the existing keyboard.

## Outcome

Delivered as three task PRs plus this doc PR, each closing one M2 requirement.

[PR #11](https://github.com/radiusred/snake/pull/11) (closing task
[#10](https://github.com/radiusred/snake/issues/10)) landed
[`bestscore.js`](../../bestscore.js) — a pure, dependency-free module
(`loadBest`/`saveBest` over an injectable storage, defaulting to
`localStorage`, key `snake.bestScore`) mirroring the existing `game.js`
pattern — and wired `index.html` to load the stored best on boot and persist
a new high on game over. Two review rounds tightened the behaviour before
merge ([Deviation 1](#deviations), [PR #11 review round](#pr-11-review-round)).

[PR #13](https://github.com/radiusred/snake/pull/13) (closing task
[#12](https://github.com/radiusred/snake/issues/12)) landed a pure, exported
`SnakeGame.tickInterval(score)` in [`game.js`](../../game.js) — a linear
shave from a `110ms` base down to a `60ms` floor — and drove `index.html`'s
game loop from it, rescheduling the interval when a bite shortens it
([Decision 1](#decisions)). QA's mutation testing pass found a coverage gap
in the shipped suite around the interval-replacement path, filed as a
finding rather than a reproduced defect ([Finding 1](#findings)).

[PR #15](https://github.com/radiusred/snake/pull/15) (closing task
[#14](https://github.com/radiusred/snake/issues/14)) added `touchstart` /
`touchmove` / `touchend` listeners on the canvas in `index.html`, mapping
swipes to the same `SnakeGame.setDirection` path the keyboard already
drives, so keyboard and touch input can never disagree. QA's mutation
testing pass found a second coverage gap, around the non-passive listener
wiring, again filed as a finding ([Finding 2](#findings)).

QA's [verdict on the milestone issue](https://github.com/radiusred/snake/issues/9#issuecomment-5465299435)
(2026-08-29T22:40:50Z), against merged `main` with `npm test` passing 46/46,
found **M2-R1, M2-R2 and M2-R3 all satisfied**, each backed by both the
shipped suite and QA's own independent probes of the merged behaviour.

## Requirement outcomes

| ID | Requirement | Status | Evidence |
|---|---|---|---|
| M2-R1 | Best score persists across page reloads (`localStorage`) and survives a fresh load in the same browser | Satisfied | [QA verdict](https://github.com/radiusred/snake/issues/9#issuecomment-5465299435), 2026-08-29T22:40:50Z — 46/46 `npm test`; independent probes of a zero-padded stored integer and a quota/write failure both preserved the correct best |
| M2-R2 | Game speed increases progressively as the score grows | Satisfied | [QA verdict](https://github.com/radiusred/snake/issues/9#issuecomment-5465299435), 2026-08-29T22:40:50Z — 46/46 `npm test`; independent boundary probe confirmed score 8 → 62ms, score 9 → 60ms, floor holds beyond; mutation-testing coverage gap filed as [Finding 1](#findings), inspection confirmed the shipped controller still clears the old timer |
| M2-R3 | Touch/swipe controls work alongside keyboard controls | Satisfied | [QA verdict](https://github.com/radiusred/snake/issues/9#issuecomment-5465299435), 2026-08-29T22:40:50Z — 46/46 `npm test`; independent probes of an exact-threshold downward swipe and a dominant-horizontal diagonal both steered correctly; mutation-testing coverage gap filed as [Finding 2](#findings), inspection confirmed the shipped page has non-passive listeners, `preventDefault()`, and `touch-action: none` |

## Decisions

1. **Progressive-difficulty curve: linear shave with a floor, not a step or
   exponential curve.** [Decision on #12, 2026-08-29T22:19:12Z](https://github.com/radiusred/snake/issues/12#issuecomment-5465208051):
   `tickInterval(score)` starts at `110ms` (score 0, identical to the former
   fixed interval), shaves `6ms` per point, and floors at `60ms` (reached at
   score 9). **Trade-off:** the simplest curve that satisfies "harder as the
   score grows" while keeping score 0 unchanged and the top speed
   controllable; the three constants are a gameplay judgment, tunable later
   without an interface change, and keeping the timing in `game.js` rather
   than the DOM makes it unit-testable without a browser. **Rejected:**
   (a) a per-N-points step function — jerkier, no simpler; (b) an
   exponential/geometric curve — harder to reason about and to floor
   cleanly; (c) leaving the interval hard-coded in `index.html` — untestable
   and couples the difficulty rule to the DOM.

## Deviations

1. **`saveBest` floored the current best at the prior in-memory value,
   instead of trusting a fresh read of storage.** [Deviation on #10, 2026-08-29T21:49:47Z](https://github.com/radiusred/snake/issues/10#issuecomment-5465080861):
   addressing Checky's changes-requested review on PR #11, Cody found that
   `saveBest()` recomputed the current best from storage on every game
   over — when `getItem()` throws (private mode / blocked cookies) that
   reads as `0`, so a weaker run after a strong one could lower the
   displayed best and overwrite a good stored value with a smaller number,
   contradicting the plan's "keeps an in-session best". **Fix:**
   `saveBest(score, storage, priorBest)` floors the current best at
   `max(stored, priorBest)`, with `index.html` threading its in-memory
   `best` through; a weaker run is now a no-op when reads fail, and a
   genuine new high still wins. Regression coverage added at both the
   `bestscore.test.js` and `browser.test.js` level, each failing against
   the pre-fix code and passing after.

### PR #11 review round

Not a `**Deviation:**` comment, but material to the outcome: a second
changes-requested round on PR #11 found that `loadBest()` used `parseInt`,
which reads a numeric *prefix* of a corrupted value (`42garbage` → `42`)
instead of the documented "garbage reads as 0". Cody's
[fix](https://github.com/radiusred/snake/issues/10#issuecomment-5465102216)
(2026-08-29T21:54:45Z) changed the validation to require the entire stored
string be a pure run of digits (`/^[0-9]+$/`, `> 0`), with regression
coverage for the numeric-prefix case plus whitespace, decimal, and
hex-prefix garbage. `node --test` went from 33 to 34 passing. Checky
approved at the fixed head, and PR #11 merged via `gh codecrew task finish 10`.

## Findings

QA filed two mutation-testing coverage gaps against merged `main` during its
milestone-level verdict pass. Both are explicitly recorded as test-coverage
findings, not reproduced product defects — the shipped code already does
the right thing; the shipped suite just doesn't prove it.

1. **M2-R2 — timer replacement not protected by the shipped suite.**
   [Finding on #12, 2026-08-29T22:40:33Z](https://github.com/radiusred/snake/issues/12#issuecomment-5465298178):
   removing `clearInterval(timer)` from `index.html` left all 46 tests
   passing, because the browser test harness stubs `clearInterval` as a
   no-op and only retains the latest callback/delay, so it cannot detect a
   stale interval continuing alongside a new, faster one. QA's inspection
   confirmed the shipped controller does call `clearInterval` before
   rescheduling; no follow-up task had been opened as of this document.
2. **M2-R3 — non-passive touch listener wiring not protected by the shipped
   suite.** [Finding on #14, 2026-08-29T22:40:34Z](https://github.com/radiusred/snake/issues/14#issuecomment-5465298251):
   removing `{ passive: false }` from the canvas touch handlers left all 46
   tests passing, because the hand-rolled `addEventListener` stub ignores
   its options argument and the tests never assert that `preventDefault()`
   ran. QA's inspection confirmed the shipped page has `{ passive: false }`,
   `preventDefault()`, and `touch-action: none`; no follow-up task had been
   opened as of this document.

## Sources

- Milestone: [#9](https://github.com/radiusred/snake/issues/9)
- Task issues: [#10](https://github.com/radiusred/snake/issues/10) (persist
  best score), [#12](https://github.com/radiusred/snake/issues/12)
  (progressive difficulty), [#14](https://github.com/radiusred/snake/issues/14)
  (touch/swipe controls), [#16](https://github.com/radiusred/snake/issues/16)
  (this record)
- PRs: [#11](https://github.com/radiusred/snake/pull/11) (best-score
  persistence), [#13](https://github.com/radiusred/snake/pull/13)
  (progressive difficulty), [#15](https://github.com/radiusred/snake/pull/15)
  (touch/swipe controls)
