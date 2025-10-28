import { createTooltip } from './base-tooltip.js';
import { TIMING } from '../../constants/timing.js';

export function createVolumeTooltip(slider, video, options = {}) {
    let hoverValue = null;
    
    function getVolumeAtPosition(e) {
        const rect = slider.getBoundingClientRect();
        const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
        return percent;
    }
    
    const tooltip = createTooltip(slider, {
        text: '50%',
        position: 'top',
        delay: TIMING.TOOLTIP_DELAY_FAST,
        dynamic: true,
        isMobile: options.isMobile,
        getContent: () => {
            if (hoverValue !== null) {
                const volume = Math.round(hoverValue * 100);
                return `${volume}%`;
            } else {
                const volume = Math.round(video.volume * 100);
                return video.muted ? 'Muted' : `${volume}%`;
            }
        }
    });
    
    function handleMouseMove(e) {
        hoverValue = getVolumeAtPosition(e);
        
        // Force tooltip update during mousemove
        const volume = Math.round(hoverValue * 100);
        const newText = `${volume}%`;
        
        // Direct DOM update for real-time feedback
        const tooltipElement = document.querySelector('.tooltip.tooltip--visible');
        if (tooltipElement) {
            tooltipElement.textContent = newText;
        }
    }
    
    function handleMouseLeave() {
        hoverValue = null;
    }
    
    function handleMouseEnter() {
        // Reset hover value on enter
    }
    
    slider.addEventListener('mouseenter', handleMouseEnter);
    slider.addEventListener('mousemove', handleMouseMove);
    slider.addEventListener('mouseleave', handleMouseLeave);
    
    return function cleanup() {
        tooltip();
        slider.removeEventListener('mouseenter', handleMouseEnter);
        slider.removeEventListener('mousemove', handleMouseMove);
        slider.removeEventListener('mouseleave', handleMouseLeave);
    };
}
