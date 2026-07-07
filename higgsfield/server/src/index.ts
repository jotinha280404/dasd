import "dotenv/config";
import type { Health } from "@dasd/higg-shared";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { getClient } from "./providers";
import { capabilitiesRoutes } from "./routes/capabilities";
import { charactersRoutes } from "./routes/characters";
import { generationsRoutes } from "./routes/generations";
import { mediaRoutes } from "./routes/media";
import { presetsRoutes } from "./routes/presets";

const PORT = Number(process.env["PORT"] ?? 8788);

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => {
  const body: Health = {
    ok: true,
    service: "higgsfield-server",
    ts: new Date().toISOString(),
  };
  return c.json(body);
});

app.route("/api/capabilities", capabilitiesRoutes);
app.route("/api/presets", presetsRoutes);
app.route("/api/characters", charactersRoutes);
app.route("/api/media", mediaRoutes);
// /api/generate + /api/generations* — mounted last so the specific routers win.
app.route("/api", generationsRoutes);

const client = getClient();
console.log(
  `[higgsfield-server] image provider: ${client.image.id} (${client.image.defaultModel})` +
    (client.image.isStub
      ? " — STUB placeholder, set GEMINI_API_KEY for real images"
      : " — real generation"),
);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[higgsfield-server] listening on http://localhost:${info.port}`);
});
