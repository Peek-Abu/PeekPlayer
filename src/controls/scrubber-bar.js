import { createScrubberTooltip } from '../components/tooltip/tooltip.js';
import { createSegmentedScrubber } from './segmented-scrubber.js';
import { assertVideoElement, assertFunction } from '../utils/assert.js';

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

    const segmentedScrubber = createSegmentedScrubber({
        getSegments,
        onSeek: (time, delta, percent) => {
            video.currentTime = time;
            if (onSeek) onSeek(time, delta, percent);
        },
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
        segmentedScrubber.update({
            currentTime: video.currentTime || 0,
            duration: video.duration || 0,
            bufferedEnd: getBufferedEnd()
        });
        maybeAutoSkip(video.currentTime || 0);
    };

    segmentedScrubber.setSegments(getSegments());
    resetAutoSkipState();
    updateScrubber();

    const cleanupTooltip = createScrubberTooltip(interactiveElement, video, {
        getSegments
    });

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

    const handleSeeked = () => {
        updateScrubber();
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('progress', handleProgress);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('seeked', handleSeeked);

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