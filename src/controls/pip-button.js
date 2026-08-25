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
        logger?.warn?.('PiP is not supported');
        button.style.display = 'none';
        // Keep the standard return shape so callers can destructure safely.
        return { element: button, cleanup: () => {} };
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
            logger?.warn?.('PiP operation failed:', error);
        }
    }

    const handleButtonClick = (e) => {
        e.stopPropagation();
        togglePip();
    };

    const handleEnterPip = () => {
        updatePipButton();
        if (onPipChange) onPipChange(true);
    };

    const handleLeavePip = () => {
        updatePipButton();
        if (onPipChange) onPipChange(false);
    };

    const handleLoadedMetadata = () => {
        button.style.display = 'flex';
    };
    
    // Event listeners (named handlers so cleanup can actually remove them)
    button.addEventListener('click', handleButtonClick);
    video.addEventListener('enterpictureinpicture', handleEnterPip);
    video.addEventListener('leavepictureinpicture', handleLeavePip);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
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
        button.removeEventListener('click', handleButtonClick);
        video.removeEventListener('enterpictureinpicture', handleEnterPip);
        video.removeEventListener('leavepictureinpicture', handleLeavePip);
        video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }};
}
