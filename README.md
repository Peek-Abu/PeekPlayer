# PeekPlayer 🎬
A professional HTML5 video player built from scratch with HLS support, custom controls, and multi-quality streaming. 

## Features

- **HLS Streaming** - M3U8 support with HLS.js v1.5.20
- **Multi-Quality Selector** - Seamless quality switching
- **Custom Controls** - Professional UI with tooltips
- **Keyboard Shortcuts** - Spacebar, arrows, F, M
- **Mobile Friendly** - Touch gestures and responsive
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
```

## 🛠️ Development

```bash
npm run build    # Build for production
npm run dev      # Development with watch
npm run serve    # Local server
```

## 📄 License

MIT
