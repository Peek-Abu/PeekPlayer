// Handles the auto-hide behavior for video player controls during playback.
import { TIMING } from '../constants/timing.js';

export function setupAutoHideControls(video, controlsElements, playerWrapper, options = {}) {
    const hideDelay = options.isMobile
        ? TIMING.CONTROLS_AUTO_HIDE_DELAY_MOBILE
        : TIMING.CONTROLS_AUTO_HIDE_DELAY;
    let hideTimeout = null;
    let controlsVisible = true;
    
    // Create vignette overlay for better contrast when controls are visible
    const vignette = document.createElement('div');
    vignette.className = 'controls-vignette';
    playerWrapper.appendChild(vignette);
    
    function scheduleHide() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(hideControls, hideDelay);
    }

    function showControls() {
        if (!controlsVisible) {
            for (let i = 0; i < controlsElements.length; i++) {
                controlsElements[i].style.opacity = '1';
                controlsElements[i].style.pointerEvents = 'auto';
            }
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
            for (let i = 0; i < controlsElements.length; i++) {
                controlsElements[i].style.opacity = '0';
                controlsElements[i].style.pointerEvents = 'none';
            }
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
        showControls();
    }

    
    function handleMouseLeave() {
        if (!video.paused) {
            scheduleHide();
        }
    }

    function handleMouseMove() {
        showControls();
    }

    // Pure-touch devices never fire mousemove: tapping the video must summon
    // the controls (the tap's click still toggles play via video-interactions).
    function handleTouchStart() {
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
            for (let i = 0; i < controlsElements.length; i++) {
                controlsElements[i].style.opacity = '1';
                controlsElements[i].style.pointerEvents = 'auto';
            }
            controlsVisible = true;
        }
    }
    
    // Set initial styles for smooth transitions
    for (let i = 0; i < controlsElements.length; i++) {
        controlsElements[i].style.transition = `opacity ${TIMING.TRANSITION_DURATION}ms ease, pointer-events ${TIMING.TRANSITION_DURATION}ms ease`;
        controlsElements[i].style.opacity = '1';
        controlsElements[i].style.pointerEvents = 'auto';
    }
    playerWrapper.style.cursor = 'default';
    video.style.cursor = 'default';
    
    // Event listeners
    playerWrapper.addEventListener('mouseenter', handleMouseEnter);
    playerWrapper.addEventListener('mouseleave', handleMouseLeave);
    playerWrapper.addEventListener('mousemove', handleMouseMove);
    playerWrapper.addEventListener('touchstart', handleTouchStart, { passive: true });
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
        // Restore controls in case we were destroyed mid-hide, otherwise a
        // re-initialized player inherits invisible controls.
        for (let i = 0; i < controlsElements.length; i++) {
            controlsElements[i].style.opacity = '';
            controlsElements[i].style.pointerEvents = '';
            controlsElements[i].style.transition = '';
        }
        playerWrapper.style.cursor = 'default';
        video.style.cursor = 'default';
        playerWrapper.removeEventListener('mouseenter', handleMouseEnter);
        playerWrapper.removeEventListener('mouseleave', handleMouseLeave);
        playerWrapper.removeEventListener('mousemove', handleMouseMove);
        playerWrapper.removeEventListener('touchstart', handleTouchStart);
        video.removeEventListener('play', handlePlay);
        video.removeEventListener('pause', handlePause);
    };
}
