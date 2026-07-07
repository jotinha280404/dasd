import { Hono } from "hono";
import { capabilities } from "../providers";

/** GET /api/capabilities — what the current backend can do (the web app reads
 *  `image.isStub` / `video.isStub` to show the placeholder banners; video is
 *  always present now — the keyless stub retired the old "hide Animate" rule). */
export const capabilitiesRoutes = new Hono();

capabilitiesRoutes.get("/", (c) => c.json(capabilities()));
