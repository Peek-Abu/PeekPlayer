// PeekPlayer - Modular HTML5 Video Player
import { setupOverlayControls } from './controls.js';
import { HLSWrapper } from '../engines/hls-wrapper.js';
import { VideoJSWrapper } from '../engines/videojs-wrapper.js';
import { assert, assertExists, assertVideoElement, assertType } from '../utils/assert.js';

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
  const forceVJS = new URLSearchParams(window.location.search).get('engine') === 'videojs';
  
  if (forceHLS) return 'hls';
  if (forceVJS) return 'videojs';
  
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
    case 'videojs':
      engine = new VideoJSWrapper(video);
      break;
    case 'hls':
      engine = new HLSWrapper(video, options.hlsConfig, logger);
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

function processVideoSources(sourcesData) {
  if (!sourcesData?.sources?.length) return null;
  
  const processedSources = sourcesData.sources
      .filter(source => source.url && source.quality)
      .map((source, index) => {
          const qualityMatch = source.quality.match(/(\d+)p/);
          const height = qualityMatch ? parseInt(qualityMatch[1]) : 480;
          
          return {
              ...source,
              height,
              width: Math.round(height * 16/9),
              index,
              displayName: source.quality
          };
      })
      .sort((a, b) => b.height - a.height); // Sort by quality (highest first)
  
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
    
    this.video = videoElement;
    this.controlsContainer = controlsContainer;
    this.overlayContainer = overlayContainer;
    this.engine = null;
    this.sourcesData = null;
    this.controlsInitialized = false;
    this.controlsCleanup = null;
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
    this.logger.log('🎬 PeekPlayer initialized with options:', {
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
    
    // Set up video event listeners
    this._setupVideoListeners();
    this._setupAutoUnmute();
  }

  _setupVideoListeners() {
    this.video.addEventListener('loadedmetadata', () => this._initControls());
    this.video.addEventListener('error', (e) => {
      this.logger.error('🎬 Video error:', this.video.error);
    });
    this.video.addEventListener('ended', this._handleVideoEnd);
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

      this.logger.log('🎬 Auto-unmute triggered by user interaction');
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
      this.logger.log('🎬 AutoNext triggered on ended');
      this.options.onSkip('next');
    }
  }

  _initControls(force = false) {
    if (this.controlsInitialized && !force) return;

    if (force && this.controlsCleanup) {
      this.controlsCleanup();
      this.controlsCleanup = null;
      this.controlsInitialized = false;
    }

    if (this.controlsInitialized) return;
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
        overlayContainer: this.overlayContainer
      },
      segmentAutoSkip: this.options.segmentAutoSkip,
      nativeControlsForMobile: !!this.options.nativeControlsForMobile
    });
  }

  _teardownControls() {
    if (this.controlsCleanup) {
      this.controlsCleanup();
      this.controlsCleanup = null;
    }
    this.controlsInitialized = false;
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
      setTimeout(() => {
        if (!this.controlsInitialized) {
          this.logger.warn('🎬 Video metadata not loaded after 2s, initializing controls anyway');
          this._initControls();
        }
      }, 2000);
      
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
    const sourcesData = { sources, headers };
    const processedSources = processVideoSources(sourcesData);
    
    if (!processedSources?.sources?.length) {
      throw new Error('No valid sources provided');
    }
    
    this.sourcesData = processedSources;
    
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
    setTimeout(() => {
      if (!this.controlsInitialized) {
        this.logger.warn('🎬 Video metadata not loaded after 2s, initializing controls anyway');
        this._initControls();
      }
    }, 2000);
    
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
    if (this.engine) {
      this.engine.destroy();
      this.engine = null;
    }
    this.sourcesData = null;
    this._teardownControls();
    if (typeof this._autoUnmuteCleanup === 'function') {
      this._autoUnmuteCleanup();
    }
  }
}

// Export for UMD builds
export default PeekPlayer;
