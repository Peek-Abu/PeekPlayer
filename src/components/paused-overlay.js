import { ICONS } from '../constants/icons.js';

export function createPausedOverlay(video, onPlaybackChange) {
    const overlay = document.getElementById('overlay-container');
    
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
        overlay.remove();
    };
    return { element: overlay, cleanup };
}
