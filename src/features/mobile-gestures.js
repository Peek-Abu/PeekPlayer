import { TIMING } from '../constants/timing.js';
import { clampSeek } from '../utils/live.js';

export function setupMobileGestures(video, playerWrapper, logger) {
    if (typeof window === 'undefined' || !('ontouchstart' in window)) return null; // Skip on desktop
    
    let touchStartX = 0;
    let touchStartY = 0;
    let isSeeking = false;
    let seekBaseTime = 0;
    
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            isSeeking = false;
        }
    };
    const handleTouchMove = (e) => {
        if (e.touches.length === 1) {
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
            
            if (Math.abs(deltaX) > TIMING.SWIPE_THRESHOLD && deltaY < TIMING.SWIPE_VERTICAL_LIMIT) {
                if (!isSeeking) {
                    isSeeking = true;
                    seekBaseTime = video.currentTime || 0;
                }

                // Live scrubbing: recompute from the touch origin so the seek
                // tracks the finger instead of latching at the threshold.
                const seekAmount = deltaX / TIMING.SWIPE_PIXEL_TO_SECOND_RATIO;
                // Clamped to the servable region. `Number.isFinite(Infinity)`
                // is false, so a live stream fell to the unclamped branch and
                // a swipe could seek past the edge or before the window start.
                video.currentTime = clampSeek(video, seekBaseTime + seekAmount);
                
                // Show seek indicator
                showSeekIndicator(playerWrapper, seekAmount > 0 ? 'forward' : 'backward');
            }
        }
    };
    
    const handleTouchEnd = () => {
        isSeeking = false;
    };
    
    // Note: double-tap fullscreen is intentionally NOT handled here.
    // setupVideoInteractions already detects double clicks (including the
    // synthetic clicks produced by taps) and toggles fullscreen; handling it
    // in both places caused double toggles / races.
    
    video.addEventListener('touchstart', handleTouchStart, { passive: true });
    video.addEventListener('touchmove', handleTouchMove, { passive: true });
    video.addEventListener('touchend', handleTouchEnd, { passive: true });
    return () => {
        video.removeEventListener('touchstart', handleTouchStart);
        video.removeEventListener('touchmove', handleTouchMove);
        video.removeEventListener('touchend', handleTouchEnd);
    };
}

function showSeekIndicator(wrapper, direction) {
    if (!(wrapper instanceof HTMLElement)) {
        return;
    }
    const indicator = document.createElement('div');
    indicator.className = 'seek-indicator';
    indicator.textContent = direction === 'forward' ? '⏩' : '⏪';
    indicator.style.cssText = `
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(0,0,0,0.7);
        color: white;
        padding: 20px;
        border-radius: 50%;
        font-size: 24px;
        z-index: 1000;
        pointer-events: none;
        animation: peekplayer-fade-in-out ${TIMING.SEEK_INDICATOR_DURATION}ms ease;
    `;
    
    wrapper.appendChild(indicator);
    setTimeout(() => indicator.remove(), TIMING.SEEK_INDICATOR_DURATION);
}
