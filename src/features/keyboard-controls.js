import { TIMING } from '../constants/timing.js';
import { clampSeek } from '../utils/live.js';
import { toggleFullscreen as toggleFullscreenWithFallback } from '../utils/fullscreen.js';

export function setupKeyboardControls(video, hooks = {}, playerWrapper, extraOptions = {}) {
    const VOLUME_STEP = 0.1;
    const { cycleSubtitle } = extraOptions;
    
    function handleKeyDown(e) {
        // Never hijack keys another component already handled (e.g. the scrubber)
        if (e.defaultPrevented) return;

        // Ignore held-down repeats (holding Space would rapidly toggle play/pause)
        if (e.repeat) return;

        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
            activeElement.tagName === 'INPUT' || 
            activeElement.tagName === 'TEXTAREA' ||
            activeElement.tagName === 'SELECT' ||
            activeElement.isContentEditable === true
        );
        
        if (isInputFocused) return;

        // Only respond when the player is actually the user's focus target:
        // either something inside the wrapper has focus, or the pointer is
        // over the player. This stops the handler from hijacking page-wide
        // scrolling/keys while the player is off-screen or unrelated.
        const wrapper = playerWrapper || video.closest('.peekplayer-wrapper');
        if (!wrapper) return;
        const wrapperHasFocus = activeElement && wrapper.contains(activeElement);
        const wrapperIsHovered = typeof wrapper.matches === 'function' && wrapper.matches(':hover');
        if (!wrapperHasFocus && !wrapperIsHovered) return;
        
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

            case 'KeyC':
                if (typeof cycleSubtitle === 'function') {
                    e.preventDefault();
                    cycleSubtitle();
                }
                break;

            case 'Comma':
                e.preventDefault();
                stepFrames(-1);
                break;

            case 'Period':
                e.preventDefault();
                stepFrames(1);
                break;
        }
    }

    // Frame-by-frame stepping (, and .). Stepping implies paused inspection,
    // so a playing video is paused first. The step size is one frame at the
    // configured frame rate (default 30fps).
    function stepFrames(count) {
        if (!video.paused) {
            video.pause();
            if (hooks.onPlaybackChange) hooks.onPlaybackChange(false);
        }
        const frameSeconds = 1 / (extraOptions.frameRate || TIMING.DEFAULT_FRAME_RATE);
        const newTime = clampSeek(video, video.currentTime + count * frameSeconds);
        if (newTime === video.currentTime) {
            return;
        }
        const delta = newTime - video.currentTime;
        video.currentTime = newTime;
        const percent = Number.isFinite(video.duration) && video.duration > 0 ? newTime / video.duration : 0;
        if (hooks.onSeek) hooks.onSeek(newTime, delta, percent);
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
        const newTime = clampSeek(video, video.currentTime - TIMING.SKIP_SECONDS);
        const delta = newTime - video.currentTime;
        video.currentTime = newTime;
        const percent = Number.isFinite(video.duration) && video.duration > 0 ? newTime / video.duration : 0;
        if (hooks.onSeek) hooks.onSeek(newTime, delta, percent);
    }
    
    function skipForward() {
        const newTime = clampSeek(video, video.currentTime + TIMING.SKIP_SECONDS);
        const delta = newTime - video.currentTime;
        video.currentTime = newTime;
        const percent = Number.isFinite(video.duration) && video.duration > 0 ? newTime / video.duration : 0;
        if (hooks.onSeek) hooks.onSeek(newTime, delta, percent);
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
        toggleFullscreenWithFallback(wrapper, video);
    }
    
    // Add event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Return cleanup function
    return () => {
        document.removeEventListener('keydown', handleKeyDown);
    };
}
