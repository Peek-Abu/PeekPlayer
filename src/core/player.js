// PeekPlayer - Modular HTML5 Video Player
import { setupOverlayControls } from './controls.js';
import { HLSWrapper } from '../engines/hls-wrapper.js';
import { assert, assertElement, assertExists, assertVideoElement, assertType } from '../utils/assert.js';

const DEFAULT_LOGGER = {
  debugEnabled: false,
  setDebug(enabled) {
    this.debugEnabled = enabled;
  },
  log(...args) {
    if (this.debugEnabled) {
      console.log(...args);
    }
  },
  warn(...args) {
    if (this.debugEnabled) {
      console.warn(...args);
    }
  },
  error(...args) {
    console.error(...args);
  }
};

function normalizeSegments(segments = []) {
  if (!Array.isArray(segments)) {
    return [];
  }

  return segments
    .map((segment) => {
      if (!segment || typeof segment !== 'object') return null;

      const start = Number(segment.start);
      const end = Number(segment.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
        return null;
      }

      return {
        label: segment.label ?? '',
        start: Math.max(0, start),
        end: Math.max(0, end),
        color: segment.color,
        data: segment.data
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);
}

// Engine selection logic
function selectVideoEngine(options = {}, sources = [], logger = DEFAULT_LOGGER) {
  if (options.engine) return options.engine;
  
  const forceHLS = new URLSearchParams(window.location.search).get('engine') === 'hls';
  
  if (forceHLS) return 'hls';
  
  // Auto-detect based on source URLs
  if (sources.length > 0) {
    const firstUrl = sources[0].url.toLowerCase();
    if (firstUrl.includes('.m3u8') || firstUrl.includes('hls')) {
      return 'hls';
    }
    if (firstUrl.includes('.mp4') || firstUrl.includes('.webm') || firstUrl.includes('.ogg')) {
      return 'native';
    }
  }
  
  // Default to native for better compatibility
  return 'native';
}

async function initializeVideoEngine(video, url, options = {}, sources = [], logger = DEFAULT_LOGGER) {
  assertVideoElement(video, { component: 'Player', method: 'initializeVideoEngine' });
  assertExists(url, 'url', { component: 'Player', method: 'initializeVideoEngine' });
  assertType(url, 'string', 'url', { component: 'Player', method: 'initializeVideoEngine' });
  
  const engineType = selectVideoEngine(options, sources, logger);
  logger.log(`🎬 Selected engine: ${engineType}`);
  
  let engine;
  switch (engineType) {
    case 'hls':
      engine = new HLSWrapper(video, options.hlsConfig, logger, {
        useNativeIfSupported: options.engine !== 'hls'
      });
      break;
    case 'native':
    default:
      // Use native HTML5 video for MP4, WebM, etc.
      engine = {
        async load(url) {
          video.src = url;
          return Promise.resolve();
        },
        destroy() {
          video.src = '';
        },
        setQualitySources() {
          // Native engine doesn't support quality switching
        }
      };
      break;
  }
  
  assertExists(engine, 'engine', { component: 'Player', method: 'initializeVideoEngine', engineType });
  
  if (engine.initialize) {
    await engine.initialize(url);
  } else {
    await engine.load(url);
  }
  return engine;
}

function extractHeightFromString(value) {
  if (!value) return null;
  const stringValue = String(value);
  const numericMatch = stringValue.match(/(\d{3,4})\s*(?:p\b|$)/i);
  if (numericMatch) {
    const parsed = parseInt(numericMatch[1], 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (/8k/i.test(stringValue)) return 4320;
  if (/4k/i.test(stringValue)) return 2160;
  if (/2k/i.test(stringValue)) return 1440;
  return null;
}

function extractHeightFromSource(source) {
  if (source && Number.isFinite(source.height)) {
    return source.height;
  }
  const candidates = [source?.quality, source?.displayName, source?.label];
  for (const candidate of candidates) {
    const height = extractHeightFromString(candidate);
    if (height) {
      return height;
    }
  }
  if (source && Number.isFinite(source.bandwidth)) {
    const estimated = Math.round(Math.sqrt(source.bandwidth));
    if (Number.isFinite(estimated) && estimated >= 144) {
      return estimated;
    }
  }
  return null;
}

function formatHeightLabel(height) {
  if (!height) {
    return 'Auto';
  }
  let suffix = '';
  if (height >= 4320) {
    suffix = ' 8K';
  } else if (height >= 2160) {
    suffix = ' 4K';
  } else if (height >= 1440) {
    suffix = ' QHD';
  } else if (height >= 1080) {
    suffix = ' Full HD';
  } else if (height >= 720) {
    suffix = ' HD';
  }
  return `${height}p${suffix}`;
}

function buildQualityDisplayName(source, height) {
  const rawCandidates = [source?.displayName, source?.label, source?.quality];
  const raw = rawCandidates.find((candidate) => typeof candidate === 'string' && candidate.trim().length > 0);
  const lowerRaw = raw?.toLowerCase() || '';
  if (lowerRaw.includes('auto')) {
    return 'Auto';
  }
  if (!raw) {
    return formatHeightLabel(height);
  }
  const trimmed = raw.trim();
  if (/^\d+$/.test(trimmed)) {
    return formatHeightLabel(parseInt(trimmed, 10));
  }
  if (/^\d+\s*p$/i.test(trimmed)) {
    return formatHeightLabel(parseInt(trimmed, 10));
  }
  if (/^\d+\s*k$/i.test(trimmed)) {
    if (height) {
      return formatHeightLabel(height);
    }
    const value = parseInt(trimmed, 10);
    if (Number.isFinite(value)) {
      if (value >= 8) return formatHeightLabel(4320);
      if (value >= 4) return formatHeightLabel(2160);
      if (value >= 2) return formatHeightLabel(1440);
    }
  }
  if (height && /^\d{3,4}$/i.test(trimmed.replace(/[^\d]/g, ''))) {
    return formatHeightLabel(height);
  }
  return trimmed;
}

function isAutoQualityLabel(label) {
  return typeof label === 'string' && label.trim().toLowerCase() === 'auto';
}

function getQualitySortWeight(source) {
  if (isAutoQualityLabel(source.displayName)) {
    return Number.POSITIVE_INFINITY;
  }
  return source.height || 0;
}

function processVideoSources(sourcesData) {
  if (!sourcesData?.sources?.length) return null;

  let processedSources = sourcesData.sources
    .filter((source) => source?.url && (source.quality || source.displayName || source.label))
    .map((source, index) => {
      const height = extractHeightFromSource(source) || 0;
      const displayName = buildQualityDisplayName(source, height);
      return {
        ...source,
        height,
        width: height ? Math.round((height * 16) / 9) : undefined,
        index,
        displayName,
      };
    })
    .sort((a, b) => {
      const weightA = getQualitySortWeight(a);
      const weightB = getQualitySortWeight(b);
      if (weightA === weightB) {
        return a.index - b.index;
      }
      return weightB - weightA;
    });

  if (processedSources.length > 1 && !processedSources.some((source) => isAutoQualityLabel(source.displayName))) {
    const estimatedHeight = processedSources.reduce((best, source) => {
      if (!source.height) {
        return best;
      }
      if (!best) {
        return source.height;
      }
      return Math.min(best, source.height);
    }, 0);

    const autoSource = {
      url: processedSources[0].url,
      quality: 'Auto',
      displayName: 'Auto',
      height: estimatedHeight || undefined,
      width: estimatedHeight ? Math.round((estimatedHeight * 16) / 9) : undefined,
      index: -1,
      isAuto: true,
    };

    processedSources = [autoSource, ...processedSources];
  }

  return { ...sourcesData, sources: processedSources };
}

/**
 * PeekPlayer - Professional HTML5 Video Player
 */
export class PeekPlayer {
  constructor(options = {}) {
    const {
      videoElement,
      controlsContainer,
      overlayContainer,
      playerWrapper,
      engine,
      hlsConfig,
      autoplay = false,
      autoNext = false,
      poster,
      debug = false,
      autoUnmuteOnInteraction = false,
      segments = [],
      logger
    } = options;
    
    // Validate required elements
    assertVideoElement(videoElement, { component: 'PeekPlayer', method: 'constructor' });
    assertExists(controlsContainer, 'controlsContainer', { component: 'PeekPlayer', method: 'constructor' });
    const resolvedWrapper = playerWrapper
      || controlsContainer?.closest('.peekplayer-wrapper')
      || videoElement.closest('.peekplayer-wrapper')
      || controlsContainer?.parentElement
      || videoElement.parentElement;
    assertElement(resolvedWrapper, 'playerWrapper', {
      component: 'PeekPlayer',
      method: 'constructor',
      note: 'Provide `playerWrapper` when instantiating PeekPlayer.'
    });
    
    this.video = videoElement;
    this.controlsContainer = controlsContainer;
    this.overlayContainer = overlayContainer;
    this.playerWrapper = resolvedWrapper;
    this.playerWrapper.classList.add('peekplayer-wrapper');
    this.controlsContainer.classList.add('peekplayer-controls');
    if (this.overlayContainer) {
      this.overlayContainer.classList.add('peekplayer-overlay');
    }
    this.engine = null;
    this.sourcesData = null;
    this.controlsInitialized = false;
    this.controlsCleanup = null;
    this._initControlsTimeout = null;
    this._isDestroyed = false;
    this.options = {
      ...options,
      engine,
      hlsConfig,
      autoplay,
      autoNext,
      poster,
      debug,
      logger: logger || DEFAULT_LOGGER,
      autoUnmuteOnInteraction
    };
    const normalizedSegments = normalizeSegments(segments);
    this.logger = this.options.logger;
    if (this.logger && typeof this.logger.setDebug === 'function') {
      this.logger.setDebug(!!debug);
    } else if (this.logger) {
      this.logger.debugEnabled = !!debug;
    }
    this.autoplay = !!autoplay;
    this.autoNext = !!autoNext;
    this.options.controls = { ...(options.controls || {}) };
    this.options.segments = normalizedSegments;
    this.logger.log('PeekPlayer initialized with options:', {
      autoplay: this.autoplay,
      autoNext: this.autoNext,
      poster: !!poster,
      debug: !!debug,
      autoUnmuteOnInteraction: !!autoUnmuteOnInteraction,
      segments: normalizedSegments.length
    });
    if (poster) {
      this.video.poster = poster;
    }
    if (this.autoplay) {
      this.video.setAttribute('autoplay', '');
      this.video.muted = true;
      this.video.setAttribute('muted', '');
      this.video.setAttribute('playsinline', '');
    }
    this.autoUnmuteOnInteraction = !!autoUnmuteOnInteraction;
    this._handleVideoEnd = this._handleVideoEnd.bind(this);
    this._handleHlsLevels = this._handleHlsLevels.bind(this);
    this._handleHlsLevelSwitch = this._handleHlsLevelSwitch.bind(this);
    this._setCurrentQualitySource = this._setCurrentQualitySource.bind(this);

    // Set up video event listeners
    this._cleanupVideoListeners = this._setupVideoListeners();
    this._setupAutoUnmute();
  }

  _setupVideoListeners() {
    if (!this._onLoadedMetadata) {
      this._onLoadedMetadata = () => this._initControls();
    }
    if (!this._onVideoError) {
      this._onVideoError = () => {
        this.logger.error('Video error:', this.video.error);
      };
    }

    this.video.addEventListener('loadedmetadata', this._onLoadedMetadata);
    this.video.addEventListener('error', this._onVideoError);
    this.video.addEventListener('ended', this._handleVideoEnd);
    this.video.addEventListener('peekplayer:hls-levels', this._handleHlsLevels);
    this.video.addEventListener('peekplayer:hls-level-switch', this._handleHlsLevelSwitch);

    return () => {
      if (this._onLoadedMetadata) {
        this.video.removeEventListener('loadedmetadata', this._onLoadedMetadata);
        this._onLoadedMetadata = null;
      }
      if (this._onVideoError) {
        this.video.removeEventListener('error', this._onVideoError);
        this._onVideoError = null;
      }
      this.video.removeEventListener('ended', this._handleVideoEnd);
      this.video.removeEventListener('peekplayer:hls-levels', this._handleHlsLevels);
      this.video.removeEventListener('peekplayer:hls-level-switch', this._handleHlsLevelSwitch);
    };
  }

  _handleHlsLevels(event) {
    const detail = event?.detail;
    if (!detail || !Array.isArray(detail.sources)) {
      return;
    }

    const processed = processVideoSources(detail);
    if (!processed?.sources?.length) {
      this.logger.warn('Received HLS levels but none were valid after processing');
      return;
    }

    this.logger.log('Updating sources from HLS levels:', processed.sources.length);
    this.sourcesData = processed;

    if (!this._currentQualitySource && processed.sources.length) {
      this._currentQualitySource = processed.sources[0];
    }

    if (this.engine && typeof this.engine.setSourcesData === 'function') {
      this.engine.setSourcesData(processed);
    }

    this._updateQualitySelector(processed);

    const activeLevel = typeof detail.currentLevel === 'number' ? detail.currentLevel : null;
    if (typeof activeLevel === 'number') {
      const matching = processed.sources.find((source) =>
        typeof source.hlsLevel === 'number' ? source.hlsLevel === activeLevel : source.index === activeLevel
      );
      if (matching) {
        this._setCurrentQualitySource(matching);
      }
    }
  }

  _handleHlsLevelSwitch(event) {
    const detail = event?.detail;
    const source = detail?.source;
    if (!source || !this.sourcesData?.sources?.length) {
      return;
    }

    const matching = this.sourcesData.sources.find((candidate) => {
      if (candidate.isAuto) {
        return false;
      }
      if (typeof candidate.hlsLevel === 'number') {
        return candidate.hlsLevel === source.hlsLevel;
      }
      return candidate.index === source.index;
    }) || source;

    this._setCurrentQualitySource(matching);
  }

  _setCurrentQualitySource(source) {
    if (!source) {
      return;
    }

    this._currentQualitySource = source;

    if (this.controlsContainer) {
      const qualitySelector = this.controlsContainer.querySelector('.quality-selector');
      if (qualitySelector && typeof qualitySelector.setActiveQuality === 'function') {
        qualitySelector.setActiveQuality(source);
      }
    }

    if (typeof this.options.onQualityChange === 'function') {
      const displayName = source.displayName || source.quality || (source.height ? `${source.height}p` : 'Auto');
      this.options.onQualityChange(displayName);
    }
  }

  _updateQualitySelector(sourcesData) {
    if (!sourcesData || !Array.isArray(sourcesData.sources) || !this.controlsContainer) {
      return;
    }

    const qualitySelector = this.controlsContainer.querySelector('.quality-selector');
    if (qualitySelector && typeof qualitySelector.updateSources === 'function') {
      qualitySelector.updateSources(sourcesData);
      if (this._currentQualitySource && typeof qualitySelector.setActiveQuality === 'function') {
        qualitySelector.setActiveQuality(this._currentQualitySource);
      }
    }
  }

  _setupAutoUnmute() {
    if (!(this.autoplay && this.autoUnmuteOnInteraction)) {
      return;
    }

    const handler = () => {
      if (!this.video.muted) {
        cleanup();
        return;
      }

      this.logger.log('Auto-unmute triggered by user interaction');
      this.video.muted = false;
      this.video.removeAttribute('muted');
      cleanup();
    };

    const cleanup = () => {
      this.video.removeEventListener('click', handler);
      this.controlsContainer?.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
      this._autoUnmuteCleanup = null;
    };

    this.video.addEventListener('click', handler, { once: false });
    this.controlsContainer?.addEventListener('click', handler, { once: false });
    document.addEventListener('keydown', handler, { once: false });

    this._autoUnmuteCleanup = cleanup;
  }

  _handleVideoEnd() {
    if (this.autoNext && typeof this.options.onSkip === 'function') {
      this.logger.log('AutoNext triggered on ended');
      this.options.onSkip('next');
    }
  }

  _initControls(force = false) {
    if (this._isDestroyed) return;
    if (this.controlsInitialized && !force) return;

    if (force && this.controlsCleanup) {
      this.controlsCleanup();
      this.controlsCleanup = null;
      this.controlsInitialized = false;
    }

    if (this.controlsInitialized) return;
    this._clearControlsFallback();
    this.controlsInitialized = true;

    const callbackKeys = [
      'onPlaybackChange',
      'onSeek',
      'onVolumeChange',
      'onFullscreen',
      'onTimeUpdate',
      'onSkip',
      'onPipChange',
      'onQualityChange'
    ];

    const callbacks = callbackKeys.reduce((acc, key) => {
      if (typeof this.options[key] === 'function') {
        acc[key] = this.options[key];
      }
      return acc;
    }, {});

    this.controlsCleanup = setupOverlayControls(this.video, this.controlsContainer, {
      logger: this.logger,
      callbacks,
      controls: this.options.controls || {},
      segments: this.options.segments || [],
      context: {
        player: this,
        overlayContainer: this.overlayContainer,
        playerWrapper: this.playerWrapper
      },
      segmentAutoSkip: this.options.segmentAutoSkip,
      nativeControlsForMobile: !!this.options.nativeControlsForMobile,
      playerWrapper: this.playerWrapper,
      overlayContainer: this.overlayContainer
    });

    if (this.sourcesData) {
      this._updateQualitySelector(this.sourcesData);
    }
  }

  _teardownControls() {
    if (this.controlsCleanup) {
      this.controlsCleanup();
      this.controlsCleanup = null;
    }
    this.controlsInitialized = false;
  }

  _clearControlsFallback() {
    if (this._initControlsTimeout) {
      clearTimeout(this._initControlsTimeout);
      this._initControlsTimeout = null;
    }
  }

  _scheduleControlsFallback() {
    if (this._isDestroyed) {
      return;
    }
    this._clearControlsFallback();
    this._initControlsTimeout = setTimeout(() => {
      if (this._isDestroyed || this.controlsInitialized) {
        return;
      }
      this.logger.warn('🎬 Video metadata not loaded after 2s, initializing controls anyway');
      this._initControls();
    }, 2000);
  }

  refreshControls() {
    if (this.controlsInitialized) {
      this._initControls(true);
    }
  }

  updateOptions(partialOptions = {}) {
    assertType(partialOptions, 'object', 'partialOptions', { component: 'PeekPlayer', method: 'updateOptions' });
    let shouldRefreshControls = false;

    const {
      autoplay,
      autoNext,
      autoUnmuteOnInteraction,
      controls: controlsUpdate,
      segments,
      logger,
      ...otherOptions
    } = partialOptions;

    Object.assign(this.options, otherOptions);

    if (logger && logger !== this.logger) {
      this.logger = logger;
    }

    if (typeof autoplay !== 'undefined') {
      const value = !!autoplay;
      this.autoplay = value;
      this.options.autoplay = value;

      if (value) {
        this.video.setAttribute('autoplay', '');
        if (!this.video.hasAttribute('muted')) {
          this.video.muted = true;
          this.video.setAttribute('muted', '');
        }

        if (this.video.readyState >= 2) {
          this.video.play().catch((error) => {
            this.logger?.warn?.('🎬 Autoplay play() failed after enabling:', error);
          });
        }
      } else {
        this.video.removeAttribute('autoplay');
        if (!this.video.paused) {
          this.video.pause();
        }
      }
    }

    if (typeof autoNext !== 'undefined') {
      const value = !!autoNext;
      this.autoNext = value;
      this.options.autoNext = value;
    }

    if (typeof autoUnmuteOnInteraction !== 'undefined') {
      const value = !!autoUnmuteOnInteraction;
      this.autoUnmuteOnInteraction = value;
      this.options.autoUnmuteOnInteraction = value;

      if (typeof this._autoUnmuteCleanup === 'function') {
        this._autoUnmuteCleanup();
        this._autoUnmuteCleanup = null;
      }

      this._setupAutoUnmute();
    }

    if (typeof controlsUpdate !== 'undefined') {
      assertType(controlsUpdate, 'object', 'controlsUpdate', { component: 'PeekPlayer', method: 'updateOptions' });
      this.options.controls = {
        ...(this.options.controls || {}),
        ...controlsUpdate
      };
      shouldRefreshControls = true;
    }

    if (typeof segments !== 'undefined') {
      const normalizedSegments = normalizeSegments(segments);
      this.options.segments = normalizedSegments;
      shouldRefreshControls = true;
    }

    if (typeof partialOptions.segmentAutoSkip !== 'undefined') {
      this.options.segmentAutoSkip = partialOptions.segmentAutoSkip;
      console.log(this.options.segmentAutoSkip);
      shouldRefreshControls = true;
    }

    if (shouldRefreshControls) {
      this.refreshControls();
    }
  }

  async loadSource(url, headers = {}) {
    assertExists(url, 'url', { component: 'PeekPlayer', method: 'loadSource' });
    assertType(url, 'string', 'url', { component: 'PeekPlayer', method: 'loadSource' });
    
    try {
      this._isDestroyed = false;
      // Pass current sources for engine selection
      const sources = this.sourcesData?.sources || [];
      this.engine = await initializeVideoEngine(this.video, url, this.options, sources, this.logger);
      this.video._engine = this.engine;
      
      // Ensure video attributes and playback respect autoplay preference
      if (this.autoplay) {
        this.video.play();
      } else {
        this.video.pause();
      }
      
      // Force controls initialization after a delay if metadata doesn't load
      this._scheduleControlsFallback();
      
      return this;
    } catch (error) {
      this.logger.error('🎬 Failed to load source:', error);
      throw error;
    }
  }

  async loadSources(sources, headers = {}) {
    assertExists(sources, 'sources', { component: 'PeekPlayer', method: 'loadSources' });
    assert(Array.isArray(sources), 'sources must be an array', { component: 'PeekPlayer', method: 'loadSources' });
    
    // Process and sort sources
    this._isDestroyed = false;
    const sourcesData = { sources, headers };
    const processedSources = processVideoSources(sourcesData);

    if (!processedSources?.sources?.length) {
      throw new Error('No valid sources provided');
    }

    this.sourcesData = processedSources;

    if (processedSources.sources.length) {
      this._currentQualitySource = processedSources.sources[0];
    }

    // Load the highest quality source first
    const initialSource = processedSources.sources[0];

    // Initialize engine with sources for proper engine selection
    this.engine = await initializeVideoEngine(this.video, initialSource.url, this.options, processedSources.sources, this.logger);
    this.video._engine = this.engine;
    // Ensure video attributes and playback respect autoplay preference
    if (this.autoplay) {
      this.video.play();
    } else {
      this.video.pause();
    }
    
    // Force controls initialization after a delay if metadata doesn't load
    this._scheduleControlsFallback();
    
    // Set sources data on the engine for quality switching
    if (this.engine && this.engine.setSourcesData) {
      this.engine.setSourcesData(processedSources);
    }
    
    return this;
  }

  async switchQuality(qualityOrIndex) {
    if (!this.engine || !this.sourcesData) {
      throw new Error('No sources loaded or engine not initialized');
    }
    
    let targetSource;
    if (typeof qualityOrIndex === 'number') {
      targetSource = this.sourcesData.sources[qualityOrIndex];
    } else {
      targetSource = this.sourcesData.sources.find(s => 
        s.quality === qualityOrIndex || s.displayName === qualityOrIndex
      );
    }
    
    if (!targetSource) {
      throw new Error(`Quality "${qualityOrIndex}" not found`);
    }

    if (typeof targetSource.hlsLevel === 'number' && typeof this.engine.switchLevel === 'function') {
      await this.engine.switchLevel(targetSource.hlsLevel);
      return this;
    }

    await this.engine.switchSource(targetSource.url);
    return this;
  }

  getSources() {
    return this.sourcesData?.sources || [];
  }

  getEngine() {
    return this.engine;
  }

  destroy() {
    this._isDestroyed = true;
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.sourcesData = null;
    this._clearControlsFallback();
    this._teardownControls();
    if (typeof this._autoUnmuteCleanup === 'function') {
      this._autoUnmuteCleanup();
    }
    if (typeof this._cleanupVideoListeners === 'function') {
      this._cleanupVideoListeners();
    }
  }
}

// Export for UMD builds
export default PeekPlayer;
