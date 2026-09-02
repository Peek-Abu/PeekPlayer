import { isLiveVideo, behindLiveBy, liveWindow } from '../utils/live.js';

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
    
    /**
     * How a live position reads: distance behind the edge, or LIVE when on it.
     *
     * Shared by the resting display and the scrub preview. They were written
     * separately and disagreed — one counted backwards from the edge while the
     * other showed a raw positive offset into the DVR window mid-drag.
     */
    function liveLabel(behindSeconds) {
        const behind = Math.max(0, behindSeconds);
        return behind < 1 ? 'LIVE' : `-${formatTime(behind)}`;
    }

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
            // Not `formatTime(currentTime)` when level with the edge: that is
            // absolute media time, so standing at live printed a large
            // positive number where the reading should say LIVE.
            currentTimeSpan.textContent = liveLabel(behindLiveBy(video));
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
    // The live edge advances whether or not the video is playing, so `buffered`
    // growing changes how far behind the viewer is.
    video.addEventListener('progress', updateTimeDisplay);

    /**
     * On a live stream the reading goes stale the moment playback stops.
     *
     * `timeupdate` only fires while playing, but a paused viewer keeps falling
     * further behind the edge every second — observed sitting at "-0:04" while
     * the real gap had grown past forty seconds. A one-second tick keeps it
     * honest, and does nothing on VOD, where a paused position genuinely does
     * not change.
     */
    const liveTick = setInterval(() => {
        if (isLiveVideo(video) && !scrubbing) updateTimeDisplay();
    }, 1000);
    
    // Initial update
    updateTimeDisplay();

    // Live preview while the scrubber is being dragged (before the seek is
    // committed to the video element).
    function setCurrentTime(seconds) {
        // The scrubber previews in window coordinates — seconds from the start
        // of what the bar draws. On VOD that is elapsed time and reads fine.
        // On live it is an offset into a rolling DVR window, so showing it
        // raw put a positive, meaningless number on screen mid-drag while the
        // resting display alongside it counted backwards from the edge.
        const { length, live } = liveWindow(video);
        if (live && length > 0) {
            currentTimeSpan.textContent = liveLabel(length - (Number.isFinite(seconds) ? seconds : 0));
            return;
        }
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
        clearInterval(liveTick);
        video.removeEventListener('progress', updateTimeDisplay);
        video.removeEventListener('timeupdate', updateTimeDisplay);
        video.removeEventListener('loadedmetadata', updateTimeDisplay);
        video.removeEventListener('durationchange', updateTimeDisplay);
        video.removeEventListener('seeked', handleSeeked);
        timeContainer.remove();
    }};
}
