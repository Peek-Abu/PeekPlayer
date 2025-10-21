# PeekPlayer 🎬
A professional HTML5 video player built from scratch with HLS support, custom controls, and multi-quality streaming. 

## Features

- **HLS Streaming** - M3U8 support with HLS.js v1.5.20
- **Multi-Quality Selector** - Seamless quality switching
- **Custom Controls** - Professional UI with tooltips
- **Keyboard Shortcuts** - Spacebar, arrows, F, M
- **Mobile Friendly** - Touch gestures and responsive
- **Auto Unmute** - Unmute on user interaction
- **Auto Next** - Auto play next video in playlist
- **Segmentation** - Segmented video playback
- **Embed Support** - Easy iframe integration

## Installation

```bash
npm install @peekabu/peekplayer
```

## Usage

```html
<link rel="stylesheet" href="node_modules/@peekabu/peekplayer/style.css">

<div id="player-wrapper">
    <video id="peek-video" preload="auto" crossorigin=""></video>
    <div id="custom-controls"></div>
    <div id="overlay-container"></div>
</div>

<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js"></script>
<script src="node_modules/@peekabu/peekplayer/dist/peekplayer.js"></script>

<script>
const player = new PeekPlayer({
    videoElement: document.getElementById('peek-video'),
    controlsContainer: document.getElementById('custom-controls'),
    overlayContainer: document.getElementById('overlay-container')
});

player.loadSource('https://example.com/video.m3u8');
</script>
```

## Multi-Quality Sources

```javascript
player.loadSources([
    { url: 'video-720p.m3u8', quality: '720p', provider: 'CDN1' },
    { url: 'video-1080p.m3u8', quality: '1080p', provider: 'CDN2' }
]);

// Switch quality programmatically
player.switchQuality('1080p'); // by quality name
player.switchQuality(0);       // by index (0 = highest quality)
```

## API Methods

- `loadSource(url, headers?)` - Load single video source
- `loadSources(sources[], headers?)` - Load multiple quality sources  
- `switchQuality(quality|index)` - Switch between qualities
- `getSources()` - Get available sources
- `destroy()` - Clean up player resources

## Customizing Controls & Callbacks

When instantiating `PeekPlayer`, you can provide:

```javascript
const player = new PeekPlayer({
  videoElement: document.querySelector('video'),
  controlsContainer: document.getElementById('custom-controls'),
  overlayContainer: document.getElementById('overlay-container'),
  controls: {
    skipPrevious: false,
    skipNext: false,
    quality: true
  },
  onPlaybackChange: (playing) => console.log('Playback state:', playing),
  onSeek: (newTime, delta) => console.log('Seeked to:', newTime ?? delta),
  onVolumeChange: (volume) => console.log('Volume:', volume),
  onQualityChange: (qualityLabel) => console.log('Quality:', qualityLabel)
});
```

Control visibility is handled via the `controls` object, while interactive lifecycle hooks (playback, seeking, fullscreen, etc.) are passed as top-level callback options. Internally, the player forwards these as `{ callbacks, controls, context }` to `setupOverlayControls()` for a clear separation of behavior, configuration, and context.

## 🛠️ Development

```bash
npm run build    # Build for production
npm run dev      # Development with watch
npm run serve    # Local server
```

## Issue Tracking

<p align="center">
  <img src="docs/assets/Highfly-white-name.svg" alt="Highfly logo" height="60" />
</p>

PeekPlayer tracks bugs and feature requests in [Highfly](https://highfly.app). The issue board lives in the PeekPlayer workspace, where feature requests are tagged by release milestone and bugs receive severity labels.


## 📄 License

MIT
