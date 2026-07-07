import { cn } from "@dasd/ui";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useGraphStore } from "../../store/graphStore";
import type { AppNode } from "../../types";
import { FlowSettingsPanel } from "./FlowSettingsPanel";
import { FIELDS, type FieldDef } from "./fields";
import { inputClass, LogsView } from "./LogsView";

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
        // biome-ignore lint/a11y/noLabelWithoutControl: the control is inside the label — the conditional rendering defeats biome's static check
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
            <input
              type="checkbox"
              className="h-4 w-4 accent-[var(--color-primary)]"
              {...register(f.key)}
            />
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

// ── panel ─────────────────────────────────────────────────────────────
export function Inspector() {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === s.selectedNodeId) ?? null);
  const [tab, setTab] = useState<"config" | "logs">("config");

  return (
    <aside className="flex h-full w-80 shrink-0 flex-col border-l border-border bg-surface">
      {!node ? (
        <FlowSettingsPanel />
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
            {tab === "config" ? (
              <ConfigForm key={node.id} node={node} />
            ) : (
              <LogsView agentId={node.id} />
            )}
          </div>
        </>
      )}
    </aside>
  );
}
