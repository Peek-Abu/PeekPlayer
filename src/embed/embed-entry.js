// Embed entry point - self-contained for iframe usage
import { setupOverlayControls } from '../core/controls.js';
import { HLSWrapper } from '../engines/hls-wrapper.js';
import { assertExists } from '../utils/assert.js';

// Global player state for compatibility
let playerState = {
    isFirstTimePlaying: true,
    ready: false,
    playing: false,
    paused: true,
    currentTime: 0,
    duration: 0,
    volume: 1,
    muted: false,
    error: null
};

// Settings from URL parameters
let playerSettings = {
    autoplay: false,
    autonext: false,
    autoskip: false,
    startTime: 0,
    title: '',
    episodeNumber: null,
    aId: null
};

// Global references
let video = null;
let engine = null;
let controlsCleanup = null;

// PostMessage communication with parent
function sendMessage(type, data = {}) {
    if (window.parent && window.parent !== window) {
        window.parent.postMessage({
            type: `player:${type}`,
            data: { ...data, timestamp: Date.now() }
        }, '*');
    }
}

// Listen for commands from parent
window.addEventListener('message', (event) => {
    if (!event.data || !event.data.type || !event.data.type.startsWith('player:')) {
        return;
    }

    const { type, data } = event.data;
    const command = type.replace('player:', '');

    if (!video) return;

    switch (command) {
        case 'play':
            video.play();
            break;
        case 'pause':
            video.pause();
            break;
        case 'seek':
            const newTime = data.currentTime || video.currentTime + (data.offset || 0);
            video.currentTime = Math.max(0, Math.min(video.duration || 0, newTime));
            break;
        case 'setVolume':
            video.volume = Math.max(0, Math.min(1, data.volume || 0));
            break;
        case 'setCurrentTime':
            video.currentTime = data.time || 0;
            break;
    }
});

// Update player state and notify parent
function updatePlayerState() {
    if (!video) return;

    const newState = {
        ready: playerState.ready,
        playing: !video.paused,
        paused: video.paused,
        currentTime: video.currentTime || 0,
        duration: video.duration || 0,
        volume: video.volume,
        muted: video.muted,
        error: playerState.error
    };

    // Only send update if state changed
    if (JSON.stringify(newState) !== JSON.stringify(playerState)) {
        playerState = newState;
        sendMessage('stateUpdate', playerState);
    }
}

// Parse URL parameters and convert to PeekPlayer format
function parseVideoParams() {
    const params = new URLSearchParams(window.location.search);
    
    // Parse settings
    playerSettings.autoplay = params.get('autoplay') === 'true';
    playerSettings.autonext = params.get('autonext') === 'true';
    playerSettings.autoskip = params.get('autoskip') === 'true';
    playerSettings.title = params.get('title') || '';
    playerSettings.episodeNumber = params.get('episode_number') ? parseInt(params.get('episode_number')) : null;
    playerSettings.aId = params.get('a_id') || null;
    const startTimeParam = params.get('startTime');
    playerSettings.startTime = startTimeParam ? parseFloat(startTimeParam) : 0;

    // Parse poster/thumbnail
    const posterUrl = params.get('poster') || params.get('thumbnail') || params.get('banner');
    
    // Parse video sources - convert from Video.js format to PeekPlayer format
    const sources = [];
    
    // Single video URL (backward compatibility)
    let videoUrl = params.get('video');
    if (videoUrl) {
        sources.push({
            url: videoUrl.replace(/ /g, '+'),
            quality: 'Auto',
            height: 720,
            displayName: 'Auto'
        });
    }
    
    // Multiple quality streams: quality_subs+·+720p, quality_yameii+·+1080p+eng, etc.
    params.forEach((value, key) => {
        if (key.startsWith('quality_')) {
            const qualityString = decodeURIComponent(key.replace('quality_', ''));
            
            // Extract resolution (look for patterns like 360p, 720p, 1080p)
            const resolutionMatch = qualityString.match(/(\d+)p/);
            const height = resolutionMatch ? parseInt(resolutionMatch[1]) : 720;
            
            // Use the full decoded quality string as display name
            const displayName = qualityString.replace(/\+/g, ' ');
            
            sources.push({
                url: value.replace(/ /g, '+'),
                quality: qualityString,
                height: height,
                displayName: displayName
            });
        }
    });

    // Parse subtitle tracks (for future implementation)
    const subtitleTracks = [];
    
    // Single subtitle (backward compatibility)
    let subtitleUrl = params.get('subtitle');
    if (subtitleUrl) {
        subtitleTracks.push({
            src: subtitleUrl.replace(/ /g, '+'),
            kind: 'subtitles',
            srclang: 'en',
            label: 'English'
        });
    }
    
    // Multiple subtitle tracks: subtitle_en, subtitle_es, subtitle_fr, etc.
    params.forEach((value, key) => {
        if (key.startsWith('subtitle_') && key !== 'subtitle') {
            const lang = key.replace('subtitle_', '');
            const langNames = {
                'en': 'English', 'es': 'Spanish', 'fr': 'French',
                'de': 'German', 'it': 'Italian', 'pt': 'Portuguese',
                'ja': 'Japanese', 'ko': 'Korean', 'zh': 'Chinese'
            };
            
            subtitleTracks.push({
                src: value.replace(/ /g, '+'),
                kind: 'subtitles',
                srclang: lang,
                label: langNames[lang] || lang.toUpperCase()
            });
        }
    });

    return { 
        sources, 
        subtitleTracks, 
        posterUrl,
        headers: {}
    };
}

