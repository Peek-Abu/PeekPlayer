import { createPlayButton } from './play-toggle.js';
import { createVolumeControl } from './volume-control.js';
import { createFullscreenButton } from './fullscreen.js';
import { createTimeDisplay } from './time-display.js';
import { createSkipButtons } from './skip-buttons.js';
import { createSecondsSkipButtons } from './seconds-skip-buttons.js';
import { createQualitySelector } from './quality-selector.js';
import { createPipButton } from './pip-button.js';

export function createControlRow(video, options = {}) {
    const controlRow = document.createElement('div');
    controlRow.className = 'controls-row';
    const {
        callbacks = {},
        controlConfig: incomingConfig = {},
        context = {},
        logger
    } = options;
    const defaultConfig = {
        skipPrevious: true,
        skipNext: true,
        playToggle: true,
        volume: true,
        timeDisplay: true,
        secondsSkipBack: true,
        secondsSkipForward: true,
        quality: true,
        pip: true,
        fullscreen: true
    };
    const controlsConfig = { ...defaultConfig, ...incomingConfig };
    const cleanups = [];
    let autoMarginApplied = false;
    const appendElement = (element, applyAutoMargin = false) => {
        if (!element) return;
        if (applyAutoMargin && !autoMarginApplied) {
            element.style.marginLeft = 'auto';
            autoMarginApplied = true;
        }
        controlRow.appendChild(element);
    };
    const shouldApplyAutoMargin = () => !autoMarginApplied;
    let leftClusterAdded = false;
    let playControl = null;
    if (controlsConfig.playToggle) {
        const { element, cleanup } = createPlayButton(video, callbacks.onPlaybackChange);
        cleanups.push(cleanup);
        playControl = element;
    }
    if (controlsConfig.skipPrevious || controlsConfig.skipNext) {
        const { prevBtn, nextBtn, cleanup } = createSkipButtons(video, callbacks.onSkip);
        cleanups.push(cleanup);
        if (controlsConfig.skipPrevious) {
            appendElement(prevBtn);
            leftClusterAdded = true;
        }
        if (playControl) {
            appendElement(playControl);
            leftClusterAdded = true;
            playControl = null;
        }
        if (controlsConfig.skipNext) {
            appendElement(nextBtn);
            leftClusterAdded = true;
        }
    }
    if (playControl) {
        appendElement(playControl);
        leftClusterAdded = true;
        playControl = null;
    }
    if (controlsConfig.volume) {
        const { element, cleanup } = createVolumeControl(video, callbacks.onVolumeChange);
        cleanups.push(cleanup);
        appendElement(element);
        leftClusterAdded = true;
    }
    if (controlsConfig.timeDisplay) {
        const { element, cleanup } = createTimeDisplay(video, callbacks.onTimeUpdate);
        cleanups.push(cleanup);
        appendElement(element);
        leftClusterAdded = true;
    }
    const applyAutoMargin = leftClusterAdded;
    if (controlsConfig.secondsSkipBack || controlsConfig.secondsSkipForward) {
        const { skipBackBtn, skipForwardBtn, cleanup } = createSecondsSkipButtons(video, callbacks.onSeek);
        cleanups.push(cleanup);
        if (controlsConfig.secondsSkipBack) {
            appendElement(skipBackBtn, applyAutoMargin && shouldApplyAutoMargin());
        }
        if (controlsConfig.secondsSkipForward) {
            appendElement(skipForwardBtn, applyAutoMargin && shouldApplyAutoMargin());
        }
    }
    if (controlsConfig.quality) {
        const { element, cleanup } = createQualitySelector(video, {
            player: context.player,
            onQualityChange: callbacks.onQualityChange
        }, logger);
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
    }
    if (controlsConfig.pip) {
        const { element, cleanup } = createPipButton(video, callbacks.onPipChange, logger);
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
    }
    if (controlsConfig.fullscreen) {
        const { element, cleanup } = createFullscreenButton(context.playerWrapper || video.parentElement, callbacks.onFullscreen, logger);
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
    }
    const cleanup = () => {
        cleanups.forEach((fn) => {
            if (typeof fn === 'function') {
                fn();
            }
        });
    };
    return { element: controlRow, cleanup };
}