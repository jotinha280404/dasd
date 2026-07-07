import type { NodeProps } from "@xyflow/react";
import { Code2 } from "lucide-react";
import type { CodeNode as CodeNodeType } from "../../types";
import { NodeShell } from "./NodeShell";

export function CodeNode({ id, data, selected }: NodeProps<CodeNodeType>) {
  const { language, mode } = data.config;
  return (
    <NodeShell
      nodeId={id}
      ports={data.ports}
      icon={Code2}
      label={data.label}
      accent="var(--color-warning)"
      selected={selected}
      summary={
        <span className="block truncate">
          {language} · {mode}
        </span>
      }
    />
  );
}
