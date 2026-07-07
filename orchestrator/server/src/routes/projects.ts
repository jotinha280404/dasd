import { BacklogItemInput, BacklogStatus, ProjectInput } from "@dasd/orch-shared";
import { Hono } from "hono";
import * as store from "../store/projects";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "invalid project";
}

/**
 * REST routes for project (backlog) CRUD + item mutations. Mount under `/api`.
 * Every mutation persists through the store, which broadcasts a full
 * `project.update` to all connected clients.
 */
export function projectsRoutes(): Hono {
  const app = new Hono();

  app.get("/projects", async (c) => c.json(await store.list()));

  app.post("/projects", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = ProjectInput.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "invalid project", issues: parsed.error.issues }, 400);
    return c.json(await store.createProject(parsed.data), 201);
  });

  app.get("/projects/:id", async (c) => {
    const project = await store.get(c.req.param("id"));
    return project ? c.json(project) : c.json({ error: "not found" }, 404);
  });

  app.put("/projects/:id", async (c) => {
    const id = c.req.param("id");
    const body: unknown = await c.req.json().catch(() => null);
    const merged = isRecord(body) ? { ...body, id } : body;
    try {
      return c.json(await store.save(merged));
    } catch (err) {
      return c.json({ error: errorMessage(err) }, 400);
    }
  });

  app.delete("/projects/:id", async (c) => {
    await store.remove(c.req.param("id"));
    return c.json({ ok: true });
  });

  app.post("/projects/:id/items", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = BacklogItemInput.safeParse(body);
    if (!parsed.success) return c.json({ error: "invalid item", issues: parsed.error.issues }, 400);
    const project = await store.addItem(c.req.param("id"), parsed.data);
    return project ? c.json(project, 201) : c.json({ error: "not found" }, 404);
  });

  app.patch("/projects/:id/items/:itemId", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const status = BacklogStatus.safeParse(isRecord(body) ? body["status"] : undefined);
    if (!status.success)
      return c.json({ error: "invalid status", issues: status.error.issues }, 400);
    const project = await store.setItemStatus(
      c.req.param("id"),
      c.req.param("itemId"),
      status.data,
    );
    return project ? c.json(project) : c.json({ error: "not found" }, 404);
  });

  return app;
}
