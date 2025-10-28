import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
import { TIMING } from '../constants/timing.js';

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
    skipBackBtn.onclick = (e) => {
        e.stopPropagation();
        const newTime = Math.max(0, video.currentTime - TIMING.SKIP_SECONDS);
        const delta = newTime - video.currentTime
        video.currentTime = newTime;
        if (onSeek) onSeek(newTime, delta, newTime / video.duration);
    };
    
    skipForwardBtn.onclick = (e) => {
        e.stopPropagation();
        const newTime = Math.min(video.duration || 0, video.currentTime + TIMING.SKIP_SECONDS);
        const delta = newTime - video.currentTime
        video.currentTime = newTime;
        if (onSeek) onSeek(newTime, delta, newTime / video.duration);
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
