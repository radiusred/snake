'use strict';

// Browser-integration coverage for the delivery path (M1-R1, M1-R3, M2-R1).
//
// The unit suite in game.test.js only proves the pure logic in game.js under
// Node. These tests exercise what the milestone actually promises a player:
// index.html served with no build step, booting the inline controller, and the
// live DOM score / game-over overlay / restart wiring.
//
// Dependency-free by design (mirrors the QA probe): no jsdom, no npm install.
// We serve the repo with Node's built-in http module, then run game.js and the
// inline <script> from index.html — in document order — inside a vm sandbox
// over a hand-rolled DOM/canvas harness. Everything runs `node --test`.

const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

const game = require('../game.js'); // shared source of the M2-R2 interval curve

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GAME_SRC = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');
const BEST_SRC = fs.readFileSync(path.join(ROOT, 'bestscore.js'), 'utf8');

// A minimal localStorage stand-in shared across "page loads" so M2-R1 reload
// behaviour is observable. Passing the same instance into two makeHarness()
// calls simulates closing and reopening the tab in one browser.
function makeStorage(initial) {
  const map = new Map(initial ? Object.entries(initial) : []);
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

// Pull the inline controller out of index.html. There is exactly one bare
// `<script>` block (the `<script src="game.js">` tag has an attribute and so
// does not match `<script>` with no attributes); it is the page's controller.
function inlineController(html) {
  const m = html.match(/<script>([\s\S]*?)<\/script>/);
  assert.ok(m, 'index.html should contain an inline <script> controller');
  return m[1];
}

// A minimal DOM/canvas harness: just enough surface for the inline controller.
// Elements are stable per id (the controller caches references at boot). The
// canvas 2d context is all no-ops; getComputedStyle returns a dummy color.
// setInterval is *captured*, not run — the test drives ticks deterministically.
function makeHarness(opts) {
  opts = opts || {};
  const storage = opts.storage || makeStorage();
  const noop = () => {};
  // Record every fillRect so the head position stays observable. The
  // controller paints the head *last* each frame (index.html draw() walks the
  // snake tail-first), so the newest fillRect of a frame is the head cell.
  const fills = [];
  const ctx = {
    fillRect: (x, y) => { fills.push({ x, y }); },
    strokeRect: noop, clearRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  };

  // index.html runs a 20-wide board on a 400px canvas -> 20px cells, painting a
  // cell at (gx*cell + 1, gy*cell + 1). Invert that inset to recover the head's
  // grid coordinates from the last fillRect of the most recent frame.
  const CELL = 20;
  function headCell() {
    const last = fills[fills.length - 1];
    assert.ok(last, 'a frame must have been painted to read the head');
    return { x: Math.round((last.x - 1) / CELL), y: Math.round((last.y - 1) / CELL) };
  }

  function el(id) {
    const listeners = {};
    return {
      id,
      textContent: '',
      hidden: true,
      width: 400,
      height: 400,
      getContext: () => ctx,
      addEventListener: (type, fn) => { (listeners[type] || (listeners[type] = [])).push(fn); },
      dispatch: (type, ev) => (listeners[type] || []).forEach((fn) => fn(ev)),
      _listeners: listeners,
    };
  }

  const elements = {
    board: el('board'),
    score: el('score'),
    best: el('best'),
    overlay: el('overlay'),
    'overlay-title': el('overlay-title'),
    'overlay-detail': el('overlay-detail'),
    restart: el('restart'),
  };

  const docListeners = {};
  const document = {
    documentElement: {},
    getElementById: (id) => elements[id] || null,
    addEventListener: (type, fn) => { (docListeners[type] || (docListeners[type] = [])).push(fn); },
    dispatchEvent: (ev) => (docListeners[ev.type] || []).forEach((fn) => fn(ev)),
  };

  let captured = null; // the setInterval tick callback
  let capturedMs = null; // and the delay it was scheduled at (M2-R2 reschedules it)
  const sandbox = {
    module: { exports: {} },
    console,
    document,
    getComputedStyle: () => ({ getPropertyValue: () => '#000000' }),
    localStorage: storage, // M2-R1: persistence surface for bestscore.js.
    setInterval: (fn, ms) => { captured = fn; capturedMs = ms; return 1; },
    clearInterval: noop,
    // Deterministic food placement. SnakeGame.placeFood falls back to this
    // Math.random when the controller steps without an rng, so a fixed 0 puts
    // every re-placed food on the first free cell (0,0) — keeping final scores
    // exact for the assertions below instead of at the mercy of Math.random.
    Math: Object.assign(Object.create(Math), { random: () => 0 }),
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Document order: game.js defines SnakeGame, bestscore.js defines BestScore,
  // then the controller boots.
  vm.runInContext(GAME_SRC, sandbox, { filename: 'game.js' });
  vm.runInContext(BEST_SRC, sandbox, { filename: 'bestscore.js' });
  vm.runInContext(inlineController(HTML), sandbox, { filename: 'index.html#inline' });

  return {
    elements,
    document,
    storage,
    headCell,
    // The delay the loop is currently scheduled at. M2-R2 reschedules the
    // interval as the score rises, so this shrinks over a run.
    intervalMs: () => capturedMs,
    tick: () => {
      assert.ok(captured, 'controller should have started a tick loop via setInterval');
      captured();
    },
  };
}

// --- M1-R1: runs by opening index.html, no build step -----------------------

test('M1-R1: index.html serves over a trivial static server (HTTP 200)', async () => {
  const server = http.createServer((req, res) => {
    const rel = req.url === '/' ? '/index.html' : req.url;
    const file = path.join(ROOT, path.normalize(rel).replace(/^(\.\.[/\\])+/, ''));
    fs.readFile(file, (err, buf) => {
      if (err) { res.statusCode = 404; res.end('not found'); return; }
      res.statusCode = 200;
      res.end(buf);
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;

  try {
    for (const url of ['/index.html', '/game.js']) {
      const status = await new Promise((resolve, reject) => {
        http.get({ host: '127.0.0.1', port, path: url }, (res) => {
          res.resume();
          resolve(res.statusCode);
        }).on('error', reject);
      });
      assert.strictEqual(status, 200, `${url} should serve 200 from a static server`);
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('M1-R1: page loads logic via a classic script tag with no build tooling', () => {
  // Classic <script src="game.js"> — not an ES module, no bundler entry point.
  assert.match(HTML, /<script\s+src=["']game\.js["']>\s*<\/script>/,
    'index.html should load game.js via a plain classic script tag');
  assert.doesNotMatch(HTML, /type=["']module["']/, 'no ES-module loading');
  assert.doesNotMatch(HTML, /require\(|import\s|from\s+["']/, 'no bundler/transpile syntax in the page');

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(!pkg.dependencies || Object.keys(pkg.dependencies).length === 0,
    'no runtime dependencies to install');
  assert.ok(!pkg.scripts || !pkg.scripts.build, 'no build step');
});

test('M1-R1: raw page source boots with no transpilation (score renders, overlay hidden)', () => {
  const h = makeHarness();
  // Booting the un-transpiled game.js + inline controller must succeed and
  // paint the initial state: score 0, overlay hidden, tick loop armed.
  assert.strictEqual(h.elements.score.textContent, 0, 'live score renders at boot');
  assert.strictEqual(h.elements.overlay.hidden, true, 'overlay hidden at boot');
  assert.doesNotThrow(() => h.tick(), 'the tick loop runs');
});

// --- M1-R3: live score, game-over overlay, restart --------------------------

test('M1-R3: live DOM score increments when the snake eats', () => {
  const h = makeHarness();
  assert.strictEqual(h.elements.score.textContent, 0);
  // Fresh state: head at (10,10) moving right, food 3 cells ahead at (13,10).
  // Three ticks reach the food and the *rendered* score must go 0 -> 1.
  h.tick(); h.tick(); h.tick();
  assert.strictEqual(h.elements.score.textContent, 1, 'DOM score reflects the eaten food');
  assert.strictEqual(h.elements.overlay.hidden, true, 'still playing, overlay hidden');
});

test('M1-R3: hitting the wall shows the game-over overlay with the final score', () => {
  const h = makeHarness();
  // Drive straight into the right wall. The head starts at x=10 on a 20-wide
  // board with food 3 cells ahead at (13,10): the run eats exactly once (score
  // 0 -> 1) before the wall, and seeded food placement (0,0) rules out a second
  // eat, so the final score is deterministically 1. Keep ticking to game over.
  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 100) h.tick();
  assert.strictEqual(h.elements.overlay.hidden, false, 'overlay shown on game over');
  assert.strictEqual(String(h.elements['overlay-detail'].textContent), 'Score: 1',
    'overlay reports the exact final score (one food eaten before the wall)');
});

test('M1-R3: Restart hides the overlay and resets the DOM score to 0', () => {
  const h = makeHarness();
  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 100) h.tick(); // reach game over
  assert.strictEqual(h.elements.overlay.hidden, false);

  h.elements.restart.dispatch('click'); // click Restart

  assert.strictEqual(h.elements.overlay.hidden, true, 'overlay hidden after restart');
  assert.strictEqual(h.elements.score.textContent, 0, 'DOM score reset to 0');
});

test('M1-R3: a real keydown event turns the snake up (live input wiring)', () => {
  const h = makeHarness();
  // The head boots at the board centre (10,10) moving right; confirm the
  // harness reads it before we send input.
  assert.deepStrictEqual(h.headCell(), { x: 10, y: 10 }, 'head boots at board centre');

  // Dispatch a real ArrowUp through the page's document listener, then tick.
  h.document.dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault() {} });
  h.tick();

  // The promised assertion, now observable: the head moves *up* one row — y
  // decreases by exactly one and x is unchanged. This fails if ArrowUp were
  // mis-wired to down (y increases), left/right (x moves), or ignored (head
  // continues right), so it pins the direction, not just "something changed".
  assert.deepStrictEqual(h.headCell(), { x: 10, y: 9 },
    'ArrowUp moves the head up exactly one row (y decreases, x unchanged)');
});

// --- M2-R1: best score persists across page reloads -------------------------

test('M2-R1: a fresh load restores the persisted best and shows it before play', () => {
  const storage = makeStorage({ 'snake.bestScore': '7' });
  const h = makeHarness({ storage });
  // No ticks: the boot must already reflect the stored record.
  assert.strictEqual(h.elements.best.textContent, 7,
    'best restored from storage at boot, before any play');
});

test('M2-R1: a new best is written to localStorage on game over', () => {
  const h = makeHarness(); // empty store
  // Same deterministic run as the M1-R3 wall test: exactly one food eaten
  // (score 0 -> 1) before hitting the right wall.
  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 100) h.tick();
  assert.strictEqual(h.elements.best.textContent, 1, 'DOM best updates to the run score');
  assert.strictEqual(h.storage.getItem('snake.bestScore'), '1',
    'the new best is persisted for the next load');
});

test('M2-R1: the best survives a reload — a second boot shows it with no play', () => {
  const storage = makeStorage(); // one browser, shared across two loads
  const first = makeHarness({ storage });
  let guard = 0;
  while (first.elements.overlay.hidden && guard++ < 100) first.tick();
  const scored = first.elements.best.textContent;
  assert.ok(scored >= 1, 'first run set a best');

  // Simulate closing and reopening the tab: brand-new harness, SAME storage.
  const second = makeHarness({ storage });
  assert.strictEqual(second.elements.best.textContent, scored,
    'the reloaded page shows the persisted best without playing');
});

test('M2-R1: a weaker run does not clobber a higher stored best', () => {
  const storage = makeStorage({ 'snake.bestScore': '5' });
  const h = makeHarness({ storage });
  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 100) h.tick(); // scores 1
  assert.strictEqual(h.storage.getItem('snake.bestScore'), '5',
    'the higher record is preserved');
  assert.strictEqual(h.elements.best.textContent, 5, 'the DOM keeps the higher best');
});

// --- M2-R2: progressive difficulty (the loop speeds up with the score) ------

test('M2-R2: the loop boots at the base interval and speeds up after eating', () => {
  const h = makeHarness();
  // At boot the controller schedules the loop at the score-0 (base) interval.
  assert.strictEqual(h.intervalMs(), game.tickInterval(0), 'boots at the base interval');
  assert.strictEqual(h.elements.score.textContent, 0);

  // Fresh state: head (10,10) moving right, food 3 cells ahead at (13,10).
  // Three ticks reach and eat it; the score goes 0 -> 1 and the loop must be
  // rescheduled to the shorter score-1 interval.
  h.tick(); h.tick(); h.tick();
  assert.strictEqual(h.elements.score.textContent, 1, 'ate one food');
  assert.strictEqual(h.intervalMs(), game.tickInterval(1),
    'loop rescheduled to the score-1 interval after eating');
  assert.ok(h.intervalMs() < game.tickInterval(0),
    'the game got faster, not slower');
});

test('M2-R2: the interval never drops below the floor across a whole run', () => {
  const h = makeHarness();
  const floor = game.tickInterval(1000); // clamped floor
  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 500) {
    h.tick();
    assert.ok(h.intervalMs() >= floor,
      'the loop is never scheduled faster than the floor');
  }
  assert.strictEqual(h.elements.overlay.hidden, false, 'run reached game over');
});

test('M2-R2: restarting resets the loop back to the base speed', () => {
  const h = makeHarness();
  h.tick(); h.tick(); h.tick(); // eat one -> faster than base
  assert.ok(h.intervalMs() < game.tickInterval(0), 'sped up during the run');

  h.elements.restart.dispatch('click');
  assert.strictEqual(h.elements.score.textContent, 0, 'score reset');
  assert.strictEqual(h.intervalMs(), game.tickInterval(0),
    'a fresh run starts back at the base speed');
});

test('M2-R1: a weaker run keeps the displayed best when storage goes unusable mid-session (regression)', () => {
  // Storage reads once at boot (restoring 6) then starts throwing — a tab whose
  // storage access flips to blocked mid-session. A subsequent run scores the
  // deterministic 1; the controller must thread its in-memory best (6) so the
  // DOM never drops 6 -> 1. Without the fix, saveBest re-reads storage, gets 0,
  // and 1 > 0 downgrades the displayed best.
  let reads = 0;
  const flaky = {
    getItem: (k) => {
      if (reads++ === 0) return k === 'snake.bestScore' ? '6' : null; // boot restore
      throw new Error('storage went away');
    },
    setItem: () => { throw new Error('storage went away'); },
    removeItem: () => {},
  };
  const h = makeHarness({ storage: flaky });
  assert.strictEqual(h.elements.best.textContent, 6, 'boot restores the stored best');

  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 100) h.tick(); // deterministic score 1
  assert.strictEqual(h.elements.best.textContent, 6,
    'the weaker run keeps the higher in-session best, not a re-read 0');
});
