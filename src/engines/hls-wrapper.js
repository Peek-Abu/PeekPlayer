import Hls from 'hls.js';

// Native HLS Engine Wrapper
export class HLSWrapper {
  constructor(videoElement, hlsConfig = {}, logger, options = {}) {
    this.video = videoElement;
    this.hls = null;
    this.sourcesData = null;
    this.hlsConfig = hlsConfig;
    this.logger = logger;
    this.useNativeIfSupported = options.useNativeIfSupported !== undefined ? options.useNativeIfSupported : true;
  }

  async initialize(hlsUrl) {
    this.logger.log('🎬 Initializing HLS Engine', hlsUrl);

    // Check if browser supports HLS natively (Safari/iOS)
    if (this.useNativeIfSupported && this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.logger.log('🎬 Using native HLS support');
      this.video.src = hlsUrl;
      return this;
    }

    // Use HLS.js for other browsers
    if (Hls && typeof Hls.isSupported === 'function' && Hls.isSupported()) {
      const defaultConfig = {
        enableWorker: true,
        lowLatencyMode: false,
        // Encryption and codec handling
        enableSoftwareAES: true, // Handle AES-128 encryption better
        maxBufferLength: 30,
        maxMaxBufferLength: 600,
        // More lenient parsing
        manifestLoadingTimeOut: 10000,
        manifestLoadingMaxRetry: 4,
        levelLoadingTimeOut: 10000,
        fragLoadingTimeOut: 20000,
        // Audio codec handling
        audioCodecSwitch: true,
        forceKeyFrameOnDiscontinuity: true,
        // Debug mode
        debug: false,
        // Handle encrypted streams better
        emeEnabled: true,
      }
      this.hls = new Hls({
        ...defaultConfig,
        ...this.hlsConfig
      });

      this.hls.loadSource(hlsUrl);
      this.hls.attachMedia(this.video);

      // Event listeners
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        this.logger.log('🎬 HLS manifest parsed');
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        this.logger.error('🎬 HLS Error:', data);
      });

      return this;
    }

    // Fallback to direct URL
    if (!Hls) {
      this.logger.error('🎬 Hls.js not found in bundle; falling back to direct URL');
    } else {
      this.logger.warn('🎬 Hls.js not supported in this environment; falling back to direct URL');
    }
    this.video.src = hlsUrl;
    return this;
  }

  // Unified API methods
  setSourcesData(sourcesData) {
    this.sourcesData = sourcesData;
  }

  getSourcesData() {
    return this.sourcesData;
  }

  async switchSource(newUrl) {
    const currentTime = this.video.currentTime;
    
    if (this.hls) {
      this.hls.loadSource(newUrl);
    } else {
      this.video.src = newUrl;
    }

    // Restore playback position
    this.video.addEventListener('loadedmetadata', () => {
      this.video.currentTime = currentTime;
    }, { once: true });

    return this;
  }

  destroy() {
    if (this.hls) {
      this.hls.destroy();
      this.hls = null;
    }
  }

  // Getters for compatibility
  get tech_() {
    return { el_: this.video };
  }
}
