'use strict';

// Unit tests for the pure best-score persistence (M2-R1). Run with
// `node --test` — Node's built-in runner, no dependencies, no build step.
const test = require('node:test');
const assert = require('node:assert');
const best = require('../bestscore.js');

// A minimal localStorage stand-in: getItem/setItem over an in-memory map.
function makeStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    _map: map,
  };
}

// A store whose access throws — private mode / blocked cookies.
const throwingStorage = {
  getItem() { throw new Error('access denied'); },
  setItem() { throw new Error('access denied'); },
};

test('loadBest returns 0 on an empty store', () => {
  assert.strictEqual(best.loadBest(makeStorage()), 0);
});

test('loadBest reads back a stored integer', () => {
  assert.strictEqual(best.loadBest(makeStorage({ [best.KEY]: '42' })), 42);
});

test('loadBest treats garbage, empty, and negative values as 0 (never NaN)', () => {
  assert.strictEqual(best.loadBest(makeStorage({ [best.KEY]: 'not-a-number' })), 0);
  assert.strictEqual(best.loadBest(makeStorage({ [best.KEY]: '' })), 0);
  assert.strictEqual(best.loadBest(makeStorage({ [best.KEY]: '-5' })), 0);
});

test('loadBest tolerates a throwing store and returns 0', () => {
  assert.strictEqual(best.loadBest(throwingStorage), 0);
});

test('saveBest writes a new high score and returns it', () => {
  const storage = makeStorage();
  assert.strictEqual(best.saveBest(9, storage), 9);
  assert.strictEqual(storage.getItem(best.KEY), '9', 'persisted to storage');
});

test('saveBest does not overwrite a higher stored best', () => {
  const storage = makeStorage({ [best.KEY]: '10' });
  assert.strictEqual(best.saveBest(4, storage), 10, 'returns the unchanged record');
  assert.strictEqual(storage.getItem(best.KEY), '10', 'stored best untouched');
});

test('saveBest replaces a lower stored best', () => {
  const storage = makeStorage({ [best.KEY]: '3' });
  assert.strictEqual(best.saveBest(8, storage), 8);
  assert.strictEqual(storage.getItem(best.KEY), '8');
});

test('saveBest tolerates a throwing store: returns the higher value, no throw', () => {
  assert.strictEqual(best.saveBest(6, throwingStorage), 6);
});

test('KEY is a stable, namespaced string', () => {
  assert.strictEqual(best.KEY, 'snake.bestScore');
});
