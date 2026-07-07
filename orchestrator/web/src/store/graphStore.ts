import type {
  EdgeKind,
  FlowEdge,
  FlowGraph,
  FlowNode,
  FlowSettings,
  NodeType,
  Port,
} from "@dasd/orch-shared";
import {
  AgentConfig as AgentConfigSchema,
  CodeConfig as CodeConfigSchema,
  ConditionalConfig as ConditionalConfigSchema,
  FlowSettings as FlowSettingsSchema,
  GroupConfig as GroupConfigSchema,
  TaskConfig as TaskConfigSchema,
  ToolConfig as ToolConfigSchema,
  TriggerConfig as TriggerConfigSchema,
} from "@dasd/orch-shared";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type EdgeChange,
  type NodeChange,
  type XYPosition,
} from "@xyflow/react";
import { nanoid } from "nanoid";
import { create } from "zustand";
import type { AppEdge, AppNode, AppNodeConfig, PortsSpec } from "../types";

type XY = { x: number; y: number };

// ── per-type authoring defaults ───────────────────────────────────────
function defaultConfig(type: NodeType): AppNodeConfig {
  switch (type) {
    case "agent":
      return AgentConfigSchema.parse({});
    case "task":
      return TaskConfigSchema.parse({});
    case "tool":
      return ToolConfigSchema.parse({});
    case "code":
      return CodeConfigSchema.parse({});
    case "trigger":
      return TriggerConfigSchema.parse({});
    case "conditional":
      return ConditionalConfigSchema.parse({});
    case "group":
      return GroupConfigSchema.parse({});
  }
}

function port(id: string, name: string, portType: Port["portType"], many = false): Port {
  return many ? { id, name, portType, many } : { id, name, portType };
}

function defaultPorts(type: NodeType): PortsSpec {
  switch (type) {
    case "trigger":
      return { inputs: [], outputs: [port("out", "out", "data")] };
    case "agent":
      return {
        inputs: [port("in", "in", "data"), port("tools", "tools", "tool", true)],
        outputs: [port("out", "out", "data")],
      };
    case "task":
      return {
        inputs: [port("in", "in", "data"), port("agent", "agent", "agent")],
        outputs: [port("out", "out", "data")],
      };
    case "tool":
      return { inputs: [], outputs: [port("tool", "tool", "tool")] };
    case "code":
      return { inputs: [port("in", "in", "data")], outputs: [port("out", "out", "data")] };
    case "conditional":
      return {
        inputs: [port("in", "in", "data")],
        outputs: [port("true", "true", "control"), port("false", "false", "control")],
      };
    case "group":
      return { inputs: [], outputs: [] };
  }
}

const DEFAULT_LABEL: Record<NodeType, string> = {
  agent: "Agent",
  task: "Task",
  tool: "Tool",
  code: "Code",
  trigger: "Trigger",
  conditional: "If",
  group: "Group",
};

function makeNode(type: NodeType, position: XY): AppNode {
  const node = {
    id: nanoid(),
    type,
    position,
    data: {
      label: DEFAULT_LABEL[type],
      ports: defaultPorts(type),
      config: defaultConfig(type),
    },
  };
  // Discriminated union: `type` and `config` are aligned by construction above.
  return node as AppNode;
}

// ── contract <-> canvas bridges ───────────────────────────────────────
function edgeKindOf(nodes: AppNode[], conn: Connection): EdgeKind {
  const src = nodes.find((n) => n.id === conn.source);
  const outPort = src?.data.ports.outputs.find((p) => p.id === conn.sourceHandle);
  return (outPort?.portType ?? "data") as EdgeKind;
}

function edgeComponentFor(kind: EdgeKind): string {
  return kind === "control" ? "control" : "data";
}

function toFlowNode(n: AppNode): FlowNode {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    width: n.width ?? undefined,
    height: n.height ?? undefined,
    parentId: n.parentId ?? undefined,
    data: {
      label: n.data.label,
      ports: n.data.ports,
      config: n.data.config,
      runtime: n.data.runtime,
    },
  } as FlowNode;
}

