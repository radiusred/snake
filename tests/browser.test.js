'use strict';

// Browser-integration coverage for the delivery path (M1-R1, M1-R3).
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

const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const GAME_SRC = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8');

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
function makeHarness() {
  const noop = () => {};
  const ctx = {
    fillRect: noop, strokeRect: noop, clearRect: noop,
    beginPath: noop, moveTo: noop, lineTo: noop, stroke: noop, fill: noop,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  };

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
  const sandbox = {
    module: { exports: {} },
    console,
    document,
    getComputedStyle: () => ({ getPropertyValue: () => '#000000' }),
    setInterval: (fn) => { captured = fn; return 1; },
    clearInterval: noop,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);

  // Document order: game.js defines SnakeGame, then the controller boots.
  vm.runInContext(GAME_SRC, sandbox, { filename: 'game.js' });
  vm.runInContext(inlineController(HTML), sandbox, { filename: 'index.html#inline' });

  return {
    elements,
    document,
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
  // Drive straight into the right wall. The snake head starts at x=10 on a
  // 20-wide board; keep ticking until the controller reveals the overlay.
  let guard = 0;
  while (h.elements.overlay.hidden && guard++ < 100) h.tick();
  assert.strictEqual(h.elements.overlay.hidden, false, 'overlay shown on game over');
  assert.match(String(h.elements['overlay-detail'].textContent), /^Score: \d+$/,
    'overlay reports the final score');
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

test('M1-R3: a real keydown event turns the snake (live input wiring)', () => {
  const h = makeHarness();
  // Dispatch ArrowUp through the page's document listener, then tick. The head
  // must move up (y decreases), proving the keyboard is wired to the game.
  h.document.dispatchEvent({ type: 'keydown', key: 'ArrowUp', preventDefault() {} });
  h.tick();
  // We can't reach the controller's private state, but movement is observable
  // via the next food-eat geometry: after turning up, three rightward ticks no
  // longer reach the food, so the score stays 0 where a straight run scored 1.
  h.tick(); h.tick();
  assert.strictEqual(h.elements.score.textContent, 0,
    'after turning up the head no longer reaches the straight-ahead food');
});
