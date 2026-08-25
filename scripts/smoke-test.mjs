import { createRequire } from 'node:module';
import { existsSync, statSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);

let failures = 0;
function check(label, fn) {
  const result = fn();
  if (result && typeof result.catch === 'function') {
    result.then(
      () => console.log(`✅ ${label}`),
      (error) => {
        failures += 1;
        console.error(`❌ ${label}: ${error.message}`);
      }
    );
  } else {
    console.log(`✅ ${label}`);
  }
}

function expectFile(relPath, minBytes = 1000) {
  const p = join(root, relPath);
  if (!existsSync(p)) throw new Error(`missing file ${relPath}`);
  const size = statSync(p).size;
  if (size < minBytes) throw new Error(`${relPath} is suspiciously small (${size} bytes)`);
}

// Dist artifacts exist and are non-trivial
check('dist/peekplayer.cjs exists', () => expectFile('dist/peekplayer.cjs'));
check('dist/peekplayer.esm.js exists', () => expectFile('dist/peekplayer.esm.js'));
check('dist/peekplayer.js (UMD) exists', () => expectFile('dist/peekplayer.js'));
check('dist/peekplayer.css exists', () => expectFile('dist/peekplayer.css'));
check('dist/peekplayer.d.ts exists', () => expectFile('dist/peekplayer.d.ts'));

// CJS entry: the regression this test guards against is Node treating the
// UMD .js as ESM (because of "type": "module") which made require() return {}.
check('require("./dist/peekplayer.cjs") exports PeekPlayer', () => {
  const mod = require(join(root, 'dist/peekplayer.cjs'));
  const Player = mod.PeekPlayer || mod.default;
  if (typeof Player !== 'function') {
    throw new Error(`PeekPlayer is ${typeof Player} — CJS exports broken`);
  }
  if (typeof Player.prototype.loadSource !== 'function'
    || typeof Player.prototype.loadSources !== 'function'
    || typeof Player.prototype.switchQuality !== 'function'
    || typeof Player.prototype.updateOptions !== 'function'
    || typeof Player.prototype.destroy !== 'function') {
    throw new Error('PeekPlayer prototype methods missing from CJS build');
  }
});

// ESM entry: import the bundle in Node. hls.js is bundled and touches browser
// globals, so provide minimal shims where Node allows.
check('import("./dist/peekplayer.esm.js") exports PeekPlayer', async () => {
  if (typeof window === 'undefined') {
    const doc = {
      createElement: () => ({
        style: {}, setAttribute() {}, addEventListener() {}, removeEventListener() {},
        classList: { add() {}, remove() {}, toggle() {} },
        appendChild() {}, querySelector: () => null, querySelectorAll: () => []
      })
    };
    const win = {
      location: { search: '' },
      Date,
      addEventListener() {},
      removeEventListener() {},
      document: doc
    };
    win.window = win;
    win.self = win;
    globalThis.window = win;
    globalThis.self = globalThis.self || win;
    globalThis.document = globalThis.document || doc;
    try {
      globalThis.navigator = globalThis.navigator || { userAgent: 'node' };
    } catch {
      // Node >= 21 exposes a getter-only navigator already
    }
  }

  const mod = await import(pathToFileURL(join(root, 'dist/peekplayer.esm.js')).href);
  const Player = mod.PeekPlayer || mod.default;
  if (typeof Player !== 'function') {
    throw new Error(`PeekPlayer is ${typeof Player} — ESM exports broken`);
  }
});

if (failures > 0) {
  console.error(`\n${failures} smoke check(s) failed`);
  process.exit(1);
}
console.log('\nAll smoke checks passed');
