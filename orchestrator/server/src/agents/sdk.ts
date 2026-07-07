import { query, type Options, type PermissionMode } from "@anthropic-ai/claude-agent-sdk";
import type { AgentSpec } from "@dasd/orch-shared";
import type { AgentHandle, EmitRaw } from "./pool";

/**
 * Launches a real Claude Code agent via the installed Agent SDK's `query()`,
 * streaming every `SDKMessage` back through `emit`. Verified against
 * `@anthropic-ai/claude-agent-sdk@0.3.202`: `query({ prompt, options })` returns
 * a `Query` whose control methods are `interrupt(): Promise<void>` and
 * `close(): void`. Any failure is surfaced as a normalized `agent.error`.
 */

const PERMISSION_MODES: readonly PermissionMode[] = [
  "default",
  "acceptEdits",
  "bypassPermissions",
  "plan",
  "dontAsk",
  "auto",
];

function toPermissionMode(value: string | undefined): PermissionMode | undefined {
  return value !== undefined && (PERMISSION_MODES as readonly string[]).includes(value)
    ? (value as PermissionMode)
    : undefined;
}

export function runSdk(spec: AgentSpec, emit: EmitRaw): AgentHandle {
  const permissionMode = toPermissionMode(spec.permissionMode);
  const cwd = spec.cwd ?? process.env["AGENT_CWD"] ?? undefined;

  const options: Options = {
    includePartialMessages: true,
    // env REPLACES the subprocess environment, so spread process.env to keep
    // PATH/HOME plus the CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY auth vars.
    env: { ...process.env },
  };
  if (spec.model) options.model = spec.model;
  if (spec.allowedTools && spec.allowedTools.length > 0) options.allowedTools = spec.allowedTools;
  if (spec.disallowedTools && spec.disallowedTools.length > 0) options.disallowedTools = spec.disallowedTools;
  if (permissionMode) {
    options.permissionMode = permissionMode;
    if (permissionMode === "bypassPermissions") options.allowDangerouslySkipPermissions = true;
  }
  if (cwd) options.cwd = cwd;
  if (typeof spec.maxTurns === "number") options.maxTurns = spec.maxTurns;
  if (spec.usePreset) {
    options.systemPrompt = spec.systemPrompt
      ? { type: "preset", preset: "claude_code", append: spec.systemPrompt }
      : { type: "preset", preset: "claude_code" };
  } else if (spec.systemPrompt) {
    options.systemPrompt = spec.systemPrompt;
  }

  const q = query({ prompt: spec.prompt, options });

  void (async () => {
    try {
      for await (const msg of q) emit(msg);
    } catch (err) {
      emit({ type: "error", error: err instanceof Error ? err.message : String(err) });
    }
  })();

  return {
    interrupt: () => {
      void Promise.resolve(q.interrupt()).catch(() => {
        /* control requests are streaming-only; ignore when unsupported */
      });
    },
    stop: () => {
      try {
        q.close();
      } catch {
        /* already closed */
      }
    },
  };
}
