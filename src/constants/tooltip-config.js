import { TIMING } from './timing.js';

export const TOOLTIP_CONFIG = {
    STATIC_FAST: {
        position: 'top',
        delay: TIMING.TOOLTIP_DELAY_FAST,
        dynamic: false
    },
    
    DYNAMIC_FAST: {
        position: 'top',
        delay: TIMING.TOOLTIP_DELAY_FAST,
        dynamic: true
    },
    
    STATIC_SLOW: {
        position: 'top',
        delay: TIMING.TOOLTIP_DELAY_SLOW,
        dynamic: false
    },
    
    VOLUME: {
        position: 'top',
        delay: TIMING.TOOLTIP_DELAY_FAST,
        dynamic: true,
        followCursor: true
    }
};
