import { Category } from "@dasd/fin-shared";
import { Hono } from "hono";
import { nanoid } from "nanoid";
import { db } from "../store/db";
import { readJson } from "./helpers";

const CategoryInput = Category.omit({ id: true });

export const categoriesRoutes = new Hono();

// Categories are shared across ledgers, so no `?ledger=` filtering here.
categoriesRoutes.get("/", (c) => c.json(db.categories.all()));

categoriesRoutes.post("/", async (c) => {
  const parsed = CategoryInput.safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const category: Category = { ...parsed.data, id: nanoid() };
  db.categories.insert(category);
  return c.json(category, 201);
});

categoriesRoutes.get("/:id", (c) => {
  const found = db.categories.get(c.req.param("id"));
  return found ? c.json(found) : c.json({ error: "not found" }, 404);
});

categoriesRoutes.put("/:id", async (c) => {
  const id = c.req.param("id");
  if (!db.categories.get(id)) return c.json({ error: "not found" }, 404);
  const parsed = CategoryInput.partial().safeParse(await readJson(c));
  if (!parsed.success) return c.json({ error: parsed.error.message }, 400);
  const updated = db.categories.update(id, parsed.data);
  return updated ? c.json(updated) : c.json({ error: "not found" }, 404);
});

categoriesRoutes.delete("/:id", (c) => {
  return db.categories.remove(c.req.param("id"))
    ? c.json({ ok: true })
    : c.json({ error: "not found" }, 404);
});
