import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
import { assertVideoElement, assertExists, assertType, assertFunction, assert } from '../utils/assert.js';

export function createQualitySelector(video, hooks = {}, logger, options = {}) {
    const { player, onQualityChange } = hooks;
    // Assert required parameters
    assertVideoElement(video, { component: 'QualitySelector', method: 'createQualitySelector' });
    assertExists(player, 'player', { component: 'QualitySelector', method: 'createQualitySelector' });
    
    const container = document.createElement('div');
    container.className = 'quality-selector';
    // Hidden until sources arrive; updateSources() will reveal it.
    container.style.display = 'none';

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
    menu.style.overflowY = 'auto';
    
    let isMenuOpen = false;
    let availableQualities = [];
    let currentQuality = 0; // Start with first quality
    let currentTime = 0;
    let wasPlaying = false;

    // Update quality display
    function updateQualityDisplay() {
        const quality = availableQualities[currentQuality];
        const qualityText = getQualityLabel(quality);
        button.setAttribute('aria-label', `Quality: ${qualityText}`);
    }

    const getQualityLabel = (quality) => {
        if (!quality) {
            return 'Auto';
        }
        const baseLabel = typeof quality.displayName === 'string' && quality.displayName.trim().length
            ? quality.displayName
            : quality.height
                ? `${quality.height}p`
                : typeof quality.quality === 'string' && quality.quality.trim().length
                    ? quality.quality
                    : 'Auto';
        return quality.isDub ? `${baseLabel} (Dub)` : baseLabel;
    };

    const findQualityIndex = (target) => {
        if (!target) {
            return -1;
        }
        return availableQualities.findIndex((candidate) => {
            if (candidate.isAuto && target.isAuto) {
                return true;
            }
            if (typeof candidate.hlsLevel === 'number' && typeof target.hlsLevel === 'number') {
                return candidate.hlsLevel === target.hlsLevel;
            }
            if (candidate.url && target.url) {
                return candidate.url === target.url;
            }
            if (typeof candidate.index === 'number' && typeof target.index === 'number') {
                return candidate.index === target.index;
            }
            return false;
        });
    };

    const updateAutoLabelFromSource = (activeSource) => {
        const autoIndex = availableQualities.findIndex((quality) => quality.isAuto);
        if (autoIndex === -1) {
            return;
        }

        const autoQuality = availableQualities[autoIndex];
        const activeLabel = getQualityLabel(activeSource);
        autoQuality.displayName = `Auto (${activeLabel})`;
        autoQuality.activeHeight = activeSource?.height || autoQuality.height;
        if (autoQuality.activeHeight) {
            autoQuality.height = autoQuality.activeHeight;
        }

        const options = menu.querySelectorAll('.quality-option');
        const autoOptionNode = options[autoIndex];
        if (autoOptionNode) {
            autoOptionNode.textContent = autoQuality.displayName;
        }
    };

    const setActiveQuality = (targetSource) => {
        if (!targetSource) {
            return;
        }

        if (!targetSource.isAuto) {
            updateAutoLabelFromSource(targetSource);
        }

        let nextIndex = findQualityIndex(targetSource);
        if (nextIndex === -1 && !targetSource.isAuto) {
            updateAutoLabelFromSource(targetSource);
            nextIndex = availableQualities.findIndex((quality) => quality.isAuto);
        }

        if (nextIndex !== -1) {
            currentQuality = nextIndex;
            updateQualityDisplay();
            updateMenuSelection();
        }
    };

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
        availableQualities = qualities.map((quality) => ({ ...quality }));
        menu.innerHTML = '';
        
        // Add quality options
        availableQualities.forEach((quality, index) => {
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
        const label = getQualityLabel(quality);
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
        showNotification(`Switching to ${getQualityLabel(newQuality)}...`, 'loading');
        
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
                showNotification(`Quality: ${getQualityLabel(newQuality)}`, 'success');
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
                showNotification(`Quality: ${getQualityLabel(newQuality)}`, 'success');
                notifyQualityChange(newQuality); // Added this line
            }, { once: true });
        }
        
        updateQualityDisplay();
        updateMenuSelection();
        closeMenu();
    }
    
    // Show notification (scoped to this player's wrapper so multiple
    // player instances don't remove each other's notifications)
    let spinKeyframesStyle = null;

    function ensureSpinKeyframes() {
        if (spinKeyframesStyle) {
            return;
        }
        spinKeyframesStyle = document.createElement('style');
        spinKeyframesStyle.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
        document.head.appendChild(spinKeyframesStyle);
    }

    function showNotification(message, type = 'info') {
        const wrapper = getPlayerWrapper() || document.body;
        // Remove existing notifications belonging to this player
        wrapper.querySelectorAll(':scope > .quality-notification').forEach((n) => n.remove());
        
        const notification = document.createElement('div');
        notification.className = 'quality-notification';
        notification.style.cssText = `
            position: absolute;
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
            ensureSpinKeyframes();
            notification.innerHTML = `
                <div style="width: 16px; height: 16px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
                ${message}
            `;
        } else {
            notification.textContent = message;
        }
        
        wrapper.appendChild(notification);
        
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
    
    const getPlayerWrapper = () => {
        if (hooks && hooks.playerWrapper instanceof HTMLElement) {
            return hooks.playerWrapper;
        }
        if (player && player.playerWrapper instanceof HTMLElement) {
            return player.playerWrapper;
        }
        const fallback = video.closest('.peekplayer-wrapper');
        return fallback instanceof HTMLElement ? fallback : null;
    };

    const repositionMenu = () => {
        if (!isMenuOpen) {
            return;
        }

        menu.style.position = 'absolute';
        menu.style.left = 'auto';
        menu.style.right = '0';

        const wrapper = getPlayerWrapper();
        const buttonRect = button.getBoundingClientRect();
        const wrapperRect = wrapper?.getBoundingClientRect();
        const viewportHeight = typeof window !== 'undefined' ? (window.innerHeight || document.documentElement?.clientHeight || 0) : 0;

        let spaceAbove = Number.POSITIVE_INFINITY;
        let spaceBelow = Number.POSITIVE_INFINITY;

        if (wrapperRect && buttonRect) {
            spaceAbove = Math.max(0, buttonRect.top - wrapperRect.top - 8);
            spaceBelow = Math.max(0, wrapperRect.bottom - buttonRect.bottom - 8);

            const baseWidth = Math.max(120, Math.ceil(buttonRect.width + 40));
            const maxAllowed = Math.min(320, Math.max(baseWidth, Math.floor(wrapperRect.width - 16)));
            menu.style.minWidth = `${baseWidth}px`;
            menu.style.maxWidth = `${maxAllowed}px`;
            menu.style.width = 'auto';
        } else {
            menu.style.minWidth = '120px';
            menu.style.maxWidth = '';
            menu.style.width = 'auto';
        }

        const openedDownwards = spaceBelow > spaceAbove;
        const availableSpace = openedDownwards ? spaceBelow : spaceAbove;
        const viewportLimit = viewportHeight > 32 ? viewportHeight - 32 : viewportHeight;
        const computedMaxHeight = Math.max(120, Math.min(Math.floor(availableSpace), viewportLimit || 320));
        menu.style.maxHeight = `${computedMaxHeight}px`;

        if (openedDownwards) {
            menu.style.top = 'calc(100% + 8px)';
            menu.style.bottom = 'auto';
        } else {
            menu.style.bottom = 'calc(100% + 8px)';
            menu.style.top = 'auto';
        }
    };

    function toggleMenu() {
        const shouldOpen = !isMenuOpen;
        if (shouldOpen) {
            isMenuOpen = true;
            menu.style.display = 'block';
            repositionMenu();
        } else {
            closeMenu();
        }
    }

    function closeMenu() {
        isMenuOpen = false;
        menu.style.display = 'none';
    }
    
    // Event listeners
    const handleButtonClick = (e) => {
        e.stopPropagation();
        toggleMenu();
    };
    button.addEventListener('click', handleButtonClick);

    // Close menu when clicking outside
    const handleDocumentClick = (e) => {
        if (!container.contains(e.target)) {
            closeMenu();
        }
    };
    document.addEventListener('click', handleDocumentClick);

    const onWindowResize = () => repositionMenu();
    if (typeof window !== 'undefined') {
        window.addEventListener('resize', onWindowResize);
    }
    
    // Initialize with sources data if already available
    const initialSourcesData = player.sourcesData;
    if (initialSourcesData?.sources?.length) {
        buildQualityMenu(initialSourcesData.sources);
    } else {
        logger.log('🎬 Quality selector: no sources available yet, waiting for updateSources()');
    }
    // Assemble component
    container.appendChild(button);
    container.appendChild(menu);
    
    // Add tooltip
    const cleanupTooltip = createTooltip(button, {
        ...TOOLTIP_CONFIG.DYNAMIC_FAST,
        getContent: () => {
            const quality = availableQualities[currentQuality];
            const qualityText = getQualityLabel(quality);
            return qualityText;
        },
        isMobile: options.isMobile
    });
    
    updateQualityDisplay();
    
    // Return container and update method for external source changes
    container.updateSources = (newSourcesData) => {
        if (newSourcesData && Array.isArray(newSourcesData.sources) && newSourcesData.sources.length) {
            buildQualityMenu(newSourcesData.sources);
            currentQuality = 0; // Reset to first quality
            updateQualityDisplay();
        }
    };
    container.setActiveQuality = setActiveQuality;

    return { element: container, setActiveQuality, cleanup: () => {
        cleanupTooltip();
        if (typeof window !== 'undefined') {
            window.removeEventListener('resize', onWindowResize);
        }
        button.removeEventListener('click', handleButtonClick);
        document.removeEventListener('click', handleDocumentClick);
        if (spinKeyframesStyle && spinKeyframesStyle.parentNode) {
            spinKeyframesStyle.parentNode.removeChild(spinKeyframesStyle);
            spinKeyframesStyle = null;
        }
    }};
}