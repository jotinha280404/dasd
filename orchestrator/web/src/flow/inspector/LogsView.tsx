import type { AgentEvent } from "@dasd/orch-shared";
import { cn } from "@dasd/ui";
import { useEffect, useRef } from "react";
import { useRunStore } from "../../store/runStore";

/**
 * Live event-log renderer for one agent — used by the Inspector's Logs tab
 * (agentId = node id for SDK-launched agents) and by the Observed section
 * (agentId = `cc:<session id>` for hook-observed ghost sessions).
 */

/** Shared input styling for inspector-style panels. */
export const inputClass =
  "w-full rounded-md border border-border bg-[var(--color-input)] px-2 py-1.5 text-sm text-foreground outline-none focus:border-[var(--color-primary)]";

function str(data: unknown, key: string): string | undefined {
  if (data && typeof data === "object" && key in data) {
    const val = (data as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return undefined;
}
function num(data: unknown, key: string): number | undefined {
  if (data && typeof data === "object" && key in data) {
    const val = (data as Record<string, unknown>)[key];
    if (typeof val === "number") return val;
  }
  return undefined;
}

type LogBlock =
  | { k: "text"; text: string }
  | { k: "tool"; name: string; phase: "pre" | "post"; error: boolean }
  | { k: "result"; cost?: number; turns?: number; inTok?: number; outTok?: number }
  | { k: "meta"; text: string };

function toBlocks(events: AgentEvent[]): LogBlock[] {
  const blocks: LogBlock[] = [];
  let buffer = "";
  const flush = () => {
    if (buffer) {
      blocks.push({ k: "text", text: buffer });
      buffer = "";
    }
  };
  for (const e of events) {
    switch (e.kind) {
      case "assistant.delta":
      case "assistant.text":
        buffer += str(e.data, "text") ?? "";
        break;
      case "user.prompt": {
        flush();
        const prompt = str(e.data, "text") ?? str(e.data, "prompt");
        if (prompt) blocks.push({ k: "meta", text: `prompt: ${prompt}` });
        break;
      }
      case "tool.pre":
        flush();
        blocks.push({
          k: "tool",
          name: str(e.data, "toolName") ?? "tool",
          phase: "pre",
          error: false,
        });
        break;
      case "tool.post":
      case "tool.error":
        flush();
        blocks.push({
          k: "tool",
          name: str(e.data, "toolName") ?? "tool",
          phase: "post",
          error: e.kind === "tool.error",
        });
        break;
      case "agent.result": {
        flush();
        const usage =
          e.data && typeof e.data === "object"
            ? (e.data as Record<string, unknown>).usage
            : undefined;
        blocks.push({
          k: "result",
          cost: num(e.data, "totalCostUsd"),
          turns: num(e.data, "numTurns"),
          inTok: num(usage, "inputTokens"),
          outTok: num(usage, "outputTokens"),
        });
        break;
      }
      case "session.start":
        flush();
        blocks.push({ k: "meta", text: `session started · ${str(e.data, "model") ?? "model"}` });
        break;
      case "session.end":
        flush();
        blocks.push({ k: "meta", text: "session ended" });
        break;
      case "notification": {
        flush();
        const message = str(e.data, "message");
        if (message) blocks.push({ k: "meta", text: message });
        break;
      }
      case "agent.error":
        flush();
        blocks.push({ k: "meta", text: `error: ${str(e.data, "message") ?? "agent failed"}` });
        break;
      default:
        break;
    }
  }
  flush();
  return blocks;
}

export function LogsView({ agentId, emptyText }: { agentId: string; emptyText?: string }) {
  const events = useRunStore((s) => s.logsByAgent[agentId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const blocks = toBlocks(events);

  // biome-ignore lint/correctness/useExhaustiveDependencies: events.length intentionally re-triggers the pin-to-bottom scroll on every new event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        {emptyText ?? "No activity yet. Press Run to stream logs."}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {blocks.map((b, i) => {
        if (b.k === "text") {
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: append-only block list
            <p key={i} className="whitespace-pre-wrap leading-relaxed text-foreground">
              {b.text}
            </p>
          );
        }
        if (b.k === "tool") {
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only block list
              key={i}
              className={cn(
                "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 font-mono",
                b.error
                  ? "border-[var(--color-destructive)] text-[var(--color-destructive)]"
                  : "border-border text-muted-foreground",
              )}
            >
              {b.phase === "pre" ? "▶" : "✓"} {b.name}
            </span>
          );
        }
        if (b.k === "result") {
          return (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: append-only block list
              key={i}
              className="mt-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-muted-foreground"
            >
              <span className="font-medium text-foreground">Result</span> · est. $
              {(b.cost ?? 0).toFixed(4)} · {b.turns ?? 0} turns · {b.inTok ?? 0}→{b.outTok ?? 0} tok
            </div>
          );
        }
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: append-only block list
          <p key={i} className="italic text-muted-foreground">
            {b.text}
          </p>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
