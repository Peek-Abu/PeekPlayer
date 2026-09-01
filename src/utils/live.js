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
 * The furthest point currently available, or null when nothing is seekable yet.
 *
 * @param {HTMLVideoElement} video
 * @returns {number | null}
 */
export function liveEdge(video) {
  const seekable = video?.seekable;
  if (!seekable || seekable.length === 0) return null;
  const end = seekable.end(seekable.length - 1);
  return Number.isFinite(end) ? end : null;
}

/**
 * The seekable start of the DVR window, or null.
 *
 * @param {HTMLVideoElement} video
 * @returns {number | null}
 */
export function liveStart(video) {
  const seekable = video?.seekable;
  if (!seekable || seekable.length === 0) return null;
  const start = seekable.start(0);
  return Number.isFinite(start) ? start : null;
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
