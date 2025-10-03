// PeekPlayer - Modular HTML5 Video Player
import { setupOverlayControls } from './controls.js';
import { HLSWrapper } from '../engines/hls-wrapper.js';
import { VideoJSWrapper } from '../engines/videojs-wrapper.js';
import { assert, assertExists, assertVideoElement, assertType } from '../utils/assert.js';

// Engine selection logic
function selectVideoEngine(options = {}, sources = []) {
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

async function initializeVideoEngine(video, url, options = {}, sources = []) {
  assertVideoElement(video, { component: 'Player', method: 'initializeVideoEngine' });
  assertExists(url, 'url', { component: 'Player', method: 'initializeVideoEngine' });
  assertType(url, 'string', 'url', { component: 'Player', method: 'initializeVideoEngine' });
  
  const engineType = selectVideoEngine(options, sources);
  console.log(`🎬 Selected engine: ${engineType}`);
  
  let engine;
  switch (engineType) {
    case 'videojs':
      engine = new VideoJSWrapper(video);
      break;
    case 'hls':
      engine = new HLSWrapper(video);
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

async function fetchSourcesData(params) {
  assertExists(params, 'params', { component: 'Player', method: 'fetchSourcesData' });
  assert(
    params instanceof URLSearchParams,
    'params must be URLSearchParams instance',
    { component: 'Player', method: 'fetchSourcesData', params }
  );
  
  try {
      // Method 1: Direct sources JSON (BEST for flexibility)
    const sourcesParam = params.get('sources');
    if (sourcesParam) {
        try {
            const sourcesData = JSON.parse(decodeURIComponent(sourcesParam));
            assert(
              Array.isArray(sourcesData),
              'Sources data must be an array',
              { component: 'Player', method: 'fetchSourcesData', sourcesData }
            );
            console.log('🎬 Loaded sources from URL:', sourcesData);
            return { headers: {}, sources: sourcesData };
        } catch (error) {
            console.error('🎬 Sources parse failed:', error);
        }
    }
    
    // Method 2: Generic API URL (any API that returns your format)
    const apiUrl = params.get('api');
    if (apiUrl) {
        try {
            console.log('🎬 Fetching from API:', apiUrl);
            const response = await fetch(apiUrl);
            const data = await response.json();
            console.log('🎬 API Response:', data);
            return data;
        } catch (error) {
            console.error('🎬 API fetch failed:', error);
        }
    }
  } catch (error) {
      console.error('🎬 API fetch failed:', error);
  }
  return { headers: {}, sources: [
    { url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',"quality":"SubsPlease · 360p" }
  ] };
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
    const { videoElement, controlsContainer, overlayContainer, engine } = options;
    
    // Validate required elements
    assertVideoElement(videoElement, { component: 'PeekPlayer', method: 'constructor' });
    assertExists(controlsContainer, 'controlsContainer', { component: 'PeekPlayer', method: 'constructor' });
    
    this.video = videoElement;
    this.controlsContainer = controlsContainer;
    this.overlayContainer = overlayContainer;
    this.engine = null;
    this.sourcesData = null;
    this.controlsInitialized = false;
    this.options = { engine, ...options };
    
    // Set up video event listeners
    this._setupVideoListeners();
  }

  _setupVideoListeners() {
    this.video.addEventListener('loadedmetadata', () => this._initControls());
    this.video.addEventListener('error', (e) => {
      console.error('🎬 Video error:', this.video.error);
    });
  }

  _initControls() {
    if (this.controlsInitialized) return;
    this.controlsInitialized = true;
    
    setupOverlayControls(this.video, this.controlsContainer, {
      player: this, // Pass the PeekPlayer instance, not just the engine
      overlayContainer: this.overlayContainer
    });
  }

  async loadSource(url, headers = {}) {
    assertExists(url, 'url', { component: 'PeekPlayer', method: 'loadSource' });
    assertType(url, 'string', 'url', { component: 'PeekPlayer', method: 'loadSource' });
    
    try {
      // Pass current sources for engine selection
      const sources = this.sourcesData?.sources || [];
      this.engine = await initializeVideoEngine(this.video, url, this.options, sources);
      this.video._engine = this.engine;
      
      // Force controls initialization after a delay if metadata doesn't load
      setTimeout(() => {
        if (!this.controlsInitialized) {
          console.warn('🎬 Video metadata not loaded after 2s, initializing controls anyway');
          this._initControls();
        }
      }, 2000);
      
      return this;
    } catch (error) {
      console.error('🎬 Failed to load source:', error);
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
    this.engine = await initializeVideoEngine(this.video, initialSource.url, this.options, processedSources.sources);
    this.video._engine = this.engine;
    
    // Force controls initialization after a delay if metadata doesn't load
    setTimeout(() => {
      if (!this.controlsInitialized) {
        console.warn('🎬 Video metadata not loaded after 2s, initializing controls anyway');
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
    this.controlsInitialized = false;
  }
}

// Export for UMD builds
export default PeekPlayer;
