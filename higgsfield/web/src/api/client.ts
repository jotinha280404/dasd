import type {
  AspectRatioValue,
  CameraPreset,
  Character,
  Generation,
  MediaKindValue,
} from "@dasd/higg-shared";

/** Shape of GET /api/capabilities (the web uses it to show the placeholder
 *  banners; both providers always exist — `isStub` marks keyless stand-ins). */
export interface ImageCapability {
  provider: string;
  model: string;
  isStub: boolean;
}
export interface VideoCapability {
  provider: string;
  model: string;
  /** True for the keyless placeholder (animated SVGs instead of real mp4s). */
  isStub: boolean;
  supportsImageToVideo: boolean;
  supportsCameraControl: boolean;
}
export interface Capabilities {
  image: ImageCapability;
  video: VideoCapability;
}

/** Body of POST /api/generate. */
export interface GenerateInput {
  /** Defaults to "image" server-side. Video responds immediately with a queued job. */
  kind?: MediaKindValue;
  prompt: string;
  aspectRatio?: AspectRatioValue;
  presetId?: string | null;
  characterId?: string | null;
  /** Reference images as data URLs. */
  references?: string[];
  negativePrompt?: string;
  count?: number;
  /** Output asset of a previous image generation → image-to-video. */
  initAssetId?: string;
  /** Video length in seconds (1–15). */
  durationSec?: number;
}

/** Body of POST/PUT /api/characters. */
export interface CharacterInput {
  name: string;
  description?: string;
  /** Reference images as data URLs. */
  references?: string[];
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      detail = body.error ?? body.message ?? detail;
    } catch {
      // Non-JSON error body — keep the status line.
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  capabilities: () => http<Capabilities>("/api/capabilities"),
  presets: () => http<CameraPreset[]>("/api/presets"),
  generations: () => http<Generation[]>("/api/generations"),
  generation: (id: string) => http<Generation>(`/api/generations/${id}`),
  generate: (input: GenerateInput) =>
    http<Generation>("/api/generate", { method: "POST", body: JSON.stringify(input) }),
  deleteGeneration: (id: string) => http<void>(`/api/generations/${id}`, { method: "DELETE" }),
  characters: () => http<Character[]>("/api/characters"),
  createCharacter: (input: CharacterInput) =>
    http<Character>("/api/characters", { method: "POST", body: JSON.stringify(input) }),
  updateCharacter: (id: string, input: CharacterInput) =>
    http<Character>(`/api/characters/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteCharacter: (id: string) => http<void>(`/api/characters/${id}`, { method: "DELETE" }),
};
