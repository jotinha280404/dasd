import type { Context } from "hono";
import { LedgerFilter } from "@dasd/fin-shared";

/** Read `?ledger=` from the query, defaulting to the combined "all" view. */
export function getLedger(c: Context): LedgerFilter {
  const parsed = LedgerFilter.safeParse(c.req.query("ledger"));
  return parsed.success ? parsed.data : "all";
}

/** Parse a JSON body, returning `null` on malformed input instead of throwing. */
export function readJson(c: Context): Promise<unknown> {
  return c.req.json().catch(() => null);
}
