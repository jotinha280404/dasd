import type { GenerativeMediaClient, ImageProvider } from "@dasd/higg-shared";
import { GeminiImageProvider } from "./image/gemini";
import { StubImageProvider } from "./image/stub";

/**
 * The provider facade. One `GenerativeMediaClient` with a swappable image
 * backend — real Gemini when `GEMINI_API_KEY` is set, the keyless placeholder
 * stub otherwise. `video` stays undefined until a Phase-4 video key lands, so the
 * web app hides "Animate".
 */

export interface Capabilities {
  image: { provider: string; model: string; isStub: boolean };
  video: null;
}

export function buildClient(): GenerativeMediaClient {
  const key = process.env["GEMINI_API_KEY"]?.trim();
  const image: ImageProvider = key ? new GeminiImageProvider(key) : new StubImageProvider();
  return { image };
}

let cached: GenerativeMediaClient | null = null;

/** The process-wide client, built once from the environment on first use. */
export function getClient(): GenerativeMediaClient {
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
    video: null,
  };
}
