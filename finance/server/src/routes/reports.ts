import { type Context, Hono } from "hono";
import {
  allocation,
  budgetStatuses,
  cashflowSeries,
  dashboard,
  goalProgress,
  holdingValues,
  netWorthSeries,
} from "../compute";
import { getLedger } from "./helpers";

/** Read a positive integer `?months=` query, defaulting to 12. */
function getMonths(c: Context): number {
  const raw = Number(c.req.query("months"));
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 12;
}

export const reportsRoutes = new Hono();

reportsRoutes.get("/dashboard", (c) => c.json(dashboard(getLedger(c))));

reportsRoutes.get("/reports/networth", (c) => c.json(netWorthSeries(getLedger(c), getMonths(c))));

reportsRoutes.get("/reports/cashflow", (c) => c.json(cashflowSeries(getLedger(c), getMonths(c))));

reportsRoutes.get("/reports/allocation", (c) => {
  const by = c.req.query("by") === "assetClass" ? "assetClass" : "accountType";
  return c.json(allocation(getLedger(c), by));
});

reportsRoutes.get("/reports/budgets", (c) => c.json(budgetStatuses(getLedger(c))));

reportsRoutes.get("/reports/goals", (c) => c.json(goalProgress(getLedger(c))));

reportsRoutes.get("/reports/holdings", (c) => c.json(holdingValues(getLedger(c))));
