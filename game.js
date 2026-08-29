/*
 * Snake — pure game logic (M1-R2, M1-R3).
 *
 * No build step and no dependencies: this is a plain script. The browser
 * loads it with <script src="game.js"> (works over file:// too), and Node's
 * built-in test runner require()s it. Everything here is pure/deterministic
 * so it can be unit-tested without a DOM; rendering and input live in
 * index.html.
 */
(function (global) {
  'use strict';

  var DIRECTIONS = {
    up: { x: 0, y: -1 },
    down: { x: 0, y: 1 },
    left: { x: -1, y: 0 },
    right: { x: 1, y: 0 },
  };

  // Create a fresh game state on a cols x rows grid.
  function createState(cols, rows) {
    var midY = Math.floor(rows / 2);
    var startX = Math.floor(cols / 2);
    // Snake occupies three cells, head first, moving right.
    var snake = [
      { x: startX, y: midY },
      { x: startX - 1, y: midY },
      { x: startX - 2, y: midY },
    ];
    return {
      cols: cols,
      rows: rows,
      snake: snake,
      direction: DIRECTIONS.right,
      // Next direction buffers the latest valid input for the coming tick.
      nextDirection: DIRECTIONS.right,
      food: { x: startX + 3, y: midY },
      score: 0,
      over: false,
    };
  }

  // Resolve a direction name to a vector, or null if unknown.
  function directionFor(name) {
    return DIRECTIONS[name] || null;
  }

  // A 180-degree reversal would drive the head straight into the neck; ignore it.
  function isOpposite(a, b) {
    return a.x + b.x === 0 && a.y + b.y === 0;
  }

  // Register a requested direction; rejected if unknown or a direct reversal.
  function setDirection(state, name) {
    var dir = directionFor(name);
    if (!dir) return false;
    if (isOpposite(dir, state.direction)) return false;
    state.nextDirection = dir;
    return true;
  }

  function cellsEqual(a, b) {
    return a.x === b.x && a.y === b.y;
  }

  function isOnSnake(snake, cell) {
    for (var i = 0; i < snake.length; i++) {
      if (cellsEqual(snake[i], cell)) return true;
    }
    return false;
  }

  // Place food on a uniformly-random free cell. `rng` defaults to Math.random
  // and is injectable so tests stay deterministic. Returns null if the board
  // is full (snake fills every cell — a win, no room left).
  function placeFood(state, rng) {
    rng = rng || Math.random;
    var free = [];
    for (var y = 0; y < state.rows; y++) {
      for (var x = 0; x < state.cols; x++) {
        var cell = { x: x, y: y };
        if (!isOnSnake(state.snake, cell)) free.push(cell);
      }
    }
    if (free.length === 0) return null;
    return free[Math.floor(rng() * free.length)];
  }

  // Advance one tick. Mutates and returns state. On collision it sets
  // state.over and leaves the board unchanged. `rng` is forwarded to food
  // placement for deterministic tests.
  function step(state, rng) {
    if (state.over) return state;

    state.direction = state.nextDirection;
    var head = state.snake[0];
    var next = { x: head.x + state.direction.x, y: head.y + state.direction.y };

    // Wall collision (M1-R2).
    if (next.x < 0 || next.x >= state.cols || next.y < 0 || next.y >= state.rows) {
      state.over = true;
      return state;
    }

    var willEat = cellsEqual(next, state.food);

    // Self collision (M1-R2). The tail cell is about to vacate unless we grow,
    // so a move into the current tail is only fatal when we also eat.
    var body = willEat ? state.snake : state.snake.slice(0, state.snake.length - 1);
    if (isOnSnake(body, next)) {
      state.over = true;
      return state;
    }

    state.snake.unshift(next);
    if (willEat) {
      state.score += 1; // M1-R3: score increments per food.
      var food = placeFood(state, rng);
      if (food) {
        state.food = food;
      } else {
        state.over = true; // Board full: nothing left to eat.
      }
    } else {
      state.snake.pop(); // No growth: drop the tail.
    }
    return state;
  }

  var api = {
    DIRECTIONS: DIRECTIONS,
    createState: createState,
    directionFor: directionFor,
    setDirection: setDirection,
    placeFood: placeFood,
    step: step,
    cellsEqual: cellsEqual,
    isOnSnake: isOnSnake,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api; // Node (tests).
  }
  global.SnakeGame = api; // Browser (index.html).
})(typeof globalThis !== 'undefined' ? globalThis : this);
