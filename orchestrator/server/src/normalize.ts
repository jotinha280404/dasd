import { nanoid } from "nanoid";
import type {
  AgentEvent,
  DeltaData,
  EventKind,
  EventSource,
  ResultData,
  SessionStartData,
  TextData,
  ToolPostData,
  ToolPreData,
  Usage,
} from "@dasd/orch-shared";

/**
 * Turns raw `@anthropic-ai/claude-agent-sdk` `SDKMessage`s (and the identically
 * shaped messages the mock provider emits) into the normalized `AgentEvent`
 * stream. Every path is defensive — unknown shapes yield `[]`, never a throw.
 */

export interface NormalizeCtx {
  agentId: string;
  runId?: string;
  nodeId?: string;
  source?: EventSource;
}

/** Monotonic seq per agentId. */
const seqByAgent = new Map<string, number>();
/** Remember toolUseId → toolName so tool_result can be labelled on `tool.post`. */
const toolNames = new Map<string, string>();

function nextSeq(agentId: string): number {
  const next = (seqByAgent.get(agentId) ?? 0) + 1;
  seqByAgent.set(agentId, next);
  return next;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function asString(x: unknown): string | undefined {
  return typeof x === "string" ? x : undefined;
}
function asNumber(x: unknown): number | undefined {
  return typeof x === "number" && Number.isFinite(x) ? x : undefined;
}
function asStringArray(x: unknown): string[] | undefined {
  return Array.isArray(x) && x.every((i) => typeof i === "string") ? (x as string[]) : undefined;
}

function make(
  ctx: NormalizeCtx,
  kind: EventKind,
  data: unknown,
  sessionId: string | undefined,
  raw: unknown,
): AgentEvent {
  const e: AgentEvent = {
    v: 1,
    id: nanoid(),
    agentId: ctx.agentId,
    source: ctx.source ?? "sdk",
    seq: nextSeq(ctx.agentId),
    ts: new Date().toISOString(),
    kind,
    data,
    raw,
  };
  if (sessionId) e.sessionId = sessionId;
  if (ctx.runId) e.runId = ctx.runId;
  if (ctx.nodeId) e.nodeId = ctx.nodeId;
  return e;
}

function fromSystem(ctx: NormalizeCtx, msg: Record<string, unknown>, sessionId: string | undefined): AgentEvent[] {
  if (asString(msg["subtype"]) !== "init") return [];
  const data: SessionStartData = {
    model: asString(msg["model"]),
    cwd: asString(msg["cwd"]),
    tools: asStringArray(msg["tools"]),
    apiKeySource: asString(msg["apiKeySource"]),
  };
  return [make(ctx, "session.start", data, sessionId, msg)];
}

function fromAssistant(
  ctx: NormalizeCtx,
  msg: Record<string, unknown>,
  sessionId: string | undefined,
): AgentEvent[] {
  const message = msg["message"];
  if (!isRecord(message)) return [];
  const content = message["content"];
  if (!Array.isArray(content)) return [];
  const events: AgentEvent[] = [];
  for (const block of content) {
    if (!isRecord(block)) continue;
    const btype = asString(block["type"]);
    if (btype === "text") {
      const data: TextData = { text: asString(block["text"]) ?? "" };
      events.push(make(ctx, "assistant.text", data, sessionId, block));
    } else if (btype === "thinking") {
      const data: TextData = { text: asString(block["thinking"]) ?? "" };
      events.push(make(ctx, "assistant.thinking", data, sessionId, block));
    } else if (btype === "tool_use") {
      const toolName = asString(block["name"]) ?? "tool";
      const toolUseId = asString(block["id"]);
      if (toolUseId) toolNames.set(toolUseId, toolName);
      const data: ToolPreData = { toolName, toolUseId, input: block["input"] };
      events.push(make(ctx, "tool.pre", data, sessionId, block));
    }
  }
  return events;
}

function fromStream(ctx: NormalizeCtx, msg: Record<string, unknown>, sessionId: string | undefined): AgentEvent[] {
  const event = msg["event"];
  if (!isRecord(event) || asString(event["type"]) !== "content_block_delta") return [];
  const delta = event["delta"];
  if (!isRecord(delta) || asString(delta["type"]) !== "text_delta") return [];
  const text = asString(delta["text"]) ?? "";
  if (!text) return [];
  const data: DeltaData = { text };
  return [make(ctx, "assistant.delta", data, sessionId, msg)];
}

function fromUser(ctx: NormalizeCtx, msg: Record<string, unknown>, sessionId: string | undefined): AgentEvent[] {
  const message = msg["message"];
  if (!isRecord(message)) return [];
  const content = message["content"];
  if (!Array.isArray(content)) return [];
  const events: AgentEvent[] = [];
  for (const block of content) {
    if (!isRecord(block) || asString(block["type"]) !== "tool_result") continue;
    const toolUseId = asString(block["tool_use_id"]);
    const toolName = (toolUseId ? toolNames.get(toolUseId) : undefined) ?? "tool";
    const data: ToolPostData = {
      toolName,
      toolUseId,
      output: block["content"],
      isError: block["is_error"] === true,
    };
    events.push(make(ctx, "tool.post", data, sessionId, block));
  }
  return events;
}

function fromResult(ctx: NormalizeCtx, msg: Record<string, unknown>, sessionId: string | undefined): AgentEvent[] {
  const usageRaw = msg["usage"];
  let usage: Usage | undefined;
  if (isRecord(usageRaw)) {
    usage = {
      inputTokens: asNumber(usageRaw["input_tokens"]) ?? 0,
      outputTokens: asNumber(usageRaw["output_tokens"]) ?? 0,
      cacheReadInputTokens: asNumber(usageRaw["cache_read_input_tokens"]),
      cacheCreationInputTokens: asNumber(usageRaw["cache_creation_input_tokens"]),
    };
  }
  const data: ResultData = {
    subtype: asString(msg["subtype"]),
    totalCostUsd: asNumber(msg["total_cost_usd"]),
    numTurns: asNumber(msg["num_turns"]),
    durationMs: asNumber(msg["duration_ms"]),
    usage,
    result: asString(msg["result"]),
  };
  return [make(ctx, "agent.result", data, sessionId, msg)];
}

function fromErrorMsg(ctx: NormalizeCtx, msg: Record<string, unknown>, sessionId: string | undefined): AgentEvent[] {
  const message = asString(msg["error"]) ?? asString(msg["message"]) ?? "Agent error";
  return [make(ctx, "agent.error", { message }, sessionId, msg)];
}

/** Map one raw SDK/mock message to zero or more normalized events. Never throws. */
export function fromSdk(ctx: NormalizeCtx, sdkMsg: unknown): AgentEvent[] {
  try {
    if (!isRecord(sdkMsg)) return [];
    const sessionId = asString(sdkMsg["session_id"]);
    switch (asString(sdkMsg["type"])) {
      case "system":
        return fromSystem(ctx, sdkMsg, sessionId);
      case "assistant":
        return fromAssistant(ctx, sdkMsg, sessionId);
      case "stream_event":
        return fromStream(ctx, sdkMsg, sessionId);
      case "user":
        return fromUser(ctx, sdkMsg, sessionId);
      case "result":
        return fromResult(ctx, sdkMsg, sessionId);
      case "error":
        return fromErrorMsg(ctx, sdkMsg, sessionId);
      default:
        return [];
    }
  } catch {
    return [];
  }
}

/** Phase 2: normalize Claude Code hook JSON. Stubbed for now. */
export function fromHook(_hookJson: unknown): AgentEvent[] {
  return [];
}
