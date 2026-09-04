# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Live stream support.** Live sources are detected from an infinite `duration`, so it works for hls.js and native HLS alike:
  - A `LIVE` badge with a pulsing red dot at the live edge, which becomes a `GO LIVE` button when the viewer falls behind; clicking it returns to the edge (landing just short of it, since seeking exactly to the edge stalls). Disable with `controls: { liveBadge: false }`; `onSeekToLive(behindBy)` reports the jump.
  - The scrubber now represents the DVR window rather than the whole timeline. Live `currentTime` sits inside an absolute `[start, edge]` range, so positions are mapped into and out of that window; previously `currentTime / Infinity` pinned the thumb at zero. Streams offering under 30s of rewind get no bar at all.
  - The time display drops the meaningless total (`Infinity` formatted as `0:00`) and shows how far behind the edge the viewer is.
  - Live edge falls back to `buffered` when `seekable` is unavailable — before the first append, or on an engine that leaves it empty.
  - The scrubber prefers the DVR window the manifest advertises (via `LEVEL_LOADED`) over `buffered`, which only covers what has been downloaded and understates a live window badly.
  - `examples/live-example.html` — a live demo with a raw media-state readout, `?src=` override, and `?simulate=1` for working offline.
  - Seeks are clamped to what the source can serve. The skip buttons and keyboard clamped forward seeks to `MAX_SAFE_INTEGER` and backward to `0`; on a live stream that means far past the end of the broadcast, or before the DVR window begins. Both stall.
  - The scrubber tooltip reads distance from the live edge. It computed `percent * video.duration`, which is `Infinity` on live — every position formatted to "0:00" — and assumed the bar spans `0..duration` rather than a window that neither starts at zero nor stays put.
  - The time display keeps counting while paused. `timeupdate` only fires during playback, but a paused viewer keeps falling behind a live edge that moves regardless; it was observed frozen at "-0:04" while the real gap had passed forty seconds.
  - The scrubber announces distance from live to assistive tech instead of elapsed window seconds.
  - Keyboard seeks report their position within the DVR window. `newTime / video.duration` is `Infinity` on live, so the finite-guard fell through and `onSeek` received `0` for every keyboard seek regardless of where the viewer went.
  - The time display stays negative *while scrubbing*. The scrubber previews in window coordinates, and rendering that raw put a positive offset on screen mid-drag while the resting reading beside it counted back from the edge. Both paths now share one label function so they cannot disagree.
  - Standing level with the live edge reads `LIVE` rather than absolute media time, which had printed a large positive number at exactly the moment it should have said LIVE.
  - Swipe seeking is clamped like every other seek. `Number.isFinite(Infinity)` is false, so a live stream fell through to the unclamped branch and a swipe could land past the edge or before the window start.
  - Exported helpers: `isLiveVideo`, `liveEdge`, `liveStart`, `dvrWindow`, `behindLiveBy`, `isAtLiveEdge`, `seekToLiveEdge`, `liveWindow`, `clampSeek`.
- Frame-by-frame stepping: `,` steps back, `.` steps forward (auto-pauses); configurable via the new `frameRate` option (default 30fps)
- Mouse-wheel volume control over the volume button/slider (5% steps)
- Live time-display preview while scrubbing (shows the target time before the seek is committed on release)
- CI: Playwright browser UI suite (13 tests) running in a new `e2e` job, npm provenance on publish, Dependabot, PR template

