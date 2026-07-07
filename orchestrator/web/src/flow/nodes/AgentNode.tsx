import type { NodeProps } from "@xyflow/react";
import { Bot } from "lucide-react";
import type { AgentNode as AgentNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function AgentNode({ id, data, selected }: NodeProps<AgentNodeType>) {
  const { role, model, goal } = data.config;
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={Bot}
      label={data.label}
      accent="var(--color-primary)"
      selected={selected}
      summary={
        <span className="block space-y-0.5">
          <span className="block truncate text-foreground">{role || "Agent"}</span>
          <span className="block truncate">{model}</span>
          {goal ? <span className="block truncate italic">{goal}</span> : null}
        </span>
      }
    />
  );
}
