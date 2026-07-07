import { Hono } from "hono";
import { capabilities } from "../providers";

/** GET /api/capabilities — what the current backend can do (the web app reads
 *  `image.isStub` to show the placeholder banner and `video` to hide "Animate"). */
export const capabilitiesRoutes = new Hono();

capabilitiesRoutes.get("/", (c) => c.json(capabilities()));
