import type { NodeProps } from "@xyflow/react";
import { Zap } from "lucide-react";
import type { TriggerNode as TriggerNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function TriggerNode({ id, data, selected }: NodeProps<TriggerNodeType>) {
  const { triggerType, cron } = data.config;
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={Zap}
      label={data.label}
      accent="var(--color-success)"
      selected={selected}
      summary={
        <span className="block truncate">
          {triggerType}
          {cron ? ` · ${cron}` : ""}
        </span>
      }
    />
  );
}
