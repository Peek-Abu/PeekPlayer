/**
 * Live-stream helpers.
 *
 * Everything here reads the video element rather than the hls.js instance, so
 * it works identically for hls.js, native HLS (Safari/iOS) and a plain live
 * source. The engine layer refines this when it can, but the controls never
 * depend on an engine being present.
 *
 * A live stream reports `duration === Infinity` and exposes its DVR window
 * through `video.seekable`. Every duration-based calculation in the player
 * predates this and assumes a finite VOD duration, which is why live streams
 * produced a scrubber pinned at zero and a "0:00" total.
 */

/** Seconds behind the edge before we stop calling the viewer "at live". */
export const LIVE_EDGE_TOLERANCE = 10;

/**
 * Is this a live stream?
 *
 * `Infinity` duration is the reliable signal across engines. NaN is not — that
 * is simply metadata that has not loaded yet, and treating it as live made the
 * badge flicker on during startup for ordinary files.
 *
 * @param {HTMLVideoElement} video
 * @returns {boolean}
 */
export function isLiveVideo(video) {
  if (!video) return false;
  return video.duration === Infinity;
}

/**
 * Read one end of a TimeRanges, or null when it is missing or not finite.
 *
 * @param {TimeRanges | undefined | null} ranges
 * @param {'start' | 'end'} which
 * @returns {number | null}
 */
function edgeOf(ranges, which) {
  if (!ranges || ranges.length === 0) return null;
  const value = which === 'start' ? ranges.start(0) : ranges.end(ranges.length - 1);
  return Number.isFinite(value) ? value : null;
}

/**
 * The furthest point currently available, or null when nothing is known yet.
 *
 * `seekable` is the correct source and is what a working MSE live stream
 * reports, so it is tried first. `buffered` backs it up for the cases where it
 * is genuinely unavailable — before the first append, and on engines that
 * leave it empty. The fallback is narrower than the true DVR window, so it can
 * understate how much rewind exists; that is the right way round, since it can
 * only ever hide a scrubber rather than offer a seek that does not work.
 *
 * @param {HTMLVideoElement} video
 * @returns {number | null}
 */
export function liveEdge(video) {
  return edgeOf(video?.seekable, 'end') ?? edgeOf(video?.buffered, 'end');
}

/**
 * The start of the DVR window, or null. See `liveEdge` for why `buffered`
 * backs `seekable` up.
 *
 * @param {HTMLVideoElement} video
 * @returns {number | null}
 */
export function liveStart(video) {
  return edgeOf(video?.seekable, 'start') ?? edgeOf(video?.buffered, 'start');
}

/**
 * How much rewind the stream offers, in seconds. 0 when it offers none.
 *
 * Streams with no meaningful DVR window should not draw a scrubber at all —
 * a bar that cannot be dragged anywhere is worse than no bar.
 *
 * @param {HTMLVideoElement} video
 * @returns {number}
 */
export function dvrWindow(video) {
  const start = liveStart(video);
  const end = liveEdge(video);
  if (start === null || end === null) return 0;
  return Math.max(0, end - start);
}

/**
 * Seconds the viewer is behind the live edge. 0 when at (or ahead of) it.
 *
 * @param {HTMLVideoElement} video
 * @returns {number}
 */
export function behindLiveBy(video) {
  const edge = liveEdge(video);
  if (edge === null) return 0;
  return Math.max(0, edge - (video.currentTime || 0));
}

/**
 * @param {HTMLVideoElement} video
 * @param {number} [tolerance] seconds of slack; defaults to LIVE_EDGE_TOLERANCE
 * @returns {boolean}
 */
export function isAtLiveEdge(video, tolerance = LIVE_EDGE_TOLERANCE) {
  if (!isLiveVideo(video)) return false;
  const edge = liveEdge(video);
  if (edge === null) return true;
  return behindLiveBy(video) <= tolerance;
}

/**
 * Jump to the live edge.
 *
 * Lands slightly behind the reported edge: seeking exactly to it commonly
 * stalls, because the last segment is still being written.
 *
 * @param {HTMLVideoElement} video
 * @param {number} [safetyGap] seconds to stay behind the edge
 * @returns {boolean} whether a seek was performed
 */
export function seekToLiveEdge(video, safetyGap = 1) {
  const edge = liveEdge(video);
  if (edge === null) return false;
  const start = liveStart(video) ?? 0;
  video.currentTime = Math.max(start, edge - safetyGap);
  return true;
}

/**
 * DVR window as reported by the engine, per video element.
 *
 * hls.js knows the window the manifest advertises; `buffered` only covers what
 * has been downloaded, which understates it badly. Kept here rather than in
 * one control so the scrubber, its tooltip and the keyboard all agree on where
 * the seekable region begins.
 */
const engineDvrWindows = new WeakMap();

/**
 * Record the manifest's DVR window for this element.
 *
 * @param {HTMLVideoElement} video
 * @param {number} seconds
 */
export function noteEngineDvrWindow(video, seconds) {
  if (!video) return;
  engineDvrWindows.set(video, Number.isFinite(seconds) && seconds > 0 ? seconds : 0);
}

/**
 * The span of media a viewer can actually move around in.
 *
 * VOD is the whole file, starting at zero. Live is the DVR window, which does
 * not start at zero and moves forward as the broadcast continues — so times
 * have to be mapped into and out of it rather than used directly.
 *
 * @param {HTMLVideoElement} video
 * @returns {{ offset: number, length: number, live: boolean }}
 */
export function liveWindow(video) {
  if (!isLiveVideo(video)) {
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    return { offset: 0, length: duration, live: false };
  }
  const end = liveEdge(video);
  if (end === null) return { offset: 0, length: 0, live: true };

  // Whichever region is larger, because both are genuinely reachable: the
  // manifest says what the source will re-serve, and anything still in the
  // buffer can be seeked to even after it has rolled off the playlist. Taking
  // the manifest window unconditionally would hide buffered media the viewer
  // can actually reach; taking `buffered` alone understates a long window down
  // to whatever happens to be downloaded.
  const bufferedStart = liveStart(video) ?? end;
  const fromEngine = engineDvrWindows.get(video) || 0;
  const start = fromEngine > (end - bufferedStart)
    ? Math.max(0, end - fromEngine)
    : bufferedStart;
  return { offset: start, length: Math.max(0, end - start), live: true };
}

/**
 * Keep a seek inside what the source can actually serve.
 *
 * On live that is the DVR window: seeking past the edge lands in a segment
 * that does not exist yet and stalls, and seeking before the window start
 * lands in one that has already been rolled off. Both were reachable — the
 * skip buttons and the keyboard clamped forward seeks to MAX_SAFE_INTEGER,
 * which on a live stream means "far past the end of the broadcast".
 *
 * @param {HTMLVideoElement} video
 * @param {number} seconds desired position, in absolute media time
 * @returns {number} a position that is safe to assign to currentTime
 */
export function clampSeek(video, seconds) {
  const { offset, length, live } = liveWindow(video);
  if (!Number.isFinite(seconds)) return video?.currentTime || 0;
  if (!live) {
    const duration = Number.isFinite(video?.duration) ? video.duration : 0;
    return duration > 0 ? Math.min(Math.max(0, seconds), duration) : Math.max(0, seconds);
  }
  // Stay a beat behind the edge: the newest segment is still being written.
  const latest = Math.max(offset, offset + length - 1);
  return Math.min(Math.max(offset, seconds), latest);
}
