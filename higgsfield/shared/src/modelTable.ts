/**
 * Provider + model IDs and rough rates as DATA (not code) — 2026 model IDs and
 * prices move fast, so swapping a backend is a data change here. Costs are
 * estimates for display only ("est."), never billing truth.
 */
export const IMAGE_MODELS = {
  "gemini-2.5-flash-image": {
    provider: "gemini",
    label: "Gemini 2.5 Flash Image",
    estCostUsd: 0.039,
  },
} as const;

export const VIDEO_MODELS = {
  // Populated in Phase 4 when a video adapter lands (fal / Veo / Kling …).
  // e.g. "fal-kling-2.5": { provider: "fal", label: "Kling 2.5", estCostPerSecUsd: 0.07 },
} as const;

export const DEFAULT_IMAGE_MODEL = "gemini-2.5-flash-image";
