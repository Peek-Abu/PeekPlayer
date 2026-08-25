// Demo-specific initialization logic
import { PeekPlayer } from '../dist/peekplayer.esm.js';
function initMobileDebugger() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.has('debug')) {
      return;
    }

    import('https://cdn.jsdelivr.net/npm/eruda@3.0.0/eruda.min.js')
      .then(() => {
        if (window.eruda && typeof window.eruda.init === 'function') {
          window.eruda.init();
          console.log('🎬 Eruda mobile debugger initialized');
        }
      })
      .catch((error) => {
        console.error('🎬 Failed to load Eruda debugger script', error);
      });
  } catch (error) {
    console.error('🎬 Mobile debugger setup failed', error);
  }
}

initMobileDebugger();

function formatNumber(value) {
  return Number.isFinite(value) ? Number(value).toFixed(3) : 'NaN';
}

function describeTimeRanges(ranges) {
  if (!ranges || typeof ranges.length !== 'number' || ranges.length === 0) {
    return 'none';
  }
  try {
    const parts = [];
    for (let i = 0; i < ranges.length; i += 1) {
      parts.push(`${formatNumber(ranges.start(i))}-${formatNumber(ranges.end(i))}`);
    }
    return parts.join(', ');
  } catch (error) {
    return `unavailable (${error?.message || error})`;
  }
}

function createScrubDiagnostics(video, params) {
  if (!params || !params.has('debug') || !video) {
    return {
      attachEngine: () => {},
      cleanup: () => {}
    };
  }

  const log = (label, payload = {}) => {
    console.log('🎯 ScrubDiag', label, {
      ...payload,
      currentTime: formatNumber(video.currentTime),
      duration: formatNumber(video.duration),
      readyState: video.readyState,
      networkState: video.networkState,
      paused: video.paused,
      ended: video.ended,
      playbackRate: video.playbackRate,
      buffered: describeTimeRanges(video.buffered),
      seekable: describeTimeRanges(video.seekable)
    });
  };

  const handlerCleanup = [];
  const throttles = {
    timeupdate: 0,
    progress: 0
  };

  const addHandler = (eventName, handler) => {
    const wrapped = (event) => handler(eventName, event);
    video.addEventListener(eventName, wrapped);
    handlerCleanup.push(() => video.removeEventListener(eventName, wrapped));
  };

  const baseHandler = (label) => () => log(label);

  addHandler('seeking', baseHandler('seeking'));
  addHandler('seeked', baseHandler('seeked'));
  addHandler('waiting', baseHandler('waiting'));
  addHandler('stalled', baseHandler('stalled'));
  addHandler('suspend', baseHandler('suspend'));
  addHandler('emptied', baseHandler('emptied'));
  addHandler('loadstart', baseHandler('loadstart'));
  addHandler('loadedmetadata', baseHandler('loadedmetadata'));
  addHandler('loadeddata', baseHandler('loadeddata'));
  addHandler('canplay', baseHandler('canplay'));
  addHandler('canplaythrough', baseHandler('canplaythrough'));
  addHandler('play', baseHandler('play'));
  addHandler('playing', baseHandler('playing'));
  addHandler('pause', baseHandler('pause'));
  addHandler('ended', baseHandler('ended'));

  addHandler('timeupdate', () => {
    const now = Date.now();
    if (now - throttles.timeupdate > 1500) {
      throttles.timeupdate = now;
      log('timeupdate');
    }
  });

  addHandler('progress', () => {
    const now = Date.now();
    if (now - throttles.progress > 1500) {
      throttles.progress = now;
      log('progress');
    }
  });

  addHandler('error', () => {
    const mediaError = video.error;
    log('error', {
      error: mediaError ? {
        code: mediaError.code,
        message: mediaError.message
      } : 'none'
    });
  });

  const intervalId = window.setInterval(() => {
    log('poll');
  }, 5000);

  const engineCleanup = [];

  const attachEngine = (engine) => {
    if (!engine) {
      log('engine-missing');
      return;
    }

    const engineLabel = engine.constructor && engine.constructor.name ? engine.constructor.name : typeof engine;
    log('engine-attached', { engine: engineLabel });

    const hlsInstance = engine.hls;
    const HlsClass = typeof window !== 'undefined' ? (window.Hls || window.hls || globalThis.Hls) : null;

    if (hlsInstance && HlsClass && HlsClass.Events && typeof hlsInstance.on === 'function' && typeof hlsInstance.off === 'function') {
      const hlsEvents = ['ERROR', 'BUFFER_STALLED', 'BUFFER_EOS', 'FRAG_BUFFERED', 'FRAG_LOAD_EMERGENCY_ABORTED'];
      hlsEvents.forEach((eventKey) => {
        const eventConst = HlsClass.Events[eventKey];
        if (!eventConst) return;
        const handler = (event, data) => {
          log(`hls:${eventKey.toLowerCase()}`, {
            details: data?.details,
            reason: data?.reason,
            error: data?.error?.message || data?.error,
            frag: data?.frag ? {
              sn: data.frag.sn,
              start: data.frag.start,
              duration: data.frag.duration,
              relurl: data.frag.relurl
            } : undefined
          });
        };
        hlsInstance.on(eventConst, handler);
        engineCleanup.push(() => hlsInstance.off(eventConst, handler));
      });
    }
  };

  const cleanup = () => {
    handlerCleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn('🎯 ScrubDiag cleanup error', error);
      }
    });
    engineCleanup.forEach((fn) => {
      try {
        fn();
      } catch (error) {
        console.warn('🎯 ScrubDiag engine cleanup error', error);
      }
    });
    handlerCleanup.length = 0;
    engineCleanup.length = 0;
    window.clearInterval(intervalId);
  };

  log('diagnostics-ready');

  return { attachEngine, cleanup };
}

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
        url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
        quality: "Sub · 1080p" 
      }
    ],
    // subtitleTracks: [
    //   { src: '/subs/episode1-en.vtt', srclang: 'en', label: 'English', default: true },
    //   { src: '/subs/episode1-es.vtt', srclang: 'es', label: 'Spanish' }
    // ]  
  };
}

