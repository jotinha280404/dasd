import { AspectRatio, type Generation, MediaKind, type VideoJob } from "@dasd/higg-shared";
import { type Context, Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { PRESETS } from "../presets/seed";
import { getClient } from "../providers";
import { db } from "../store/db";
import { readMediaAsDataUrl, referenceToDataUrl } from "../store/media";
import { readJson } from "./helpers";

/**
 * The generation feed. `POST /api/generate` runs two paths:
 *  - image (synchronous): compose the prompt with the chosen preset's suffix,
 *    resolve reference images (uploads + the character's stored refs) into
 *    inline data URLs, call the image provider, persist the finished
 *    `Generation`.
 *  - video (asynchronous): submit to the video provider and respond immediately
 *    with the `queued` Generation. Progress is *lazily polled*: any read of the
 *    feed or of a single generation advances active video jobs first (throttled
 *    per generation), so no background loop is needed.
 * The feed is served newest-first.
 */

const GenerateInput = z.object({
  prompt: z.string().min(1),
  aspectRatio: AspectRatio.optional(),
  presetId: z.string().nullish(),
  characterId: z.string().nullish(),
  references: z.array(z.string()).default([]),
  negativePrompt: z.string().optional(),
  count: z.number().int().min(1).max(4).optional(),
  kind: MediaKind.optional(),
  /** Video only: a stored asset (e.g. a generated image) to animate. */
  initAssetId: z.string().nullish(),
  durationSec: z.number().int().min(1).max(15).optional(),
});
type GenerateInputValue = z.infer<typeof GenerateInput>;

export const generationsRoutes = new Hono();

generationsRoutes.post("/generate", async (c) => {
  const parsed = GenerateInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const input = parsed.data;
  if ((input.kind ?? "image") === "video") return generateVideo(c, input);

  const client = getClient();
  const aspectRatio = input.aspectRatio ?? "1:1";
  const presetId = input.presetId ?? null;
  const characterId = input.characterId ?? null;

  const preset = presetId ? PRESETS.find((p) => p.id === presetId) : undefined;
  const character = characterId ? db.characters.get(characterId) : undefined;

  const composedPrompt = preset?.promptSuffix
    ? `${input.prompt}, ${preset.promptSuffix}`
    : input.prompt;

  // Resolve every reference (uploaded data URLs + the character's stored refs)
  // into inline data URLs the provider can embed.
  const references: string[] = [];
  for (const ref of input.references) {
    const dataUrl = referenceToDataUrl(ref);
    if (dataUrl) references.push(dataUrl);
  }
  for (const assetId of character?.referenceAssetIds ?? []) {
    const dataUrl = readMediaAsDataUrl(assetId);
    if (dataUrl) references.push(dataUrl);
  }

  const now = new Date().toISOString();
  const generation: Generation = {
    id: nanoid(),
    userId: "local",
    kind: input.kind ?? "image",
    status: "running",
    provider: client.image.id,
    model: client.image.defaultModel,
    input: {
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      referenceAssetIds: character?.referenceAssetIds ?? [],
      presetId,
      characterId,
      aspectRatio,
    },
    outputs: [],
    createdAt: now,
  };
  db.generations.insert(generation);

  try {
    const result = await client.image.generate({
      prompt: composedPrompt,
      negativePrompt: input.negativePrompt,
      aspectRatio,
      references,
      presetId,
      characterId,
      count: input.count ?? 1,
    });
    const succeeded = db.generations.update(generation.id, {
      status: "succeeded",
      provider: result.provider,
      model: result.model,
      outputs: result.assets,
      costUsd: result.costUsd,
      completedAt: new Date().toISOString(),
    });
    return c.json(succeeded ?? generation);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const failed = db.generations.update(generation.id, {
      status: "failed",
      error: message,
      completedAt: new Date().toISOString(),
    });
    return c.json(failed ?? generation);
  }
});

/** The async video path: submit, persist as queued, respond right away. */
async function generateVideo(c: Context, input: GenerateInputValue): Promise<Response> {
  const client = getClient();
  const aspectRatio = input.aspectRatio ?? "16:9";
  const presetId = input.presetId ?? null;
  const characterId = input.characterId ?? null;

  const preset = presetId ? PRESETS.find((p) => p.id === presetId) : undefined;
  const character = characterId ? db.characters.get(characterId) : undefined;

  const composedPrompt = preset?.promptSuffix
    ? `${input.prompt}, ${preset.promptSuffix}`
    : input.prompt;

  // Resolve the init image for image→video: an explicit asset id wins, else the
  // character's first stored reference (character continuation), else none
  // (pure text→video).
  const initAssetId = input.initAssetId ?? undefined;
  let initImageUrl: string | undefined;
  if (initAssetId) {
    initImageUrl = readMediaAsDataUrl(initAssetId) ?? undefined;
  } else if (character) {
    const firstRef = character.referenceAssetIds[0];
    if (firstRef) initImageUrl = readMediaAsDataUrl(firstRef) ?? undefined;
  }

  const generation: Generation = {
    id: nanoid(),
    userId: "local",
    kind: "video",
    status: "queued",
    provider: client.video.id,
    model: client.video.defaultModel,
    input: {
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      referenceAssetIds: initAssetId ? [initAssetId] : (character?.referenceAssetIds ?? []),
      presetId,
      characterId,
      aspectRatio,
      durationSec: input.durationSec,
    },
    outputs: [],
    createdAt: new Date().toISOString(),
  };

  try {
    const job = await client.video.submit({
      prompt: composedPrompt,
      initAssetId,
      initImageUrl,
      presetId,
      characterId,
      aspectRatio,
      durationSec: input.durationSec,
    });
    generation.providerJobId = job.providerJobId ?? job.jobId;
    db.generations.insert(generation);
    return c.json(generation);
  } catch (err) {
    generation.status = "failed";
    generation.error = err instanceof Error ? err.message : String(err);
    generation.completedAt = new Date().toISOString();
    db.generations.insert(generation);
    return c.json(generation);
  }
}

/** Min gap between provider polls for a single generation (lazy-poll throttle). */
const POLL_INTERVAL_MS = 2_500;
const lastPollAt = new Map<string, number>();

/**
 * Lazy polling: reads drive progress. If `gen` is an active video job and its
 * per-generation throttle allows, poll the provider once and fold the result
 * into the stored Generation. Returns the freshest copy either way.
 */
async function advanceVideoJob(gen: Generation): Promise<Generation> {
  if (gen.kind !== "video") return gen;
  if (gen.status !== "queued" && gen.status !== "running") return gen;
  if (!gen.providerJobId) return gen;
  const now = Date.now();
  if (now - (lastPollAt.get(gen.id) ?? 0) < POLL_INTERVAL_MS) return gen;
  lastPollAt.set(gen.id, now);

  let job: VideoJob;
  try {
    job = await getClient().video.poll(gen.providerJobId);
  } catch (err) {
    lastPollAt.delete(gen.id);
    const failed = db.generations.update(gen.id, {
      status: "failed",
      error: err instanceof Error ? err.message : String(err),
      completedAt: new Date().toISOString(),
    });
    return failed ?? gen;
  }

  if (job.status === "succeeded") {
    lastPollAt.delete(gen.id);
    const succeeded = db.generations.update(gen.id, {
      status: "succeeded",
      outputs: job.assets ?? [],
      completedAt: new Date().toISOString(),
    });
    return succeeded ?? gen;
  }
  if (job.status === "failed" || job.status === "canceled") {
    lastPollAt.delete(gen.id);
    const failed = db.generations.update(gen.id, {
      status: job.status,
      error: job.error ?? "video job failed",
      completedAt: new Date().toISOString(),
    });
    return failed ?? gen;
  }
  if (job.status !== gen.status) {
    return db.generations.update(gen.id, { status: job.status }) ?? gen;
  }
  return gen;
}

generationsRoutes.get("/generations", async (c) => {
  const active = db.generations
    .all()
    .filter((g) => g.kind === "video" && (g.status === "queued" || g.status === "running"));
  if (active.length > 0) await Promise.all(active.map((g) => advanceVideoJob(g)));
  return c.json([...db.generations.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
});

generationsRoutes.get("/generations/:id", async (c) => {
  const found = db.generations.get(c.req.param("id"));
  if (!found) return c.json({ error: "not found" }, 404);
  return c.json(await advanceVideoJob(found));
});

generationsRoutes.delete("/generations/:id", (c) =>
  db.generations.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404),
);
