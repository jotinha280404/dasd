import { serve } from "@hono/node-server";
import type { Health } from "@dasd/higg-shared";
import { Hono } from "hono";

const PORT = Number(process.env.PORT ?? 8788);

const app = new Hono();

app.get("/api/health", (c) => {
  const body: Health = {
    ok: true,
    service: "higgsfield-server",
    ts: new Date().toISOString(),
  };
  return c.json(body);
});

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[higgsfield-server] listening on http://localhost:${info.port}`);
});
