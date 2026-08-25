import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';

export function createPlayButton(video, onPlaybackChange, options = {}) {
   
    const btn = document.createElement('button');
    btn.className = 'play-toggle-button';
    btn.style.pointerEvents = 'auto';
    btn.innerHTML = video.paused ? ICONS.PLAY : ICONS.PAUSE;

    const handleClick = (e) => {
        e.stopPropagation();
        if (video.paused) {
            video.play();
        } else {
            video.pause();
        }
        btn.innerHTML = video.paused ? ICONS.PLAY : ICONS.PAUSE;
        if (onPlaybackChange) onPlaybackChange(!video.paused);
    };

    // Use addEventListener (instead of onplay/onpause assignment) so we never
    // clobber handlers the host page or other components registered.
    const handlePlay = () => { btn.innerHTML = ICONS.PAUSE; };
    const handlePause = () => { btn.innerHTML = ICONS.PLAY; };

    btn.addEventListener('click', handleClick);
    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);

    const cleanupTooltip = createTooltip(btn, {
        ...TOOLTIP_CONFIG.DYNAMIC_FAST,
        getContent: () => video.paused ? 'Play' : 'Pause',
        isMobile: options.isMobile
    });
    return {
        element: btn,
        cleanup: () => {
            btn.removeEventListener('click', handleClick);
            video.removeEventListener('play', handlePlay);
            video.removeEventListener('pause', handlePause);
            cleanupTooltip();
        }
    };
}
