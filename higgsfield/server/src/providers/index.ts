import type { GenerativeMediaClient, ImageProvider, VideoProvider } from "@dasd/higg-shared";
import { GeminiImageProvider } from "./image/gemini";
import { StubImageProvider } from "./image/stub";
import { FalVideoProvider } from "./video/fal";
import { StubVideoProvider } from "./video/stub";

/**
 * The provider facade. One client with swappable backends — real Gemini when
 * `GEMINI_API_KEY` is set (keyless placeholder stub otherwise), and real fal.ai
 * video when `FAL_KEY` is set (animated-SVG stub otherwise). `video` is never
 * undefined anymore: the old "hide Animate when keyless" rule is retired, the
 * stub keeps the whole submit→poll flow working for $0.
 */

/** The server's client: `video` always present, and both backends flag `isStub`. */
export interface MediaClient extends GenerativeMediaClient {
  video: VideoProvider & { readonly isStub: boolean };
}

export interface Capabilities {
  image: { provider: string; model: string; isStub: boolean };
  video: {
    provider: string;
    model: string;
    isStub: boolean;
    supportsImageToVideo: boolean;
    supportsCameraControl: boolean;
  };
}

export function buildClient(): MediaClient {
  const geminiKey = process.env["GEMINI_API_KEY"]?.trim();
  const falKey = process.env["FAL_KEY"]?.trim();
  const image: ImageProvider = geminiKey
    ? new GeminiImageProvider(geminiKey)
    : new StubImageProvider();
  const video = falKey ? new FalVideoProvider(falKey) : new StubVideoProvider();
  return { image, video };
}

let cached: MediaClient | null = null;

/** The process-wide client, built once from the environment on first use. */
export function getClient(): MediaClient {
  if (!cached) cached = buildClient();
  return cached;
}

export function capabilities(): Capabilities {
  const client = getClient();
  return {
    image: {
      provider: client.image.id,
      model: client.image.defaultModel,
      isStub: client.image.isStub,
    },
    video: {
      provider: client.video.id,
      model: client.video.defaultModel,
      isStub: client.video.isStub,
      supportsImageToVideo: client.video.supportsImageToVideo,
      supportsCameraControl: client.video.supportsCameraControl,
    },
  };
}
