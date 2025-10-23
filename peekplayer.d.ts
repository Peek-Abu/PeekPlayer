export interface VideoSource {
  url: string;
  quality?: string;
  type?: string;
}

export interface PeekPlayerOptions {
  videoElement?: HTMLVideoElement;
  controlsContainer?: HTMLElement;
  overlayContainer?: HTMLElement;
  playerWrapper?: HTMLElement;
  engine?: 'hls' | 'videojs' | 'native' | 'auto';
}

export interface LoadSourcesHeaders {
  [key: string]: string;
}

export declare class PeekPlayer {
  constructor(options?: PeekPlayerOptions);
  
  loadSources(sources: VideoSource[], headers?: LoadSourcesHeaders): Promise<void>;
  play(): Promise<void>;
  pause(): void;
  destroy(): void;
  
  // Properties
  readonly video: HTMLVideoElement;
  readonly engine: any;
  readonly sourcesData: VideoSource[] | null;
  readonly controlsInitialized: boolean;
}

export default PeekPlayer;
