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
    context = {}
  } = options;
  assertType(callbacks, 'object', 'callbacks', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(controlsConfig, 'object', 'controlsConfig', { component: 'Controls', method: 'setupOverlayControls' });
  assertType(context, 'object', 'context', { component: 'Controls', method: 'setupOverlayControls' });
  
  container.innerHTML = '';
  
  // Get player wrapper for interactions
  const playerWrapper = document.getElementById('player-wrapper');
  assertElement(playerWrapper, 'playerWrapper', { 
    component: 'Controls', 
    method: 'setupOverlayControls',
    note: 'player-wrapper element not found in DOM' 
  });
  
  // Initialize all controls
  const { element: scrubberBar, cleanup: scrubberCleanup } = createScrubberBar(video, callbacks.onSeek);
  const { element: controlRow, cleanup: controlRowCleanup } = createControlRow(video, { callbacks, controlConfig: controlsConfig, context, logger });
  const { element: pausedOverlay, cleanup: pausedOverlayCleanup } = createPausedOverlay(video, callbacks.onPlaybackChange);
  
  // Assert control components were created successfully
  assertElement(scrubberBar, 'scrubberBar', { component: 'Controls', method: 'setupOverlayControls' });
  assertElement(controlRow, 'controlRow', { component: 'Controls', method: 'setupOverlayControls' });
  assertElement(pausedOverlay, 'pausedOverlay', { component: 'Controls', method: 'setupOverlayControls' });
  
  // Append to overlay
  container.appendChild(scrubberBar);
  container.appendChild(controlRow);
    
  // Setup interactions and behaviors
  const cleanupInteractions = setupVideoInteractions(video, playerWrapper, callbacks);
  const cleanupKeyboard = setupKeyboardControls(video, callbacks);
  const cleanupAutoHide = setupAutoHideControls(video, container, playerWrapper);
  const cleanupMobileGestures = setupMobileGestures(video, playerWrapper);
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
    fullscreenEvents.forEach((evt) => document.removeEventListener(evt, handleFullscreenChange));
  };
}
