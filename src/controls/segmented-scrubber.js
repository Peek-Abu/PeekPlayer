import { assertFunction } from '../utils/assert.js';

const KEYBOARD_STEP_SECONDS = 5;
const KEYBOARD_LARGE_STEP_SECONDS = 10;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export function getBufferedEnd(buffered, duration = 0) {
  if (!buffered || typeof buffered.length !== 'number' || buffered.length === 0) {
    return 0;
  }

  let maxEnd = 0;
  for (let i = 0; i < buffered.length; i += 1) {
    try {
      const end = buffered.end(i);
      if (Number.isFinite(end) && end > maxEnd) {
        maxEnd = end;
      }
    } catch (error) {
      // Some environments may throw if the index is not available yet.
    }
  }

  if (duration && Number.isFinite(duration)) {
    return Math.min(maxEnd, duration);
  }

  return maxEnd;
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds)) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function createSegmentedScrubber(options = {}) {
  const { onSeek, getSegments, segmentGap } = options;
  const segmentHooksOption = options.segmentHooks ?? {};

  if (onSeek) {
    assertFunction(onSeek, 'onSeek', { component: 'SegmentedScrubber', method: 'createSegmentedScrubber' });
  }
  if (getSegments) {
    assertFunction(getSegments, 'getSegments', { component: 'SegmentedScrubber', method: 'createSegmentedScrubber' });
  }
  if (segmentHooksOption && typeof segmentHooksOption !== 'object') {
    throw new TypeError('SegmentedScrubber expected segmentHooks to be an object');
  }

  const { onSegmentChange, onSegmentHover } = segmentHooksOption;

  if (onSegmentChange) {
    assertFunction(onSegmentChange, 'segmentHooks.onSegmentChange', { component: 'SegmentedScrubber', method: 'createSegmentedScrubber' });
  }
  if (onSegmentHover) {
    assertFunction(onSegmentHover, 'segmentHooks.onSegmentHover', { component: 'SegmentedScrubber', method: 'createSegmentedScrubber' });
  }

  const root = document.createElement('div');
  root.className = 'segmented-scrubber';
  root.tabIndex = 0;
  root.setAttribute('role', 'slider');
  root.setAttribute('aria-label', 'Seek');
  root.setAttribute('aria-valuemin', '0');
  root.setAttribute('aria-valuenow', '0');
  root.setAttribute('aria-valuetext', '0:00');

  const track = document.createElement('div');
  track.className = 'segmented-scrubber__track';

  const segmentsLayer = document.createElement('div');
  segmentsLayer.className = 'segmented-scrubber__segments';

  const thumb = document.createElement('div');
  thumb.className = 'segmented-scrubber__thumb';

  track.appendChild(segmentsLayer);
  track.appendChild(thumb);
  root.appendChild(track);

  let duration = 0;
  let currentTime = 0;
  let bufferedEnd = 0;
  let isScrubbing = false;
  let segments = Array.isArray(getSegments?.()) ? getSegments() : [];
  let segmentElements = [];
  let hoveredSegmentIndex = null;
  let activeSegmentIndex = null;
  const segmentGapPercent = typeof segmentGap === 'number' && segmentGap > 0 ? segmentGap : 0;

  function buildSegments() {
    segmentsLayer.innerHTML = '';
    segmentElements = [];
    hoveredSegmentIndex = null;
    activeSegmentIndex = null;

    if (onSegmentHover) {
      onSegmentHover(null);
    }

    if (!duration) {
      return;
    }

    const providedSegments = Array.isArray(segments) ? segments : [];
    const sanitizedSegments = providedSegments
      .map((segment) => {
        if (!segment || typeof segment !== 'object') return null;
        const start = Number(segment.start);
        const end = Number(segment.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
        return {
          start: clamp(start, 0, duration),
          end: clamp(end, 0, duration),
          color: segment.color || null,
          data: segment.data,
          label: segment.label
        };
      })
      .filter((segment) => segment && segment.end > segment.start)
      .sort((a, b) => a.start - b.start);

    const normalizedSegments = [];
    let cursor = 0;

    sanitizedSegments.forEach((segment) => {
      if (segment.start > cursor) {
        normalizedSegments.push({
          start: cursor,
          end: segment.start,
          gap: true
        });
      }

      normalizedSegments.push({
        start: segment.start,
        end: segment.end,
        gap: false,
        color: segment.color,
        data: segment.data,
        label: segment.label
      });

      cursor = Math.max(cursor, segment.end);
    });

    if (cursor < duration) {
      normalizedSegments.push({
        start: cursor,
        end: duration,
        gap: true
      });
    }

    if (!normalizedSegments.length) {
      normalizedSegments.push({ start: 0, end: duration, gap: true });
    }

    normalizedSegments.forEach((segment) => {
      const leftPercent = (segment.start / duration) * 100;
      const widthPercent = ((segment.end - segment.start) / duration) * 100;
      const maxGap = widthPercent > 0 ? Math.min(segmentGapPercent, widthPercent * 0.6) : 0;
      const effectiveGap = maxGap > 0.01 ? maxGap : 0;
      const halfGap = effectiveGap / 2;
      const adjustedLeft = leftPercent + halfGap;
      const adjustedWidth = Math.max(0, widthPercent - effectiveGap);

      const segmentEl = document.createElement('div');
      segmentEl.className = 'segmented-scrubber__segment';
      segmentEl.dataset.gap = segment.gap ? 'true' : 'false';
      if (!segment.gap) {
        segmentEl.classList.add('segmented-scrubber__segment--defined');
      }
      segmentEl.style.setProperty('--segment-left', `${adjustedLeft}%`);
      segmentEl.style.setProperty('--segment-width', `${adjustedWidth}%`);
      segmentEl.style.setProperty('--segment-gap', `${effectiveGap}%`);
      if (!segment.gap && segment.color) {
        segmentEl.style.setProperty('--segment-color', segment.color);
      }

      const segmentTrack = document.createElement('div');
      segmentTrack.className = 'segmented-scrubber__segment-track';

      const segmentBuffered = document.createElement('div');
      segmentBuffered.className = 'segmented-scrubber__segment-buffered';

      const segmentPlayed = document.createElement('div');
      segmentPlayed.className = 'segmented-scrubber__segment-played';

      segmentEl.appendChild(segmentTrack);
      segmentEl.appendChild(segmentBuffered);
      segmentEl.appendChild(segmentPlayed);
      segmentsLayer.appendChild(segmentEl);

      const meta = {
        label: typeof segment.label === 'string' ? segment.label : '',
        color: segment.color || null,
        data: segment.data,
        gap: !!segment.gap
      };

      segmentElements.push({
        segment: { start: segment.start, end: segment.end },
        meta,
        buffered: segmentBuffered,
        played: segmentPlayed,
        element: segmentEl,
        isGap: meta.gap
      });
    });
  }

  function getSegmentPayload(index) {
    if (index === null || index === undefined || index < 0 || index >= segmentElements.length) {
      return null;
    }
    const entry = segmentElements[index];
    const durationSeconds = Math.max(0, entry.segment.end - entry.segment.start);
    return {
      index,
      start: entry.segment.start,
      end: entry.segment.end,
      duration: durationSeconds,
      label: entry.meta?.label ?? '',
      color: entry.meta?.color ?? null,
      data: entry.meta?.data,
      gap: !!entry.isGap
    };
  }

  function updateSegmentStates() {
    segmentElements.forEach(({ segment, buffered, played }) => {
      const range = segment.end - segment.start;
      if (range <= 0) {
        buffered.style.width = '0%';
        played.style.width = '0%';
        return;
      }

      const playedRatio = clamp((currentTime - segment.start) / range, 0, 1);
      const bufferedRatio = clamp((bufferedEnd - segment.start) / range, 0, 1);
      played.style.width = `${playedRatio * 100}%`;
      buffered.style.width = `${Math.max(bufferedRatio, playedRatio) * 100}%`;
    });
  }

  function highlightActiveSegment() {
    let newActiveIndex = null;
    segmentElements.forEach(({ segment, element }, index) => {
      const isActive = currentTime >= segment.start && currentTime < segment.end;
      element.classList.toggle('segmented-scrubber__segment--active', isActive);
      if (isActive) {
        newActiveIndex = index;
      }
    });

    if (newActiveIndex === null && segmentElements.length && currentTime >= duration) {
      newActiveIndex = segmentElements.length - 1;
      segmentElements[newActiveIndex].element.classList.add('segmented-scrubber__segment--active');
    }

    if (activeSegmentIndex !== newActiveIndex) {
      activeSegmentIndex = newActiveIndex;
      if (onSegmentChange) {
        onSegmentChange(getSegmentPayload(activeSegmentIndex));
      }
    }
  }

  function findSegmentIndexAtTime(time) {
    if (!segmentElements.length) return null;
    for (let i = 0; i < segmentElements.length; i += 1) {
      const { segment } = segmentElements[i];
      if (time >= segment.start && time < segment.end) {
        return i;
      }
    }

    if (time >= duration) {
      return segmentElements.length - 1;
    }

    return null;
  }

  function setHoveredSegment(index) {
    if (hoveredSegmentIndex === index) return;

    if (hoveredSegmentIndex !== null && segmentElements[hoveredSegmentIndex]) {
      segmentElements[hoveredSegmentIndex].element.classList.remove('segmented-scrubber__segment--hover');
    }

    hoveredSegmentIndex = index;

    if (hoveredSegmentIndex !== null && segmentElements[hoveredSegmentIndex]) {
      segmentElements[hoveredSegmentIndex].element.classList.add('segmented-scrubber__segment--hover');
    }

    if (onSegmentHover) {
      onSegmentHover(getSegmentPayload(hoveredSegmentIndex));
    }
  }

  function clearHoveredSegment() {
    if (hoveredSegmentIndex !== null && segmentElements[hoveredSegmentIndex]) {
      segmentElements[hoveredSegmentIndex].element.classList.remove('segmented-scrubber__segment--hover');
    }
    const hadHover = hoveredSegmentIndex !== null;
    hoveredSegmentIndex = null;
    if (hadHover && onSegmentHover) {
      onSegmentHover(null);
    }
  }

  function updateVisualState() {
    const percent = duration > 0 ? (currentTime / duration) * 100 : 0;
    thumb.style.left = `${percent}%`;

    root.setAttribute('aria-valuemax', duration > 0 ? `${Math.round(duration)}` : '0');
    root.setAttribute('aria-valuenow', `${Math.round(currentTime)}`);
    root.setAttribute('aria-valuetext', formatTime(currentTime));

    updateSegmentStates();
    highlightActiveSegment();
  }

  function seekTo(time) {
    const clampedTime = duration > 0 ? clamp(time, 0, duration) : 0;
    const previous = currentTime;
    currentTime = clampedTime;
    updateVisualState();
    if (onSeek) {
      onSeek(clampedTime, clampedTime - previous, duration > 0 ? clampedTime / duration : 0);
    }
  }

  function updateFromPointer(event) {
    if (duration <= 0) return;
    const rect = track.getBoundingClientRect();
    if (!rect.width) return;

    const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1);
    const nextTime = percent * duration;
    const previous = currentTime;
    currentTime = nextTime;
    updateVisualState();
    if (onSeek) {
      onSeek(nextTime, nextTime - previous, percent);
    }

    const hoverIndex = findSegmentIndexAtTime(nextTime);
    setHoveredSegment(hoverIndex);
  }

  function handlePointerDown(event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    if (duration <= 0) return;
    event.preventDefault();
    root.focus({ preventScroll: true });
    isScrubbing = true;
    root.classList.add('segmented-scrubber--scrubbing');
    root.setPointerCapture(event.pointerId);
    updateFromPointer(event);
  }

  function handlePointerMove(event) {
    if (duration > 0) {
      const rect = track.getBoundingClientRect();
      if (rect.width) {
        const percent = clamp((event.clientX - rect.left) / rect.width, 0, 1);
        const time = percent * duration;
        const hoverIndex = findSegmentIndexAtTime(time);
        setHoveredSegment(hoverIndex);
      }
    }

    if (isScrubbing) {
      updateFromPointer(event);
    }
  }

  function finishScrub(event) {
    if (!isScrubbing) return;
    if (event && root.hasPointerCapture(event.pointerId)) {
      root.releasePointerCapture(event.pointerId);
    }
    if (event) {
      updateFromPointer(event);
    }
    isScrubbing = false;
    root.classList.remove('segmented-scrubber--scrubbing');
  }

  function handlePointerUp(event) {
    finishScrub(event);
  }

  function handlePointerCancel(event) {
    finishScrub(event);
  }

  function handlePointerLeave() {
    clearHoveredSegment();
  }

  function handleKeyDown(event) {
    if (duration <= 0) return;
    let delta = 0;
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = -KEYBOARD_STEP_SECONDS;
        break;
      case 'ArrowRight':
      case 'ArrowUp':
        delta = KEYBOARD_STEP_SECONDS;
        break;
      case 'PageDown':
        delta = -KEYBOARD_LARGE_STEP_SECONDS;
        break;
      case 'PageUp':
        delta = KEYBOARD_LARGE_STEP_SECONDS;
        break;
      case 'Home':
        seekTo(0);
        event.preventDefault();
        return;
      case 'End':
        seekTo(duration);
        event.preventDefault();
        return;
      default:
        return;
    }

    event.preventDefault();
    seekTo(currentTime + delta);
  }

  function update(state = {}) {
    const {
      currentTime: nextTime,
      duration: nextDuration,
      bufferedEnd: nextBufferedEnd,
      segments: nextSegments
    } = state;

    let shouldRebuildSegments = false;

    if (typeof nextDuration === 'number' && nextDuration !== duration) {
      duration = Math.max(0, nextDuration);
      shouldRebuildSegments = true;
    }

    if (Array.isArray(nextSegments)) {
      segments = nextSegments;
      shouldRebuildSegments = true;
    }

    if (typeof nextBufferedEnd === 'number') {
      bufferedEnd = clamp(nextBufferedEnd, 0, duration || nextBufferedEnd || 0);
    }

    if (!isScrubbing && typeof nextTime === 'number') {
      currentTime = clamp(nextTime, 0, duration || nextTime || 0);
    }

    if (shouldRebuildSegments) {
      buildSegments();
    }

    updateVisualState();
  }

  function setSegments(nextSegments = []) {
    segments = Array.isArray(nextSegments) ? nextSegments : [];
    buildSegments();
    updateVisualState();
  }

  function cleanup() {
    track.removeEventListener('pointerdown', handlePointerDown);
    thumb.removeEventListener('pointerdown', handlePointerDown);
    root.removeEventListener('pointermove', handlePointerMove);
    root.removeEventListener('pointerup', handlePointerUp);
    root.removeEventListener('pointercancel', handlePointerCancel);
    root.removeEventListener('pointerleave', handlePointerLeave);
    root.removeEventListener('keydown', handleKeyDown);
  }

  track.addEventListener('pointerdown', handlePointerDown);
  thumb.addEventListener('pointerdown', handlePointerDown);
  root.addEventListener('pointermove', handlePointerMove);
  root.addEventListener('pointerup', handlePointerUp);
  root.addEventListener('pointercancel', handlePointerCancel);
  root.addEventListener('pointerleave', handlePointerLeave);
  root.addEventListener('keydown', handleKeyDown);

  buildSegments();
  updateVisualState();

  return {
    element: root,
    getInteractiveElement: () => root,
    update,
    setSegments,
    isScrubbing: () => isScrubbing,
    cleanup
  };
}
