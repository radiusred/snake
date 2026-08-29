# Introduction

snake is a working example for Radius Red's engineering-loop demo: proof
that a build → review → test → docs loop can run cleanly on
[Paperclip](https://github.com/radiusred/gh-codecrew), coordinated through
GitHub issues and PRs under the [CodeCrew protocol](https://github.com/radiusred/gh-codecrew/blob/main/SPEC.md),
with a small agent team holding each role: **Cody** (implementer), **Checky**
(reviewer), **Testy** (qa), **Wordy** (doc-synthesizer).

## What exists today (as of Milestone M2)

A playable, browser-based Snake game with no build step: [`index.html`](../index.html)
(canvas UI, a score-driven game loop, keyboard/WASD and touch/swipe input,
a live score bar showing a persisted best, and a game-over overlay with a
Restart affordance) plus [`game.js`](../game.js) — pure, dependency-free
game logic (including the `tickInterval` difficulty curve) shared verbatim
between the page and the test suite — and [`bestscore.js`](../bestscore.js) —
a pure, dependency-free store that persists the best score across page
reloads via `localStorage`. Open `index.html` directly (`file://`) or serve
the folder with any static server — see the
[README's Run section](../README.md#run). Classic mechanics are in place:
arrow-key/WASD/swipe movement, growth and scoring on eating food, a game
that speeds up as the score grows, and game-over on wall or self-collision
(see the [Play section](../README.md#play)).

## How it was built

Milestone [M1](https://github.com/radiusred/snake/issues/2) ran build → test
→ docs as small, independently reviewed GitHub PRs, each gated by the
CodeCrew protocol (green CI, a holder's approval, no unresolved
`cc:needs-decision` gate) before merge:

1. **Build** — [PR #4](https://github.com/radiusred/snake/pull/4) landed
   `index.html` and `game.js` (task [#3](https://github.com/radiusred/snake/issues/3)),
   plus the project's CI and commit-lint workflows as a bootstrap-gap fix.
2. **Test** — QA's [first verdict pass](https://github.com/radiusred/snake/issues/2#issuecomment-5463706286)
   found the shipped unit suite didn't exercise the browser delivery path
   the requirements name, leaving M1-R1 and M1-R3 unsatisfied. [PR #6](https://github.com/radiusred/snake/pull/6)
   (task [#5](https://github.com/radiusred/snake/issues/5)) closed that gap
   with a dependency-free browser-integration suite, growing coverage to 17
   tests; QA's [second, superseding pass](https://github.com/radiusred/snake/issues/2#issuecomment-5463839595)
   found all of M1-R1–R3 satisfied.
3. **Docs** — [PR #8](https://github.com/radiusred/snake/pull/8): README,
   this introduction, and the M1 milestone record (task
   [#7](https://github.com/radiusred/snake/issues/7)).

Milestone [M2](https://github.com/radiusred/snake/issues/9) added three more
features the same way, each its own task/PR:

4. **Persistent best score** — [PR #11](https://github.com/radiusred/snake/pull/11)
   (task [#10](https://github.com/radiusred/snake/issues/10)) added
   `bestscore.js` and wired `index.html` to it, after a review round fixed a
   regression where a weak run after a strong one could lower the displayed
   best.
5. **Progressive difficulty** — [PR #13](https://github.com/radiusred/snake/pull/13)
   (task [#12](https://github.com/radiusred/snake/issues/12)) added the
   `tickInterval(score)` curve and rescheduled the game loop from it.
6. **Touch/swipe controls** — [PR #15](https://github.com/radiusred/snake/pull/15)
   (task [#14](https://github.com/radiusred/snake/issues/14)) added swipe
   gestures on the canvas, routed through the same `setDirection` path as
   the keyboard.
7. **Docs** — this PR: refreshed README and introduction, and the M2
   milestone record (task [#16](https://github.com/radiusred/snake/issues/16)).

QA's [milestone verdict](https://github.com/radiusred/snake/issues/9#issuecomment-5465299435)
found all of M2-R1–R3 satisfied, with two mutation-testing coverage gaps
filed as findings (not reproduced defects) against the shipped test suite.

The full account of what was decided along the way for each milestone —
trade-offs, rejected alternatives, deviations, and findings — is in
[`docs/milestones/1-playable-snake.md`](milestones/1-playable-snake.md) and
[`docs/milestones/2-persistent-best-progressive-difficulty.md`](milestones/2-persistent-best-progressive-difficulty.md).

## What's next

No further milestone charter exists yet; see [`ROADMAP.md`](../ROADMAP.md)
for the tracking table as it fills in.

## Status

| Area | Status |
|---|---|
| Game (`index.html`, `game.js`, `bestscore.js`) | Done — reviewed, tested, all of M1-R1…R3 and M2-R1…R3 verified by QA |
| Docs | M2 (this milestone) |
