import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
export function createFullscreenButton(videoWrapper, onFullscreen) {
  const btn = document.createElement('button');
  btn.className = 'fullscreen-button';
  btn.style.pointerEvents = 'auto';

  // Update button icon based on fullscreen state
  function updateFullscreenIcon() {
    btn.innerHTML = ICONS.FULLSCREEN;
  }
  const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'];
  const handleFullscreenChange = () => {
    updateFullscreenIcon();
  };
  
  btn.onclick = (e) => {
    e.stopPropagation();
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      const wrapper = document.getElementById('player-wrapper');
      wrapper.requestFullscreen().then(() => {
        videoWrapper.style.width = '100%';
        videoWrapper.style.height = '100%';
      }).catch((err) => {
        console.error('Fullscreen request failed:', err);
      });
    }
  };

  updateFullscreenIcon();
  fullscreenEvents.forEach((evt) => document.addEventListener(evt, handleFullscreenChange));
  const cleanupTooltip = createTooltip(btn, {
    ...TOOLTIP_CONFIG.DYNAMIC_FAST,
    getContent: () => document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen'
  });
  return { element: btn, cleanup: () => {
    cleanupTooltip();
    fullscreenEvents.forEach((evt) => document.removeEventListener(evt, handleFullscreenChange));
  }};
}
 