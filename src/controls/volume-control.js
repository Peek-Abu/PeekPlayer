import { createTooltip, createVolumeTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
import { TIMING } from '../constants/timing.js';
import { assertVideoElement, assertExists, assertFunction, assertRange } from '../utils/assert.js';

export function createVolumeControl(video, onVolumeChange) {
    // Assert required parameters
    assertVideoElement(video, { component: 'VolumeControl', method: 'createVolumeControl' });
    if (onVolumeChange) {
        assertFunction(onVolumeChange, 'onVolumeChange', { component: 'VolumeControl', method: 'createVolumeControl' });
    }
    assertRange(video.volume, 0, 1, 'video.volume', {
        component: 'VolumeControl',
        method: 'createVolumeControl',
        note: 'Video volume should be between 0 and 1'
    });
    
    const container = document.createElement('div');
    container.className = 'volume-control';
    
    // Mute button
    const muteBtn = document.createElement('button');
    muteBtn.className = 'mute-button';
    muteBtn.setAttribute('aria-label', 'Mute');
    muteBtn.style.pointerEvents = 'auto';
    const muteTooltip = createTooltip(muteBtn, {
        ...TOOLTIP_CONFIG.DYNAMIC_FAST,
        getContent: () => video.muted ? 'Unmute' : 'Mute'
    });

    // Volume slider (hidden by default)
    const volumeSlider = document.createElement('div');
    volumeSlider.className = 'volume-popup';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'volume-slider';
    slider.min = '0';
    slider.max = '100';
    slider.step = '1';
    slider.value = Math.round(video.volume * 100);
    slider.setAttribute('aria-label', 'Volume');
    slider.style.pointerEvents = 'auto';
    const volumeTooltip = createVolumeTooltip(slider, video);

    volumeSlider.appendChild(slider);

    // Function to update volume progress fill
    function updateVolumeProgress() {
        const percentage = slider.value;
        slider.style.background = `linear-gradient(to right, #fff 0%, #fff ${percentage}%, rgba(255, 255, 255, 0.3) ${percentage}%, rgba(255, 255, 255, 0.3) 100%)`;
    }

    // Update mute button icon based on volume
    function updateMuteIcon() {
        const volume = video.volume;
        const isMuted = video.muted || volume === 0;
        
        if (isMuted) {
            muteBtn.innerHTML = ICONS.VOLUME_MUTED;
        } else if (volume < 0.5) {
            muteBtn.innerHTML = ICONS.VOLUME_LOW;
        } else {
            muteBtn.innerHTML = ICONS.VOLUME_HIGH;
        }
    }
    
    // Event handlers
    muteBtn.onclick = (e) => {
        e.stopPropagation();
        video.muted = !video.muted;
        updateMuteIcon();
        if (onVolumeChange) onVolumeChange(video.muted ? 0 : video.volume);
    };
    
    slider.oninput = () => {
        const volume = parseFloat(slider.value) / 100;
        video.volume = volume;
        video.muted = false;
        updateMuteIcon();
        updateVolumeProgress(); // Add this line
        if (onVolumeChange) onVolumeChange(volume);
    };
    
    // Hover events for volume popup
    let hoverTimeout;

    container.addEventListener('mouseenter', () => {
        clearTimeout(hoverTimeout);
        // Expand horizontally
        volumeSlider.style.width = '70px';
        volumeSlider.style.opacity = '1';
    });
    
    container.addEventListener('mouseleave', () => {
        hoverTimeout = setTimeout(() => {
            // Collapse horizontally
            volumeSlider.style.width = '0px';
            volumeSlider.style.opacity = '0';
        }, TIMING.TOOLTIP_DELAY_FAST);
    });
    
    // Update volume slider when video volume changes
    video.addEventListener('volumechange', () => {
        slider.value = Math.round(video.volume * 100);
        updateVolumeProgress(); // Add this line
        updateMuteIcon();
    });
    
    // Initial icon update
    updateMuteIcon();
    updateVolumeProgress();
    container.appendChild(muteBtn);
    container.appendChild(volumeSlider);
    return { element: container, cleanup: () => {
        container.remove();
        muteTooltip();
        volumeTooltip();
    }};
}
