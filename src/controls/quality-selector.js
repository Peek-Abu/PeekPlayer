import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
import { assertVideoElement, assertExists, assertType, assertFunction, assert } from '../utils/assert.js';

export function createQualitySelector(video, hooks = {}, logger) {
    const { player, onQualityChange } = hooks;
    // Assert required parameters
    assertVideoElement(video, { component: 'QualitySelector', method: 'createQualitySelector' });
    assertExists(player, 'player', { component: 'QualitySelector', method: 'createQualitySelector' });
    
    // Handle case where sourcesData is not yet available (during initialization)
    const sourcesData = player.sourcesData;
    if (!sourcesData) {
        logger.log('🎬 Quality selector: sourcesData not available yet, creating placeholder');
        // Return a hidden placeholder that will be updated later
        const container = document.createElement('div');
        container.className = 'quality-selector';
        container.style.display = 'none'; // Hide until sources are loaded
        
        return {
            element: container,
            cleanup: () => {}
        };
    }
    const container = document.createElement('div');
    container.className = 'quality-selector';
    const button = document.createElement('button');
    button.className = 'quality-button';
    button.style.pointerEvents = 'auto';
    button.setAttribute('aria-label', 'Quality settings');
    
    // Quality icon SVG
    button.innerHTML = ICONS.QUALITY;
    
    // Quality menu
    const menu = document.createElement('div');
    menu.className = 'quality-menu';
    menu.style.display = 'none';
    
    let isMenuOpen = false;
    let availableQualities = [];
    let currentQuality = 0; // Start with first quality
    let currentTime = 0;
    let wasPlaying = false;
    
    // Update quality display
    function updateQualityDisplay() {
        const quality = availableQualities[currentQuality];
        const qualityText = quality ? `${quality.height}p` : 'Auto';
        button.setAttribute('aria-label', `Quality: ${qualityText}`);
    }
    
    // Build quality menu
    function buildQualityMenu(qualities) {
        assert(
            Array.isArray(qualities),
            'qualities must be an array',
            { component: 'QualitySelector', method: 'buildQualityMenu', qualities }
        );
        assert(
            qualities.length > 0,
            'qualities array must not be empty',
            { component: 'QualitySelector', method: 'buildQualityMenu', qualities }
        );
        
        // Hide quality selector if only one quality available
        if (qualities.length <= 1) {
            container.style.display = 'none';
            logger.log('🎬 Only one quality available, hiding quality selector');
            return;
        } else {
            container.style.display = 'flex';
        }
        
        logger.log('🎬 Building quality menu with:', qualities);
        availableQualities = qualities;
        menu.innerHTML = '';
        
        // Add quality options
        qualities.forEach((quality, index) => {
            const option = document.createElement('button');
            option.className = 'quality-option';
            
        // Use the pre-processed displayName
        option.textContent = quality.displayName;
        
        option.onclick = () => selectQuality(index);
        menu.appendChild(option);
        });
        
        updateMenuSelection();
        logger.log('🎬 Quality menu built with', menu.children.length, 'options');
    }
    
    // Switch to different quality source
    const notifyQualityChange = (quality) => {
        if (!onQualityChange) return;
        const label = quality.displayName || quality.quality || `${quality.height}p`;
        onQualityChange(label);
    };

    function selectQuality(qualityIndex) {
        assertType(qualityIndex, 'number', 'qualityIndex', { 
            component: 'QualitySelector', 
            method: 'selectQuality' 
        });
        assert(
            qualityIndex >= 0 && qualityIndex < availableQualities.length,
            `qualityIndex must be between 0 and ${availableQualities.length - 1}`,
            { component: 'QualitySelector', method: 'selectQuality', qualityIndex, availableQualities }
        );
        
        if (qualityIndex === currentQuality) {
            closeMenu();
            return;
        }
        
        logger.log('🎬 Switching to quality:', qualityIndex, availableQualities[qualityIndex]);
        
        const newQuality = availableQualities[qualityIndex];
        assertExists(newQuality, 'newQuality', { 
            component: 'QualitySelector', 
            method: 'selectQuality', 
            qualityIndex, 
            availableQualities 
        });
        assertExists(newQuality.url, 'newQuality.url', { 
            component: 'QualitySelector', 
            method: 'selectQuality', 
            newQuality 
        });
        
        // Store current playback state
        if (video) {
            currentTime = video.currentTime || 0;
            wasPlaying = !video.paused;
        } else if (player) {
            currentTime = player.currentTime() || 0;
            wasPlaying = !player.paused();
        }
        
        currentQuality = qualityIndex;
        
        // Show loading notification
        showNotification(`Switching to ${newQuality.height}p...`, 'loading');
        
        // Switch source
        if (player) {
            assertFunction(player.switchQuality, 'player.switchQuality', {
                component: 'QualitySelector',
                method: 'selectQuality'
            });

            logger.log('🎬 Using player.switchQuality()');
            
            player.switchQuality(qualityIndex).then(() => {
                if (wasPlaying) {
                    video.play();
                }
                showNotification(`Quality: ${newQuality.height}p${newQuality.isDub ? ' (Dub)' : ''}`, 'success');
                notifyQualityChange(newQuality);
            }).catch(error => {
                logger.error('🎬 Quality switch failed:', error);
                showNotification('Quality switch failed', 'error');
            });
        } else if (video) {
            // Native video element method
            video.src = newQuality.url;
            video.load();
            
            video.addEventListener('loadedmetadata', () => {
                video.currentTime = currentTime;
                if (wasPlaying) {
                    video.play();
                }
                showNotification(`Quality: ${newQuality.height}p${newQuality.isDub ? ' (Dub)' : ''}`, 'success');
                notifyQualityChange(newQuality); // Added this line
            }, { once: true });
        }
        
        updateQualityDisplay();
        updateMenuSelection();
        closeMenu();
    }
    
    // Show notification
    function showNotification(message, type = 'info') {
        // Remove existing notifications
        const existing = document.querySelectorAll('.quality-notification');
        existing.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'quality-notification';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'loading' ? 'rgba(255, 193, 7, 0.9)' : 
                        type === 'success' ? 'rgba(40, 167, 69, 0.9)' : 
                        'rgba(0, 0, 0, 0.8)'};
            color: white;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            z-index: 10000;
            transition: opacity 0.3s ease;
            display: flex;
            align-items: center;
            gap: 8px;
        `;
        
        if (type === 'loading') {
            notification.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                ${message}
            `;
            
            // Add spin animation
            const style = document.createElement('style');
            style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
            document.head.appendChild(style);
        } else {
            notification.textContent = message;
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after delay (longer for loading)
        const delay = type === 'loading' ? 5000 : 2000;
        setTimeout(() => {
            if (notification.parentNode) {
                notification.style.opacity = '0';
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, delay);
    }
    
    // Update menu selection visual state
    function updateMenuSelection() {
        const options = menu.querySelectorAll('.quality-option');
        options.forEach((option, index) => {
            option.classList.toggle('selected', index === currentQuality);
        });
    }
    
    // Toggle menu
    function toggleMenu() {
        isMenuOpen = !isMenuOpen;
        menu.style.display = isMenuOpen ? 'block' : 'none';
        
        if (isMenuOpen) {
            const rect = button.getBoundingClientRect();
            menu.style.position = 'absolute';
            menu.style.bottom = '100%';
            menu.style.right = '0';
            menu.style.marginBottom = '8px';
        }
    }
    
    function closeMenu() {
        isMenuOpen = false;
        menu.style.display = 'none';
    }
    
    // Event listeners
    button.onclick = (e) => {
        e.stopPropagation();
        toggleMenu();
    };
    
    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!container.contains(e.target)) {
            closeMenu();
        }
    });
    
    // Initialize with sources data
    if (sourcesData && sourcesData.sources) {
        buildQualityMenu(sourcesData.sources);
    } else {
        // Fallback for demo
        logger.log('🎬 No sources provided, using demo qualities');
        const demoQualities = [
            { height: 1080, width: 1920, url: '', label: '1080p', isDub: false, index: 0 },
            { height: 720, width: 1280, url: '', label: '720p', isDub: false, index: 1 },
            { height: 480, width: 854, url: '', label: '480p', isDub: false, index: 2 }
        ];
        buildQualityMenu(demoQualities);
    }
    // Assemble component
    container.appendChild(button);
    container.appendChild(menu);
    
    // Add tooltip
    const cleanupTooltip = createTooltip(button, {
        ...TOOLTIP_CONFIG.DYNAMIC_FAST,
        getContent: () => {
            const quality = availableQualities[currentQuality];
            const qualityText = quality ? `${quality.height}p${quality.isDub ? ' (Dub)' : ''}` : 'Quality';
            return qualityText;
        }
    });
    
    updateQualityDisplay();
    
    // Return container and update method for external source changes
    container.updateSources = (newSourcesData) => {
        if (newSourcesData && newSourcesData.sources) {
            buildQualityMenu(newSourcesData.sources);
            currentQuality = 0; // Reset to first quality
            updateQualityDisplay();
            notifyQualityChange(newSourcesData.sources[0]);
        }
    };
    
    return { element: container, cleanup: () => {
        cleanupTooltip();
        button.removeEventListener('click', toggleMenu);
        menu.removeEventListener('click', closeMenu);
    }};
}