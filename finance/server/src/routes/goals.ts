import { Goal } from "@dasd/fin-shared";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { db } from "../store/db";
import { getLedger, readJson } from "./helpers";

const GoalInput = Goal.omit({ id: true, createdAt: true });

export const goalsRoutes = new Hono();

goalsRoutes.get("/", (c) => {
  const ledger = getLedger(c);
  // Goals with a null ledger are cross-ledger and always included.
  return c.json(
    db.goals.all().filter((g) => ledger === "all" || g.ledger === null || g.ledger === ledger),
  );
});

goalsRoutes.post("/", async (c) => {
  const parsed = GoalInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const goal: Goal = { ...parsed.data, id: nanoid(), createdAt: new Date().toISOString() };
  db.goals.insert(goal);
  return c.json(goal, 201);
});

goalsRoutes.get("/:id", (c) => {
  const found = db.goals.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

goalsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!db.goals.get(id)) return c.json({ error: "not found" }, 404);
  const parsed = GoalInput.partial().safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const updated = db.goals.update(id, parsed.data);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

goalsRoutes.delete("/:id", (c) => {
  return db.goals.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404);
});
