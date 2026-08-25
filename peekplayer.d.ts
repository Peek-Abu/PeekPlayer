export interface VideoSource {
  url: string;
  /** Raw quality identifier, e.g. "1080", "720p", "high" */
  quality?: string;
  /** Human-friendly label shown in the quality menu */
  displayName?: string;
  label?: string;
  /** Vertical resolution in pixels; inferred from labels when omitted */
  height?: number;
  width?: number;
  bandwidth?: number;
  type?: string;
  /** Set automatically for HLS levels */
  hlsLevel?: number;
  isDub?: boolean;
  [key: string]: unknown;
}

export interface VideoSegment {
  /** Segment start time in seconds */
  start: number;
  /** Segment end time in seconds */
  end: number;
  label?: string;
  /** CSS color used to highlight the segment on the scrubber */
  color?: string;
  /** Arbitrary metadata surfaced via segment hooks */
  data?: unknown;
}

export interface PlayerControlsConfig {
  playToggle?: boolean;
  skipPrevious?: boolean;
  skipNext?: boolean;
  volume?: boolean;
  timeDisplay?: boolean;
  secondsSkipBack?: boolean;
  secondsSkipForward?: boolean;
  quality?: boolean;
  subtitles?: boolean;
  pip?: boolean;
  fullscreen?: boolean;
}

export interface SegmentAutoSkipConfig {
  /** Segment labels to skip automatically, e.g. ["intro", "recap"] */
  labels: string[];
  /** Seconds of tolerance before a segment counts as "started" (default 0.15) */
  tolerance?: number;
  /** Seconds to jump past the segment end (default 0) */
  offsetAfter?: number;
  onAutoSkip?: (payload: { segment: VideoSegment; index: number; targetTime: number }) => void;
}

export interface PlayerLogger {
  debugEnabled?: boolean;
  setDebug(enabled: boolean): void;
  log(...args: unknown[]): void;
  warn(...args: unknown[]): void;
  error(...args: unknown[]): void;
}

export interface PlayerCallbacks {
  onPlaybackChange?(playing: boolean): void;
  /** Fired on user-initiated seeks */
  onSeek?(time: number, delta: number, percent: number): void;
  onVolumeChange?(volume: number): void;
  onFullscreen?(isFullscreen: boolean): void;
  /** Fired independently of the time display component */
  onTimeUpdate?(currentTime: number, duration: number): void;
  /** 'previous' | 'next' from skip buttons, or autoNext on video end */
  onSkip?(direction: 'previous' | 'next'): void;
  onPipChange?(isInPip: boolean): void;
  onQualityChange?(qualityLabel: string): void;
  onSubtitleChange?(label: string, track: TextTrack | null): void;
}

export interface PeekPlayerOptions extends PlayerCallbacks {
  /** Required: the <video> element to attach to */
  videoElement: HTMLVideoElement;
  /** Required: empty container that will hold the player controls */
  controlsContainer: HTMLElement;
  /** Optional container for the centered play/pause overlay */
  overlayContainer?: HTMLElement;
  /** Wrapper element that gets fullscreened; inferred when omitted */
  playerWrapper?: HTMLElement;
  /** Force an engine; auto-detected from source URLs when omitted */
  engine?: 'hls' | 'native';
  /** hls.js config overrides */
  hlsConfig?: Record<string, unknown>;
  autoplay?: boolean;
  /** Fire onSkip('next') when the video ends */
  autoNext?: boolean;
  poster?: string;
  /** Enable verbose internal logging */
  debug?: boolean;
  /** Unmute automatically on first user interaction after autoplay */
  autoUnmuteOnInteraction?: boolean;
  segments?: VideoSegment[];
  /** Auto-skip labeled segments such as intros */
  segmentAutoSkip?: SegmentAutoSkipConfig;
  /**
   * Source frame rate used for frame-by-frame stepping (`,` / `.` keys).
   * Defaults to 30 when unknown.
   */
  frameRate?: number;
  /** Use the browser's native controls on touch devices */
  nativeControlsForMobile?: boolean;
  /** Toggle individual control components */
  controls?: PlayerControlsConfig;
  logger?: PlayerLogger;
}

export interface LoadSourcesHeaders {
  [key: string]: string;
}

export declare class PeekPlayer {
  constructor(options: PeekPlayerOptions);

  /** Load a single URL (mp4/webm or HLS manifest). */
  loadSource(url: string, headers?: LoadSourcesHeaders): Promise<this>;

  /** Load multiple quality variants; enables the quality selector. */
  loadSources(sources: VideoSource[], headers?: LoadSourcesHeaders): Promise<this>;

  /** Switch quality by index in getSources(), or by quality/displayName string. */
  switchQuality(qualityOrIndex: number | string): Promise<this>;

  /** Update options after construction (controls, segments, autoplay, ...). */
  updateOptions(partialOptions: Partial<PeekPlayerOptions>): void;

  /** Rebuild the controls with the current options. */
  refreshControls(): void;

  getSources(): VideoSource[];
  getEngine(): unknown;

  destroy(): void;

  readonly video: HTMLVideoElement;
  readonly controlsContainer: HTMLElement;
  readonly playerWrapper: HTMLElement;
  readonly autoplay: boolean;
  readonly autoNext: boolean;
}

export default PeekPlayer;
