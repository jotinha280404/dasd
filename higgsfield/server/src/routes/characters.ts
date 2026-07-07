import type { Character } from "@dasd/higg-shared";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { db } from "../store/db";
import { storeDataUrls } from "../store/media";
import { readJson } from "./helpers";

/**
 * The character library (reusable "Soul-ID" identities). Reference images arrive
 * as data URLs, are persisted to the media store, and their asset ids are what a
 * generation later resolves back into inline reference images.
 */

const CreateCharacter = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  referenceImages: z.array(z.string()).default([]),
});

const UpdateCharacter = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  referenceImages: z.array(z.string()).default([]),
});

export const charactersRoutes = new Hono();

charactersRoutes.get("/", (c) =>
  c.json([...db.characters.all()].sort((a, b) => b.createdAt.localeCompare(a.createdAt))),
);

charactersRoutes.post("/", async (c) => {
  const parsed = CreateCharacter.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const assets = storeDataUrls(parsed.data.referenceImages);
  const now = new Date().toISOString();
  const character: Character = {
    id: nanoid(),
    name: parsed.data.name,
    description: parsed.data.description,
    referenceAssetIds: assets.map((a) => a.assetId),
    coverUrl: assets[0]?.url,
    createdAt: now,
    updatedAt: now,
  };
  db.characters.insert(character);
  return c.json(character, 201);
});

charactersRoutes.get("/:id", (c) => {
  const found = db.characters.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

charactersRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = db.characters.get(id);
  if (!existing) return c.json({ error: "not found" }, 404);
  const parsed = UpdateCharacter.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const added = storeDataUrls(parsed.data.referenceImages);
  const patch: Partial<Character> = {
    name: parsed.data.name ?? existing.name,
    description: parsed.data.description ?? existing.description,
    referenceAssetIds: added.length
      ? [...existing.referenceAssetIds, ...added.map((a) => a.assetId)]
      : existing.referenceAssetIds,
    coverUrl: existing.coverUrl ?? added[0]?.url,
    updatedAt: new Date().toISOString(),
  };
  const updated = db.characters.update(id, patch);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

charactersRoutes.delete("/:id", (c) =>
  db.characters.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404),
);
