import type { NodeProps } from "@xyflow/react";
import { Box } from "lucide-react";
import type { GroupNode as GroupNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function GroupNode({ id, data, selected }: NodeProps<GroupNodeType>) {
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={Box}
      label={data.label}
      accent="var(--color-muted-foreground)"
      selected={selected}
      summary={<span className="block truncate">Visual group</span>}
    />
  );
}
