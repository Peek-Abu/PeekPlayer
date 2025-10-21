import { TIMING } from '../../constants/timing.js';

export function createScrubberTooltip(scrubber, video, options = {}) {
    let hoverTime = null;
    let hoverX = 0;
    let tooltip = null;
    let showTimeout = null;
    let hideTimeout = null;
    const getSegments = options.getSegments;
    
    function formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    function getTimeAtPosition(e) {
        const rect = scrubber.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        const time = percent * video.duration;
        return Math.max(0, Math.min(time, video.duration));
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
            timeElement.textContent = formatTime(time);
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
