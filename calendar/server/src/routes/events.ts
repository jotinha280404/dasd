import { Hono } from "hono";
import { EventInput, EventPatch } from "@dasd/cal-shared";
import { getProvider } from "../providers";

/** REST routes for event CRUD. Mount under `/api/events`. */
export const eventsRoutes = new Hono();

function monthWindow(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : "invalid request";
}

eventsRoutes.get("/", async (c) => {
  const fallback = monthWindow();
  const from = c.req.query("from") ?? fallback.from;
  const to = c.req.query("to") ?? fallback.to;
  const events = await getProvider().list({ from, to });
  return c.json(events);
});

eventsRoutes.post("/", async (c) => {
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = EventInput.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid event", issues: parsed.error.issues }, 400);
  }
  const event = await getProvider().create(parsed.data);
  return c.json(event, 201);
});

eventsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body: unknown = await c.req.json().catch(() => null);
  const parsed = EventPatch.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "invalid patch", issues: parsed.error.issues }, 400);
  }
  try {
    const event = await getProvider().update(id, parsed.data);
    return c.json(event);
  } catch (err) {
    return c.json({ error: errorMessage(err) }, 404);
  }
});

eventsRoutes.delete("/:id", async (c) => {
  await getProvider().remove(c.req.param("id"));
  return c.json({ ok: true });
});
