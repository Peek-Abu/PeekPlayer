# PeekPlayer Examples

This directory contains example implementations of PeekPlayer.

## Examples

### 1. Basic Example (`basic.html`) - ES Modules
- **Engine**: Auto-detects (MP4 → native, .m3u8 → HLS)
- **Requires**: HTTP server (CORS issues with file://)
- **Best for**: Modern development, bundlers

### 2. Basic UMD Example (`basic-umd.html`) - UMD Bundle
- **Engine**: Same auto-detection as basic
- **Requires**: Can open directly in browser
- **Best for**: Simple integration, no bundler needed

### 3. HLS Example (`hls-example.html`) - HLS Streaming
- **Engine**: Auto-detects HLS from .m3u8 URL
- **Best for**: Live streams, adaptive bitrate
- **Features**: Multi-quality streaming

### 4. Development Example (`development.html`) - Advanced
- **Purpose**: Development with URL parameters
- **Features**: Custom sources via URL params
- **Best for**: Testing different videos

### 5. Embed Template (`embed.html`) - Template
- **Purpose**: Template for iframe embedding
- **Uses**: Template variables like `{{CSS_PATH}}`
- **Best for**: Embedded players

## Running Examples

### For Basic Example
1. Build the library: `npm run build`
2. Serve the examples directory with a local server
3. Open `basic.html`

### For Development Example
1. Serve the project root directory
2. Open `examples/development.html`

## URL Parameters (Development Example)

- `?sources=[JSON]` - Load custom video sources(example in the future)
- `?api=[URL]` - Load sources from API endpoint
- `?subtitle=[URL]` - Load subtitle file (future feature)

### Example URLs
```
# Custom sources
examples/development.html?sources=[{"url":"video.mp4","quality":"1080p"}]

# API endpoint
examples/development.html?api=https://api.example.com/video-sources
```
