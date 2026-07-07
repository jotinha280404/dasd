import type { NodeType } from "@dasd/orch-shared";

export type FieldKind = "text" | "textarea" | "number" | "checkbox" | "select" | "csv";

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: readonly string[];
  nullable?: boolean;
  placeholder?: string;
}

const EFFORT = ["low", "medium", "high", "xhigh", "max"] as const;
const PERMISSION = ["default", "acceptEdits", "bypassPermissions", "plan"] as const;
const TOOL_TYPE = [
  "web_search",
  "http_request",
  "mcp",
  "bash",
  "file_read",
  "file_write",
  "custom",
] as const;

/** Which scalar config fields the inspector renders, per node type. */
export const FIELDS: Record<NodeType, FieldDef[]> = {
  agent: [
    { key: "role", label: "Role", kind: "text", placeholder: "Researcher" },
    { key: "model", label: "Model", kind: "text", placeholder: "claude-opus-4-8" },
    { key: "goal", label: "Goal", kind: "textarea" },
    { key: "prompt", label: "Prompt", kind: "textarea" },
    { key: "systemPrompt", label: "System prompt", kind: "textarea", nullable: true },
    { key: "usePreset", label: "Use Claude Code preset", kind: "checkbox" },
    { key: "effort", label: "Reasoning effort", kind: "select", options: EFFORT },
    { key: "permissionMode", label: "Permission mode", kind: "select", options: PERMISSION },
    { key: "allowedTools", label: "Allowed tools", kind: "csv", placeholder: "Read, WebSearch" },
    { key: "disallowedTools", label: "Disallowed tools", kind: "csv" },
    { key: "maxTurns", label: "Max turns", kind: "number" },
    { key: "cwd", label: "Working dir", kind: "text", nullable: true },
  ],
  task: [
    { key: "description", label: "Description", kind: "textarea" },
    { key: "expectedOutput", label: "Expected output", kind: "textarea" },
    { key: "agentId", label: "Bound agent id", kind: "text", nullable: true },
    { key: "async", label: "Run async", kind: "checkbox" },
  ],
  tool: [
    { key: "name", label: "Name", kind: "text" },
    { key: "toolType", label: "Tool type", kind: "select", options: TOOL_TYPE },
    { key: "description", label: "Description", kind: "textarea" },
  ],
  code: [
    {
      key: "language",
      label: "Language",
      kind: "select",
      options: ["javascript", "typescript", "python"],
    },
    { key: "mode", label: "Mode", kind: "select", options: ["all", "perItem"] },
    { key: "code", label: "Code", kind: "textarea" },
    { key: "timeoutSec", label: "Timeout (s)", kind: "number" },
  ],
  trigger: [
    {
      key: "triggerType",
      label: "Trigger type",
      kind: "select",
      options: ["manual", "webhook", "schedule", "event"],
    },
    { key: "cron", label: "Cron", kind: "text", nullable: true },
  ],
  conditional: [
    { key: "mode", label: "Mode", kind: "select", options: ["expression", "llm"] },
    { key: "expression", label: "Expression", kind: "text" },
    { key: "llmPrompt", label: "LLM prompt", kind: "textarea" },
  ],
  group: [],
};
