import { ICONS } from '../constants/icons.js';

export function createPausedOverlay(video, onPlaybackChange, playerWrapper, overlayContainer) {
    let overlay = overlayContainer || playerWrapper?.querySelector('.peekplayer-overlay');
    let ownsOverlay = false;

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'peekplayer-overlay';
        ownsOverlay = true;
    } else {
        overlay.classList.add('peekplayer-overlay');
    }

    overlay.style.position = 'absolute';
    overlay.style.top = '0';
    overlay.style.right = '0';
    overlay.style.bottom = '0';
    overlay.style.left = '0';
    overlay.style.pointerEvents = 'none';
    overlay.style.display = 'flex';
    if (playerWrapper && overlay.parentElement !== playerWrapper) {
        playerWrapper.appendChild(overlay);
    }
    
    // Centered play button
    const playButton = document.createElement('button');
    playButton.className = 'paused-play-button';
    playButton.setAttribute('aria-label', 'Play');
    playButton.innerHTML = ICONS.PLAY;
    
    // Click handler
    playButton.onclick = (e) => {
        e.stopPropagation();
        const isPaused = video.paused;
        if (isPaused) {
            video.play();
        } else {
            video.pause();
        }
        if (onPlaybackChange) onPlaybackChange(isPaused);
    };

    // Show/hide based on video state: the center button must only be
    // visible (and clickable) while the video is paused, otherwise it
    // intercepts clicks meant for the video surface.
    function updateVisibility() {
        const isPaused = video.paused;
        playButton.innerHTML = isPaused ? ICONS.PLAY : ICONS.PAUSE;
        playButton.style.opacity = isPaused ? '1' : '0';
        playButton.style.pointerEvents = isPaused ? 'auto' : 'none';
        overlay.classList.toggle('visible', isPaused);
    }

    // Video event listeners
    video.addEventListener('play', updateVisibility);
    video.addEventListener('pause', updateVisibility);
    video.addEventListener('loadeddata', updateVisibility);
    
    // Assembly
    overlay.innerHTML = '';
    overlay.appendChild(playButton);
    // Initial state
    updateVisibility();
    
    const cleanup = () => {
        video.removeEventListener('play', updateVisibility);
        video.removeEventListener('pause', updateVisibility);
        video.removeEventListener('loadeddata', updateVisibility);
        playButton.remove();
        overlay.innerHTML = '';
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
        if (ownsOverlay && overlay.parentElement) {
            overlay.remove();
        }
    };
    return { element: overlay, playPauseButton: playButton, cleanup };
}
