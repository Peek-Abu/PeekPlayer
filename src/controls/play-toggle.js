import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';

export function createPlayButton(video, onPlaybackChange) {
   
    const btn = document.createElement('button');
    btn.className = 'play-toggle-button';
    btn.style.pointerEvents = 'auto';
    btn.innerHTML = video.paused ? ICONS.PLAY : ICONS.PAUSE;
    btn.onclick = (e) => {
        e.stopPropagation();
        if (video.paused) {
        video.play();
        } else {
        video.pause();
        }
        btn.innerHTML = video.paused ? ICONS.PLAY : ICONS.PAUSE;
        if (onPlaybackChange) onPlaybackChange(!video.paused);
    };

    video.onplay = () => { btn.innerHTML = ICONS.PAUSE; };
    video.onpause = () => { btn.innerHTML = ICONS.PLAY; };
    const cleanupTooltip = createTooltip(btn, {
        ...TOOLTIP_CONFIG.DYNAMIC_FAST,
        getContent: () => video.paused ? 'Play' : 'Pause'
    });
    return { element: btn, cleanup: cleanupTooltip };
}