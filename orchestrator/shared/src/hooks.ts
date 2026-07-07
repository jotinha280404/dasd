import { z } from "zod";

/**
 * Hook observation (Phase 2): the payload a Claude Code hook forwards to
 * `POST /api/hooks`. This is the JSON Claude Code pipes to hook commands on
 * stdin — common fields plus the per-event extras we normalize. Unknown extra
 * keys are stripped here; the server keeps the original body as `raw` on the
 * normalized event.
 */

export const HookEventName = z.enum([
  "SessionStart",
  "UserPromptSubmit",
  "PreToolUse",
  "PostToolUse",
  "Notification",
  "Stop",
  "SubagentStop",
  "PreCompact",
  "SessionEnd",
]);
export type HookEventName = z.infer<typeof HookEventName>;

export const HookPayload = z.object({
  hook_event_name: HookEventName,
  session_id: z.string().min(1),
  transcript_path: z.string().optional(),
  cwd: z.string().optional(),
  /** PreToolUse / PostToolUse */
  tool_name: z.string().optional(),
  tool_input: z.unknown().optional(),
  tool_response: z.unknown().optional(),
  tool_use_id: z.string().optional(),
  /** UserPromptSubmit */
  prompt: z.string().optional(),
  /** Notification */
  message: z.string().optional(),
  /** SessionStart */
  source: z.string().optional(),
  /** SessionEnd */
  reason: z.string().optional(),
  /** PreCompact */
  trigger: z.string().optional(),
});
export type HookPayload = z.infer<typeof HookPayload>;

/** Observed ("ghost") agents are namespaced so they can never collide with launched node ids. */
export function hookAgentId(sessionId: string): string {
  return `cc:${sessionId}`;
}
