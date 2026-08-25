export function getFullscreenElement() {
  if (typeof document === 'undefined') return null;
  return document.fullscreenElement
    || document.webkitFullscreenElement
    || document.mozFullScreenElement
    || document.msFullscreenElement
    || null;
}

export function exitFullscreenWithFallback(video, logger) {
  if (document.exitFullscreen) {
    return Promise.resolve(document.exitFullscreen()).catch((error) => {
      logger?.warn?.('Fullscreen exit failed:', error);
    });
  }
  if (document.webkitExitFullscreen) {
    document.webkitExitFullscreen();
    return Promise.resolve();
  }
  if (video?.webkitExitFullscreen) {
    video.webkitExitFullscreen();
    return Promise.resolve();
  }
  if (document.msExitFullscreen) {
    document.msExitFullscreen();
    return Promise.resolve();
  }
  return Promise.resolve();
}

export function enterFullscreenWithFallback(element, video, logger) {
  if (!element && !video) {
    return Promise.resolve();
  }
  if (element?.requestFullscreen) {
    return Promise.resolve(element.requestFullscreen()).catch((error) => {
      logger?.warn?.('Fullscreen request failed:', error);
    });
  }
  if (element?.webkitRequestFullscreen) {
    try {
      element.webkitRequestFullscreen();
    } catch (error) {
      logger?.warn?.('Fullscreen request failed:', error);
    }
    return Promise.resolve();
  }
  if (element?.msRequestFullscreen) {
    try {
      element.msRequestFullscreen();
    } catch (error) {
      logger?.warn?.('Fullscreen request failed:', error);
    }
    return Promise.resolve();
  }
  if (video?.webkitEnterFullscreen) {
    try {
      video.webkitEnterFullscreen();
    } catch (error) {
      logger?.warn?.('Fullscreen request failed:', error);
    }
    return Promise.resolve();
  }
  logger?.warn?.('Fullscreen is not supported in this environment');
  return Promise.resolve();
}

export function toggleFullscreen(element, video, logger) {
  if (getFullscreenElement()) {
    return exitFullscreenWithFallback(video, logger);
  }
  return enterFullscreenWithFallback(element, video, logger);
}
