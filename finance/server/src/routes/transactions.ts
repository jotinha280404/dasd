import { Hono } from "hono";
import { nanoid } from "nanoid";
import { z } from "zod";
import { Category, type CategoryKind, Transaction } from "@dasd/fin-shared";
import { parseCsv } from "../csv";
import { db } from "../store/db";
import { getLedger, readJson } from "./helpers";

// Client never sends `ledger`/`id`/`createdAt`; the server derives them.
const TxnInput = Transaction.omit({ id: true, createdAt: true, ledger: true });
const ImportInput = z.object({ accountId: z.string(), csv: z.string() });

/** Find a category by name (case-insensitive), creating one when absent. */
function resolveCategory(name: string, kind: CategoryKind): string {
  const existing = db.categories.all().find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (existing) return existing.id;
  const category: Category = { id: nanoid(), name, kind };
  db.categories.insert(category);
  return category.id;
}

export const transactionsRoutes = new Hono();

transactionsRoutes.post("/import", async (c) => {
  const parsed = ImportInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const account = db.accounts.get(parsed.data.accountId);
  if (!account) return c.json({ error: "account not found" }, 400);

  const now = new Date().toISOString();
  let created = 0;
  for (const row of parseCsv(parsed.data.csv)) {
    const kind: CategoryKind = row.amount >= 0 ? "income" : "expense";
    db.transactions.insert({
      id: nanoid(),
      accountId: account.id,
      ledger: account.ledger,
      date: row.date,
      amount: row.amount,
      type: kind,
      categoryId: row.category ? resolveCategory(row.category, kind) : null,
      payee: row.description || undefined,
      tags: [],
      transferAccountId: null,
      cleared: true,
      createdAt: now,
    });
    created += 1;
  }
  return c.json({ created });
});

transactionsRoutes.get("/", (c) => {
  const ledger = getLedger(c);
  const accountId = c.req.query("account");
  const items = db.transactions
    .all()
    .filter((t) => ledger === "all" || t.ledger === ledger)
    .filter((t) => !accountId || t.accountId === accountId)
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return c.json(items);
});

transactionsRoutes.post("/", async (c) => {
  const parsed = TxnInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const account = db.accounts.get(parsed.data.accountId);
  if (!account) return c.json({ error: "account not found" }, 400);
  const txn: Transaction = {
    ...parsed.data,
    id: nanoid(),
    ledger: account.ledger,
    createdAt: new Date().toISOString(),
  };
  db.transactions.insert(txn);
  return c.json(txn, 201);
});

transactionsRoutes.get("/:id", (c) => {
  const found = db.transactions.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

transactionsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!db.transactions.get(id)) return c.json({ error: "not found" }, 404);
  const parsed = TxnInput.partial().safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const patch: Partial<Transaction> = { ...parsed.data };
  if (parsed.data.accountId) {
    const account = db.accounts.get(parsed.data.accountId);
    if (!account) return c.json({ error: "account not found" }, 400);
    patch.ledger = account.ledger;
  }
  const updated = db.transactions.update(id, patch);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

transactionsRoutes.delete("/:id", (c) => {
  return db.transactions.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404);
});
