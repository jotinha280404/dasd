import type { NodeTypes } from "@xyflow/react";
import { AgentNode } from "./nodes/AgentNode";
import { CodeNode } from "./nodes/CodeNode";
import { ConditionalNode } from "./nodes/ConditionalNode";
import { GroupNode } from "./nodes/GroupNode";
import { TaskNode } from "./nodes/TaskNode";
import { ToolNode } from "./nodes/ToolNode";
import { TriggerNode } from "./nodes/TriggerNode";

/** Declared once at module scope (stable identity across renders). */
export const nodeTypes = {
  agent: AgentNode,
  task: TaskNode,
  tool: ToolNode,
  code: CodeNode,
  trigger: TriggerNode,
  conditional: ConditionalNode,
  group: GroupNode,
} satisfies NodeTypes;
