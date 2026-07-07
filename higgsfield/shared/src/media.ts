import type { AspectRatioValue, JobStatusValue, MediaAsset } from "./models";

/**
 * Provider-adapter interfaces. One facade, swappable backends: image resolves
 * synchronously (Gemini today); video is submit→poll (fal/Veo later). `video`
 * stays undefined until a video key is present, so the UI hides "Animate".
 */

export interface ImageGenInput {
  prompt: string;
  negativePrompt?: string;
  aspectRatio?: AspectRatioValue;
  /** Reference images as data URLs or stored asset URLs (for edit / character). */
  references?: string[];
  presetId?: string | null;
  characterId?: string | null;
  seed?: number;
  count?: number;
}

export interface ImageGenResult {
  assets: MediaAsset[];
  provider: string;
  model: string;
  costUsd?: number;
}

export interface VideoGenInput {
  prompt: string;
  /** A source image (e.g. a generated "Soul" image) for image→video. */
  initAssetId?: string;
  initImageUrl?: string;
  presetId?: string | null;
  characterId?: string | null;
  aspectRatio?: AspectRatioValue;
  durationSec?: number;
}

export interface VideoJob {
  jobId: string;
  status: JobStatusValue;
  assets?: MediaAsset[];
  provider: string;
  model: string;
  providerJobId?: string;
  error?: string;
}

export interface ImageProvider {
  readonly id: string;
  readonly defaultModel: string;
  /** Whether this is a real generator (vs. the keyless placeholder stub). */
  readonly isStub: boolean;
  generate(input: ImageGenInput): Promise<ImageGenResult>;
}

export interface VideoProvider {
  readonly id: string;
  readonly defaultModel: string;
  readonly supportsImageToVideo: boolean;
  readonly supportsCameraControl: boolean;
  submit(input: VideoGenInput): Promise<VideoJob>;
  poll(jobId: string): Promise<VideoJob>;
}

export interface GenerativeMediaClient {
  image: ImageProvider;
  /** undefined until a video key is configured. */
  video?: VideoProvider;
}
