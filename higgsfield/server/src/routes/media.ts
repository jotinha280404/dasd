import { Hono } from "hono";
import { readMedia } from "../store/media";

/** GET /api/media/:file — stream a stored asset with the right content-type. */
export const mediaRoutes = new Hono();

mediaRoutes.get("/:file", (c) => {
  const media = readMedia(c.req.param("file"));
  if (!media) return c.json({ error: "not found" }, 404);
  return new Response(media.bytes, {
    status: 200,
    headers: {
      "Content-Type": media.mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
});
