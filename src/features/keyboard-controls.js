import { TIMING } from '../constants/timing.js';

export function setupKeyboardControls(video, hooks = {}, playerWrapper) {
    const VOLUME_STEP = 0.1;
    
    function handleKeyDown(e) {
        // Only handle if video player area has focus or no input is focused
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.contentEditable === 'true'
        );
        
        if (isInputFocused) return;
        
        switch (e.code) {
            case 'Space':
                e.preventDefault();
                togglePlayPause();
                break;
                
            case 'ArrowLeft':
                e.preventDefault();
                skipBackward();
                break;
                
            case 'ArrowRight':
                e.preventDefault();
                skipForward();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                volumeUp();
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                volumeDown();
                break;
                
            case 'KeyF':
                e.preventDefault();
                toggleFullscreen();
                break;
                
            case 'KeyM':
                e.preventDefault();
                toggleMute();
                break;
        }
    }
    
    function togglePlayPause() {
        if (video.paused) {
            video.play();
            if (hooks.onPlaybackChange) hooks.onPlaybackChange(true);
        } else {
            video.pause();
            if (hooks.onPlaybackChange) hooks.onPlaybackChange(false);
        }
    }
    
    function skipBackward() {
        const newTime = Math.max(0, video.currentTime - TIMING.SKIP_SECONDS);
        const delta = newTime - video.currentTime;
        video.currentTime = newTime;
        if (hooks.onSeek) hooks.onSeek(newTime, delta, newTime / video.duration);
    }
    
    function skipForward() {
        const newTime = Math.min(video.duration || 0, video.currentTime + TIMING.SKIP_SECONDS);
        const delta = newTime - video.currentTime;
        video.currentTime = newTime;
        if (hooks.onSeek) hooks.onSeek(newTime, delta, newTime / video.duration);
    }
    
    function volumeUp() {
        const newVolume = Math.min(1, video.volume + VOLUME_STEP);
        video.volume = newVolume;
        video.muted = false;
        if (hooks.onVolumeChange) hooks.onVolumeChange(newVolume);
    }
    
    function volumeDown() {
        const newVolume = Math.max(0, video.volume - VOLUME_STEP);
        video.volume = newVolume;
        if (hooks.onVolumeChange) hooks.onVolumeChange(newVolume);
    }
    
    function toggleMute() {
        video.muted = !video.muted;
        if (hooks.onVolumeChange) hooks.onVolumeChange(video.muted ? 0 : video.volume);
    }
    
    function toggleFullscreen() {
        const wrapper = playerWrapper || video.closest('.peekplayer-wrapper') || video.parentElement;
        if (!wrapper) return;
        if (!document.fullscreenElement) {
            if (wrapper.requestFullscreen) {
                wrapper.requestFullscreen();
            }
        } else if (document.exitFullscreen) {
            document.exitFullscreen();
        }
    }
    
    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Return cleanup function
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
}
