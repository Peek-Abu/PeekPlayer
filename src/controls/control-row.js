import { createPlayButton } from './play-toggle.js';
import { createVolumeControl } from './volume-control.js';
import { createFullscreenButton } from './fullscreen.js';
import { createTimeDisplay } from './time-display.js';
import { createSkipButtons } from './skip-buttons.js';
import { createSecondsSkipButtons } from './seconds-skip-buttons.js';
import { createQualitySelector } from './quality-selector.js';
import { createSubtitleSelector } from './subtitle-selector.js';
import { createPipButton } from './pip-button.js';

export function createControlRow(video, options = {}) {
    const controlRow = document.createElement('div');
    controlRow.className = 'controls-row';
    const {
        callbacks = {},
        controlConfig: incomingConfig = {},
        context = {},
        logger,
        isMobile = false
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
        subtitles: true,
        pip: true,
        fullscreen: true
    };
    const controlsConfig = { ...defaultConfig, ...incomingConfig };
    const cleanups = [];
    const childElements = {};
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
        const { element, cleanup } = createPlayButton(video, callbacks.onPlaybackChange, {isMobile});
        cleanups.push(cleanup);
        playControl = element;
    }
    if (controlsConfig.skipPrevious || controlsConfig.skipNext) {
        const { prevBtn, nextBtn, cleanup } = createSkipButtons(video, callbacks.onSkip, {isMobile});
        cleanups.push(cleanup);
        if (controlsConfig.skipPrevious) {
            appendElement(prevBtn);
            childElements.skipPrevious = prevBtn;
            leftClusterAdded = true;
        }
        if (playControl) {
            appendElement(playControl);
            childElements.playToggle = playControl;
            leftClusterAdded = true;
            playControl = null;
        }
        if (controlsConfig.skipNext) {
            appendElement(nextBtn);
            childElements.skipNext = nextBtn;
            leftClusterAdded = true;
        }
    }
    if (playControl) {
        appendElement(playControl);
        childElements.playToggle = playControl;
        leftClusterAdded = true;
        playControl = null;
    }
    if (controlsConfig.volume) {
        const { element, cleanup } = createVolumeControl(video, callbacks.onVolumeChange, {isMobile});
        cleanups.push(cleanup);
        appendElement(element);
        childElements.volume = element;
        leftClusterAdded = true;
    }
    if (controlsConfig.timeDisplay) {
        const { element, cleanup } = createTimeDisplay(video, callbacks.onTimeUpdate);
        cleanups.push(cleanup);
        appendElement(element);
        childElements.timeDisplay = element;
        leftClusterAdded = true;
    }
    const applyAutoMargin = leftClusterAdded;
    if (controlsConfig.secondsSkipBack || controlsConfig.secondsSkipForward) {
        const { skipBackBtn, skipForwardBtn, cleanup } = createSecondsSkipButtons(video, callbacks.onSeek, {isMobile});
        cleanups.push(cleanup);
        if (controlsConfig.secondsSkipBack) {
            appendElement(skipBackBtn, applyAutoMargin && shouldApplyAutoMargin());
            childElements.secondsSkipBack = skipBackBtn;
        }
        if (controlsConfig.secondsSkipForward) {
            appendElement(skipForwardBtn, applyAutoMargin && shouldApplyAutoMargin());
            childElements.secondsSkipForward = skipForwardBtn;
        }
    }
    if (controlsConfig.subtitles) {
        const { element, cleanup } = createSubtitleSelector(video, {
            onSubtitleChange: callbacks.onSubtitleChange
        }, logger, { isMobile });
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
        childElements.subtitles = element;
    }
    if (controlsConfig.quality) {
        const { element, cleanup } = createQualitySelector(video, {
            player: context.player,
            onQualityChange: callbacks.onQualityChange
        }, logger, {isMobile});
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
        childElements.quality = element;
    }
    if (controlsConfig.pip) {
        const { element, cleanup } = createPipButton(video, callbacks.onPipChange, logger, {isMobile});
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
        childElements.pip = element;
    }
    if (controlsConfig.fullscreen) {
        const { element, cleanup } = createFullscreenButton(context.playerWrapper || video.parentElement, callbacks.onFullscreen, video, logger, {isMobile});
        cleanups.push(cleanup);
        appendElement(element, applyAutoMargin && shouldApplyAutoMargin());
        childElements.fullscreen = element;
    }
    const cleanup = () => {
        cleanups.forEach((fn) => {
            if (typeof fn === 'function') {
                fn();
            }
        });
    };
    return { element: controlRow, cleanup, childElements };
}