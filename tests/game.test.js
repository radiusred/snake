'use strict';

// Unit tests for the pure Snake logic. Run with `node --test` (or `npm test`) —
// Node's built-in runner, no dependencies, no build step.
const test = require('node:test');
const assert = require('node:assert');
const game = require('../game.js');

function fixedRng(value) {
  // Deterministic rng for placeFood: 0 -> first free cell, ~1 -> last.
  return () => value;
}

test('createState places a 3-cell snake moving right', () => {
  const s = game.createState(20, 20);
  assert.strictEqual(s.snake.length, 3);
  assert.deepStrictEqual(s.direction, game.DIRECTIONS.right);
  assert.strictEqual(s.score, 0);
  assert.strictEqual(s.over, false);
  // Head is ahead of the body in the direction of travel.
  assert.strictEqual(s.snake[0].x, s.snake[1].x + 1);
});

test('step moves the snake one cell without growing when no food eaten', () => {
  const s = game.createState(20, 20);
  const headBefore = { ...s.snake[0] };
  const lenBefore = s.snake.length;
  game.step(s);
  assert.strictEqual(s.snake.length, lenBefore); // no growth
  assert.strictEqual(s.snake[0].x, headBefore.x + 1);
  assert.strictEqual(s.snake[0].y, headBefore.y);
});

test('setDirection rejects a direct reversal but accepts a turn', () => {
  const s = game.createState(20, 20); // moving right
  assert.strictEqual(game.setDirection(s, 'left'), false);
  assert.deepStrictEqual(s.nextDirection, game.DIRECTIONS.right);
  assert.strictEqual(game.setDirection(s, 'up'), true);
  assert.deepStrictEqual(s.nextDirection, game.DIRECTIONS.up);
});

test('setDirection rejects unknown directions', () => {
  const s = game.createState(20, 20);
  assert.strictEqual(game.setDirection(s, 'sideways'), false);
});

test('eating food grows the snake and increments the score', () => {
  const s = game.createState(20, 20);
  // Put food directly ahead of the head.
  s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
  const lenBefore = s.snake.length;
  game.step(s, fixedRng(0));
  assert.strictEqual(s.score, 1);
  assert.strictEqual(s.snake.length, lenBefore + 1); // grew by one
  assert.strictEqual(s.over, false);
});

test('new food never spawns on the snake', () => {
  const s = game.createState(20, 20);
  s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
  game.step(s, fixedRng(0.999999));
  assert.strictEqual(game.isOnSnake(s.snake, s.food), false);
});

test('wall collision ends the game', () => {
  const s = game.createState(5, 5);
  // Drive straight into the right wall.
  let guard = 0;
  while (!s.over && guard++ < 50) game.step(s);
  assert.strictEqual(s.over, true);
});

test('self collision ends the game', () => {
  // Build a snake long enough to bite itself with a tight loop of turns.
  const s = game.createState(10, 10);
  // Grow to length 5 by feeding it repeatedly straight ahead.
  for (let i = 0; i < 2; i++) {
    s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
    game.step(s, fixedRng(0));
  }
  assert.ok(s.snake.length >= 5);
  // Now turn up, left, down -> head re-enters an occupied body cell.
  game.setDirection(s, 'up'); game.step(s);
  game.setDirection(s, 'left'); game.step(s);
  game.setDirection(s, 'down'); game.step(s);
  assert.strictEqual(s.over, true);
});

test('stepping a finished game is a no-op', () => {
  const s = game.createState(5, 5);
  s.over = true;
  const snapshot = JSON.stringify(s.snake);
  game.step(s);
  assert.strictEqual(JSON.stringify(s.snake), snapshot);
});

test('moving into the vacating tail cell is allowed (not self-collision)', () => {
  // A body-length move that lands where the tail currently sits must survive,
  // because the tail vacates on the same tick when not eating.
  const s = game.createState(10, 10);
  s.snake = [
    { x: 5, y: 5 },
    { x: 5, y: 6 },
    { x: 4, y: 6 },
    { x: 4, y: 5 },
  ];
  s.direction = game.DIRECTIONS.left;
  s.nextDirection = game.DIRECTIONS.left;
  s.food = { x: 0, y: 0 };
  game.step(s);
  assert.strictEqual(s.over, false);
  assert.deepStrictEqual(s.snake[0], { x: 4, y: 5 }); // moved into old tail cell
});
