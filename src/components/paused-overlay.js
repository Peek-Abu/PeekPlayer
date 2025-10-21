import { ICONS } from '../constants/icons.js';

export function createPausedOverlay(video, onPlaybackChange) {
    let overlay = document.getElementById('overlay-container');

    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'overlay-container';
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.left = '0';
        const wrapper = video.closest('#player-wrapper');
        if (wrapper) {
            wrapper.appendChild(overlay);
        }
    }
    
    // Centered play button
    const playButton = document.createElement('button');
    playButton.className = 'paused-play-button';
    playButton.setAttribute('aria-label', 'Play');
    
    playButton.innerHTML = ICONS.PLAY;
    
    // Click handler
    playButton.onclick = (e) => {
        e.stopPropagation();
        video.play();
        if (onPlaybackChange) onPlaybackChange(true);
    };
    
    // Show/hide based on video state
    function updateVisibility() {
        if (video.paused) {
            overlay.style.display = 'flex';
            overlay.style.opacity = '1';
        } else {
            overlay.style.opacity = '0';
            setTimeout(() => {
                if (!video.paused) {
                    overlay.style.display = 'none';
                }
            }, 300);
        }
    }
    
    // Video event listeners
    video.addEventListener('play', updateVisibility);
    video.addEventListener('pause', updateVisibility);
    video.addEventListener('loadeddata', updateVisibility);
    
    // Assembly
    overlay.appendChild(playButton);
    
    // Initial state
    updateVisibility();
    
    const cleanup = () => {
        video.removeEventListener('play', updateVisibility);
        video.removeEventListener('pause', updateVisibility);
        video.removeEventListener('loadeddata', updateVisibility);
        playButton.remove();
        overlay.style.display = 'none';
        overlay.style.opacity = '0';
    };
    return { element: overlay, cleanup };
}
