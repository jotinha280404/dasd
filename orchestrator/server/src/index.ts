import "dotenv/config";
import type { Server } from "node:http";
import { serve } from "@hono/node-server";
import type { Health } from "@dasd/orch-shared";
import { Hono } from "hono";
import { AgentPool, agentMode, hasAuth } from "./agents/pool";
import { Engine } from "./engine/run";
import { runsRoutes } from "./routes/runs";
import { workflowsRoutes } from "./routes/workflows";
import { seedIfEmpty } from "./store/workflows";
import { attachHub } from "./ws/hub";

const PORT = Number(process.env["PORT"] ?? 8787);

const pool = new AgentPool();
const engine = new Engine(pool);

const app = new Hono();

app.get("/api/health", (c) => {
  const body: Health = {
    ok: true,
    service: "orchestrator-server",
    ts: new Date().toISOString(),
  };
  return c.json(body);
});

app.route("/api", workflowsRoutes(engine));
app.route("/api", runsRoutes(engine));

async function main(): Promise<void> {
  await seedIfEmpty();

  const server = serve({ fetch: app.fetch, port: PORT }, (info) => {
    const m = agentMode();
    const willUseSdk = m === "sdk" || (m !== "mock" && hasAuth());
    const desc = willUseSdk ? "sdk (real Claude Code agents)" : "mock (keyless demo)";
    console.log(`[orchestrator-server] listening on http://localhost:${info.port}`);
    console.log(
      `[orchestrator-server] agent mode: ${desc}  (AGENT_MODE=${m}, auth ${hasAuth() ? "detected" : "none"})`,
    );
  });

  attachHub(server as unknown as Server, pool);
}

void main();
