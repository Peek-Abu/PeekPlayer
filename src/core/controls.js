import { createScrubberBar } from '../controls/scrubber-bar.js';
import { createControlRow } from '../controls/control-row.js';
import { createPausedOverlay } from '../components/paused-overlay.js';
import { setupVideoInteractions } from '../features/video-interactions.js';
import { setupKeyboardControls } from '../features/keyboard-controls.js';
import { setupAutoHideControls } from '../features/auto-hide-controls.js';
import { setupMobileGestures } from '../features/mobile-gestures.js';
import { assertVideoElement, assertElement, assertType } from '../utils/assert.js';

export function setupOverlayControls(video, container, options = {}) {
  // Assert required parameters
  assertVideoElement(video, { component: 'Controls', method: 'setupOverlayControls' });
  assertElement(container, 'container', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(options, 'object', 'options', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(options.logger, 'object', 'options.logger', { component: 'Controls', method: 'setupOverlayControls' });
  const {
    callbacks = {},
    logger,
    controls: controlsConfig = {},
    context = {},
    nativeControlsForMobile = false,
    playerWrapper,
    overlayContainer: overlayContainerOption
  } = options;
  assertType(callbacks, 'object', 'callbacks', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(controlsConfig, 'object', 'controlsConfig', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(context, 'object', 'context', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(nativeControlsForMobile, 'boolean', 'nativeControlsForMobile', { component: 'Controls', method: 'setupOverlayControls' });
  
  container.innerHTML = '';
  const hasWindow = typeof window !== 'undefined';
  const hasNavigator = typeof navigator !== 'undefined';
  const maxTouchPoints = hasNavigator ? (navigator.maxTouchPoints || navigator.msMaxTouchPoints || 0) : 0;
  const supportsMatchMedia = hasWindow && typeof window.matchMedia === 'function';
  const coarsePointer = supportsMatchMedia && window.matchMedia('(pointer: coarse)').matches;
  const finePointer = supportsMatchMedia && window.matchMedia('(pointer: fine)').matches;
  const canHover = supportsMatchMedia && window.matchMedia('(hover: hover)').matches;
  const isTouchCapable = (hasWindow && 'ontouchstart' in window) || maxTouchPoints > 0;
  const isMobileUserAgent = hasNavigator && /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent || '');
  const viewportWidth = hasWindow ? window.innerWidth : undefined;
  const shouldUseNativeControls = nativeControlsForMobile && (
    isMobileUserAgent || (
      isTouchCapable && !canHover && (
        coarsePointer ||
        (!finePointer && maxTouchPoints > 1) ||
        (typeof viewportWidth === 'number' && viewportWidth <= 900)
      )
    )
  );
  if (shouldUseNativeControls) {
    const hadControlsAttr = video.hasAttribute('controls');
    const hadPlaysInlineAttr = video.hasAttribute('playsinline');
    const previousControlsAttr = video.getAttribute('controls');
    const previousPlaysInlineAttr = video.getAttribute('playsinline');
    const previousControls = video.controls;
    const previousDisplay = container.style.display;
    container.style.display = 'none';
    video.controls = true;
    if (!hadControlsAttr) {
      video.setAttribute('controls', '');
    }
    if (!hadPlaysInlineAttr) {
      video.setAttribute('playsinline', '');
    }
    container.classList.add('native-mobile-controls');

    const cleanupFns = [];
    const addListener = (target, event, handler, options) => {
      target.addEventListener(event, handler, options);
      cleanupFns.push(() => target.removeEventListener(event, handler, options));
    };

    if (callbacks.onPlaybackChange) {
      addListener(video, 'play', () => callbacks.onPlaybackChange(true));
      addListener(video, 'pause', () => callbacks.onPlaybackChange(false));
    }

    if (callbacks.onVolumeChange) {
      addListener(video, 'volumechange', () => callbacks.onVolumeChange(video.muted ? 0 : video.volume));
    }

    if (callbacks.onTimeUpdate) {
      addListener(video, 'timeupdate', () => callbacks.onTimeUpdate(video.currentTime, video.duration));
    }

    if (callbacks.onSeek) {
      let lastReported = video.currentTime;
      const reportSeek = () => {
        const nextTime = video.currentTime;
        const delta = nextTime - lastReported;
        callbacks.onSeek(nextTime, delta, video.duration ? nextTime / video.duration : 0);
        lastReported = nextTime;
      };
      addListener(video, 'seeking', reportSeek);
      addListener(video, 'seeked', reportSeek);
    }

    if (callbacks.onFullscreen) {
      const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'];
      const handleFullscreenChange = () => callbacks.onFullscreen(!!document.fullscreenElement);
      fullscreenEvents.forEach((evt) => addListener(document, evt, handleFullscreenChange));
    }

    if (callbacks.onPipChange) {
      addListener(video, 'enterpictureinpicture', () => callbacks.onPipChange(true));
      addListener(video, 'leavepictureinpicture', () => callbacks.onPipChange(false));
    }

    return () => {
      container.classList.remove('native-mobile-controls');
      container.style.display = previousDisplay;
      if (!hadControlsAttr) {
        video.removeAttribute('controls');
      } else if (previousControlsAttr !== null) {
        video.setAttribute('controls', previousControlsAttr);
      }
      if (!hadPlaysInlineAttr) {
        video.removeAttribute('playsinline');
      } else if (previousPlaysInlineAttr !== null) {
        video.setAttribute('playsinline', previousPlaysInlineAttr);
      }
      video.controls = previousControls;
      cleanupFns.forEach((fn) => {
        try {
          fn();
        } catch (error) {
          logger?.warn?.('Failed to cleanup native control listener', error);
        }
      });
    };
  }
  
  const resolvedWrapper = playerWrapper || context.playerWrapper || video.closest('.peekplayer-wrapper');
  assertElement(resolvedWrapper, 'playerWrapper', {
    component: 'Controls',
    method: 'setupOverlayControls'
  });
  const overlayRoot = overlayContainerOption || context.overlayContainer || resolvedWrapper.querySelector('.peekplayer-overlay');

  // Initialize all controls
  const { element: scrubberBar, cleanup: scrubberCleanup } = createScrubberBar(video, callbacks.onSeek, options);
  const { element: controlRow, cleanup: controlRowCleanup } = createControlRow(video, { callbacks, controlConfig: controlsConfig, context: { ...context, playerWrapper: resolvedWrapper }, logger });
  const { element: pausedOverlay, cleanup: pausedOverlayCleanup } = createPausedOverlay(video, callbacks.onPlaybackChange, resolvedWrapper, overlayRoot);
  
  // Assert control components were created successfully
  assertElement(scrubberBar, 'scrubberBar', { component: 'Controls', method: 'setupOverlayControls' });
  assertElement(controlRow, 'controlRow', { component: 'Controls', method: 'setupOverlayControls' });
  assertElement(pausedOverlay, 'pausedOverlay', { component: 'Controls', method: 'setupOverlayControls' });
  
  // Append to overlay
  container.appendChild(scrubberBar);
  container.appendChild(controlRow);
    
  // Setup interactions and behaviors
  const cleanupInteractions = setupVideoInteractions(video, resolvedWrapper, callbacks);
  const cleanupKeyboard = setupKeyboardControls(video, callbacks, resolvedWrapper);
  const cleanupAutoHide = setupAutoHideControls(video, container, resolvedWrapper);
  const cleanupMobileGestures = setupMobileGestures(video, resolvedWrapper, context.player);
  const fullscreenEvents = ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'];
  const handleFullscreenChange = () => {
    if (callbacks.onFullscreen) {
      callbacks.onFullscreen(!!document.fullscreenElement);
    }
  };
  fullscreenEvents.forEach((evt) => document.addEventListener(evt, handleFullscreenChange));
  
  // Mobile-specific adjustments
  if ('ontouchstart' in window) {
    // Disable tooltips on mobile
    container.classList.add('mobile');
  }
  // Return cleanup function for all features
  return () => {
    cleanupInteractions();
    cleanupKeyboard();
    cleanupAutoHide();
    if (cleanupMobileGestures) cleanupMobileGestures();
    scrubberCleanup();
    controlRowCleanup();
    pausedOverlayCleanup();
    console.log('controls cleanup');
    fullscreenEvents.forEach((evt) => document.removeEventListener(evt, handleFullscreenChange));
  };
}
