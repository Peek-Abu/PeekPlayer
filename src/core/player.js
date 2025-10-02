// PeekPlayer - Modular HTML5 Video Player
import { setupOverlayControls } from './controls.js';
import { HLSWrapper } from '../engines/hls-wrapper.js';
import { VideoJSWrapper } from '../engines/videojs-wrapper.js';
import { assert, assertExists, assertVideoElement, assertType } from '../utils/assert.js';

// Engine selection logic
function selectVideoEngine() {
  const forceHLS = new URLSearchParams(window.location.search).get('engine') === 'hls';
  const forceVJS = new URLSearchParams(window.location.search).get('engine') === 'videojs';
  
  if (forceHLS) return 'hls';
  if (forceVJS) return 'videojs';
  
  return 'hls'
}

async function initializeVideoEngine(video, hlsUrl) {
  assertVideoElement(video, { component: 'Player', method: 'initializeVideoEngine' });
  assertExists(hlsUrl, 'hlsUrl', { component: 'Player', method: 'initializeVideoEngine' });
  assertType(hlsUrl, 'string', 'hlsUrl', { component: 'Player', method: 'initializeVideoEngine' });
  
  const engineType = selectVideoEngine();
  console.log(`🎬 Selected engine: ${engineType}`);
  
  let engine;
  switch (engineType) {
    case 'videojs':
      engine = new VideoJSWrapper(video);
      break;
    default:
      engine = new HLSWrapper(video);
      break;
  }
  
  assertExists(engine, 'engine', { component: 'Player', method: 'initializeVideoEngine', engineType });
  
  await engine.initialize(hlsUrl);
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

document.addEventListener("DOMContentLoaded", async () => {
  const video = document.getElementById('peek-video');
  const params = new URLSearchParams(window.location.search);

  const sourcesData = await fetchSourcesData(params);
  let processedSources = null;
  let initialUrl = null;
  let headers = {};

  if (sourcesData) {
    // Process multi-source data
    processedSources = processVideoSources(sourcesData);
    if (processedSources?.sources?.length) {
        initialUrl = processedSources.sources[0].url; // Start with highest quality
        headers = sourcesData.headers || {};
    }
  }

  let controlsInitialized = false;
  const initControls = () => {
    if (controlsInitialized) return;
    controlsInitialized = true;
    
    setupOverlayControls(video, document.getElementById('custom-controls'), {
      // Add any control hooks here if needed
      player: video._engine, // Changed from _vjsPlayer to _engine
    });
  };
  // Event listeners for video readiness
  video.addEventListener('loadedmetadata', initControls);
  video.addEventListener('click', () => {
    if (video.readyState === 0) {
      console.log('🎬 User clicked, forcing video load');
    }
  }, { once: true });
  video.addEventListener('error', (e) => {
    console.error('Video error:', video.error);
  });

  if (initialUrl) {
    const engine = await initializeVideoEngine(video, initialUrl);
    video._engine = engine;
    
    if (processedSources) {
      engine.setSourcesData(processedSources);
    }
  }
  const subtitleUrl = params.get('subtitle');

  // Set up video source and load
  const initVideo = () => {
    if (subtitleUrl) {
      // loadSubtitles(video, subtitleUrl);
    }
  };

  initVideo();

  // Fallback: Initialize controls after 2 seconds if metadata hasn't loaded
  setTimeout(() => {
    if (!controlsInitialized) {
      console.warn('Video metadata not loaded after 2s, initializing controls anyway');
      initControls();
    }
  }, 6000);

  // Apply themes (optional)
  // applyTheme('dark');
});
