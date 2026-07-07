import { Hono } from "hono";
import { PRESETS } from "../presets/seed";

/** GET /api/presets — the curated camera / VFX preset library. */
export const presetsRoutes = new Hono();

presetsRoutes.get("/", (c) => c.json(PRESETS));
