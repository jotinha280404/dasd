import type { NodeStatusValue } from "./graph";

/**
 * The normalized agent-event stream. One envelope for SDK-launched AND
 * hook-observed agents — the frontend never branches on `source`. A monotonic
 * `seq` per agentId enables gap-detection + snapshot replay.
 */
export type EventSource = "sdk" | "hook";

export type EventKind =
  | "session.start"
  | "session.end"
  | "user.prompt"
  | "assistant.text"
  | "assistant.thinking"
  | "assistant.delta"
  | "tool.pre"
  | "tool.post"
  | "tool.error"
  | "permission.request"
  | "notification"
  | "compact.pre"
  | "agent.result"
  | "agent.error";

export interface AgentEvent {
  v: 1;
  id: string;
  /** SDK: node id or agent spec id. Hook: `cc:<session_id>`. */
  agentId: string;
  sessionId?: string;
  /** Orchestrator run this belongs to (SDK-launched only). */
  runId?: string;
  /** Canvas node this drives (SDK-launched only). */
  nodeId?: string;
  source: EventSource;
  /** Monotonic per agentId. */
  seq: number;
  /** ISO-8601, server-stamped. */
  ts: string;
  kind: EventKind;
  data: unknown;
  /** Original SDK message / hook JSON (debug; strip in prod). */
  raw?: unknown;
}

// ── kind-specific data payloads ───────────────────────────────────────
export interface TextData {
  text: string;
}
export interface DeltaData {
  text: string;
}
export interface ToolPreData {
  toolName: string;
  toolUseId?: string;
  input: unknown;
}
export interface ToolPostData {
  toolName: string;
  toolUseId?: string;
  output?: unknown;
  isError: boolean;
}
export interface PermissionRequestData {
  toolName: string;
  toolUseId: string;
  input: unknown;
}
export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens?: number;
  cacheCreationInputTokens?: number;
}
export interface ResultData {
  subtype?: string;
  /** Client-side estimate, not billing truth — label "est." in the UI. */
  totalCostUsd?: number;
  numTurns?: number;
  durationMs?: number;
  usage?: Usage;
  result?: string;
}
export interface SessionStartData {
  model?: string;
  cwd?: string;
  tools?: string[];
  apiKeySource?: string;
}
export interface NotificationData {
  message: string;
  hookEventName?: string;
}

// ── run record (drives the monitor overlay; not part of the graph doc) ─
export type RunStatus = "running" | "success" | "error" | "canceled";

export interface RunRecord {
  runId: string;
  workflowId: string;
  startedAt: string;
  endedAt?: string;
  status: RunStatus;
  nodeStatus: Record<string, NodeStatusValue>;
  activeEdges: string[];
  outputs: Record<string, unknown>;
}
