import { TIMING } from '../constants/timing.js';

export function setupMobileGestures(video, playerWrapper, player) {
    if (!('ontouchstart' in window)) return; // Skip on desktop
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSeeking = false;
    
    const handleTouchStart = (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    };
    const handleTouchMove = (e) => {
        if (e.touches.length === 1 && !isSeeking) {
            const deltaX = e.touches[0].clientX - touchStartX;
            const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
            
            if (Math.abs(deltaX) > TIMING.SWIPE_THRESHOLD && deltaY < TIMING.SWIPE_VERTICAL_LIMIT) {
                isSeeking = true;
                const seekAmount = deltaX / TIMING.VOLUME_PIXEL_TO_SECOND_RATIO; // pixels to seconds
                const currentTime = player ? player.currentTime() : video.currentTime;
                const newTime = Math.max(0, currentTime + seekAmount);
                if (player) {
                    player.currentTime(newTime);
                } else {
                    video.currentTime = newTime;
                }
                
                // Show seek indicator
                showSeekIndicator(seekAmount > 0 ? 'forward' : 'backward');
            }
        }
    };
    
    const handleTouchEnd = () => {
        isSeeking = false;
    };
    
    // Double tap for fullscreen
    let lastTap = 0;
    const handleTouchEndFullscreen = (e) => {
        const currentTime = Date.now();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < TIMING.DOUBLE_TAP_THRESHOLD && tapLength > 0) {
            // Double tap detected
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                const wrapper = playerWrapper || video.closest('.peekplayer-wrapper') || video.parentElement;
                if (wrapper?.requestFullscreen) {
                    wrapper.requestFullscreen();
                }
            }
        }
        lastTap = currentTime;
    };
    
    video.addEventListener('touchstart', handleTouchStart, { passive: true });
    video.addEventListener('touchmove', handleTouchMove, { passive: true });
    video.addEventListener('touchend', handleTouchEnd, { passive: true });
    video.addEventListener('touchend', handleTouchEndFullscreen);
    return () => {
        video.removeEventListener('touchstart', handleTouchStart);
        video.removeEventListener('touchmove', handleTouchMove);
        video.removeEventListener('touchend', handleTouchEnd);
        video.removeEventListener('touchend', handleTouchEndFullscreen);
    };
}

function showSeekIndicator(direction) {
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
        animation: fadeInOut 1s ease;
    `;
    
    document.querySelector('.video-container').appendChild(indicator);
    setTimeout(() => indicator.remove(), TIMING.SEEK_INDICATOR_DURATION);
}