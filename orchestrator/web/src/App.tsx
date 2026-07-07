import type { RunStatus } from "@dasd/orch-shared";
import { cn } from "@dasd/ui";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactFlowProvider } from "@xyflow/react";
import { useEffect } from "react";
import { getWorkflow, listProjects, listWorkflows } from "./api/client";
import { Canvas } from "./flow/Canvas";
import { Inspector } from "./flow/inspector/Inspector";
import { Palette } from "./flow/palette/Palette";
import { ProgressPanel } from "./progress/ProgressPanel";
import { useGraphStore } from "./store/graphStore";
import { useProjectStore } from "./store/projectStore";
import { useRunStore } from "./store/runStore";

const queryClient = new QueryClient();

const STATUS_META: Record<RunStatus | "idle", { label: string; dot: string }> = {
  idle: { label: "idle", dot: "bg-[var(--color-muted-foreground)]" },
  running: { label: "running", dot: "bg-[var(--color-primary)] animate-pulse" },
  success: { label: "success", dot: "bg-[var(--color-success)]" },
  error: { label: "error", dot: "bg-[var(--color-destructive)]" },
  canceled: { label: "canceled", dot: "bg-[var(--color-warning)]" },
};

function TopBar() {
  const graphName = useGraphStore((s) => s.graphName);
  const maxIterations = useGraphStore((s) => s.settings.runner.maxIterations);
  const status = useRunStore((s) => s.status);
  const runner = useRunStore((s) => s.runner);
  const iteration = useRunStore((s) => s.iteration);
  const meta = STATUS_META[status ?? "idle"];
  // "running · ralph 2/10" while a Ralph/Caveman loop is live.
  const label =
    status === "running" && runner && runner !== "dag" && iteration != null
      ? `${meta.label} · ${runner} ${iteration}/${maxIterations}`
      : meta.label;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        <span className="text-lg">🕹️</span>
        <span className="text-sm font-semibold tracking-tight">Orchestrator</span>
        <span className="text-sm text-muted-foreground">· {graphName}</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground">
        <span className={cn("h-1.5 w-1.5 rounded-full", meta.dot)} />
        {label}
      </div>
    </header>
  );
}

function Workbench() {
  const loadGraph = useGraphStore((s) => s.loadGraph);
  const setProjects = useProjectStore((s) => s.setProjects);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await listWorkflows();
        const first = list[0];
        if (!first) return;
        const graph = await getWorkflow(first.id);
        if (!cancelled) loadGraph(graph);
      } catch {
        // Server offline — start with an empty canvas.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadGraph]);

  // Seed the project store; project.update WS frames keep it live from here.
  useEffect(() => {
    let cancelled = false;
    listProjects()
      .then((list) => {
        if (!cancelled) setProjects(list);
      })
      .catch(() => undefined); // server offline — panels show their empty states
    return () => {
      cancelled = true;
    };
  }, [setProjects]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1">
        <Palette />
        <main className="relative min-w-0 flex-1">
          <Canvas />
        </main>
        <Inspector />
      </div>
      <ProgressPanel />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReactFlowProvider>
        <div className="flex h-screen flex-col bg-background text-foreground">
          <TopBar />
          <Workbench />
        </div>
      </ReactFlowProvider>
    </QueryClientProvider>
  );
}
