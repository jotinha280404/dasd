import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { AspectRatio, type Generation, MediaKind } from "@dasd/higg-shared";
import { getClient } from "../providers";
import { PRESETS } from "../presets/seed";
import { db } from "../store/db";
import { readMediaAsDataUrl, referenceToDataUrl } from "../store/media";
import { readJson } from "./helpers";

/**
 * The generation feed. `POST /api/generate` runs the (synchronous) image path:
 * compose the prompt with the chosen preset's suffix, resolve reference images
 * (uploads + the character's stored refs) into inline data URLs, call the image
 * provider, and persist the finished `Generation`. The feed is served newest-first.
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
});

export const generationsRoutes = new Hono();

generationsRoutes.post("/generate", async (c) => {
  const parsed = GenerateInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const input = parsed.data;

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

generationsRoutes.get("/generations", (c) =>
  c.json([...db.generations.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
);

generationsRoutes.get("/generations/:id", (c) => {
  const found = db.generations.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

generationsRoutes.delete("/generations/:id", (c) =>
  db.generations.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404),
);
