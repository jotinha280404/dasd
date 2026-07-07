import type { AspectRatioValue, CameraPreset, Character, Generation } from "@dasd/higg-shared";

/** Shape of GET /api/capabilities (the web uses it to show the placeholder
 *  banner and to hide "Animate" until a video backend exists). */
export interface ImageCapability {
  provider: string;
  model: string;
  isStub: boolean;
}
export interface VideoCapability {
  provider: string;
  model: string;
  supportsImageToVideo: boolean;
  supportsCameraControl: boolean;
}
export interface Capabilities {
  image: ImageCapability;
  video: VideoCapability | null;
}

/** Body of POST /api/generate. */
export interface GenerateInput {
  prompt: string;
  aspectRatio?: AspectRatioValue;
  presetId?: string | null;
  characterId?: string | null;
  /** Reference images as data URLs. */
  references?: string[];
  negativePrompt?: string;
  count?: number;
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
  deleteGeneration: (id: string) =>
    http<void>(`/api/generations/${id}`, { method: "DELETE" }),
  characters: () => http<Character[]>("/api/characters"),
  createCharacter: (input: CharacterInput) =>
    http<Character>("/api/characters", { method: "POST", body: JSON.stringify(input) }),
  updateCharacter: (id: string, input: CharacterInput) =>
    http<Character>(`/api/characters/${id}`, { method: "PUT", body: JSON.stringify(input) }),
  deleteCharacter: (id: string) =>
    http<void>(`/api/characters/${id}`, { method: "DELETE" }),
};
