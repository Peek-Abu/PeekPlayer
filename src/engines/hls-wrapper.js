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
        // Live tuning. lowLatencyMode stays off by default — it is a real
        // win on streams that publish partial segments and a source of
        // stalling on the many that do not. Callers opt in via hlsConfig.
        liveSyncDurationCount: 3,
        liveDurationInfinity: true,
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

        const levels = Array.isArray(this.hls.levels) ? this.hls.levels : [];
        if (levels.length) {
          const mappedSources = levels
            .map((level, index) => {
              const levelUrl = Array.isArray(level.url) ? level.url[0] : level.url;
              if (!levelUrl) return null;
              const height = level.height || 0;
              const width = level.width || 0;
              const bandwidth = level.maxBitrate || level.bitrate || level.averageduration || 0;
              const displayName = level.name || (height ? `${height}p` : bandwidth ? `${Math.round(bandwidth / 1000)} kbps` : `Level ${index + 1}`);

              return {
                url: levelUrl,
                quality: displayName,
                displayName,
                height,
                width,
                bandwidth,
                index,
                hlsLevel: index
              };
            })
            .filter(Boolean);

          if (mappedSources.length) {
            const sourcesData = {
              headers: this.sourcesData?.headers || {},
              sources: mappedSources
            };
            this.setSourcesData(sourcesData);
            this.video.dispatchEvent(new CustomEvent('peekplayer:hls-levels', { detail: sourcesData }));
          }
        }
      });

      this.hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        const levelIndex = typeof data?.level === 'number' ? data.level : this.hls?.currentLevel;
        if (typeof levelIndex !== 'number' || levelIndex < 0) {
          return;
        }

        const sources = this.sourcesData?.sources || [];
        const matchingSource = sources.find((source) =>
          typeof source.hlsLevel === 'number' ? source.hlsLevel === levelIndex : source.index === levelIndex
        ) || sources[levelIndex];

        this.video.dispatchEvent(new CustomEvent('peekplayer:hls-level-switch', {
          detail: {
            levelIndex,
            source: matchingSource || null
          }
        }));
      });

      // A live level tells us the stream is live and how much rewind it
      // offers. Dispatched rather than returned because the controls are built
      // before the manifest is parsed.
      this.hls.on(Hls.Events.LEVEL_LOADED, (_event, data) => {
        const details = data?.details;
        if (!details) return;
        this.video.dispatchEvent(new CustomEvent('peekplayer:live-state', {
          detail: {
            isLive: !!details.live,
            dvrWindow: Number.isFinite(details.totalduration) ? details.totalduration : 0,
            targetDuration: details.targetduration || 0
          }
        }));
      });

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        this.logger.error('🎬 HLS Error:', data);
        if (!data?.fatal) return;

        // Live streams drop segments routinely — a flaky origin, a mid-stream
        // rendition change, a network blip. Without recovery a single fatal
        // error ends playback for good, which on a live stream means the
        // viewer has simply lost the broadcast.
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            this.logger.warn('🎬 Fatal network error, restarting load');
            this.hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            this.logger.warn('🎬 Fatal media error, recovering');
            this.hls.recoverMediaError();
            break;
          default:
            this.logger.error('🎬 Unrecoverable HLS error');
            this.video.dispatchEvent(new CustomEvent('peekplayer:fatal-error', { detail: data }));
            break;
        }
      });
      this.hls.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_evt, data) => {
        this.logger.log('🎬 Subtitle tracks updated:', data);
        const tracks = data.subtitleTracks || [];
        this.video.dispatchEvent(new CustomEvent('peekplayer:subtitle-tracks', {
          detail: tracks.map(({ name, lang, url, default: isDefault }, index) => ({
            id: index,
            label: name || lang?.toUpperCase() || `Track ${index + 1}`,
            language: lang,
            src: url,
            default: !!isDefault
          }))
        }));
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

  async switchLevel(levelIndex) {
    if (this.hls && typeof levelIndex === 'number' && levelIndex >= 0) {
      this.hls.currentLevel = levelIndex;
      return this;
    }
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
