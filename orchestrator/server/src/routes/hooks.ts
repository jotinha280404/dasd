import { HookPayload, hookAgentId } from "@dasd/orch-shared";
import { Hono } from "hono";
import { bus } from "../bus";
import { fromHook } from "../normalize";

/**
 * Hook ingest for ghost sessions: `POST /hooks` receives the JSON a Claude
 * Code hook pipes to `orchestrator/hooks/forward.mjs`, normalizes it onto the
 * bus, and returns immediately — hooks block the user's session, so this path
 * does no disk I/O. An in-memory registry of observed sessions backs
 * `GET /observed`. Mount under `/api`.
 */

interface ObservedSession {
  agentId: string;
  sessionId: string;
  cwd?: string;
  lastEvent: string;
  eventCount: number;
  firstSeen: string;
}

const observed = new Map<string, ObservedSession>();

export function hooksRoutes(): Hono {
  const app = new Hono();

  app.post("/hooks", async (c) => {
    const body: unknown = await c.req.json().catch(() => null);
    const parsed = HookPayload.safeParse(body);
    if (!parsed.success)
      return c.json({ error: "invalid hook payload", issues: parsed.error.issues }, 400);
    const payload = parsed.data;

    const events = fromHook(payload, body);
    for (const e of events) bus.emitEvent(e);

    const agentId = hookAgentId(payload.session_id);
    const now = new Date().toISOString();
    const entry = observed.get(agentId);
    if (entry) {
      entry.lastEvent = now;
      entry.eventCount += events.length;
      if (payload.cwd) entry.cwd = payload.cwd;
    } else {
      observed.set(agentId, {
        agentId,
        sessionId: payload.session_id,
        cwd: payload.cwd,
        lastEvent: now,
        eventCount: events.length,
        firstSeen: now,
      });
    }
    return c.json({ ok: true });
  });

  app.get("/observed", (c) => {
    const sessions = Array.from(observed.values()).sort((a, b) =>
      b.lastEvent.localeCompare(a.lastEvent),
    );
    return c.json(sessions);
  });

  return app;
}
