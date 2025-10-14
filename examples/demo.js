// Demo-specific initialization logic
import { PeekPlayer } from '../src/core/player.js';

async function fetchSourcesData(params) {
  try {
      // Method 1: Direct sources JSON (BEST for flexibility)
    const sourcesParam = params.get('sources');
    if (sourcesParam) {
        try {
            const sourcesData = JSON.parse(decodeURIComponent(sourcesParam));
            if (Array.isArray(sourcesData)) {
              console.log('🎬 Loaded sources from URL:', sourcesData);
              return { headers: {}, sources: sourcesData };
            }
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
  
  // Default fallback source
  return { 
    headers: {}, 
    sources: [
      { 
        url: 'https://demo.unified-streaming.com/k8s/features/stable/video/tears-of-steel/tears-of-steel.ism/.m3u8',
        quality: "Sub · 1080p" 
      }
    ] 
            
  };
}

// Demo initialization
document.addEventListener("DOMContentLoaded", async () => {
  const video = document.getElementById('peek-video');
  const controlsContainer = document.getElementById('custom-controls');
  const overlayContainer = document.getElementById('overlay-container');
  
  if (!video || !controlsContainer) {
    console.error('🎬 Required elements not found');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  
  // Create PeekPlayer instance
  const logHook = (name, payload) => console.log(`🎛 ${name}:`, payload);

  const player = new PeekPlayer({
    videoElement: video,
    controlsContainer: controlsContainer,
    overlayContainer: overlayContainer,
    controls: {
      skipNext: false,
    },
    onPlaybackChange: (playing) => logHook('playbackChange', { playing }),
    onSeek: (newTime, delta, pct) => {
      const payload = typeof newTime === 'number'
        ? { currentTime: newTime, delta, pct }
        : { time: newTime };
      logHook('seek', payload);
    },
    onVolumeChange: (volume) => logHook('volumeChange', { volume }),
    onTimeUpdate: (currentTime, duration) => logHook('timeUpdate', { currentTime, duration }),
    onFullscreen: (isFullscreen) => logHook('fullscreen', { isFullscreen }),
    onPipChange: (isPipEnabled) => logHook('pipChange', { isPipEnabled }),
    onQualityChange: (qualityLabel) => logHook('qualityChange', { qualityLabel }),
    onSkip: (value) => logHook('skip', { value }),
  });

  // Load sources from URL parameters or use defaults
  const sourcesData = await fetchSourcesData(params);
  
  if (sourcesData?.sources?.length) {
    try {
      await player.loadSources(sourcesData.sources, sourcesData.headers || {});
      console.log('🎬 Demo player initialized successfully');
    } catch (error) {
      console.error('🎬 Failed to initialize demo player:', error);
    }
  } else {
    console.warn('🎬 No sources available for demo');
  }

  // Handle subtitle parameter (if needed in future)
  const subtitleUrl = params.get('subtitle');
  if (subtitleUrl) {
    // TODO: Implement subtitle loading
    console.log('🎬 Subtitle URL provided:', subtitleUrl);
  }

  // Make player available globally for debugging
  window.peekPlayer = player;
});