function toFlowEdge(e: AppEdge): FlowEdge {
  const kind = e.data?.kind ?? "data";
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? null,
    targetHandle: e.targetHandle ?? null,
    type: e.type ?? edgeComponentFor(kind),
    label: typeof e.label === "string" ? e.label : undefined,
    data: {
      kind,
      active: e.data?.active ?? false,
      mapping: e.data?.mapping,
    },
  };
}

function fromFlowNode(n: FlowNode): AppNode {
  return {
    id: n.id,
    type: n.type,
    position: n.position,
    width: n.width,
    height: n.height,
    parentId: n.parentId,
    data: {
      label: n.data.label,
      ports: n.data.ports,
      config: n.data.config,
      runtime: n.data.runtime,
    },
  } as AppNode;
}

function fromFlowEdge(e: FlowEdge): AppEdge {
  const kind = e.data?.kind ?? "data";
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
    type: e.type ?? edgeComponentFor(kind),
    label: e.label,
    data: { kind, active: e.data?.active ?? false, mapping: e.data?.mapping },
  };
}

// ── store ─────────────────────────────────────────────────────────────
export interface GraphState {
  graphId: string;
  graphName: string;
  nodes: AppNode[];
  edges: AppEdge[];
  settings: FlowSettings;
  selectedNodeId: string | null;
  /** Bumped whenever a graph is loaded, so autosave can skip the load echo. */
  loadedRev: number;

  onNodesChange: (changes: NodeChange<AppNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<AppEdge>[]) => void;
  onConnect: (conn: Connection) => void;

  addNode: (type: NodeType, position: XYPosition) => void;
  updateNodeData: (id: string, patch: Partial<AppNode["data"]>) => void;
  updateNodeConfig: (id: string, patch: Record<string, unknown>) => void;
  setSelected: (id: string | null) => void;
  setGraph: (nodes: AppNode[], edges: AppEdge[]) => void;
  updateSettings: (patch: Partial<FlowSettings>) => void;
  toGraph: () => FlowGraph;
  loadGraph: (graph: FlowGraph) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  graphId: "",
  graphName: "Untitled flow",
  nodes: [],
  edges: [],
  settings: FlowSettingsSchema.parse(undefined),
  selectedNodeId: null,
  loadedRev: 0,

  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges<AppNode>(changes, s.nodes) })),

  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges<AppEdge>(changes, s.edges) })),

  onConnect: (conn) =>
    set((s) => {
      const kind = edgeKindOf(s.nodes, conn);
      const edge: AppEdge = {
        id: nanoid(),
        source: conn.source,
        target: conn.target,
        sourceHandle: conn.sourceHandle ?? undefined,
        targetHandle: conn.targetHandle ?? undefined,
        type: edgeComponentFor(kind),
        data: { kind, active: false },
      };
      return { edges: addEdge<AppEdge>(edge, s.edges) };
    }),

  addNode: (type, position) =>
    set((s) => {
      const node = makeNode(type, position);
      return { nodes: [...s.nodes, node], selectedNodeId: node.id };
    }),

  updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? ({ ...n, data: { ...n.data, ...patch } } as AppNode) : n,
      ),
    })),

  updateNodeConfig: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id
          ? ({
              ...n,
              data: { ...n.data, config: { ...n.data.config, ...patch } },
            } as AppNode)
          : n,
      ),
    })),

  setSelected: (id) => set({ selectedNodeId: id }),

  setGraph: (nodes, edges) => set({ nodes, edges }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  toGraph: () => {
    const s = get();
    return {
      schemaVersion: "1.0",
      id: s.graphId || nanoid(),
      name: s.graphName,
      settings: s.settings,
      nodes: s.nodes.map(toFlowNode),
      edges: s.edges.map(toFlowEdge),
    };
  },

  loadGraph: (graph) =>
    set((s) => ({
      graphId: graph.id,
      graphName: graph.name,
      nodes: graph.nodes.map(fromFlowNode),
      edges: graph.edges.map(fromFlowEdge),
      settings: graph.settings,
      selectedNodeId: null,
      loadedRev: s.loadedRev + 1,
    })),
}));
