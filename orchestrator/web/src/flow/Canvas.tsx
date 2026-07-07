import type { NodeType } from "@dasd/orch-shared";
import { Button, cn } from "@dasd/ui";
import {
  Background,
  BackgroundVariant,
  type Connection,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  useReactFlow,
} from "@xyflow/react";
import { Play, Square } from "lucide-react";
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { runWorkflow, saveWorkflow, stopRun } from "../api/client";
import { useSocket } from "../api/useSocket";
import { useGraphStore } from "../store/graphStore";
import { useRunStore } from "../store/runStore";
import type { AppEdge, AppNode } from "../types";
import { edgeTypes } from "./edgeTypes";
import { nodeTypes } from "./nodeTypes";
import { DND_MIME } from "./palette/Palette";
import { validateConnection } from "./validation";

const KNOWN_TYPES = new Set<NodeType>([
  "trigger",
  "agent",
  "task",
  "tool",
  "code",
  "conditional",
  "group",
]);

function isNodeType(value: string): value is NodeType {
  return KNOWN_TYPES.has(value as NodeType);
}

export function Canvas() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const addNode = useGraphStore((s) => s.addNode);
  const setSelected = useGraphStore((s) => s.setSelected);
  const loadedRev = useGraphStore((s) => s.loadedRev);
  const settings = useGraphStore((s) => s.settings);

  const runStatus = useRunStore((s) => s.status);
  const runId = useRunStore((s) => s.runId);
  const setRunId = useRunStore((s) => s.setRunId);
  const reset = useRunStore((s) => s.reset);

  const { screenToFlowPosition } = useReactFlow();
  const { subscribe, connected } = useSocket();
  const [busy, setBusy] = useState(false);

  const isValidConnection = useCallback(
    (c: Connection | AppEdge) => validateConnection(nodes, edges, c),
    [nodes, edges],
  );

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(DND_MIME);
      if (!isNodeType(raw)) return;
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addNode(raw, position);
    },
    [addNode, screenToFlowPosition],
  );

  // Debounced autosave once a graph has been loaded. `settings` is in the
  // dependency list so flow-settings edits (runner picker etc.) persist too —
  // updateSettings replaces the settings object, retriggering this effect.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: nodes/edges/settings are intentional save triggers; the body reads fresh state via getState()
  useEffect(() => {
    if (loadedRev === 0) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const graph = useGraphStore.getState().toGraph();
      if (graph.id) void saveWorkflow(graph).catch(() => undefined);
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [nodes, edges, settings, loadedRev]);

  const onRun = useCallback(async () => {
    setBusy(true);
    try {
      reset();
      subscribe(["*"]);
      const graph = useGraphStore.getState().toGraph();
      await saveWorkflow(graph);
      const { runId: id } = await runWorkflow(graph.id);
      setRunId(id);
    } catch {
      // Surface nothing fancy in the MVP; leave the run idle.
    } finally {
      setBusy(false);
    }
  }, [reset, subscribe, setRunId]);

  const onStop = useCallback(async () => {
    if (!runId) return;
    setBusy(true);
    try {
      await stopRun(runId);
    } catch {
      // ignore
    } finally {
      setBusy(false);
    }
  }, [runId]);

  const running = runStatus === "running";

  return (
    <div className="relative h-full w-full">
      <ReactFlow<AppNode, AppEdge>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => setSelected(n.id)}
        onPaneClick={() => setSelected(null)}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        isValidConnection={isValidConnection}
        colorMode="dark"
        fitView
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} />
        <MiniMap pannable zoomable className="!bg-surface-2" />
        <Controls />
        <Panel position="top-left">
          <div className="flex items-center gap-2 rounded-md border border-border bg-surface/90 p-1.5 shadow-sm backdrop-blur">
            {running ? (
              <Button size="sm" variant="destructive" onClick={onStop} disabled={busy}>
                <Square size={14} /> Stop
              </Button>
            ) : (
              <Button size="sm" onClick={onRun} disabled={busy}>
                <Play size={14} /> Run
              </Button>
            )}
            <span
              className={cn(
                "flex items-center gap-1.5 px-1.5 text-xs",
                connected ? "text-muted-foreground" : "text-[var(--color-warning)]",
              )}
            >
              <span
                className={cn(
                  "h-1.5 w-1.5 rounded-full",
                  connected ? "bg-[var(--color-success)]" : "bg-[var(--color-warning)]",
                )}
              />
              {connected ? "live" : "offline"}
            </span>
          </div>
        </Panel>
      </ReactFlow>
    </div>
  );
}
