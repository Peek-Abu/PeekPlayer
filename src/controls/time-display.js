import { isLiveVideo, behindLiveBy } from '../utils/live.js';

export function createTimeDisplay(video) {
    // While a scrub drag is active, timeupdate/seeked events carry the stale
    // playback position and must not overwrite the previewed position.
    let scrubbing = false;
    const timeContainer = document.createElement('div');
    timeContainer.className = 'time-display';
    timeContainer.style.pointerEvents = 'auto';
    
    const currentTimeSpan = document.createElement('span');
    currentTimeSpan.className = 'current-time';
    currentTimeSpan.textContent = '0:00';
    
    const separator = document.createElement('span');
    separator.className = 'time-separator';
    separator.textContent = ' / ';
    
    const totalTimeSpan = document.createElement('span');
    totalTimeSpan.className = 'total-time';
    totalTimeSpan.textContent = '0:00';
    
    timeContainer.appendChild(currentTimeSpan);
    timeContainer.appendChild(separator);
    timeContainer.appendChild(totalTimeSpan);
    
    // Format time in MM:SS or HH:MM:SS format
    function formatTime(seconds) {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        } else {
            return `${minutes}:${secs.toString().padStart(2, '0')}`;
        }
    }
    
    // Update time display
    function updateTimeDisplay() {
        if (scrubbing) {
            return;
        }
        const currentTime = video.currentTime || 0;

        // A live stream has no total: duration is Infinity, which formatted as
        // "0:00" and made every live stream look like an empty file. Show how
        // far behind the edge the viewer is instead, which is the number that
        // actually means something, and nothing at all when they are on it.
        if (isLiveVideo(video)) {
            const behind = Math.round(behindLiveBy(video));
            currentTimeSpan.textContent = behind > 0 ? `-${formatTime(behind)}` : formatTime(currentTime);
            separator.hidden = true;
            totalTimeSpan.hidden = true;
            return;
        }

        separator.hidden = false;
        totalTimeSpan.hidden = false;
        const duration = video.duration || 0;
        currentTimeSpan.textContent = formatTime(currentTime);
        totalTimeSpan.textContent = formatTime(duration);
    }
    
    // Set up event listeners for time updates
    video.addEventListener('timeupdate', updateTimeDisplay);
    video.addEventListener('loadedmetadata', updateTimeDisplay);
    video.addEventListener('durationchange', updateTimeDisplay);
    video.addEventListener('seeked', handleSeeked);
    
    // Initial update
    updateTimeDisplay();

    // Live preview while the scrubber is being dragged (before the seek is
    // committed to the video element).
    function setCurrentTime(seconds) {
        currentTimeSpan.textContent = formatTime(Number.isFinite(seconds) ? seconds : 0);
    }
    timeContainer.setCurrentTime = setCurrentTime;

    // Toggled by the scrubber so stale timeupdate/seeked events during a
    // drag don't overwrite the previewed time.
    function setScrubbing(active) {
        scrubbing = !!active;
        if (!scrubbing) {
            updateTimeDisplay();
        }
    }
    timeContainer.setScrubbing = setScrubbing;

    function handleSeeked() {
        updateTimeDisplay();
    }

    return { element: timeContainer, cleanup: () => {
        video.removeEventListener('timeupdate', updateTimeDisplay);
        video.removeEventListener('loadedmetadata', updateTimeDisplay);
        video.removeEventListener('durationchange', updateTimeDisplay);
        video.removeEventListener('seeked', handleSeeked);
        timeContainer.remove();
    }};
}
