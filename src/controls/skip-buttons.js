import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';

export function createSkipButtons(video, onSkip) {
    // Previous episode button
    const prevBtn = document.createElement('button');
    prevBtn.className = 'skip-button skip-prev';
    prevBtn.setAttribute('aria-label', 'Previous episode');
    prevBtn.style.pointerEvents = 'auto';
    const prevTooltip = createTooltip(prevBtn, {
        ...TOOLTIP_CONFIG.STATIC_FAST,
        text: 'Previous'
    });

    prevBtn.innerHTML = ICONS.SKIP_PREVIOUS;
    
    // Next episode button
    const nextBtn = document.createElement('button');
    nextBtn.className = 'skip-button skip-next';
    nextBtn.setAttribute('aria-label', 'Next episode');
    nextBtn.style.pointerEvents = 'auto';
    const nextTooltip = createTooltip(nextBtn, {
        ...TOOLTIP_CONFIG.STATIC_FAST,
        text: 'Next'
    });
    
    nextBtn.innerHTML = ICONS.SKIP_NEXT;
    
    // Event handlers
    prevBtn.onclick = (e) => {
        e.stopPropagation();
        if (onSkip) onSkip('previous');
    };
    
    nextBtn.onclick = (e) => {
        e.stopPropagation();
        if (onSkip) onSkip('next');
    };
    
    return {
        prevBtn: prevBtn,
        nextBtn: nextBtn,
        cleanup: () => {
            prevTooltip();
            nextTooltip();
        }
    };
}