// Notification system
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Show notification
    setTimeout(() => notification.classList.add('show'), 100);

    // Hide and remove notification
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Initialize PeekPlayer
async function initializePeekPlayer() {
    try {
        const { sources, subtitleTracks, posterUrl, headers } = parseVideoParams();
        
        if (sources.length === 0) {
            throw new Error('No video URL provided. Use ?video=URL or ?quality_720p=URL etc.');
        }

        video = document.getElementById('peek-video');
        const container = document.getElementById('custom-controls');
        
        assertExists(video, 'video element');
        assertExists(container, 'controls container');

        // Set poster if provided
        if (posterUrl) {
            video.poster = posterUrl;
        }

        // Initialize HLS engine
        engine = new HLSWrapper(video);
        
        // Set sources data for quality selector
        engine.setSourcesData({ sources, headers });
        
        // Initialize with first source
        const initialUrl = sources[0].url;
        await engine.initialize(initialUrl);

        // Setup controls with hooks
        const hooks = {
            onPlay: () => video.play(),
            onPause: () => video.pause(),
            onSeek: (time) => video.currentTime = time,
            onVolumeChange: (volume) => video.volume = volume,
            onMute: () => video.muted = !video.muted,
            onFullscreen: () => {
                if (document.fullscreenElement) {
                    document.exitFullscreen();
                } else {
                    document.getElementById('player-wrapper').requestFullscreen();
                }
            },
            player: engine
        };

        controlsCleanup = setupOverlayControls(video, container, hooks);

        // Set up video event listeners for PostMessage API
        setupVideoEventListeners();

        // Mark as ready
        playerState.ready = true;
        
        // Send ready message to parent
        sendMessage('ready', {
            ...playerState,
            qualities: sources.map(s => s.displayName),
            subtitles: subtitleTracks.map(s => s.label),
            hasMultipleQualities: sources.length > 1,
            hasMultipleSubtitles: subtitleTracks.length > 1,
            settings: playerSettings
        });

        // Set up periodic state updates
        setInterval(updatePlayerState, 1000);

        console.log('🎬 PeekPlayer initialized successfully');

    } catch (error) {
        console.error('🎬 PeekPlayer initialization failed:', error);
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = `Error: ${error.message}`;
        document.body.appendChild(errorDiv);
        
        sendMessage('error', { message: error.message });
    }
}

// Set up video event listeners for PostMessage compatibility
function setupVideoEventListeners() {
    video.addEventListener('play', () => {
        playerState.playing = true;
        playerState.paused = false;
        playerState.isFirstTimePlaying = false;
        sendMessage('play', playerState);
    });

    video.addEventListener('pause', () => {
        playerState.playing = false;
        playerState.paused = true;
        sendMessage('pause', playerState);
    });

    video.addEventListener('ended', () => {
        playerState.playing = false;
        playerState.paused = true;
        sendMessage('ended', { ...playerState, autoNext: playerSettings.autonext });
        
        if (playerSettings.autonext) {
            setTimeout(() => {
                sendMessage('requestNextEpisode', { autoAdvanced: true });
            }, 2000);
        }
    });

    video.addEventListener('timeupdate', () => {
        playerState.currentTime = video.currentTime || 0;
        sendMessage('timeupdate', { 
            currentTime: playerState.currentTime,
            duration: playerState.duration,
            progress: playerState.duration ? (playerState.currentTime / playerState.duration) : 0
        });
    });

    video.addEventListener('seeked', () => {
        const currentTime = video.currentTime;
        sendMessage('seek', { 
            currentTime: currentTime,
            timestamp: Date.now()
        });
    });

    video.addEventListener('volumechange', () => {
        playerState.volume = video.volume;
        playerState.muted = video.muted;
        sendMessage('volumechange', { volume: playerState.volume, muted: playerState.muted });
    });

    video.addEventListener('error', (e) => {
        const errorMsg = video.error ? video.error.message || `Video error (${video.error.code})` : 'Unknown video error';
        playerState.error = errorMsg;
        sendMessage('error', { message: errorMsg, code: video.error?.code });
    });

    video.addEventListener('loadedmetadata', () => {
        playerState.duration = video.duration || 0;
        if (playerSettings.startTime > 0 && playerSettings.startTime < playerState.duration) {
            video.currentTime = playerSettings.startTime;
            sendMessage('startTimeSet', { 
                startTime: playerSettings.startTime,
                currentTime: video.currentTime
            });
        }
        
        sendMessage('loadedmetadata', { duration: playerState.duration });
    });
}

// Handle window focus/blur for better parent communication
window.addEventListener('focus', () => {
    sendMessage('focus', { focused: true });
});

window.addEventListener('blur', () => {
    sendMessage('blur', { focused: false });
});

// Global notification function for quality selector
window.showNotification = showNotification;

// Send initial load message
sendMessage('load', { 
    url: window.location.href,
    settings: playerSettings,
    player: 'PeekPlayer'
});

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializePeekPlayer);

// Export for potential external usage
window.PeekPlayerEmbed = {
    initializePeekPlayer,
    sendMessage,
    playerState,
    playerSettings
};
