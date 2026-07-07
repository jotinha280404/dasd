import type {
  AgentConfig,
  CodeConfig,
  ConditionalConfig,
  EdgeKind,
  GroupConfig,
  NodeType,
  Port,
  Runtime,
  TaskConfig,
  ToolConfig,
  TriggerConfig,
} from "@dasd/orch-shared";
import type { Edge, Node } from "@xyflow/react";

/**
 * The canvas-side view of the shared graph contract. `AppNode`/`AppEdge` are the
 * React-Flow-native shapes the store holds; they map 1:1 onto `FlowNode`/`FlowEdge`
 * from `@dasd/orch-shared` (see store/graphStore `toGraph`/`loadGraph`).
 */

/** Ports live on `node.data` (the shared `Ports` schema shape). */
export type PortsSpec = {
  inputs: Port[];
  outputs: Port[];
};

/** Common `node.data` envelope; `C` is the per-type config union member. */
export type NodeDataOf<C> = {
  label: string;
  ports: PortsSpec;
  config: C;
  runtime?: Runtime;
};

export type AgentNodeData = NodeDataOf<AgentConfig>;
export type TaskNodeData = NodeDataOf<TaskConfig>;
export type ToolNodeData = NodeDataOf<ToolConfig>;
export type CodeNodeData = NodeDataOf<CodeConfig>;
export type TriggerNodeData = NodeDataOf<TriggerConfig>;
export type ConditionalNodeData = NodeDataOf<ConditionalConfig>;
export type GroupNodeData = NodeDataOf<GroupConfig>;

export type AgentNode = Node<AgentNodeData, "agent">;
export type TaskNode = Node<TaskNodeData, "task">;
export type ToolNode = Node<ToolNodeData, "tool">;
export type CodeNode = Node<CodeNodeData, "code">;
export type TriggerNode = Node<TriggerNodeData, "trigger">;
export type ConditionalNode = Node<ConditionalNodeData, "conditional">;
export type GroupNode = Node<GroupNodeData, "group">;

export type AppNode =
  | AgentNode
  | TaskNode
  | ToolNode
  | CodeNode
  | TriggerNode
  | ConditionalNode
  | GroupNode;

/** Union of every per-type config (handy for the inspector). */
export type AppNodeConfig =
  | AgentConfig
  | TaskConfig
  | ToolConfig
  | CodeConfig
  | TriggerConfig
  | ConditionalConfig
  | GroupConfig;

export type EdgeData = {
  kind: EdgeKind;
  active?: boolean;
  mapping?: { from: string; to: string }[];
};

export type AppEdge = Edge<EdgeData>;

/** All authored node kinds, in palette order. */
export const NODE_TYPES: NodeType[] = [
  "trigger",
  "agent",
  "task",
  "tool",
  "code",
  "conditional",
  "group",
];
