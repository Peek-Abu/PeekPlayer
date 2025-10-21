// Video.js Engine Wrapper
export class VideoJSWrapper {
  constructor(videoElement, logger) {
    this.video = videoElement;
    this.player = null;
    this.sourcesData = null;
    this.logger = logger;
  }

  async initialize(hlsUrl) {
    this.logger.log('🎬 Initializing Video.js Engine');

    this.player = videojs(this.video, {
      controls: false,
      fluid: false,
      responsive: false,
      fill: true,
      preload: 'metadata',
      playsinline: true,
      children: {
        mediaLoader: {},
      },
      sources: [{
        src: hlsUrl,
        type: 'application/x-mpegURL'
      }],
      html5: {
        vhs: {
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          overrideNative: true,
          xhr: {
            beforeRequest: (options) => {
              return options;
            }
          }
        }
      }
    });

    this.player.ready(() => {
        this.logger.log('🎬 Video.js tech:', this.player.tech_.name_);
        this.logger.log('🎬 Video.js source:', this.player.currentSrc());

        // Log what Video.js is actually trying to play
        this.player.on('loadstart', () => {
            this.logger.log('🎬 Video.js loadstart:', this.player.currentSrc());
        });
    });
    return new Promise((resolve) => {
      this.player.ready(() => {
        this.logger.log('🎬 Video.js player ready');
        resolve(this);
      });
    });
  }

  // Unified API methods
  setSourcesData(sourcesData) {
    this.sourcesData = sourcesData;
    if (this.player) {
      this.player.sourcesData = sourcesData;
    }
  }

  getSourcesData() {
    return this.sourcesData;
  }

  async switchSource(newUrl) {
    if (this.player) {
      const currentTime = this.player.currentTime();
      this.player.src({
        src: newUrl,
        type: 'application/x-mpegURL'
      });
      
      this.player.one('loadedmetadata', () => {
        this.player.currentTime(currentTime);
      });
    }
    return this;
  }

  destroy() {
    if (this.player) {
      this.player.dispose();
      this.player = null;
    }
  }

  // Getters for compatibility
  get tech_() {
    return this.player ? this.player.tech_ : { el_: this.video };
  }
}
