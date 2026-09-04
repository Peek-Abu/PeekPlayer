import Hls from 'hls.js';

/**
 * Consecutive recovery attempts allowed before playback is declared dead.
 *
 * Reset whenever a fragment actually loads, so a long broadcast that hiccups
 * repeatedly keeps recovering; the cap only catches a source that never comes
 * back.
 */
const MAX_RECOVERY_ATTEMPTS = 5;

// Native HLS Engine Wrapper
export class HLSWrapper {
  constructor(videoElement, hlsConfig = {}, logger, options = {}) {
    this.video = videoElement;
    this.hls = null;
    this.sourcesData = null;
    this.hlsConfig = hlsConfig;
    this.logger = logger;
    // Opt-in, not the default. See initialize() for why.
    this.useNativeIfSupported = options.useNativeIfSupported === true;
  }

  async initialize(hlsUrl) {
    this.logger.log('🎬 Initializing HLS Engine', hlsUrl);

    const hlsJsUsable = !!Hls && typeof Hls.isSupported === 'function' && Hls.isSupported();

    /**
     * Native HLS, for browsers that genuinely have it — iOS Safari above all,
     * where MSE is absent and hls.js cannot run.
     *
     * `canPlayType` alone is not enough to decide this. Chromium answers
     * "maybe" for application/vnd.apple.mpegurl despite having no native HLS,
     * so preferring native on a truthy answer handed Chrome a text playlist as
     * `video.src` and playback died with DEMUXER_ERROR_COULD_NOT_PARSE.
     *
     * Native is therefore taken in exactly two cases: hls.js cannot run (iOS
     * Safari, where `Hls.isSupported()` is false for want of MSE), or the
     * caller asked for it with `engine: 'native'`. Otherwise hls.js drives —
     * the order hls.js's own documentation recommends.
     */
    if ((!hlsJsUsable || this.useNativeIfSupported) && this.video.canPlayType('application/vnd.apple.mpegurl')) {
      this.logger.log('🎬 Using native HLS support');
      this.video.src = hlsUrl;
      return this;
    }

    if (hlsJsUsable) {
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
        // A caller's own hlsConfig is spread over these, so passing the same
        // key replaces the default outright. That matters most for
        // liveDurationInfinity: it is what makes `duration` report Infinity,
        // which is how every live helper here recognises a live source. Pass
        // `liveDurationInfinity: false` and live detection goes quiet — no
        // badge, no DVR scrubber, a "0:00" total — with nothing to say why.
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

      // Recovery attempts since the last time anything actually loaded. A
      // stream that is simply gone — a 403, a pulled channel — reports a fatal
      // error every time we retry, so recovery has to give up eventually
      // rather than hammer a dead origin forever.
      let recoveryAttempts = 0;
      // Any sign of progress clears the count. Resetting only on FRAG_LOADED
      // was too strict: on a flaky live edge a handful of network errors can
      // land without a fragment completing in between, and the cap would then
      // give up on a stream that was still reachable. A playlist that reloads
      // is progress too.
      const noteProgress = () => { recoveryAttempts = 0; };
      this.hls.on(Hls.Events.FRAG_LOADED, noteProgress);
      this.hls.on(Hls.Events.LEVEL_LOADED, noteProgress);
      this.hls.on(Hls.Events.MANIFEST_PARSED, noteProgress);

      const giveUp = (data) => {
        this.logger.error('🎬 Unrecoverable HLS error');
        this.video.dispatchEvent(new CustomEvent('peekplayer:fatal-error', { detail: data }));
      };

      this.hls.on(Hls.Events.ERROR, (event, data) => {
        this.logger.error('🎬 HLS Error:', data);
        if (!data?.fatal) return;

        const recoverable =
          data.type === Hls.ErrorTypes.NETWORK_ERROR || data.type === Hls.ErrorTypes.MEDIA_ERROR;
        if (!recoverable) {
          giveUp(data);
          return;
        }

        if (recoveryAttempts >= MAX_RECOVERY_ATTEMPTS) {
          this.logger.error(`🎬 Giving up after ${recoveryAttempts} recovery attempts`);
          giveUp(data);
          return;
        }
        recoveryAttempts++;

        // Live streams drop segments routinely — a flaky origin, a mid-stream
        // rendition change, a network blip. Without recovery a single fatal
        // error ends playback for good, which on a live stream means the
        // viewer has simply lost the broadcast.
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          this.logger.warn(`🎬 Fatal network error, restarting load (${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`);
          this.hls.startLoad();
        } else {
          this.logger.warn(`🎬 Fatal media error, recovering (${recoveryAttempts}/${MAX_RECOVERY_ATTEMPTS})`);
          this.hls.recoverMediaError();
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
