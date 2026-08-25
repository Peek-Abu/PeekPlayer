// Re-export tooltip creators with mobile check
import { createTooltip as createBaseTooltip } from './base-tooltip.js';
import { createVolumeTooltip as createBaseVolumeTooltip } from './volume-tooltip.js';
import { createScrubberTooltip as createBaseScrubberTooltip } from './scrubber-tooltip.js';

// Wrapper functions that check for mobile before creating tooltips
export const createTooltip = (element, options = {}) => {
    // If isMobile is true, return a no-op cleanup function
    if (options.isMobile) {
        return () => {}; // No-op cleanup
    }
    return createBaseTooltip(element, options);
};

export const createVolumeTooltip = (element, video, options = {}) => {
    if (options.isMobile) {
        return () => {}; // No-op cleanup
    }
    return createBaseVolumeTooltip(element, video, options);
};

export const createScrubberTooltip = (element, video, options = {}) => {
    if (options.isMobile) {
        return () => {}; // No-op cleanup
    }
    return createBaseScrubberTooltip(element, video, options);
};