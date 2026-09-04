import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
import { TIMING } from '../constants/timing.js';
import { clampSeek, liveWindow } from '../utils/live.js';

export function createSecondsSkipButtons(video, onSeek, options = {}) {
    // Skip backward 10 seconds button
    const skipBackBtn = document.createElement('button');
    skipBackBtn.className = 'skip-button skip-back';
    skipBackBtn.setAttribute('aria-label', 'Skip backward 10 seconds');
    skipBackBtn.style.pointerEvents = 'auto';
    const backTooltip = createTooltip(skipBackBtn, {
        ...TOOLTIP_CONFIG.STATIC_FAST,
        text: `Skip back ${TIMING.SKIP_SECONDS}s`,
        isMobile: options.isMobile
    });
    
    skipBackBtn.innerHTML = ICONS.SKIP_BACK_10;
    
    // Skip forward 10 seconds button
    const skipForwardBtn = document.createElement('button');
    skipForwardBtn.className = 'skip-button skip-forward';
    skipForwardBtn.setAttribute('aria-label', 'Skip forward 10 seconds');
    skipForwardBtn.style.pointerEvents = 'auto';
    
    const forwardTooltip = createTooltip(skipForwardBtn, {
        ...TOOLTIP_CONFIG.STATIC_FAST,
        text: `Skip forward ${TIMING.SKIP_SECONDS}s`,
        isMobile: options.isMobile
    });

    skipForwardBtn.innerHTML = ICONS.SKIP_FORWARD_10;
    
    // Event handlers
    const seekWithGuard = (targetTime) => {
        // Clamped to what the source can serve. On live that is the DVR
        // window: forward used to clamp to MAX_SAFE_INTEGER, which on a live
        // stream means far past the end of the broadcast, and backward to 0,
        // which is before the window even begins. Both stall.
        const newTime = clampSeek(video, targetTime);
        const delta = newTime - video.currentTime;
        video.currentTime = newTime;
        const { offset, length } = liveWindow(video);
        const percent = length > 0 ? (newTime - offset) / length : 0;
        if (onSeek) onSeek(newTime, delta, percent);
    };

    skipBackBtn.onclick = (e) => {
        e.stopPropagation();
        seekWithGuard(video.currentTime - TIMING.SKIP_SECONDS);
    };
    
    skipForwardBtn.onclick = (e) => {
        e.stopPropagation();
        seekWithGuard(video.currentTime + TIMING.SKIP_SECONDS);
    };
    
    return {
        skipBackBtn: skipBackBtn,
        skipForwardBtn: skipForwardBtn,
        cleanup: () => {
            backTooltip();
            forwardTooltip();
        }
    };
}
