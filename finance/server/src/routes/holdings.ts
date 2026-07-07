import { Holding } from "@dasd/fin-shared";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { getPriceProvider } from "../prices";
import { db } from "../store/db";
import { getLedger, readJson } from "./helpers";

const HoldingInput = Holding.omit({ id: true, updatedAt: true, ledger: true });

export const holdingsRoutes = new Hono();

holdingsRoutes.post("/refresh-prices", async (c) => {
  const ledger = getLedger(c);
  const provider = getPriceProvider();
  const holdings = db.holdings.all().filter((h) => ledger === "all" || h.ledger === ledger);
  const quotes = await provider.quote(holdings);
  const now = new Date().toISOString();
  const updated: Holding[] = [];
  for (const h of holdings) {
    const next = db.holdings.update(h.id, {
      currentPrice: quotes.get(h.id) ?? h.currentPrice,
      updatedAt: now,
    });
    if (next) updated.push(next);
  }
  return c.json({ provider: provider.name, holdings: updated });
});

holdingsRoutes.get("/", (c) => {
  const ledger = getLedger(c);
  return c.json(db.holdings.all().filter((h) => ledger === "all" || h.ledger === ledger));
});

holdingsRoutes.post("/", async (c) => {
  const parsed = HoldingInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const account = db.accounts.get(parsed.data.accountId);
  if (!account) return c.json({ error: "account not found" }, 400);
  const holding: Holding = {
    ...parsed.data,
    id: nanoid(),
    ledger: account.ledger,
    updatedAt: new Date().toISOString(),
  };
  db.holdings.insert(holding);
  return c.json(holding, 201);
});

holdingsRoutes.get("/:id", (c) => {
  const found = db.holdings.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

holdingsRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!db.holdings.get(id)) return c.json({ error: "not found" }, 404);
  const parsed = HoldingInput.partial().safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const updated = db.holdings.update(id, { ...parsed.data, updatedAt: new Date().toISOString() });
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

holdingsRoutes.delete("/:id", (c) => {
  return db.holdings.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404);
});