// Demo initialization
document.addEventListener("DOMContentLoaded", async () => {
  const wrapper = document.querySelector('.peekplayer-wrapper');
  const video = wrapper?.querySelector('.peekplayer-video');
  const controlsContainer = wrapper?.querySelector('.peekplayer-controls');
  const overlayContainer = wrapper?.querySelector('.peekplayer-overlay');
  
  if (!video || !controlsContainer) {
    console.error('🎬 Required elements not found');
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const scrubDiagnostics = createScrubDiagnostics(video, params);

  // Create PeekPlayer instance
  const logHook = (name, payload) => console.log(`🎛 ${name}:`, payload);

  const player = new PeekPlayer({
    videoElement: video,
    controlsContainer: controlsContainer,
    overlayContainer: overlayContainer,
    playerWrapper: wrapper,
    // autoplay: true,
    autoNext: true,
    // autoUnmuteOnInteraction: true,
    poster: 'https://dummyimage.com/1920x1080/000/fff&text=PeekPlayer',
    debug: true,
    engine: 'hls',
    nativeControlsForMobile: false,
    controls: {
      skipNext: false,
    },
    segments: [
      { start: 0, end: 95, label: 'Intro'  },
      // { start: 30, end: 120, label: 'Episode' },
      { start: 500, end: 600, label: 'Outro' }
    ],
    segmentAutoSkip: {
      labels: ['Intro'],
      tolerance: 0.25,
      offsetAfter: 1.5,
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
  
  const subtitleTracks = sourcesData.subtitleTracks || [];
  if (sourcesData?.sources?.length) {
    try {
      await player.loadSources(sourcesData.sources, sourcesData.headers || {});
      console.log('🎬 Demo player initialized successfully');
      scrubDiagnostics.attachEngine(player.getEngine?.() || player.engine || video._engine || null);
    } catch (error) {
      console.error('🎬 Failed to initialize demo player:', error);
    }
  } else {
    console.warn('🎬 No sources available for demo');
  }

  // Handle subtitle parameter (if needed in future)
  const subtitleUrl = params.get('subtitle');
  if (subtitleUrl) {
    const track = document.createElement('track');
    track.dataset.peekplayer = 'subtitle';
    track.kind = 'subtitles';
    track.src = subtitleUrl;
    track.srclang = 'en';
    track.label = 'English';
    track.default = true;
    video.appendChild(track);
    // TODO: Implement subtitle loading
    console.log('🎬 Subtitle URL provided:', subtitleUrl);
  }

  subtitleTracks.forEach(({ src, srclang, label, default: isDefault }) => {
    const track = document.createElement('track');
    track.dataset.peekplayer = 'subtitle';
    track.kind = 'subtitles';
    track.src = src;
    track.srclang = srclang;
    track.label = label;
    if (isDefault) track.default = true;
    video.appendChild(track);
  });
  // Make player available globally for debugging
  window.peekPlayer = player;

  window.playerRefreshControls = () => player.refreshControls();
  window.scrubDiagnostics = scrubDiagnostics;
});
