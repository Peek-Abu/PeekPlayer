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
            if (hooks.onPlay) hooks.onPlay();
        } else {
            video.pause();
            if (hooks.onPause) hooks.onPause();
        }
    }
    
    function handleDoubleClick() {
        // Toggle fullscreen
        if (!document.fullscreenElement) {
            if (playerWrapper.requestFullscreen) {
                playerWrapper.requestFullscreen();
            } else if (playerWrapper.webkitRequestFullscreen) {
                playerWrapper.webkitRequestFullscreen();
            } else if (playerWrapper.msRequestFullscreen) {
                playerWrapper.msRequestFullscreen();
            }
            if (hooks.onFullscreenEnter) hooks.onFullscreenEnter();
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
            if (hooks.onFullscreenExit) hooks.onFullscreenExit();
        }
    }
    
    // Add click listener to video
    video.addEventListener('click', handleVideoClick);
    
    // Prevent context menu on video for cleaner experience
    video.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });
    
    // Return cleanup function
    return () => {
        video.removeEventListener('click', handleVideoClick);
        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }
    };
}
