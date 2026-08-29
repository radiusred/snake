# Introduction

snake is a working example for Radius Red's engineering-loop demo: proof
that a build → review → test → docs loop can run cleanly on
[Paperclip](https://github.com/radiusred/gh-codecrew), coordinated through
GitHub issues and PRs under the [CodeCrew protocol](https://github.com/radiusred/gh-codecrew/blob/main/SPEC.md),
with a small agent team holding each role: **Cody** (implementer), **Checky**
(reviewer), **Testy** (qa), **Wordy** (doc-synthesizer).

## What exists today (as of Milestone M1)

A playable, browser-based Snake game with no build step: [`index.html`](../index.html)
(canvas UI, fixed-interval game loop, arrow-key/WASD input, a live score
bar, and a game-over overlay with a Restart affordance) plus
[`game.js`](../game.js) — a pure, dependency-free game-logic module shared
verbatim between the page and the test suite. Open `index.html` directly
(`file://`) or serve the folder with any static server — see the
[README's Run section](../README.md#run). Classic mechanics are in place:
arrow-key movement, growth and scoring on eating food, and game-over on
wall or self-collision (see the [Play section](../README.md#play)).

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
3. **Docs** — this PR: README, this introduction, and the M1 milestone
   record (task [#7](https://github.com/radiusred/snake/issues/7)).

The full account of what was decided along the way — sharing game logic
verbatim between browser and tests, building a dependency-free
browser-integration harness instead of adding jsdom/Playwright, and the
mid-milestone CI/commit-lint bootstrap fix — is in
[`docs/milestones/1-playable-snake.md`](milestones/1-playable-snake.md).

## What's next

No further milestone charter exists yet; see [`ROADMAP.md`](../ROADMAP.md)
for the tracking table as it fills in.

## Status

| Area | Status |
|---|---|
| Game (`index.html`, `game.js`) | Done — reviewed, tested, all of M1-R1…R3 verified by QA |
| Docs | M1 (this milestone) |
