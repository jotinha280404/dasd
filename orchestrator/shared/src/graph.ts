import { z } from "zod";

/**
 * The flow-graph contract: what a saved workflow looks like on disk and what
 * the canvas edits. React-Flow-native (flat nodes[] + edges[]), versioned,
 * validated with zod on every load/save. Secrets are referenced, never inlined.
 */

// ── Ports & handles ───────────────────────────────────────────────────
export const PortType = z.enum(["data", "control", "agent", "tool"]);
export type PortType = z.infer<typeof PortType>;

export const Port = z.object({
  id: z.string(),
  name: z.string(),
  portType: PortType,
  many: z.boolean().optional(),
});
export type Port = z.infer<typeof Port>;

export const Ports = z.object({
  inputs: z.array(Port).default([]),
  outputs: z.array(Port).default([]),
});

export const Position = z.object({ x: z.number(), y: z.number() });

// ── Runtime (execution overlay; not authored, filled during a run) ─────
export const NodeStatus = z.enum(["idle", "queued", "running", "success", "error", "skipped"]);
export type NodeStatusValue = z.infer<typeof NodeStatus>;

export const Runtime = z
  .object({
    status: NodeStatus,
    output: z.unknown().nullable(),
    logs: z.array(z.string()),
    startedAt: z.string().nullable(),
    endedAt: z.string().nullable(),
    error: z.string().nullable(),
  })
  .partial();
export type Runtime = z.infer<typeof Runtime>;

// ── Per-type node config ──────────────────────────────────────────────
export const ReasoningEffort = z.enum(["low", "medium", "high", "xhigh", "max"]);
export const PermissionMode = z.enum(["default", "acceptEdits", "bypassPermissions", "plan"]);

/** AGENT — a real Claude Code agent (maps ~1:1 onto the Agent SDK query() options). */
export const AgentConfig = z.object({
  kind: z.literal("agent").default("agent"),
  role: z.string().default("Assistant"),
  goal: z.string().default(""),
  backstory: z.string().optional(),
  /** The task/user prompt this agent runs on. */
  prompt: z.string().default(""),
  /** Raw system-prompt override; null = use the Claude Code preset if usePreset. */
  systemPrompt: z.string().nullable().default(null),
  usePreset: z.boolean().default(false),
  model: z.string().default("claude-opus-4-8"),
  allowedTools: z.array(z.string()).default([]),
  disallowedTools: z.array(z.string()).default([]),
  effort: ReasoningEffort.default("high"),
  permissionMode: PermissionMode.default("bypassPermissions"),
  maxTurns: z.number().int().positive().optional(),
  /** Working dir; null = a per-run sandbox scratch dir (safe default). */
  cwd: z.string().nullable().default(null),
});
export type AgentConfig = z.infer<typeof AgentConfig>;

/** TASK — a CrewAI-style task bound to an agent via an in:agent edge. */
export const TaskConfig = z.object({
  kind: z.literal("task").default("task"),
  description: z.string().default(""),
  expectedOutput: z.string().default(""),
  agentId: z.string().nullable().default(null),
  async: z.boolean().default(false),
});
export type TaskConfig = z.infer<typeof TaskConfig>;

/** TOOL — plugs into an agent's in:tools handle. */
export const ToolType = z.enum([
  "web_search",
  "http_request",
  "mcp",
  "bash",
  "file_read",
  "file_write",
  "custom",
]);
export const ToolConfig = z.object({
  kind: z.literal("tool").default("tool"),
  toolType: ToolType.default("web_search"),
  name: z.string().default("tool"),
  description: z.string().default(""),
});
export type ToolConfig = z.infer<typeof ToolConfig>;

/** CODE — an n8n-style JS snippet. */
export const CodeConfig = z.object({
  kind: z.literal("code").default("code"),
  language: z.enum(["javascript", "typescript", "python"]).default("javascript"),
  mode: z.enum(["all", "perItem"]).default("all"),
  code: z.string().default("// `input` holds upstream output; return a value\nreturn input;"),
  timeoutSec: z.number().default(30),
});
export type CodeConfig = z.infer<typeof CodeConfig>;

/** TRIGGER — a flow entry point. */
export const TriggerConfig = z.object({
  kind: z.literal("trigger").default("trigger"),
  triggerType: z.enum(["manual", "webhook", "schedule", "event"]).default("manual"),
  cron: z.string().nullable().default(null),
});
export type TriggerConfig = z.infer<typeof TriggerConfig>;

/** CONDITIONAL — IF-style branch with two control outputs. */
export const ConditionalConfig = z.object({
  kind: z.literal("conditional").default("conditional"),
  mode: z.enum(["expression", "llm"]).default("expression"),
  expression: z.string().default(""),
  llmPrompt: z.string().optional(),
});
export type ConditionalConfig = z.infer<typeof ConditionalConfig>;

/** GROUP — a visual grouping frame. */
export const GroupConfig = z.object({
  kind: z.literal("group").default("group"),
});
export type GroupConfig = z.infer<typeof GroupConfig>;

