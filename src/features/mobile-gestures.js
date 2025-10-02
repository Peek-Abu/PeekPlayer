import { TIMING } from '../constants/timing.js';

export function setupMobileGestures(video, player) {
    if (!('ontouchstart' in window)) return; // Skip on desktop
    
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;
    let isSeeking = false;
    
    video.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
            touchStartTime = Date.now();
        }
    }, { passive: true });
    video.addEventListener('touchmove', (e) => {
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
    }, { passive: true });
    
    video.addEventListener('touchend', () => {
        isSeeking = false;
    }, { passive: true });
    
    // Double tap for fullscreen
    let lastTap = 0;
    video.addEventListener('touchend', (e) => {
        const currentTime = Date.now();
        const tapLength = currentTime - lastTap;
        
        if (tapLength < TIMING.DOUBLE_TAP_THRESHOLD && tapLength > 0) {
            // Double tap detected
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                video.requestFullscreen();
            }
        }
        lastTap = currentTime;
    });
    return () => {
        video.removeEventListener('touchstart', (e) => {});
        video.removeEventListener('touchmove', (e) => {});
        video.removeEventListener('touchend', (e) => {});
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