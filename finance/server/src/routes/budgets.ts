import { Budget } from "@dasd/fin-shared";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { db } from "../store/db";
import { getLedger, readJson } from "./helpers";

const BudgetInput = Budget.omit({ id: true });

export const budgetsRoutes = new Hono();

budgetsRoutes.get("/", (c) => {
  const ledger = getLedger(c);
  return c.json(db.budgets.all().filter((b) => ledger === "all" || b.ledger === ledger));
});

budgetsRoutes.post("/", async (c) => {
  const parsed = BudgetInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const budget: Budget = { ...parsed.data, id: nanoid() };
  db.budgets.insert(budget);
  return c.json(budget, 201);
});

budgetsRoutes.get("/:id", (c) => {
  const found = db.budgets.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

budgetsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!db.budgets.get(id)) return c.json({ error: "not found" }, 404);
  const parsed = BudgetInput.partial().safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const updated = db.budgets.update(id, parsed.data);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

budgetsRoutes.delete("/:id", (c) => {
  return db.budgets.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404);
});
