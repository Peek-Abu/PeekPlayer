# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project

`@peekabu/peekplayer` — a dependency-free vanilla-JS HTML5 video player npm package (ES modules, Rollup, no framework, no TypeScript build — plain JSDoc-style JS with a hand-maintained `.d.ts`). hls.js is bundled into `dist` at build time.

## Commands

```bash
npm run build      # rollup → dist/ (umd .js + .cjs, esm, min.js, css, d.ts copy)
npm run dev        # rollup watch
npm run serve      # http-server on :3001 (examples/, dist/)
npm run lint       # eslint (src only; 0 errors expected)
npm test           # node scripts/smoke-test.mjs (CJS/ESM exports + dist artifacts)
npm run test:ui    # playwright (13 browser tests, chromium, local fixture clip)
```

Run `npm run build` before `npm test` / `npm run test:ui` — the tests exercise `dist/`, not `src/`.

## Architecture

```
src/core/player.js     PeekPlayer class: options, engine selection, quality state, lifecycle
src/core/controls.js   setupOverlayControls: assembles scrubber + control row + features, returns cleanup
src/controls/*.js      one factory per control, ALL return { element, cleanup }
src/features/*.js      behaviors (keyboard, auto-hide, gestures); return cleanup functions
src/components/*.js    paused overlay, tooltip system (base-tooltip + specialized)
src/engines/           hls-wrapper (hls.js or native HLS); native engine is inline in player.js
src/constants/         timing.js (all delays/thresholds), icons.js
src/utils/             assert.js, fullscreen.js (vendor-safe helpers)
tests/                 Playwright suite; tests/fixtures/ has a synthetic ffmpeg clip (no network)
```

Engine selection: `options.engine` > `?engine=hls` URL param > URL sniffing (`.m3u8`/`hls` → hls.js). Both `loadSource(url)` and the sources array are checked.

## Hard conventions (violations caused real bugs before)

- **Every component/feature returns a cleanup function that removes every listener it added.** Register handlers as named functions so `removeEventListener` actually matches. Leaks here compound because `refreshControls()` re-runs `setupOverlayControls`.
- **Never assign `video.onplay`/`onclick`-style properties** — use `addEventListener` so host pages and sibling components aren't clobbered.
- **Scope all DOM queries to the player wrapper**, never `document.querySelector` for player-owned elements — multiple players per page are supported.
- **Route all logging through the `logger`** (optional, has a fallback). No bare `console.log` in src/.
- **Tooltips attach to `document.body`** — never query for them in the wrapper; use the `cleanup.updateContent()` handle that `createTooltip` returns.
- **Keyboard controls are scoped** to wrapper focus/hover and honor `e.defaultPrevented` and `e.repeat` — keep it that way (the handler used to hijack whole pages).
- **Scrubbing must not set `video.currentTime` per pointermove** — preview internally, commit on press/release, notify via `onScrubPreview`/`onScrubStart`/`onScrubEnd` hooks.
- Guard duration-dependent math (`Number.isFinite(video.duration)`) — metadata may not be loaded.
- `container.innerHTML = ''` in `setupOverlayControls` is intentional (controls container must be empty); don't "fix" it.

## Testing expectations

- Behavior changes to controls/keyboard/scrubbing need a Playwright test in `tests/player.spec.js`. Use real input (`mouse`, `keyboard`, `hover`) over synthetic `dispatchEvent` — synthetic events miss pointer-capture and hover-interception behavior.
- The fixture video is generated (`tests/fixtures/sample.mp4`, ffmpeg `testsrc2`). Keep tests network-free.
- `npm run lint` and `npm test` must pass with zero errors before finishing any task.

## Packaging notes

- `"type": "module"` + UMD: the CJS output **must** stay `.cjs` (see rollup.config.js). `scripts/smoke-test.mjs` guards this — if `require()` returns `{}`, you broke it.
- hls.js is bundled: keep it in devDependencies only. If you make it external, that's a breaking packaging change requiring a major version.
- `files` in package.json is the publish allowlist (dist/, README, LICENSE). Don't add src/ to the tarball.
- Releases: bump via `npm version patch|minor|major`, push tags, then create a GitHub Release — that is the **only** publish trigger (see .github/workflows/publish.yml).

## Docs

Update all three when changing the public API: `README.md`, `peekplayer.d.ts`, `CHANGELOG.md` (Keep a Changelog format; unreleased changes go under `[Unreleased]`).
