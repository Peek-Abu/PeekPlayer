import { isLiveVideo, isAtLiveEdge, seekToLiveEdge, behindLiveBy } from '../utils/live.js';

/**
 * The LIVE indicator, and the way back to the edge.
 *
 * Two states in one control:
 *   at the edge  — a pulsing red dot beside "LIVE", not interactive
 *   behind it    — a grey dot beside "GO LIVE", click to jump forward
 *
 * It is the same control rather than two because that is what viewers expect
 * from a broadcast player: the badge tells you where you are, and pressing it
 * takes you to now.
 *
 * Hidden entirely on non-live sources, so it costs nothing for VOD.
 *
 * @param {HTMLVideoElement} video
 * @param {{ onSeekToLive?: (behindBy: number) => void, logger?: any }} [options]
 * @returns {{ element: HTMLButtonElement, cleanup: () => void }}
 */
export function createLiveBadge(video, options = {}) {
  const { onSeekToLive, logger } = options;

  const badge = document.createElement('button');
  badge.className = 'live-badge';
  badge.type = 'button';
  badge.hidden = true;

  const dot = document.createElement('span');
  dot.className = 'live-badge-dot';

  const label = document.createElement('span');
  label.className = 'live-badge-label';
  label.textContent = 'LIVE';

  badge.appendChild(dot);
  badge.appendChild(label);

  /**
   * `peekplayer:live-state` from the hls.js engine is authoritative when it
   * arrives, but it never arrives for native HLS, so the video element's own
   * infinite duration remains the fallback.
   */
  let engineSaysLive = null;

  function live() {
    return engineSaysLive === null ? isLiveVideo(video) : engineSaysLive;
  }

  function render() {
    const isLive = live();
    badge.hidden = !isLive;
    if (!isLive) return;

    const atEdge = isAtLiveEdge(video);
    badge.classList.toggle('is-at-edge', atEdge);
    badge.classList.toggle('is-behind', !atEdge);
    label.textContent = atEdge ? 'LIVE' : 'GO LIVE';
    // aria-disabled rather than `disabled`: the real attribute drops the
    // button out of the tab order, so reaching the edge silently threw away
    // keyboard focus and the viewer had to tab from the top to get it back.
    // handleClick already ignores a press at the edge.
    badge.setAttribute('aria-disabled', atEdge ? 'true' : 'false');
    badge.setAttribute(
      'aria-label',
      atEdge ? 'Playing live' : `Behind live by ${Math.round(behindLiveBy(video))} seconds. Jump to live.`
    );
    badge.title = atEdge ? 'Playing live' : 'Jump to live';
  }

  function handleClick() {
    if (!live() || isAtLiveEdge(video)) return;
    const behind = behindLiveBy(video);
    if (seekToLiveEdge(video)) {
      logger?.log?.('🎬 Jumped to live edge');
      onSeekToLive?.(behind);
      // The seek lands us at the edge; reflect it without waiting for a tick.
      render();
      if (video.paused) video.play().catch(() => {});
    }
  }

  function handleLiveState(event) {
    const detail = event?.detail;
    if (!detail) return;
    engineSaysLive = !!detail.isLive;
    render();
  }

  /**
   * The edge advances whether or not the video is playing, so a paused viewer
   * keeps falling behind while `timeupdate` stays silent. Without this the
   * badge could read LIVE, and stay disabled, while the gap grew — the same
   * staleness the time display had.
   */
  const tick = setInterval(() => {
    if (document.visibilityState === 'hidden') return;
    if (live()) render();
  }, 1000);

  badge.addEventListener('click', handleClick);
  video.addEventListener('timeupdate', render);
  video.addEventListener('durationchange', render);
  video.addEventListener('loadedmetadata', render);
  video.addEventListener('progress', render);
  video.addEventListener('seeked', render);
  video.addEventListener('peekplayer:live-state', handleLiveState);

  render();

  return {
    element: badge,
    cleanup: () => {
      clearInterval(tick);
      badge.removeEventListener('click', handleClick);
      video.removeEventListener('timeupdate', render);
      video.removeEventListener('durationchange', render);
      video.removeEventListener('loadedmetadata', render);
      video.removeEventListener('progress', render);
      video.removeEventListener('seeked', render);
      video.removeEventListener('peekplayer:live-state', handleLiveState);
      badge.remove();
    }
  };
}
