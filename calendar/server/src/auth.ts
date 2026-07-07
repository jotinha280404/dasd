import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/**
 * True when real Claude can authenticate: an env token, OR a local `claude`
 * login. The CLI stores credentials in `~/.claude/.credentials.json`, which the
 * Agent SDK subprocess inherits — so no env token is required. Copied from the
 * orchestrator's proven `pool.ts`.
 */
export function hasAuth(): boolean {
  if (process.env["CLAUDE_CODE_OAUTH_TOKEN"] || process.env["ANTHROPIC_API_KEY"]) {
    return true;
  }
  try {
    return existsSync(join(homedir(), ".claude", ".credentials.json"));
  } catch {
    return false;
  }
}

/** Resolved chat mode from AGENT_MODE (mock | sdk | auto → auto default). */
export function agentMode(): "mock" | "sdk" | "auto" {
  const m = (process.env["AGENT_MODE"] ?? "auto").toLowerCase();
  return m === "mock" || m === "sdk" ? m : "auto";
}
