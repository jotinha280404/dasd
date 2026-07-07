import { z } from "zod";

/** Higgsfield domain: presets (camera/VFX), generations (image or video jobs),
 *  and characters (Soul-ID reusable identities). */

export const MediaKind = z.enum(["image", "video"]);
export type MediaKindValue = z.infer<typeof MediaKind>;

export const JobStatus = z.enum(["queued", "running", "succeeded", "failed", "canceled"]);
export type JobStatusValue = z.infer<typeof JobStatus>;

export const AspectRatio = z.enum(["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"]);
export type AspectRatioValue = z.infer<typeof AspectRatio>;

export const PresetCategory = z.enum(["camera", "vfx", "transition"]);
export type PresetCategoryValue = z.infer<typeof PresetCategory>;

export const MotionType = z.enum([
  "dolly",
  "zoom",
  "orbit",
  "fpv",
  "bullet_time",
  "pan",
  "tilt",
  "crane",
  "handheld",
]);
export type MotionTypeValue = z.infer<typeof MotionType>;

/** A camera-motion / VFX preset — the "DoP" abstraction; one button that works
 *  across video backends (realized via promptSuffix for prompt-driven models). */
export const CameraPreset = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  category: PresetCategory.default("camera"),
  motionType: MotionType.default("zoom"),
  description: z.string().default(""),
  intensity: z.number().min(0).max(1).default(0.6),
  speed: z.number().min(0).max(1).default(0.6),
  /** Appended to the prompt for prompt-driven video providers. */
  promptSuffix: z.string().default(""),
  examplePrompt: z.string().optional(),
  thumbnailUrl: z.string().optional(),
  tags: z.array(z.string()).default([]),
});
export type CameraPreset = z.infer<typeof CameraPreset>;

/** One output asset (image or video). */
export const MediaAsset = z.object({
  assetId: z.string(),
  url: z.string(),
  mimeType: z.string(),
  width: z.number().optional(),
  height: z.number().optional(),
  durationSec: z.number().optional(),
});
export type MediaAsset = z.infer<typeof MediaAsset>;

/** A generation job (image resolves sync; video is submit→poll). */
export const Generation = z.object({
  id: z.string(),
  userId: z.string().default("local"),
  kind: MediaKind,
  status: JobStatus,
  provider: z.string(),
  model: z.string(),
  input: z.object({
    prompt: z.string().default(""),
    negativePrompt: z.string().optional(),
    referenceAssetIds: z.array(z.string()).default([]),
    presetId: z.string().nullable().default(null),
    characterId: z.string().nullable().default(null),
    aspectRatio: AspectRatio.default("1:1"),
    durationSec: z.number().optional(),
    seed: z.number().optional(),
  }),
  outputs: z.array(MediaAsset).default([]),
  providerJobId: z.string().optional(),
  costUsd: z.number().optional(),
  error: z.string().optional(),
  createdAt: z.string(),
  completedAt: z.string().optional(),
});
export type Generation = z.infer<typeof Generation>;

/** A reusable character identity (Soul ID). */
export const Character = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  referenceAssetIds: z.array(z.string()).default([]),
  coverUrl: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Character = z.infer<typeof Character>;
