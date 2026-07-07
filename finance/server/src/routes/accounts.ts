import { Hono } from "hono";
import { nanoid } from "nanoid";
import { Account } from "@dasd/fin-shared";
import { accountBalances } from "../compute";
import { db } from "../store/db";
import { getLedger, readJson } from "./helpers";

const AccountInput = Account.omit({ id: true, createdAt: true });

export const accountsRoutes = new Hono();

// Static routes must be registered before the `/:id` param route.
accountsRoutes.get("/balances", (c) => c.json(accountBalances(getLedger(c))));

accountsRoutes.get("/", (c) => {
  const ledger = getLedger(c);
  return c.json(db.accounts.all().filter((a) => ledger === "all" || a.ledger === ledger));
});

accountsRoutes.post("/", async (c) => {
  const parsed = AccountInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const account: Account = { ...parsed.data, id: nanoid(), createdAt: new Date().toISOString() };
  db.accounts.insert(account);
  return c.json(account, 201);
});

accountsRoutes.get("/:id", (c) => {
  const found = db.accounts.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

accountsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!db.accounts.get(id)) return c.json({ error: "not found" }, 404);
  const parsed = AccountInput.partial().safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const updated = db.accounts.update(id, parsed.data);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

accountsRoutes.delete("/:id", (c) => {
  return db.accounts.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404);
});
