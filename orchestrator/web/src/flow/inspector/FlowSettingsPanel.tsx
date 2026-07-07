import type { RunnerConfig, RunnerKind } from "@dasd/orch-shared";
import { Button, cn } from "@dasd/ui";
import { useState } from "react";
import { createProject } from "../../api/client";
import { useGraphStore } from "../../store/graphStore";
import { useProjectList, useProjectStore } from "../../store/projectStore";
import { inputClass } from "./LogsView";

/**
 * Shown in the Inspector when no node is selected: flow-level settings,
 * i.e. the runner strategy (Phase 2). Writes go through
 * `useGraphStore.updateSettings` and ride the canvas autosave.
 */

const RUNNERS: { kind: RunnerKind; label: string; desc: string }[] = [
  { kind: "dag", label: "DAG", desc: "one pass, parallel where possible" },
  { kind: "ralph", label: "Ralph", desc: "loop over a project backlog until done" },
  {
    kind: "caveman",
    label: "Caveman",
    desc: "brute-force retry until the result contains a marker",
  },
];

function patchRunner(patch: Partial<RunnerConfig>): void {
  const { settings, updateSettings } = useGraphStore.getState();
  updateSettings({ runner: { ...settings.runner, ...patch } });
}

function MaxIterationsField({ value }: { value: number }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">Max iterations</span>
      <input
        type="number"
        min={1}
        max={100}
        className={inputClass}
        value={value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) {
            patchRunner({ maxIterations: Math.min(100, Math.max(1, Math.round(n))) });
          }
        }}
      />
    </label>
  );
}

function NewProjectForm({ onDone }: { onDone: () => void }) {
  const graphId = useGraphStore((s) => s.graphId);
  const applyProject = useProjectStore((s) => s.applyProject);
  const [name, setName] = useState("");
  const [items, setItems] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setError(null);
    try {
      const created = await createProject({
        name: trimmed,
        workflowId: graphId || null,
        items: items
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean)
          .map((title) => ({ title, description: "" })),
      });
      applyProject(created);
      patchRunner({ projectId: created.id });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border bg-surface-2 p-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Name</span>
        <input
          className={inputClass}
          value={name}
          placeholder="My project"
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Backlog — one item per line
        </span>
        <textarea
          className={cn(inputClass, "min-h-[72px] resize-y font-mono text-xs")}
          value={items}
          placeholder={"Write the parser\nAdd tests\nUpdate docs"}
          onChange={(e) => setItems(e.target.value)}
        />
      </label>
      {error && <p className="text-xs text-[var(--color-destructive)]">{error}</p>}
      <div className="flex gap-2">
        <Button size="sm" onClick={onCreate} disabled={busy || !name.trim()}>
          Create
        </Button>
        <Button size="sm" variant="ghost" onClick={onDone} disabled={busy}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function RalphFields({ runner }: { runner: RunnerConfig }) {
  const projects = useProjectList();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Project</span>
        <select
          className={inputClass}
          value={runner.projectId ?? ""}
          onChange={(e) => patchRunner({ projectId: e.target.value || null })}
        >
          <option value="">— none —</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      {creating ? (
        <NewProjectForm onDone={() => setCreating(false)} />
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="w-fit text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          New project…
        </button>
      )}
      <MaxIterationsField value={runner.maxIterations} />
    </>
  );
}

function CavemanFields({ runner }: { runner: RunnerConfig }) {
  return (
    <>
      <MaxIterationsField value={runner.maxIterations} />
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground">Done marker</span>
        <input
          className={inputClass}
          value={runner.doneMarker}
          placeholder="DONE"
          onChange={(e) => patchRunner({ doneMarker: e.target.value })}
        />
      </label>
      <label className="flex flex-row-reverse items-center justify-end gap-1">
        <span className="text-xs font-medium text-muted-foreground">
          Compress context between iterations
        </span>
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--color-primary)]"
          checked={runner.compressContext}
          onChange={(e) => patchRunner({ compressContext: e.target.checked })}
        />
      </label>
    </>
  );
}

export function FlowSettingsPanel() {
  const runner = useGraphStore((s) => s.settings.runner);

  return (
    <>
      <div className="border-b border-border px-4 py-3">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">flow</p>
        <p className="truncate text-sm font-semibold text-foreground">Flow settings</p>
      </div>
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">Runner</span>
          <div className="flex flex-col gap-1.5">
            {RUNNERS.map((r) => (
              <button
                key={r.kind}
                type="button"
                onClick={() => patchRunner({ kind: r.kind })}
                className={cn(
                  "rounded-md border px-3 py-2 text-left transition-colors",
                  runner.kind === r.kind
                    ? "border-[var(--color-primary)] bg-surface-2"
                    : "border-border hover:bg-surface-2",
                )}
              >
                <span className="block text-sm font-medium text-foreground">{r.label}</span>
                <span className="block text-xs text-muted-foreground">{r.desc}</span>
              </button>
            ))}
          </div>
        </div>

        {runner.kind === "ralph" && <RalphFields runner={runner} />}
        {runner.kind === "caveman" && <CavemanFields runner={runner} />}

        <p className="mt-auto pt-2 text-[11px] leading-snug text-muted-foreground">
          Select a node to edit its config instead. Settings are autosaved with the flow.
        </p>
      </div>
    </>
  );
}
