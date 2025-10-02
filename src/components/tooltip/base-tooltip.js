import { TIMING } from '../../constants/timing.js';

export function createTooltip(element, options = {}) {
    const {
        text = '',
        position = 'top',
        delay = TIMING.TOOLTIP_DELAY_DEFAULT,
        dynamic = false,
        getContent = null
    } = options;
    
    let tooltip = null;
    let showTimeout = null;
    let hideTimeout = null;
    
    function createTooltipElement() {
        tooltip = document.createElement('div');
        tooltip.className = `tooltip tooltip--${position}`;
        tooltip.textContent = dynamic && getContent ? getContent() : text;
        document.body.appendChild(tooltip);
        return tooltip;
    }
    
    function positionTooltip() {
        if (!tooltip) return;
        
        const rect = element.getBoundingClientRect();
        const tooltipRect = tooltip.getBoundingClientRect();
        
        let left, top;
        
        switch (position) {
            case 'top':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.top - tooltipRect.height - 8;
                break;
            case 'bottom':
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                top = rect.bottom + 8;
                break;
            case 'left':
                left = rect.left - tooltipRect.width - 8;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                break;
            case 'right':
                left = rect.right + 8;
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                break;
        }
        
        // Keep tooltip on screen
        left = Math.max(8, Math.min(left, window.innerWidth - tooltipRect.width - 8));
        top = Math.max(8, Math.min(top, window.innerHeight - tooltipRect.height - 8));
        
        tooltip.style.left = `${left}px`;
        tooltip.style.top = `${top}px`;
    }
    
    function showTooltip() {
        clearTimeout(hideTimeout);
        
        showTimeout = setTimeout(() => {
            if (!tooltip) {
                createTooltipElement();
            }
            
            // Update content if dynamic
            if (dynamic && getContent) {
                tooltip.textContent = getContent();
            }
            
            positionTooltip();
            tooltip.classList.add('tooltip--visible');
        }, delay);
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
    
    function updateTooltipContent() {
        if (tooltip && tooltip.classList.contains('tooltip--visible') && dynamic && getContent) {
            tooltip.textContent = getContent();
        }
    }
    
    // Event listeners
    element.addEventListener('mouseenter', showTooltip);
    element.addEventListener('mouseleave', hideTooltip);
    element.addEventListener('focus', showTooltip);
    element.addEventListener('blur', hideTooltip);
    
    // Return cleanup function
    return function cleanup() {
        clearTimeout(showTimeout);
        clearTimeout(hideTimeout);
        element.removeEventListener('mouseenter', showTooltip);
        element.removeEventListener('mouseleave', hideTooltip);
        element.removeEventListener('focus', showTooltip);
        element.removeEventListener('blur', hideTooltip);
        
        if (dynamic) {
            element.removeEventListener('click', updateTooltipContent);
            element.removeEventListener('change', updateTooltipContent);
        }

        if (tooltip) {
            document.body.removeChild(tooltip);
            tooltip = null;
        }
    };
}
