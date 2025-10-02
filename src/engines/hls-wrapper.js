// Native HLS Engine Wrapper
export class HLSWrapper {
  constructor(videoElement) {
    this.video = videoElement;
    this.hls = null;
    this.sourcesData = null;
  }

  async initialize(hlsUrl) {
    console.log('🎬 Initializing HLS Engine');

    // Check if browser supports HLS natively (Safari/iOS)
    if (this.video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('🎬 Using native HLS support');
      this.video.src = hlsUrl;
      return this;
    }

    // Use HLS.js for other browsers
    if (window.Hls && Hls.isSupported()) {
      console.log('Using HLS.js');
      this.hls = new Hls({
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
      });

      this.hls.loadSource(hlsUrl);
      this.hls.attachMedia(this.video);

      // Event listeners
      this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('🎬 HLS manifest parsed');
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        console.error('🎬 HLS Error:', data);
      });

      return this;
    }

    // Fallback to direct URL
    console.log('🎬 Using direct URL fallback');
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
