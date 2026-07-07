import type { NodeProps } from "@xyflow/react";
import { ListChecks } from "lucide-react";
import type { TaskNode as TaskNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function TaskNode({ id, data, selected }: NodeProps<TaskNodeType>) {
  const { description } = data.config;
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={ListChecks}
      label={data.label}
      accent="var(--color-accent)"
      selected={selected}
      summary={
        <span className="block truncate">{description || "No description yet"}</span>
      }
    />
  );
}
