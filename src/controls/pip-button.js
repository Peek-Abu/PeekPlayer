import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';

export function createPipButton(video, onPipChange, logger, options = {}) {
    const button = document.createElement('button');
    button.className = 'pip-button';
    button.style.pointerEvents = 'auto';

    
    // Check if PiP is supported
    const isPipSupported = 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;
    if (!isPipSupported) {
        logger.warn('PiP is not supported');
        button.style.display = 'none';
        return button;
    }
    
    // Update button icon and label based on PiP state
    function updatePipButton() {
        const isInPip = document.pictureInPictureElement === video;
        button.innerHTML = ICONS.PIP_ENTER;

        if (isInPip) {
            button.setAttribute('aria-label', 'Exit Picture in Picture');
            button.title = 'Exit Picture in Picture';
        } else {
            button.setAttribute('aria-label', 'Picture in Picture');
            button.title = 'Picture in Picture';
        }
    }
    
    // Handle PiP toggle
    async function togglePip() {
        try {
            if (document.pictureInPictureElement === video) {
                // Exit PiP
                await document.exitPictureInPicture();
            } else {
                // Enter PiP
                await video.requestPictureInPicture();
            }
        } catch (error) {
            logger.warn('PiP operation failed:', error);
            // Could show a toast notification here
        }
    }
    
    // Event listeners
    button.addEventListener('click', (e) => {
        e.stopPropagation();
        togglePip();
    });
    
    // Listen for PiP state changes
    video.addEventListener('enterpictureinpicture', () => {
        updatePipButton();
        if (onPipChange) onPipChange(true);
    });
    
    video.addEventListener('leavepictureinpicture', () => {
        updatePipButton();
        if (onPipChange) onPipChange(false);
    });
    
    // Handle when PiP is not available (e.g., video not loaded)
    video.addEventListener('loadedmetadata', () => {
        button.style.display = 'flex'; // Changed from conditional to always show
    });
    
    // Initial state
    updatePipButton();
    // Add tooltip
    const cleanupTooltip = createTooltip(button, {
        ...TOOLTIP_CONFIG.DYNAMIC_FAST,
        getContent: () => {
            const isInPip = document.pictureInPictureElement === video;
            return isInPip ? 'Exit Picture in Picture' : 'Picture in Picture';
        },
        isMobile: options.isMobile
    });
    return { element: button, cleanup: () => {
        cleanupTooltip();
        button.removeEventListener('click', togglePip);
        video.removeEventListener('enterpictureinpicture', updatePipButton);
        video.removeEventListener('leavepictureinpicture', updatePipButton);
        video.removeEventListener('loadedmetadata', () => { button.style.display = 'flex'; });
    }};
}
