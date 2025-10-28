import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';

export function createFullscreenButton(playerWrapper, onFullscreen, video, logger, options = {}) {
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
    const wrapper = playerWrapper || btn.closest('.peekplayer-wrapper');
    if (!wrapper) {
      logger?.warn?.('Fullscreen button: no wrapper available');
      return;
    }
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      } else if (video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }
    } else {
      if (wrapper.requestFullscreen) {
        wrapper.requestFullscreen().catch((err) => {
          logger?.error?.('Fullscreen request failed:', err);
        });
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen().catch((err) => {
          logger?.error?.('Fullscreen request failed:', err);
        });
      } else if (wrapper.msRequestFullscreen) {
        wrapper.msRequestFullscreen().catch((err) => {
          logger?.error?.('Fullscreen request failed:', err);
        });
      }
    }
  };

  updateFullscreenIcon();
  fullscreenEvents.forEach((evt) => document.addEventListener(evt, handleFullscreenChange));
  const cleanupTooltip = createTooltip(btn, {
    ...TOOLTIP_CONFIG.DYNAMIC_FAST,
    getContent: () => document.fullscreenElement ? 'Exit Fullscreen' : 'Fullscreen',
    isMobile: options.isMobile
  });
  return { element: btn, cleanup: () => {
    cleanupTooltip();
    fullscreenEvents.forEach((evt) => document.removeEventListener(evt, handleFullscreenChange));
  }};
}
 