import type { Context } from "hono";

/** Parse a JSON body, returning `null` on malformed input instead of throwing. */
export function readJson(c: Context): Promise<unknown> {
  return c.req.json().catch(() => null);
}
