import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import type { Health } from "@dasd/orch-shared";
import { Hono } from "hono";
import { WebSocketServer } from "ws";

const PORT = Number(process.env.PORT ?? 8787);

const app = new Hono();

app.get("/api/health", (c) => {
  const body: Health = {
    ok: true,
    service: "orchestrator-server",
    ts: new Date().toISOString(),
  };
  return c.json(body);
});

const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[orchestrator-server] listening on http://localhost:${info.port}`);
});

// WebSocket hub — Phase 1 replaces this echo stub with the real
// subscribe / launch / interrupt / permission protocol (see wire.ts).
const wss = new WebSocketServer({ server: server as unknown as Server, path: "/ws" });
wss.on("connection", (ws) => {
  ws.send(JSON.stringify({ t: "hello", service: "orchestrator-server" }));
  ws.on("message", (buf) => ws.send(buf.toString()));
});
