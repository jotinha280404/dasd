import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import pLimit from "p-limit";
import type { AgentSpec } from "@dasd/orch-shared";
import { bus } from "../bus";
import { fromSdk, type NormalizeCtx } from "../normalize";
import { runMock } from "./mock";
import { runSdk } from "./sdk";

/** Sink a provider pushes raw SDK-shaped messages into. */
export type EmitRaw = (raw: unknown) => void;

/** Control surface returned by a provider so the pool can steer a live agent. */
export interface AgentHandle {
  interrupt: () => void;
  stop: () => void;
}

export interface LaunchResult {
  ok: boolean;
  error?: string;
}

interface Entry {
  handle: AgentHandle;
  runId?: string;
  finish: (r: LaunchResult) => void;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/**
 * True when real Claude Code agents can authenticate: an env token, OR a local
 * `claude` login — the CLI stores credentials in ~/.claude/.credentials.json,
 * which the SDK subprocess inherits, so no env token is required.
 */
export function hasAuth(): boolean {
  if (process.env["CLAUDE_CODE_OAUTH_TOKEN"] || process.env["ANTHROPIC_API_KEY"]) return true;
  try {
    return existsSync(join(homedir(), ".claude", ".credentials.json"));
  } catch {
    return false;
  }
}

/** Resolved default agent mode from AGENT_MODE (mock | sdk | auto → auto). */
export function agentMode(): "mock" | "sdk" | "auto" {
  const m = (process.env["AGENT_MODE"] ?? "auto").toLowerCase();
  return m === "mock" || m === "sdk" ? m : "auto";
}

/**
 * Launches agents (mock or real SDK), caps concurrency at 4, normalizes every
 * raw message onto the bus, and tracks live handles so a run can be steered.
 */
export class AgentPool {
  private readonly limit = pLimit(4);
  private readonly agents = new Map<string, Entry>();

  /** Resolves when the agent produces a terminal `agent.result` / `agent.error`. */
  launch(spec: AgentSpec): Promise<LaunchResult> {
    const mode = agentMode();
    const useMock = spec.mock === true || mode === "mock" || (mode !== "sdk" && !hasAuth());
    const ctx: NormalizeCtx = {
      agentId: spec.agentId,
      runId: spec.runId,
      nodeId: spec.nodeId,
      source: "sdk",
    };

    return this.limit(
      () =>
        new Promise<LaunchResult>((resolve) => {
          let settled = false;
          const finish = (r: LaunchResult): void => {
            if (settled) return;
            settled = true;
            this.agents.delete(spec.agentId);
            resolve(r);
          };
          const emit: EmitRaw = (raw) => {
            for (const e of fromSdk(ctx, raw)) {
              bus.emitEvent(e);
              if (e.kind === "agent.result") {
                finish({ ok: true });
              } else if (e.kind === "agent.error") {
                const msg = isRecord(e.data) && typeof e.data["message"] === "string" ? e.data["message"] : "agent error";
                finish({ ok: false, error: msg });
              }
            }
          };
          const handle = useMock ? runMock(spec, emit) : runSdk(spec, emit);
          this.agents.set(spec.agentId, { handle, runId: spec.runId, finish });
        }),
    );
  }

  interrupt(agentId: string): void {
    this.agents.get(agentId)?.handle.interrupt();
  }

  stop(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;
    entry.handle.stop();
    entry.finish({ ok: false, error: "stopped" });
  }

  stopRun(runId: string): void {
    for (const [agentId, entry] of Array.from(this.agents)) {
      if (entry.runId !== runId) continue;
      entry.handle.stop();
      entry.finish({ ok: false, error: "stopped" });
      this.agents.delete(agentId);
    }
  }
}
