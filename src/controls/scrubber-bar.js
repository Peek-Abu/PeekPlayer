import { createScrubberTooltip } from '../components/tooltip/tooltip.js';
import { createSegmentedScrubber } from './segmented-scrubber.js';
import { assertVideoElement, assertFunction } from '../utils/assert.js';
import { liveWindow, noteEngineDvrWindow } from '../utils/live.js';

/**
 * Below this much rewind a live stream gets no scrubber at all.
 *
 * A bar representing eight seconds of DVR cannot be dragged anywhere useful,
 * and drawing one invites viewers to try.
 */
const MIN_DVR_SECONDS = 30;

export function createScrubberBar(video, onSeek, options = {}) {
    // Assert required parameters
    assertVideoElement(video, { component: 'ScrubberBar', method: 'createScrubberBar' });
    if (onSeek) {
        assertFunction(onSeek, 'onSeek', { component: 'ScrubberBar', method: 'createScrubberBar' });
    }
    const bar = document.createElement('div');
    bar.className = 'scrubber-row';
    const segmentHooks = options.segmentHooks && typeof options.segmentHooks === 'object' ? options.segmentHooks : null;
    const autoSkipConfig = normalizeAutoSkipConfig(options.segmentAutoSkip);
    const autoSkipState = {
        skippedKeys: new Set(),
        isSkipping: false
    };
    const getSegments = () => options.segments || [];
    const segmentGap = typeof options.segmentGap === 'number' ? options.segmentGap : 0.17;

    /**
     * The window the scrubber represents.
     *
     * VOD is the whole file. Live is the DVR window, which both moves forward
     * and does not start at zero — so times are shifted into and out of it
     * rather than passed through. Without this, live playback sat at a
     * position of `currentTime / Infinity`, i.e. pinned at the far left.
     */
    /**
     * The DVR window the manifest advertises, when hls.js has told us.
     *
     * Preferred over `buffered`, which only covers what has been downloaded —
     * on a stream advertising several minutes of rewind that read as fifteen
     * seconds, so the bar stayed hidden on streams that were perfectly
     * seekable. hls.js will fetch older segments on a seek outside the
     * buffer, so the manifest's window is the honest one.
     */
    // Recorded against the element so the tooltip and keyboard resolve the
    // same window this bar is drawing.
    const handleLiveState = (event) => {
        noteEngineDvrWindow(video, event?.detail?.dvrWindow);
        updateScrubber();
    };
    video.addEventListener('peekplayer:live-state', handleLiveState);

    const timelineWindow = () => liveWindow(video);

    const segmentedScrubber = createSegmentedScrubber({
        getSegments,
        onSeek: (time, delta, percent) => {
            // `time` is window-relative; the video wants absolute media time.
            video.currentTime = timelineWindow().offset + time;
            if (onSeek) onSeek(video.currentTime, delta, percent);
        },
        describePosition: (windowTime, windowLength) => {
            const { live } = liveWindow(video);
            if (!live) return null;
            const behind = Math.max(0, windowLength - windowTime);
            return behind < 1 ? 'Live' : `${Math.round(behind)} seconds behind live`;
        },
        onScrubPreview: typeof options.onScrubPreview === 'function' ? options.onScrubPreview : null,
        onScrubStart: typeof options.onScrubStart === 'function' ? options.onScrubStart : null,
        onScrubEnd: typeof options.onScrubEnd === 'function' ? options.onScrubEnd : null,
        segmentGap,
        ...(segmentHooks ? { segmentHooks } : {})
    });

    const scrubber = segmentedScrubber.element;
    scrubber.classList.add('scrubber');
    bar.appendChild(scrubber);

    const interactiveElement = segmentedScrubber.getInteractiveElement();

    const handleHoverEnter = () => {
        scrubber.classList.add('scrubber--hover');
    };

    const handleHoverLeave = () => {
        scrubber.classList.remove('scrubber--hover');
    };

    interactiveElement.addEventListener('mouseenter', handleHoverEnter);
    interactiveElement.addEventListener('mouseleave', handleHoverLeave);

    const getBufferedEnd = () => {
        const window = timelineWindow();
        if (window.live) {
            const { offset, length } = window;
            if (!video.buffered?.length) return 0;
            let maxEnd = 0;
            for (let i = 0; i < video.buffered.length; i++) {
                const end = video.buffered.end(i);
                if (end > maxEnd) maxEnd = end;
            }
            return Math.min(Math.max(0, maxEnd - offset), length);
        }
        if (!video.duration || !video.buffered?.length) return 0;
        let maxEnd = 0;
        for (let i = 0; i < video.buffered.length; i++) {
            const end = video.buffered.end(i);
            if (end > maxEnd) {
                maxEnd = end;
            }
        }
        return Math.min(maxEnd, video.duration);
    };

    const updateScrubber = () => {
        const { offset, length, live } = timelineWindow();

        // A live stream with no meaningful rewind gets no bar.
        if (live && length < MIN_DVR_SECONDS) {
            bar.hidden = true;
            return;
        }
        bar.hidden = false;

        segmentedScrubber.update({
            currentTime: Math.max(0, (video.currentTime || 0) - offset),
            duration: length,
            bufferedEnd: getBufferedEnd()
        });
        maybeAutoSkip(video.currentTime || 0);
    };

    segmentedScrubber.setSegments(getSegments());
    resetAutoSkipState();
    updateScrubber();

    const cleanupTooltip = createScrubberTooltip(interactiveElement, video, {
        getSegments,
        isMobile: options.isMobile
    },);

    // Use requestAnimationFrame for smooth updates
    let animationFrame;
    const smoothUpdate = () => {
        updateScrubber();
        animationFrame = requestAnimationFrame(smoothUpdate);
    };

    const handlePlay = () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        smoothUpdate();
    };

    const handlePause = () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        updateScrubber();
    };

    const handleProgress = () => {
        updateScrubber();
    };

    const handleLoadedMetadata = () => {
        segmentedScrubber.setSegments(getSegments());
        resetAutoSkipState();
        updateScrubber();
    };

    const handleDurationChange = () => {
        updateScrubber();
    };

    const handleSeeked = () => {
        updateScrubber();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);
    // A source turning out to be live only shows up as a duration change —
    // Infinity replacing a finite value. Without this the bar kept whatever
    // geometry it had when the metadata first loaded.
    video.addEventListener('durationchange', handleDurationChange);

    const cleanup = () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        cleanupTooltip();
        segmentedScrubber.cleanup();
        resetAutoSkipState();
        interactiveElement.removeEventListener('mouseenter', handleHoverEnter);
        interactiveElement.removeEventListener('mouseleave', handleHoverLeave);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
        video.removeEventListener('progress', handleProgress);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('durationchange', handleDurationChange);
        video.removeEventListener('peekplayer:live-state', handleLiveState);
    };

    function resetAutoSkipState() {
        autoSkipState.skippedKeys.clear();
        autoSkipState.isSkipping = false;
    }

    function maybeAutoSkip(currentTime) {
        if (!autoSkipConfig || autoSkipState.isSkipping) {
            return;
        }
        if (video.paused || segmentedScrubber.isScrubbing()) {
            return;
        }

        const segments = getSegments();
        if (!Array.isArray(segments) || !segments.length) {
            return;
        }

        const match = findSegmentAtTime(currentTime, segments);
        if (!match) {
            return;
        }

        const { segment, index } = match;
        if (!segment || typeof segment.label !== 'string') {
            return;
        }

        const labelKey = segment.label.trim().toLowerCase();
        if (!autoSkipConfig.labels.has(labelKey)) {
            return;
        }

        const segmentKey = `${segment.start}-${segment.end}`;
        if (autoSkipState.skippedKeys.has(segmentKey)) {
            return;
        }

        const remaining = segment.end - currentTime;
        if (!Number.isFinite(remaining) || remaining <= autoSkipConfig.tolerance) {
            return;
        }

        autoSkipState.skippedKeys.add(segmentKey);
        autoSkipState.isSkipping = true;

        const offsetAfter = autoSkipConfig.offsetAfter;
        const targetTime = Math.min(segment.end + offsetAfter, video.duration || segment.end + offsetAfter);
        video.currentTime = targetTime;

        if (autoSkipConfig.onAutoSkip) {
            autoSkipConfig.onAutoSkip({
                segment,
                index,
                targetTime
            });
        }

        // Allow the video to settle before permitting another skip
        requestAnimationFrame(() => {
            autoSkipState.isSkipping = false;
        });
    }

    function normalizeAutoSkipConfig(config) {
        if (!config) {
            return null;
        }

        let working = config;
        if (Array.isArray(config)) {
            working = { labels: config };
        }

        if (typeof working !== 'object' || working === null) {
            return null;
        }

        const labelsArray = Array.isArray(working.labels)
            ? working.labels
                .map((label) => (typeof label === 'string' ? label.trim().toLowerCase() : ''))
                .filter(Boolean)
            : [];

        if (!labelsArray.length) {
            return null;
        }

        const tolerance = typeof working.tolerance === 'number' && working.tolerance > 0 ? working.tolerance : 0.15;
        const offsetAfter = typeof working.offsetAfter === 'number' ? working.offsetAfter : 0;
        const onAutoSkip = typeof working.onAutoSkip === 'function' ? working.onAutoSkip : null;

        return {
            labels: new Set(labelsArray),
            tolerance,
            offsetAfter,
            onAutoSkip
        };
    }

    function findSegmentAtTime(time, segments) {
        if (!Number.isFinite(time)) {
            return null;
        }

        for (let i = 0; i < segments.length; i += 1) {
            const segment = segments[i];
            if (!segment) continue;
            const start = Number(segment.start);
            const end = Number(segment.end);
            if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
            if (time >= start && time < end) {
                return { segment, index: i };
            }
        }

        if (segments.length) {
            const last = segments[segments.length - 1];
            const lastEnd = Number(last.end);
            if (Number.isFinite(lastEnd) && time >= lastEnd) {
                return { segment: last, index: segments.length - 1 };
            }
        }

        return null;
    }

    return { element: bar, cleanup };
}