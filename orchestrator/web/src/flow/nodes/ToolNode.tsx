import type { NodeProps } from "@xyflow/react";
import { Wrench } from "lucide-react";
import type { ToolNode as ToolNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function ToolNode({ id, data, selected }: NodeProps<ToolNodeType>) {
  const { toolType, name } = data.config;
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={Wrench}
      label={data.label}
      accent="var(--color-accent)"
      selected={selected}
      summary={
        <span className="block truncate">
          {name || "tool"} · {toolType}
        </span>
      }
    />
  );
}
