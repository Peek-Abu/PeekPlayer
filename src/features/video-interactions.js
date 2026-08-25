import { toggleFullscreen } from '../utils/fullscreen.js';

export function setupVideoInteractions(video, playerWrapper, hooks = {}) {
    let clickTimeout = null;
    let lastClickTime = 0;
    
    // Handle single and double clicks
    function handleVideoClick(e) {
        e.preventDefault();
        
        const currentTime = Date.now();
        const timeDiff = currentTime - lastClickTime;
        
        // Clear any existing timeout
        if (clickTimeout) {
            clearTimeout(clickTimeout);
            clickTimeout = null;
        }
        
        // Double click detection (within 300ms)
        if (timeDiff < 300) {
            // Double click - toggle fullscreen
            handleDoubleClick();
            lastClickTime = 0; // Reset to prevent triple clicks
        } else {
            // Single click - delay to check for double click
            clickTimeout = setTimeout(() => {
                handleSingleClick();
                clickTimeout = null;
            }, 300);
            lastClickTime = currentTime;
        }
    }
    
    function handleSingleClick() {
        // Toggle play/pause
        if (video.paused) {
            video.play();
            if (hooks.onPlaybackChange) hooks.onPlaybackChange(true);
        } else {
            video.pause();
            if (hooks.onPlaybackChange) hooks.onPlaybackChange(false);
        }
    }
    
    function handleDoubleClick() {
        // Toggle fullscreen
        toggleFullscreen(playerWrapper, video, console);
    }
    
    // Add click listener to video
    video.addEventListener('click', handleVideoClick);
    
    // Prevent context menu on video for cleaner experience
    const handleContextMenu = (e) => {
        e.preventDefault();
    };
    video.addEventListener('contextmenu', handleContextMenu);
    
    // Return cleanup function
    return () => {
        video.removeEventListener('click', handleVideoClick);
        video.removeEventListener('contextmenu', handleContextMenu);
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
    };
}
