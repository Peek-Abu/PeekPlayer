export function createTimeDisplay(video, onTimeUpdate) {
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
        const currentTime = video.currentTime || 0;
        const duration = video.duration || 0;
        
        currentTimeSpan.textContent = formatTime(currentTime);
        totalTimeSpan.textContent = formatTime(duration);
        
        // Call optional callback for external updates
        if (onTimeUpdate) {
            onTimeUpdate(currentTime, duration);
        }
    }
    
    // Set up event listeners for time updates
    video.addEventListener('timeupdate', updateTimeDisplay);
    video.addEventListener('loadedmetadata', updateTimeDisplay);
    video.addEventListener('durationchange', updateTimeDisplay);
    
    // Initial update
    updateTimeDisplay();

    return { element: timeContainer, cleanup: () => {
        cleanupTooltip();
        video.removeEventListener('timeupdate', updateTimeDisplay);
        video.removeEventListener('loadedmetadata', updateTimeDisplay);
        video.removeEventListener('durationchange', updateTimeDisplay);
    }};
}
