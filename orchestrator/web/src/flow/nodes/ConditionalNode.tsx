import type { NodeProps } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import type { ConditionalNode as ConditionalNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function ConditionalNode({ id, data, selected }: NodeProps<ConditionalNodeType>) {
  const { mode, expression } = data.config;
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={GitBranch}
      label={data.label}
      accent="var(--color-warning)"
      selected={selected}
      summary={
        <span className="block truncate">
          {mode}
          {expression ? ` · ${expression}` : ""}
        </span>
      }
    />
  );
}