// ── Node envelope + typed union ───────────────────────────────────────
export const NodeType = z.enum([
  "agent",
  "task",
  "tool",
  "code",
  "trigger",
  "conditional",
  "group",
]);
export type NodeType = z.infer<typeof NodeType>;

function nodeSchema<K extends string, C extends z.ZodTypeAny>(type: K, config: C) {
  return z.object({
    id: z.string(),
    type: z.literal(type),
    position: Position,
    width: z.number().optional(),
    height: z.number().optional(),
    parentId: z.string().optional(),
    data: z.object({
      label: z.string(),
      ports: Ports,
      config,
      runtime: Runtime.optional(),
    }),
  });
}

export const AgentNode = nodeSchema("agent", AgentConfig);
export const TaskNode = nodeSchema("task", TaskConfig);
export const ToolNode = nodeSchema("tool", ToolConfig);
export const CodeNode = nodeSchema("code", CodeConfig);
export const TriggerNode = nodeSchema("trigger", TriggerConfig);
export const ConditionalNode = nodeSchema("conditional", ConditionalConfig);
export const GroupNode = nodeSchema("group", GroupConfig);

export const FlowNode = z.discriminatedUnion("type", [
  AgentNode,
  TaskNode,
  ToolNode,
  CodeNode,
  TriggerNode,
  ConditionalNode,
  GroupNode,
]);
export type FlowNode = z.infer<typeof FlowNode>;

// ── Edges ─────────────────────────────────────────────────────────────
export const EdgeKind = z.enum(["data", "control", "tool", "agent"]);
export type EdgeKind = z.infer<typeof EdgeKind>;

export const FlowEdge = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  sourceHandle: z.string().nullable().optional(),
  targetHandle: z.string().nullable().optional(),
  /** React Flow edge component key ("data" | "control" | ...). */
  type: z.string().optional(),
  label: z.string().optional(),
  data: z
    .object({
      kind: EdgeKind,
      mapping: z.array(z.object({ from: z.string(), to: z.string() })).optional(),
      /** flipped true during a run to animate the edge. */
      active: z.boolean().default(false),
    })
    .optional(),
});
export type FlowEdge = z.infer<typeof FlowEdge>;

// ── Runner strategies (Phase 2) ───────────────────────────────────────
/**
 * How a run drives its agents:
 * - `dag` — one pass in dependency order, parallel where the graph allows.
 * - `ralph` — loop-until-done over a project backlog (Geoffrey Huntley's
 *   technique): each iteration takes the next `todo` item, runs the flow's
 *   agents on it, and marks it `done`; stops when the backlog is empty.
 * - `caveman` — brute-force re-invoke loop: run the same flow repeatedly
 *   until an agent result contains `doneMarker` (or `maxIterations`).
 */
export const RunnerKind = z.enum(["dag", "ralph", "caveman"]);
export type RunnerKind = z.infer<typeof RunnerKind>;

export const RunnerConfig = z
  .object({
    kind: RunnerKind.default("dag"),
    /** Ralph/Caveman: hard iteration cap so loops always terminate. */
    maxIterations: z.number().int().positive().max(100).default(10),
    /** Ralph: the project whose backlog drives (and records) the loop. */
    projectId: z.string().nullable().default(null),
    /** Caveman: substring in an agent result that means "done". */
    doneMarker: z.string().default("DONE"),
    /** Caveman: carry only a truncated summary between iterations. */
    compressContext: z.boolean().default(false),
  })
  .default({
    kind: "dag",
    maxIterations: 10,
    projectId: null,
    doneMarker: "DONE",
    compressContext: false,
  });
export type RunnerConfig = z.infer<typeof RunnerConfig>;

// ── The graph document ────────────────────────────────────────────────
export const FlowSettings = z
  .object({
    process: z.enum(["sequential", "hierarchical"]).default("sequential"),
    maxParallelism: z.number().int().positive().default(4),
    timeoutSec: z.number().int().positive().default(600),
    runner: RunnerConfig,
  })
  .default({
    process: "sequential",
    maxParallelism: 4,
    timeoutSec: 600,
    runner: {
      kind: "dag",
      maxIterations: 10,
      projectId: null,
      doneMarker: "DONE",
      compressContext: false,
    },
  });
export type FlowSettings = z.infer<typeof FlowSettings>;

export const FlowGraph = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  id: z.string(),
  name: z.string(),
  meta: z
    .object({
      createdAt: z.string(),
      updatedAt: z.string(),
      author: z.string().optional(),
    })
    .partial()
    .optional(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }).optional(),
  settings: FlowSettings,
  nodes: z.array(FlowNode).default([]),
  edges: z.array(FlowEdge).default([]),
});
export type FlowGraph = z.infer<typeof FlowGraph>;

/** Any per-type config (useful for the inspector). */
export type AnyNodeConfig =
  | AgentConfig
  | TaskConfig
  | ToolConfig
  | CodeConfig
  | TriggerConfig
  | ConditionalConfig
  | GroupConfig;
