import { createScrubberTooltip } from '../components/tooltip/tooltip.js';
import { TIMING } from '../constants/timing.js';
import { assertVideoElement, assertExists, assertFunction, assertRange } from '../utils/assert.js';

export function createScrubberBar(video, onSeek) {
    // Assert required parameters
    assertVideoElement(video, { component: 'ScrubberBar', method: 'createScrubberBar' });
    if (onSeek) {
        assertFunction(onSeek, 'onSeek', { component: 'ScrubberBar', method: 'createScrubberBar' });
    }
    assertExists(TIMING.SCRUBBER_PRECISION, 'TIMING.SCRUBBER_PRECISION', {
        component: 'ScrubberBar',
        method: 'createScrubberBar',
        note: 'SCRUBBER_PRECISION constant not found'
    });
    
    const bar = document.createElement('div');
    bar.className = 'scrubber-row';
    
    const scrubber = document.createElement('input');
    scrubber.className = 'scrubber';
    scrubber.type = 'range';
    scrubber.min = 0;
    scrubber.max = TIMING.SCRUBBER_PRECISION;
    scrubber.value = 0;
    
    // Add hover effects and styling
    scrubber.style.cursor = 'pointer';
    scrubber.style.transition = 'all 0.2s ease';
    bar.appendChild(scrubber);
    
    // Track hover state for thumb visibility
    let isHovering = false;
    let isUserSeeking = false;
    
    scrubber.addEventListener('mouseenter', () => {
        isHovering = true;
        scrubber.classList.add('scrubber--hover');
    });
    
    scrubber.addEventListener('mouseleave', () => {
        isHovering = false;
        scrubber.classList.remove('scrubber--hover');
    });
    
    // Handle seeking
    scrubber.addEventListener('mousedown', () => {
        isUserSeeking = true;
    });
    
    scrubber.addEventListener('mouseup', () => {
        isUserSeeking = false;
    });
    
    scrubber.addEventListener('input', () => {
        const pct = scrubber.value / TIMING.SCRUBBER_PRECISION;
        const seekTime = pct * video.duration;
        // video.currentTime = pct * video.duration;
        // Check buffered ranges
        video.currentTime = seekTime;
        if (onSeek) onSeek(video.currentTime, pct);
    });
    
    // Update scrubber position and buffered progress
    const updateScrubber = () => {
        if (!video.duration) return;
        
        // Don't update scrubber value while user is actively seeking, but always update progress bars
        if (!isUserSeeking) {
            const currentPercent = (video.currentTime / video.duration) * TIMING.SCRUBBER_PRECISION;
            scrubber.value = Math.round(currentPercent);
        }
        
        // Always update progress bars (even when seeking or paused)
        const progressPercent = (video.currentTime / video.duration) * 100;
        scrubber.style.setProperty('--progress-width', `${progressPercent}%`);

        // Update buffered progress (using CSS custom property)
        updateBufferedProgress();
    };
    
    const updateBufferedProgress = () => {
        if (!video.duration || !video.buffered.length) return;
        
        // Find the buffered range that contains the current time
        let bufferedEnd = 0;
        for (let i = 0; i < video.buffered.length; i++) {
            const start = video.buffered.start(i);
            const end = video.buffered.end(i);
            
            // Use the furthest buffered point
            if (end > bufferedEnd) {
                bufferedEnd = end;
            }
        }
        const bufferedPercent = Math.min((bufferedEnd / video.duration) * 100, 100);
        scrubber.style.setProperty('--buffered-width', `${bufferedPercent}%`);
    };
    
    const cleanupTooltip = createScrubberTooltip(scrubber, video);
    
    // Use requestAnimationFrame for smooth updates
    let animationFrame;
    const smoothUpdate = () => {
        updateScrubber();
        animationFrame = requestAnimationFrame(smoothUpdate);
    };
    
    // Start smooth updates when video plays
    video.addEventListener('play', () => {
        if (animationFrame) cancelAnimationFrame(animationFrame);
        smoothUpdate();
    });
    
    // Stop smooth updates when video pauses
    video.addEventListener('pause', () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }
        updateScrubber(); // Final update
    });
    
    // Update on important events
    video.addEventListener('progress', updateBufferedProgress);
    video.addEventListener('loadedmetadata', () => {
        updateScrubber();
        updateBufferedProgress();
    });
    video.addEventListener('seeked', updateScrubber);

    const cleanup = () => {
        if (animationFrame) {
            cancelAnimationFrame(animationFrame);
        }
        cleanupTooltip();
        video.removeEventListener('play', smoothUpdate);
        video.removeEventListener('pause', smoothUpdate);
        video.removeEventListener('progress', updateBufferedProgress);
        video.removeEventListener('loadedmetadata', () => {
            updateScrubber();
            updateBufferedProgress();
        });
        video.removeEventListener('seeked', updateScrubber);
    };
    return { element: bar, cleanup };
}