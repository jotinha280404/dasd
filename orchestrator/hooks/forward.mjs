#!/usr/bin/env node
/**
 * Claude Code hook forwarder: reads the hook JSON from stdin and POSTs it to
 * the orchestrator's `/api/hooks` endpoint so the session shows up as a
 * read-only ghost agent. Dependency-free; never blocks the user's session —
 * 1500ms timeout, every error swallowed, always exits 0.
 */

const BASE = process.env.ORCHESTRATOR_URL ?? "http://localhost:8787";
const TIMEOUT_MS = 1500;

// Safety net: never hang the hook, even if stdin misbehaves.
setTimeout(() => process.exit(0), TIMEOUT_MS + 1500).unref();

const chunks = [];
process.stdin.on("data", (chunk) => chunks.push(chunk));
process.stdin.on("error", () => process.exit(0));
process.stdin.on("end", async () => {
  const body = Buffer.concat(chunks).toString("utf8");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    await fetch(`${BASE}/api/hooks`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: controller.signal,
    });
  } catch {
    // Orchestrator down / slow / unreachable — never fail the hook.
  } finally {
    clearTimeout(timer);
    process.exit(0);
  }
});
