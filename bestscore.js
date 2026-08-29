/*
 * Snake — best-score persistence (M2-R1).
 *
 * Keeps the highest score a browser has seen so it survives a page reload.
 * Like game.js this is a plain classic script with no build step and no
 * dependencies: the browser loads it with <script src="bestscore.js"> and
 * Node's test runner require()s it.
 *
 * Storage is injected (defaulting to the browser's localStorage) so the logic
 * is unit-testable under Node with a fake store, and so a browser where
 * localStorage is unavailable — private mode, blocked cookies, file:// in some
 * engines — degrades to an in-session best instead of throwing at boot.
 */
(function (global) {
  'use strict';

  var KEY = 'snake.bestScore';

  // Resolve the storage to use: an explicit arg wins (tests), otherwise the
  // browser's localStorage. Returns null when neither is usable — merely
  // *touching* localStorage can throw when cookies are blocked, so guard it.
  function resolveStorage(storage) {
    if (storage) return storage;
    try {
      return global.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  // Read the persisted best. Returns 0 when absent, non-numeric, negative, or
  // when storage is unavailable — a fresh browser starts at 0, never NaN.
  function loadBest(storage) {
    var s = resolveStorage(storage);
    if (!s) return 0;
    try {
      var n = parseInt(s.getItem(KEY), 10);
      return isFinite(n) && n > 0 ? n : 0;
    } catch (e) {
      return 0;
    }
  }

  // Persist `score` as the new best only when it beats the current best, so a
  // weaker run never clobbers a record. Returns the resulting best (updated or
  // unchanged). Never throws: a failed/absent write still returns the higher
  // value for in-session display.
  //
  // `priorBest` is the caller's in-memory best (the controller threads its
  // displayed value here). It matters when storage is present but unusable:
  // loadBest() then collapses to 0, and without a floor a weaker run after a
  // strong one would *lower* the displayed best (6 -> 2) and could even
  // overwrite a good stored value with the smaller number. Flooring `current`
  // at the prior in-session best retains it across calls when reads fail.
  function saveBest(score, storage, priorBest) {
    var s = resolveStorage(storage);
    var current = loadBest(s);
    if (typeof priorBest === 'number' && isFinite(priorBest) && priorBest > current) {
      current = priorBest;
    }
    if (!(score > current)) return current;
    if (s) {
      try {
        s.setItem(KEY, String(score));
      } catch (e) {
        /* best-effort: keep the higher value in memory even if the write fails */
      }
    }
    return score;
  }

  var api = { KEY: KEY, loadBest: loadBest, saveBest: saveBest };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (tests).
  }
  global.BestScore = api; // Browser (index.html).
})(typeof globalThis !== 'undefined' ? globalThis : this);
