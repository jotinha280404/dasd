import "dotenv/config";
import { serve } from "@hono/node-server";
import type { Health } from "@dasd/fin-shared";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { accountsRoutes } from "./routes/accounts";
import { budgetsRoutes } from "./routes/budgets";
import { categoriesRoutes } from "./routes/categories";
import { goalsRoutes } from "./routes/goals";
import { holdingsRoutes } from "./routes/holdings";
import { reportsRoutes } from "./routes/reports";
import { transactionsRoutes } from "./routes/transactions";
import { seedIfEmpty } from "./store/seed";

const PORT = Number(process.env["PORT"] ?? 8789);

const app = new Hono();

app.use("/api/*", cors());

app.get("/api/health", (c) => {
  const body: Health = {
    ok: true,
    service: "finance-server",
    ts: new Date().toISOString(),
  };
  return c.json(body);
});

app.route("/api/accounts", accountsRoutes);
app.route("/api/categories", categoriesRoutes);
app.route("/api/transactions", transactionsRoutes);
app.route("/api/holdings", holdingsRoutes);
app.route("/api/budgets", budgetsRoutes);
app.route("/api/goals", goalsRoutes);
// Dashboard + report endpoints live under /api (e.g. /api/dashboard, /api/reports/*).
app.route("/api", reportsRoutes);

const seeded = seedIfEmpty();
console.log(`[finance-server] ${seeded ? "seeded demo data" : "using existing store"}`);

serve({ fetch: app.fetch, port: PORT }, (info) => {
  console.log(`[finance-server] listening on http://localhost:${info.port}`);
});
