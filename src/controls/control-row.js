import { createPlayButton } from './play-toggle.js';
import { createVolumeControl } from './volume-control.js';
import { createFullscreenButton } from './fullscreen.js';
import { createTimeDisplay } from './time-display.js';
import { createSkipButtons } from './skip-buttons.js';
import { createSecondsSkipButtons } from './seconds-skip-buttons.js';
import { createQualitySelector } from './quality-selector.js';
import { createPipButton } from './pip-button.js';

export function createControlRow(video, hooks = {}) {
    const controlRow = document.createElement('div');
    controlRow.className = 'controls-row';
    
    const { element: playBtn, cleanup: playCleanup } = createPlayButton(video, hooks.onPlayPause);
    const { prevBtn: prevSkipBtn, nextBtn: nextSkipBtn, cleanup: skipCleanup } = createSkipButtons(video, hooks.onSkip);
    const { element: volumeControl, cleanup: volumeCleanup } = createVolumeControl(video, hooks.onVolumeChange);
    const { element: timeDisplay, cleanup: timeCleanup } = createTimeDisplay(video, hooks.onTimeUpdate);
    const { skipBackBtn: secondsSkipBackBtn, skipForwardBtn: secondsSkipForwardBtn, cleanup: secondsSkipCleanup } = createSecondsSkipButtons(video, hooks.onSkip);
    const { element: pipBtn, cleanup: pipCleanup } = createPipButton(video, hooks.onPipChange);
    const { element: qualitySelector, cleanup: qualityCleanup } = createQualitySelector(video, hooks.player);
    const { element: fsBtn, cleanup: fsCleanup } = createFullscreenButton(video.parentElement, hooks.onFullscreen);
    secondsSkipBackBtn.style.marginLeft = 'auto';

    // Append all sections to main bar
    controlRow.appendChild(prevSkipBtn);
    controlRow.appendChild(playBtn);
    controlRow.appendChild(nextSkipBtn);
    controlRow.appendChild(volumeControl);
    controlRow.appendChild(timeDisplay);
    controlRow.appendChild(secondsSkipBackBtn);
    controlRow.appendChild(secondsSkipForwardBtn);
    controlRow.appendChild(qualitySelector);
    controlRow.appendChild(pipBtn);
    controlRow.appendChild(fsBtn);
    
    const cleanup = () => {
        playCleanup();
        skipCleanup();
        volumeCleanup();
        timeCleanup();
        secondsSkipCleanup();
        pipCleanup();
        qualityCleanup();
        fsCleanup();
    };
    return { element: controlRow, cleanup };
}