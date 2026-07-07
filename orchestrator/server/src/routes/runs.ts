import { Hono } from "hono";
import type { Engine } from "../engine/run";

/** REST routes for run inspection + stop. Mount under `/api`. */
export function runsRoutes(engine: Engine): Hono {
  const app = new Hono();

  app.get("/runs/:id", (c) => {
    const run = engine.getRun(c.req.param("id"));
    return run ? c.json(run) : c.json({ error: "not found" }, 404);
  });

  app.post("/runs/:id/stop", (c) => {
    const ok = engine.stopRun(c.req.param("id"));
    return ok ? c.json({ ok: true }) : c.json({ error: "not found" }, 404);
  });

  return app;
}