### Fixed
- **hls.js never ran; every HLS source went down the native path.** `player.js` passed `useNativeIfSupported: options.engine !== 'hls'`, which is true for every caller that does not name an engine. Chromium answers `"maybe"` for `application/vnd.apple.mpegurl` despite having no native HLS, so the video element was handed a text playlist and playback died with `DEMUXER_ERROR_COULD_NOT_PARSE`. Native is now used only when the caller asks for `engine: 'native'`, or when hls.js genuinely cannot run (iOS Safari). This also restored quality levels, `seekable`, and the DVR window, none of which the native path produced.
- **Fatal HLS errors ended playback permanently**, and recovery is bounded — five consecutive attempts, reset whenever a fragment actually loads. A source that is simply gone reports a fatal error on every retry, so unbounded recovery hammers a dead origin forever. The error handler only logged. Fatal network errors now call `startLoad()` and fatal media errors `recoverMediaError()`, which matters most on live streams: a dropped segment or a mid-stream rendition change would otherwise lose the broadcast for good. Genuinely unrecoverable errors emit `peekplayer:fatal-error`.
- The scrubber ignored `durationchange`, so a source that turned out to be live kept whatever geometry it had when metadata first loaded.
- `.scrubber-row` sets `display: flex`, which overrode the user-agent `[hidden]` rule — hiding the row from JS did nothing until the explicit `[hidden]` rule was added.
- **CommonJS entry was broken**: `require('@peekabu/peekplayer')` returned an empty object because the UMD bundle was parsed as ESM (`"type": "module"`). The CJS build is now emitted as `dist/peekplayer.cjs` and wired into the exports map.
- **HLS engine was never selected by `loadSource(url)`**: engine detection only inspected the (initially empty) sources array, so `.m3u8` URLs bypassed hls.js — quality levels and subtitles never appeared. The URL argument is now checked.
- **Quality selector never appeared** when HLS levels arrived after initialization (placeholder component did not expose `updateSources`).
- **Paused overlay button was permanently visible** and intercepted clicks meant for the video; it now only shows while paused. (fixes #4)
- **Mobile swipe-to-seek crashed** on every swipe (nonexistent `.video-container` element and invalid `player.currentTime()` API call); swipe now live-scrubs from the touch origin.
- Keyboard shortcuts no longer hijack the whole page (scoped to player focus/hover), ignore held-down repeats, and no longer double-fire while the scrubber is focused.
- Listener leaks on re-init/destroy: volume `volumechange`, Picture-in-Picture handlers, quality-selector document click.
- `setupOverlayControls` no longer throws when `options.logger` is omitted.
- Mobile layout now includes play/pause, skip, and ±10s buttons.
- Scrubbing no longer assigns `video.currentTime` on every pointermove (UI preview during drag, single commit on press/release) — removes drag hitching.
- Volume bar reflects muted state (autoplay-muted showed a full bar) (#5); mute click syncs the bar explicitly; volume tooltip live-updates while dragging.
- Subtitle selector no longer fires `onSubtitleChange` spuriously during init/rebuild.
- Auto-hide controls: mobile delay constant is now used (5s), tapping the video summons controls, cleanup restores inline styles.
- Tooltips and quality notifications are scoped to their player instance (no cross-instance interference with multiple players).
- iOS Safari: `webkitEnterFullscreen()` no longer crashes (`.catch()` was called on a non-Promise); fullscreen state reporting works with vendor-prefixed APIs.
- Double-tap fullscreen no longer fires twice; `requestFullscreen` rejections are handled.
- NaN guards for seek percentages; scrubber tooltip supports hour-long media; `setPointerCapture` hardened.

### Changed
- **Packaging**: hls.js is bundled into `dist` and no longer listed as a `dependency`/`peerDependency` (consumers no longer install an unused copy; remove any separate hls.js script tags).
- **Packaging**: exports map gains `default` fallback and `types`-first ordering; `main` now points to `dist/peekplayer.cjs`.
- **Docs**: README CSS path corrected (`dist/peekplayer.css` — the old `style.css` path was never published); TypeScript definitions rewritten to match the actual API (`updateOptions`, `loadSource`, `switchQuality`, segments, callbacks).
- **CI**: lint + build + smoke tests gate every PR (Node 18/20/22) plus a browser e2e job; publishing now happens only on GitHub Releases (previously tag pushes and releases could double-fire publishes) and includes npm provenance.
- Removed stray `console.log` calls and dead code from production paths.

## [1.1.0] - 2025

### Added
- Subtitle track support with keyboard controls (C)
- Mobile controls layout, native-controls-for-mobile option, and touch gesture improvements
- Quality selector with HLS levels and an "Auto" quality option
- Scrubber segments, auto-skip for labeled segments (e.g. intros), and tooltip labels
- Player options: `autoPlay`, `autoNext`, `autoUnmuteOnInteraction`, `poster`, `debug`, segments, lifecycle callbacks
- Dynamic active indicator on the subtitle button

### Changed
- HLS.js is bundled directly instead of an external dependency
- Improved touch device detection and wrapper detection
- Standardized player element classes and cleanup

## [1.0.1] - 2025

### Fixed
- Smart engine selection and MP4 support
- Scrubber bar styling and vignette initialization

## [1.0.0] - 2025

### Added
- Initial release: HTML5 video player with HLS support, custom controls, quality switching, keyboard shortcuts, tooltips, and auto-hide controls
