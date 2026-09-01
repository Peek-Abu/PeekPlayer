import { TIMING } from '../../constants/timing.js';
import { liveWindow } from '../../utils/live.js';

export function createScrubberTooltip(scrubber, video, options = {}) {
    let hoverTime = null;
    let hoverX = 0;
    let tooltip = null;
    let showTimeout = null;
    let hideTimeout = null;
    const getSegments = options.getSegments;
    
    function formatTime(seconds) {
        if (!Number.isFinite(seconds)) {
            return '0:00';
        }
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Absolute media time under the cursor.
     *
     * Resolved through the same window the bar is drawing. On a live stream
     * `video.duration` is Infinity, so the old `percent * video.duration` gave
     * Infinity for every position and the tooltip read as nonsense; it also
     * treated the bar as spanning 0..duration, which is wrong for a DVR window
     * that neither starts at zero nor stays put.
     */
    function getTimeAtPosition(e) {
        const rect = scrubber.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const { offset, length } = liveWindow(video);
        if (!(length > 0)) return null;
        return offset + percent * length;
    }

    /**
     * What to print for a position.
     *
     * Live has no meaningful elapsed time — a viewer does not care that they
     * are 412 seconds into a rolling window — so it shows distance from the
     * live edge instead, which is the thing that means something.
     */
    function labelForTime(time) {
        if (time === null) return '';
        const { offset, length, live } = liveWindow(video);
        if (!live) return formatTime(time);
        const behind = Math.max(0, (offset + length) - time);
        return behind < 1 ? 'LIVE' : `-${formatTime(behind)}`;
    }
    
    function createTooltipElement() {
        tooltip = document.createElement('div');
        tooltip.className = 'tooltip tooltip--scrubber tooltip--top';
        tooltip.innerHTML = `
            <div class="tooltip__thumbnail"></div>
            <div class="tooltip__segment-label"></div>
            <div class="tooltip__time">0:00</div>
        `;
        document.body.appendChild(tooltip);
        return tooltip;
    }
    
    function findSegmentForTime(time) {
        if (typeof getSegments !== 'function') return null;
        const segments = getSegments();
        if (!Array.isArray(segments) || !segments.length) return null;
        return segments.find((segment) => time >= segment.start && time < segment.end) || null;
    }

    function updateTooltipContent(time, thumbnailData = null) {
        if (!tooltip) return;
        
        const segmentLabelElement = tooltip.querySelector('.tooltip__segment-label');
        const timeElement = tooltip.querySelector('.tooltip__time');
        const thumbnailElement = tooltip.querySelector('.tooltip__thumbnail');

        if (segmentLabelElement) {
            const segment = findSegmentForTime(time);
            if (segment?.label) {
                segmentLabelElement.textContent = segment.label;
                segmentLabelElement.style.display = 'block';
            } else {
                segmentLabelElement.textContent = '';
                segmentLabelElement.style.display = 'none';
            }
        }

        if (timeElement) {
            timeElement.textContent = labelForTime(time);
        }
        
        if (thumbnailElement && thumbnailData) {
            thumbnailElement.style.backgroundImage = `url(${thumbnailData})`;
            thumbnailElement.style.display = 'block';
        }
    }
    
    function positionTooltip(mouseX) {
        if (!tooltip) return;
        
        const rect = scrubber.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left = mouseX - (tooltipRect.width / 2);
        const top = rect.top - tooltipRect.height - 12;
        
        // Keep tooltip on screen
        left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }
    
    function showTooltip(e) {
        clearTimeout(hideTimeout);
        
        hoverTime = getTimeAtPosition(e);
        hoverX = e.clientX;
        
        showTimeout = setTimeout(() => {
            if (!tooltip) {
                createTooltipElement();
            }
            
            updateTooltipContent(hoverTime);
            positionTooltip(hoverX);
            tooltip.classList.add('tooltip--visible');
        }, TIMING.TOOLTIP_DELAY_FAST);
    }
    
    function hideTooltip() {
        clearTimeout(showTimeout);
        
        if (tooltip) {
            tooltip.classList.remove('tooltip--visible');
            hideTimeout = setTimeout(() => {
                if (tooltip) {
                    document.body.removeChild(tooltip);
                    tooltip = null;
                }
            }, TIMING.TOOLTIP_HIDE_DELAY);
        }
    }
    
    function handleMouseMove(e) {
        hoverTime = getTimeAtPosition(e);
        hoverX = e.clientX;
        
        // Update tooltip content and position in real-time
        if (tooltip && tooltip.classList.contains('tooltip--visible')) {
            updateTooltipContent(hoverTime);
            positionTooltip(hoverX);
        }
    }
    
    function handleMouseLeave() {
        hoverTime = null;
        hideTooltip();
    }
    
    scrubber.addEventListener('mouseenter', showTooltip);
    scrubber.addEventListener('mousemove', handleMouseMove);
    scrubber.addEventListener('mouseleave', handleMouseLeave);
    
    return function cleanup() {
        clearTimeout(showTimeout);
        clearTimeout(hideTimeout);
        scrubber.removeEventListener('mouseenter', showTooltip);
        scrubber.removeEventListener('mousemove', handleMouseMove);
        scrubber.removeEventListener('mouseleave', handleMouseLeave);
        
        if (tooltip) {
            document.body.removeChild(tooltip);
            tooltip = null;
        }
    };
}
