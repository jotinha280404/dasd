import { Hono } from "hono";
import type { Engine } from "../engine/run";
import * as store from "../store/workflows";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "invalid workflow";
}

/** REST routes for workflow CRUD + run trigger. Mount under `/api`. */
export function workflowsRoutes(engine: Engine): Hono {
  const app = new Hono();

  app.get("/workflows", async (c) => c.json(await store.list()));

  app.post("/workflows", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    try {
      return c.json(await store.save(body), 201);
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 400);
    }
  });

  app.get("/workflows/:id", async (c) => {
    const graph = await store.get(c.req.param("id"));
    return graph ? c.json(graph) : c.json({ error: "not found" }, 404);
  });

  app.put("/workflows/:id", async (c) => {
    const id = c.req.param("id");
    const body: unknown = await c.req.json().catch(() => null);
    const merged = isRecord(body) ? { ...body, id } : body;
    try {
      return c.json(await store.save(merged));
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 400);
    }
  });

  app.delete("/workflows/:id", async (c) => {
    await store.remove(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/workflows/:id/run", async (c) => {
    const graph = await store.get(c.req.param("id"));
    if (!graph) return c.json({ error: "not found" }, 404);
    return c.json({ runId: engine.startRun(graph) });
  });

  return app;
}
