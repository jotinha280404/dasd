import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import type { AgentEvent } from "@dasd/orch-shared";
import { cn } from "@dasd/ui";
import { useGraphStore } from "../../store/graphStore";
import { useRunStore } from "../../store/runStore";
import type { AppNode } from "../../types";
import { FIELDS, type FieldDef } from "./fields";

type FormValues = Record<string, string | number | boolean>;

function buildDefaults(node: AppNode): FormValues {
  const cfg = node.data.config as Record<string, unknown>;
  const values: FormValues = { label: node.data.label };
  for (const f of FIELDS[node.type]) {
    const v = cfg[f.key];
    if (f.kind === "csv") values[f.key] = Array.isArray(v) ? v.join(", ") : "";
    else if (f.kind === "number") values[f.key] = typeof v === "number" ? v : "";
    else if (f.kind === "checkbox") values[f.key] = Boolean(v);
    else values[f.key] = v == null ? "" : String(v);
  }
  return values;
}

function coercePatch(fields: FieldDef[], values: FormValues): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const f of fields) {
    const raw = values[f.key];
    if (f.kind === "csv") {
      patch[f.key] = String(raw ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (f.kind === "number") {
      const n = Number(raw);
      patch[f.key] = Number.isFinite(n) ? n : undefined;
    } else if (f.kind === "checkbox") {
      patch[f.key] = Boolean(raw);
    } else {
      const s = String(raw ?? "");
      patch[f.key] = f.nullable && s === "" ? null : s;
    }
  }
  return patch;
}

const inputClass =
  "w-full rounded-md border border-border bg-[var(--color-input)] px-2 py-1.5 text-sm text-foreground outline-none focus:border-[var(--color-primary)]";

function ConfigForm({ node }: { node: AppNode }) {
  const updateNodeConfig = useGraphStore((s) => s.updateNodeConfig);
  const updateNodeData = useGraphStore((s) => s.updateNodeData);
  const { register, watch, getValues } = useForm<FormValues>({
    defaultValues: buildDefaults(node),
  });

  useEffect(() => {
    const sub = watch(() => {
      const values = getValues();
      const label = typeof values.label === "string" ? values.label : node.data.label;
      updateNodeData(node.id, { label });
      updateNodeConfig(node.id, coercePatch(FIELDS[node.type], values));
    });
    return () => sub.unsubscribe();
  }, [watch, getValues, node.id, node.type, node.data.label, updateNodeConfig, updateNodeData]);

  return (
    <form className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Label</span>
        <input className={inputClass} {...register("label")} />
      </label>

      {FIELDS[node.type].map((f) => (
        <label
          key={f.key}
          className={cn(
            "flex gap-1",
            f.kind === "checkbox" ? "flex-row-reverse items-center justify-end" : "flex-col",
          )}
        >
          <span className="text-xs font-medium text-muted-foreground">{f.label}</span>
          {f.kind === "textarea" ? (
            <textarea
              className={cn(inputClass, "min-h-[72px] resize-y font-mono text-xs")}
              placeholder={f.placeholder}
              {...register(f.key)}
            />
          ) : f.kind === "select" ? (
            <select className={inputClass} {...register(f.key)}>
              {(f.options ?? []).map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          ) : f.kind === "checkbox" ? (
            <input type="checkbox" className="h-4 w-4 accent-[var(--color-primary)]" {...register(f.key)} />
          ) : f.kind === "number" ? (
            <input
              type="number"
              className={inputClass}
              placeholder={f.placeholder}
              {...register(f.key, { valueAsNumber: true })}
            />
          ) : (
            <input
              type="text"
              className={inputClass}
              placeholder={f.placeholder}
              {...register(f.key)}
            />
          )}
        </label>
      ))}

      {FIELDS[node.type].length === 0 && (
        <p className="text-xs text-muted-foreground">This node has no editable settings.</p>
      )}
    </form>
  );
}

// ── logs ──────────────────────────────────────────────────────────────
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
      case "tool.pre":
        flush();
        blocks.push({ k: "tool", name: str(e.data, "toolName") ?? "tool", phase: "pre", error: false });
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
        const usage = e.data && typeof e.data === "object" ? (e.data as Record<string, unknown>).usage : undefined;
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

function LogsView({ nodeId }: { nodeId: string }) {
  const events = useRunStore((s) => s.logsByAgent[nodeId] ?? []);
  const bottomRef = useRef<HTMLDivElement>(null);
  const blocks = toBlocks(events);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [events.length]);

  if (events.length === 0) {
    return <p className="text-xs text-muted-foreground">No activity yet. Press Run to stream logs.</p>;
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {blocks.map((b, i) => {
        if (b.k === "text") {
          return (
            <p key={i} className="whitespace-pre-wrap leading-relaxed text-foreground">
              {b.text}
            </p>
          );
        }
        if (b.k === "tool") {
          return (
            <span
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
            <div key={i} className="mt-1 rounded-md border border-border bg-surface-2 px-2 py-1.5 text-muted-foreground">
              <span className="font-medium text-foreground">Result</span> · est. $
              {(b.cost ?? 0).toFixed(4)} · {b.turns ?? 0} turns · {b.inTok ?? 0}→{b.outTok ?? 0} tok
            </div>
          );
        }
        return (
          <p key={i} className="italic text-muted-foreground">
            {b.text}
          </p>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}

// ── panel ─────────────────────────────────────────────────────────────
export function Inspector() {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null);
  const [tab, setTab] = useState<"config" | "logs">("config");

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
      {!node ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a node to edit its config and watch its live logs.
        </div>
      ) : (
        <>
          <div className="border-b border-border px-4 py-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{node.type}</p>
            <p className="truncate text-sm font-semibold text-foreground">{node.data.label}</p>
          </div>
          <div className="flex gap-1 border-b border-border px-3 pt-2">
            {(["config", "logs"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={cn(
                  "rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
                  tab === t
                    ? "border-b-2 border-[var(--color-primary)] text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t === "config" ? "Config" : "Logs"}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {tab === "config" ? <ConfigForm key={node.id} node={node} /> : <LogsView nodeId={node.id} />}
          </div>
        </>
      )}
    </aside>
  );
}
