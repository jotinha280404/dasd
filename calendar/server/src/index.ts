import "dotenv/config";
import type { Health } from "@dasd/cal-shared";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { agentMode, hasAuth } from "./auth";
import { getProvider } from "./providers";
import { chatRoutes } from "./routes/chat";
import { eventsRoutes } from "./routes/events";
import { seedIfEmpty } from "./store/seed";

const PORT = Number(process.env["PORT"] ?? 8790);

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => {
  const body: Health = {
    ok: true,
    service: "calendar-server",
    ts: new Date().toISOString(),
  };
  return c.json(body);
});

app.route("/api/events", eventsRoutes);
app.route("/api/chat", chatRoutes);

const seeded = seedIfEmpty();
console.log(`[calendar-server] ${seeded ? "seeded demo events" : "using existing store"}`);

const provider = getProvider();
const chatBackend =
  hasAuth() && agentMode() !== "mock" ? "real Claude (Agent SDK)" : "heuristic parser";
console.log(`[calendar-server] provider=${provider.id}, chat=${chatBackend}`);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[calendar-server] listening on http://localhost:${info.port}`);
});
