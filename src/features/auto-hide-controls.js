import { TIMING } from '../constants/timing.js';

export function setupAutoHideControls(video, controlsElement, playerWrapper) {
    let hideTimeout = null;
    let isMouseOverPlayer = playerWrapper.matches(':hover');
    let controlsVisible = true;
    
    // Create vignette overlay for better contrast when controls are visible
    const vignette = document.createElement('div');
    vignette.className = 'controls-vignette';
    playerWrapper.appendChild(vignette);
    
    function scheduleHide() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(hideControls, TIMING.CONTROLS_AUTO_HIDE_DELAY);
    }

    function showControls() {
        if (!controlsVisible) {
            controlsElement.style.opacity = '1';
            controlsElement.style.pointerEvents = 'auto';
            controlsVisible = true;
        }

        // Show vignette when controls are visible
        if (!video.paused) {
            vignette.style.opacity = '1';
        }

        playerWrapper.style.cursor = 'default';
        video.style.cursor = 'default';

        // Clear any existing hide timeout
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }

        // Set new hide timeout if video is playing and mouse not over player
        if (!video.paused) {
            scheduleHide();
        }
    }

    function hideControls() {
        if (controlsVisible && !video.paused) {
            controlsElement.style.opacity = '0';
            controlsElement.style.pointerEvents = 'none';
            controlsVisible = false;

            // Hide vignette when controls are hidden
            vignette.style.opacity = '0';
        }

        playerWrapper.style.cursor = 'none';
        video.style.cursor = 'none';

        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
    }
    
    function handleMouseEnter() {
        isMouseOverPlayer = true;
        showControls();
    }

    
    function handleMouseLeave() {
        isMouseOverPlayer = false;
        if (!video.paused) {
            scheduleHide();
        }
    }

    function handleMouseMove() {
        showControls();
    }
    
    function handlePlay() {
        // Remove paused class to restore normal vignette strength
        vignette.classList.remove('paused');
        
        // Show vignette when playing (if controls are visible)
        if (controlsVisible) {
            vignette.style.opacity = '1';
        }
        
        scheduleHide();
    }

    function handlePause() {
        showControls();
        // Add paused class for stronger vignette when paused
        vignette.classList.add('paused');
        vignette.style.opacity = '1';
    }
    
    function initializeVignette() {
        if (video.paused) {
            vignette.classList.add('paused');
            vignette.style.opacity = '1';
            controlsElement.style.opacity = '1';
            controlsElement.style.pointerEvents = 'auto';
            controlsVisible = true;
        }
    }
    
    // Set initial styles for smooth transitions
    controlsElement.style.transition = `opacity ${TIMING.TRANSITION_DURATION}ms ease, pointer-events ${TIMING.TRANSITION_DURATION}ms ease`;
    controlsElement.style.opacity = '1';
    controlsElement.style.pointerEvents = 'auto';
    playerWrapper.style.cursor = 'default';
    video.style.cursor = 'default';
    
    // Event listeners
    playerWrapper.addEventListener('mouseenter', handleMouseEnter);
    playerWrapper.addEventListener('mouseleave', handleMouseLeave);
    playerWrapper.addEventListener('mousemove', handleMouseMove);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    // Initialize vignette state
    initializeVignette();
    if (video.paused) {
        handlePause();
    } else {
        showControls();
    }
    
    // Return cleanup function
    return () => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        vignette.remove();
        playerWrapper.style.cursor = 'default';
        video.style.cursor = 'default';
        playerWrapper.removeEventListener('mouseenter', handleMouseEnter);
        playerWrapper.removeEventListener('mouseleave', handleMouseLeave);
        playerWrapper.removeEventListener('mousemove', handleMouseMove);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
    };
}
