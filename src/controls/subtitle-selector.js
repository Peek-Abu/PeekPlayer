import { createTooltip } from '../components/tooltip/tooltip.js';
import { ICONS } from '../constants/icons.js';
import { TOOLTIP_CONFIG } from '../constants/tooltip-config.js';
import { assertVideoElement, assertType } from '../utils/assert.js';

const OFF_OPTION = {
  id: 'off',
  label: 'Off',
  language: '',
  track: null
};

function normalizeTrack(track, index) {
  if (!track) {
    return null;
  }

  const label = track.label?.trim();
  const language = track.language || track.srclang || '';
  const displayName = (language ? language.toUpperCase() : `Track ${index + 1}`) || label;

  return {
    id: `track-${index}`,
    label: displayName,
    language,
    track
  };
}

function setTrackMode(track, mode) {
  if (!track) return;

  try {
    track.mode = mode;
  } catch (error) {
    // Some browsers (iOS Safari) throw if mode is set before metadata is loaded.
    // Defer to the next frame to retry.
    requestAnimationFrame(() => {
      try {
        track.mode = mode;
      } catch (_) {
        /* no-op */
      }
    });
  }
}

export function createSubtitleSelector(video, hooks = {}, logger, options = {}) {
  assertVideoElement(video, { component: 'SubtitleSelector', method: 'createSubtitleSelector' });
  assertType(hooks, 'object', 'hooks', { component: 'SubtitleSelector', method: 'createSubtitleSelector' });
  const { onSubtitleChange } = hooks;

  const container = document.createElement('div');
  container.className = 'subtitles-selector';

  const button = document.createElement('button');
  button.className = 'subtitles-button';
  button.style.pointerEvents = 'auto';
  button.setAttribute('aria-label', 'Closed captions');
  button.setAttribute('type', 'button');
  button.innerHTML = ICONS.SUBTITLES;

  let ccActiveIndicatorMarkup = '';
  const subtitlesIcon = button.querySelector('svg');
  const activeIndicatorPath = subtitlesIcon?.querySelector('[data-role="cc-active-indicator"]');
  if (activeIndicatorPath) {
    ccActiveIndicatorMarkup = activeIndicatorPath.outerHTML;
    activeIndicatorPath.remove();
  }

  const menu = document.createElement('div');
  menu.className = 'subtitles-menu';
  menu.style.display = 'none';
  menu.style.overflowY = 'auto';

  let isMenuOpen = false;
  let optionsList = [OFF_OPTION];
  let currentIndex = 0;

  function notifySubtitleChange(option) {
    if (typeof onSubtitleChange === 'function') {
      try {
        onSubtitleChange(option?.label || 'Off', option?.track || null);
      } catch (error) {
        logger?.warn?.('Subtitle change callback failed', error);
      }
    }
  }

  function updateButtonState() {
    const activeOption = optionsList[currentIndex] || OFF_OPTION;
    const ariaLabel = activeOption.track ? `Closed captions: ${activeOption.label}` : 'Closed captions off';
    const hasActiveTrack = !!activeOption.track;
    button.setAttribute('aria-label', ariaLabel);
    button.classList.toggle('is-active', hasActiveTrack);

    const icon = button.querySelector('svg');
    if (!icon) {
      return;
    }

    const indicator = icon.querySelector('[data-role="cc-active-indicator"]');
    if (hasActiveTrack) {
      if (!indicator && ccActiveIndicatorMarkup) {
        icon.insertAdjacentHTML('afterbegin', ccActiveIndicatorMarkup);
      }
    } else if (indicator) {
      indicator.remove();
    }
  }

  function updateVisibility() {
    const shouldShow = optionsList.length > 1;
    container.style.display = shouldShow ? 'flex' : 'none';
    button.disabled = !shouldShow;
    if (!shouldShow && isMenuOpen) {
      closeMenu();
    }
  }

  function closeMenu() {
    isMenuOpen = false;
    menu.style.display = 'none';
  }

  function openMenu() {
    isMenuOpen = true;
    menu.style.display = 'block';
    repositionMenu();
  }

  function toggleMenu() {
    if (isMenuOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }

  function selectOption(index, { emitChange = true } = {}) {
    if (index < 0 || index >= optionsList.length) {
      index = 0;
    }

    if (index === currentIndex && optionsList[index]?.track === (optionsList[currentIndex]?.track || null)) {
      closeMenu();
      return;
    }

    const nextOption = optionsList[index] || OFF_OPTION;

    optionsList.forEach((option, optIndex) => {
      const track = option.track;
      if (!track) {
        return;
      }

      const mode = optIndex === index ? 'showing' : 'disabled';
      setTrackMode(track, mode);
    });

    if (!nextOption.track) {
      // Ensure all tracks are disabled when "Off" is chosen
      const textTracks = Array.from(video.textTracks || []);
      textTracks.forEach((track) => setTrackMode(track, 'disabled'));
    }

    currentIndex = index;
    updateButtonState();
    updateMenuSelection();

    if (emitChange) {
      notifySubtitleChange(nextOption);
    }
  }

  function cycleOption() {
    if (!optionsList.length) {
      return;
    }
    const nextIndex = (currentIndex + 1) % optionsList.length;
    selectOption(nextIndex);
  }

  function updateMenuSelection() {
    const options = menu.querySelectorAll('.subtitles-option');
    options.forEach((optionElement, index) => {
      optionElement.classList.toggle('selected', index === currentIndex);
    });
  }

  function rebuildMenu() {
    menu.innerHTML = '';

    optionsList.forEach((option, index) => {
      const optionButton = document.createElement('button');
      optionButton.className = 'subtitles-option';
      optionButton.type = 'button';
      optionButton.textContent = option.label;
      optionButton.onclick = () => {
        selectOption(index);
        closeMenu();
      };
      menu.appendChild(optionButton);
    });

    updateMenuSelection();
    updateButtonState();
    updateVisibility();

    const activeOption = optionsList[currentIndex] || OFF_OPTION;
    notifySubtitleChange(activeOption);
  }

  function snapshotTracks() {
    const textTracks = Array.from(video.textTracks || []);
    const normalized = textTracks
      .map((track, index) => normalizeTrack(track, index))
      .filter(Boolean);

    // Preserve currently active option label if possible
    const activeOption = optionsList[currentIndex];
    optionsList = [OFF_OPTION, ...normalized];

    rebuildMenu();

    if (activeOption?.track) {
      const matchingIndex = optionsList.findIndex((option) => option.track === activeOption.track);
      if (matchingIndex !== -1) {
        currentIndex = matchingIndex;
        updateMenuSelection();
        updateButtonState();
        return;
      }
    }

    // Determine initial selection (default track or "off")
    const defaultIndex = optionsList.findIndex((option) => option.track?.mode === 'showing' || option.track?.default);
    currentIndex = defaultIndex !== -1 ? defaultIndex : 0;
    updateMenuSelection();
    updateButtonState();
    updateVisibility();
  }

  function repositionMenu() {
    if (!isMenuOpen) {
      return;
    }

    menu.style.position = 'absolute';
    menu.style.left = 'auto';
    menu.style.right = '0';

    const buttonRect = button.getBoundingClientRect();
    const viewportHeight = typeof window !== 'undefined' ? (window.innerHeight || document.documentElement?.clientHeight || 0) : 0;

    const spaceBelow = viewportHeight ? Math.max(0, viewportHeight - buttonRect.bottom - 12) : 0;
    const spaceAbove = buttonRect.top - 12;
    const openDownwards = spaceBelow >= spaceAbove;

    menu.style.maxHeight = `${openDownwards ? spaceBelow : spaceAbove}px`;

    if (openDownwards) {
      menu.style.top = 'calc(100% + 8px)';
      menu.style.bottom = 'auto';
    } else {
      menu.style.bottom = 'calc(100% + 8px)';
      menu.style.top = 'auto';
    }
  }

  function handleDocumentClick(event) {
    if (!container.contains(event.target)) {
      closeMenu();
    }
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  document.addEventListener('click', handleDocumentClick);

  if (typeof window !== 'undefined') {
    window.addEventListener('resize', repositionMenu);
  }

  const textTracks = video.textTracks;
  const handleTrackCollectionChange = () => snapshotTracks();
  const handleTrackModeChange = () => {
    const showingIndex = optionsList.findIndex((option) => option.track?.mode === 'showing');
    const nextIndex = showingIndex !== -1 ? showingIndex : 0;
    if (nextIndex !== currentIndex) {
      currentIndex = nextIndex;
      updateMenuSelection();
      updateButtonState();
    }
  };

  if (textTracks && typeof textTracks.addEventListener === 'function') {
    textTracks.addEventListener('addtrack', handleTrackCollectionChange);
    textTracks.addEventListener('removetrack', handleTrackCollectionChange);
    textTracks.addEventListener('change', handleTrackModeChange);
  }

  video.addEventListener('loadedmetadata', snapshotTracks);
  const handleVideoEmptied = () => {
    optionsList = [OFF_OPTION];
    currentIndex = 0;
    rebuildMenu();
  };
  video.addEventListener('emptied', handleVideoEmptied);

  container.appendChild(button);
  container.appendChild(menu);

  if (menu.children.length === 0) {
    rebuildMenu();
  }

  const cleanupTooltip = createTooltip(button, {
    ...TOOLTIP_CONFIG.DYNAMIC_FAST,
    getContent: () => (optionsList[currentIndex]?.label || 'Off'),
    isMobile: options?.isMobile
  });

  // Initial snapshot to capture preloaded tracks
  snapshotTracks();

  container.cycleSubtitle = cycleOption;
  container.selectSubtitleByLabel = (label) => {
    if (!label) {
      selectOption(0);
      return;
    }
    const index = optionsList.findIndex((option) => option.label.toLowerCase() === label.toLowerCase());
    selectOption(index >= 0 ? index : 0);
  };
  container.updateTracks = snapshotTracks;

  const cleanup = () => {
    document.removeEventListener('click', handleDocumentClick);
    if (typeof window !== 'undefined') {
      window.removeEventListener('resize', repositionMenu);
    }
    if (textTracks && typeof textTracks.removeEventListener === 'function') {
      textTracks.removeEventListener('addtrack', handleTrackCollectionChange);
      textTracks.removeEventListener('removetrack', handleTrackCollectionChange);
      textTracks.removeEventListener('change', handleTrackModeChange);
    }
    video.removeEventListener('loadedmetadata', snapshotTracks);
    video.removeEventListener('emptied', handleVideoEmptied);
    cleanupTooltip();
  };

  return {
    element: container,
    cleanup,
    cycleSubtitle: cycleOption,
    selectByLabel: container.selectSubtitleByLabel,
    updateTracks: snapshotTracks
  };
}
