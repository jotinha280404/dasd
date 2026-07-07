import type { AgentSpec } from "@dasd/orch-shared";
import { nanoid } from "nanoid";
import type { AgentHandle, EmitRaw } from "./pool";

/**
 * A scripted, keyless agent. Emits raw SDK-shaped messages via `setTimeout` so
 * the same `normalize.fromSdk` path handles it, producing a believable ~4.7s
 * sequence: session.start → typed deltas → a tool call → more deltas → the final
 * answer → result. `stop()`/`interrupt()` clear all pending timers.
 */
export function runMock(spec: AgentSpec, emit: EmitRaw): AgentHandle {
  const sessionId = `mock-${nanoid(8)}`;
  const toolUseId = `toolu_${nanoid(10)}`;
  const timers: Array<ReturnType<typeof setTimeout>> = [];
  let stopped = false;

  const at = (ms: number, fn: () => void): void => {
    timers.push(
      setTimeout(() => {
        if (!stopped) fn();
      }, ms),
    );
  };
  const clearAll = (): void => {
    stopped = true;
    for (const t of timers) clearTimeout(t);
    timers.length = 0;
  };

  const answer = buildAnswer(spec.prompt);
  const intro = "Looking into your request and gathering the key points.";
  const mid = "Synthesizing what I found into a concise summary.";

  at(0, () =>
    emit({
      type: "system",
      subtype: "init",
      session_id: sessionId,
      model: spec.model ?? "claude-opus-4-8",
      cwd: spec.cwd ?? process.cwd(),
      tools: ["Read", "WebSearch", "Grep"],
      apiKeySource: "mock",
      permissionMode: spec.permissionMode ?? "bypassPermissions",
    }),
  );

  let t = 400;
  for (const word of intro.split(" ")) {
    const chunk = `${word} `;
    at(t, () => emit(streamDelta(sessionId, chunk)));
    t += 130;
  }

  t += 250;
  at(t, () =>
    emit({
      type: "assistant",
      session_id: sessionId,
      parent_tool_use_id: null,
      message: {
        role: "assistant",
        content: [
          {
            type: "tool_use",
            id: toolUseId,
            name: "WebSearch",
            input: { query: firstLine(spec.prompt) },
          },
        ],
      },
    }),
  );

  t += 1000;
  at(t, () =>
    emit({
      type: "user",
      session_id: sessionId,
      parent_tool_use_id: null,
      message: {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: toolUseId,
            is_error: false,
            content: "Found 3 relevant, high-quality sources.",
          },
        ],
      },
    }),
  );

  t += 300;
  for (const word of mid.split(" ")) {
    const chunk = `${word} `;
    at(t, () => emit(streamDelta(sessionId, chunk)));
    t += 130;
  }

  t += 300;
  at(t, () =>
    emit({
      type: "assistant",
      session_id: sessionId,
      parent_tool_use_id: null,
      message: { role: "assistant", content: [{ type: "text", text: answer }] },
    }),
  );

  const total = t + 400;
  at(total, () =>
    emit({
      type: "result",
      subtype: "success",
      session_id: sessionId,
      is_error: false,
      num_turns: 2,
      duration_ms: total,
      total_cost_usd: 0.0123,
      result: answer,
      usage: {
        input_tokens: 1200,
        output_tokens: 320,
        cache_read_input_tokens: 0,
        cache_creation_input_tokens: 0,
      },
    }),
  );

  return {
    interrupt: () => {
      clearAll();
      emit({
        type: "result",
        subtype: "interrupted",
        session_id: sessionId,
        is_error: false,
        num_turns: 1,
        duration_ms: total,
        total_cost_usd: 0.004,
        result: "Interrupted by user.",
        usage: { input_tokens: 400, output_tokens: 40 },
      });
    },
    stop: () => {
      clearAll();
      emit({ type: "error", error: "stopped", session_id: sessionId });
    },
  };
}

function streamDelta(sessionId: string, text: string): unknown {
  return {
    type: "stream_event",
    session_id: sessionId,
    parent_tool_use_id: null,
    event: { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } },
  };
}

function firstLine(s: string): string {
  return (s.split("\n")[0] ?? s).slice(0, 120);
}

function buildAnswer(prompt: string): string {
  if (prompt.toLowerCase().includes("typescript")) {
    return [
      "Here are the top 3 benefits of TypeScript for a React team:",
      "",
      "1. Static types catch prop, state, and API-shape bugs at compile time, before they ever reach the browser.",
      "2. First-class editor tooling — autocomplete, inline docs, and safe refactors — keeps the whole team fast as the codebase grows.",
      "3. Shared types across components, hooks, and network calls keep the UI and data layer in sync, so contract changes surface immediately.",
    ].join("\n");
  }
  const topic = firstLine(prompt) || "your request";
  return [
    `Summary for: ${topic}`,
    "",
    "1. Identified the core requirement and the constraints that matter most.",
    "2. Gathered the key supporting facts and cross-checked them.",
    "3. Distilled everything into a short, actionable answer you can use right away.",
  ].join("\n");
}
