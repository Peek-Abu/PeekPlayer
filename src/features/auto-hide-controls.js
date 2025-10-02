import { TIMING } from '../constants/timing.js';

export function setupAutoHideControls(video, controlsElement, playerWrapper) {
    let hideTimeout = null;
    let isMouseOverPlayer = false;
    let controlsVisible = true;
    
    function showControls() {
        if (!controlsVisible) {
            controlsElement.style.opacity = '1';
            controlsElement.style.pointerEvents = 'auto';
            controlsVisible = true;
        }
        
        // Clear any existing hide timeout
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        
        // Set new hide timeout if video is playing and mouse not over player
        if (!video.paused && !isMouseOverPlayer) {
            hideTimeout = setTimeout(hideControls, TIMING.CONTROLS_HIDE_DELAY);
        }
    }
    
    function hideControls() {
        if (controlsVisible && !video.paused && !isMouseOverPlayer) {
            controlsElement.style.opacity = '0';
            controlsElement.style.pointerEvents = 'none';
            controlsVisible = false;
        }
        
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
            hideTimeout = setTimeout(hideControls, TIMING.CONTROLS_HIDE_DELAY);
        }
    }
    
    function handleMouseMove() {
        showControls();
    }
    
    function handlePlay() {
        if (!isMouseOverPlayer) {
            hideTimeout = setTimeout(hideControls, TIMING.CONTROLS_HIDE_DELAY);
        }
    }
    
    function handlePause() {
        showControls();
    }
    
    // Set initial styles for smooth transitions
    controlsElement.style.transition = `opacity ${TIMING.TRANSITION_DURATION}ms ease, pointer-events ${TIMING.TRANSITION_DURATION}ms ease`;
    controlsElement.style.opacity = '1';
    controlsElement.style.pointerEvents = 'auto';
    
    // Event listeners
    playerWrapper.addEventListener('mouseenter', handleMouseEnter);
    playerWrapper.addEventListener('mouseleave', handleMouseLeave);
    playerWrapper.addEventListener('mousemove', handleMouseMove);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    
    // Return cleanup function
    return () => {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        playerWrapper.removeEventListener('mouseenter', handleMouseEnter);
        playerWrapper.removeEventListener('mouseleave', handleMouseLeave);
        playerWrapper.removeEventListener('mousemove', handleMouseMove);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
    };
}
