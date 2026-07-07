import type { NodeStatusValue, Port } from "@dasd/orch-shared";
import { cn } from "@dasd/ui";
import { Handle, Position } from "@xyflow/react";
import type { LucideIcon } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useRunStore } from "../../store/runStore";
import type { PortsSpec } from "../../types";

type Side = "left" | "right" | "top" | "bottom";

const POSITION: Record<Side, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

function inputSide(port: Port): Side {
  return port.portType === "tool" || port.portType === "agent" ? "top" : "left";
}

/** Even distribution of `n` handles along a side (as CSS %). */
function offset(index: number, total: number): string {
  return `${((index + 1) / (total + 1)) * 100}%`;
}

const HANDLE_COLOR: Record<Port["portType"], string> = {
  data: "var(--color-primary)",
  control: "var(--color-warning)",
  tool: "var(--color-accent)",
  agent: "var(--color-success)",
};

function handleStyle(port: Port, side: Side, index: number, total: number): CSSProperties {
  const along = offset(index, total);
  const base: CSSProperties = {
    width: 9,
    height: 9,
    background: HANDLE_COLOR[port.portType],
    border: "2px solid var(--color-background)",
  };
  if (side === "left" || side === "right") return { ...base, top: along };
  return { ...base, left: along };
}

const RING: Record<NodeStatusValue, string> = {
  idle: "ring-1 ring-[var(--color-border)]",
  queued: "ring-2 ring-[var(--color-warning)]",
  running: "ring-2 ring-[var(--color-primary)] animate-pulse",
  success: "ring-2 ring-[var(--color-success)]",
  error: "ring-2 ring-[var(--color-destructive)]",
  skipped: "ring-1 ring-[var(--color-muted-foreground)]",
};

export interface NodeShellProps {
  nodeId: string;
  ports: PortsSpec;
  icon: LucideIcon;
  label: string;
  summary?: ReactNode;
  accent: string;
  selected: boolean;
  children?: ReactNode;
}

export function NodeShell({
  nodeId,
  ports,
  icon: Icon,
  label,
  summary,
  accent,
  selected,
  children,
}: NodeShellProps) {
  const status = useRunStore((s) => s.nodeStatus[nodeId] ?? "idle");

  const inputsBySide: Record<Side, Port[]> = { left: [], right: [], top: [], bottom: [] };
  for (const p of ports.inputs) inputsBySide[inputSide(p)].push(p);

  return (
    <div
      className={cn(
        "relative rounded-md border border-border bg-surface text-foreground shadow-sm transition-shadow",
        "min-w-[184px] max-w-[240px]",
        RING[status],
        selected && "shadow-md",
      )}
    >
      {(Object.keys(inputsBySide) as Side[]).flatMap((side) =>
        inputsBySide[side].map((p, i) => (
          <Handle
            key={p.id}
            id={p.id}
            type="target"
            position={POSITION[side]}
            style={handleStyle(p, side, i, inputsBySide[side].length)}
          />
        )),
      )}

      {ports.outputs.map((p, i) => (
        <Handle
          key={p.id}
          id={p.id}
          type="source"
          position={POSITION.right}
          style={handleStyle(p, "right", i, ports.outputs.length)}
        />
      ))}

      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className="flex h-6 w-6 items-center justify-center rounded"
          style={{ background: `color-mix(in srgb, ${accent} 22%, transparent)`, color: accent }}
        >
          <Icon size={14} />
        </span>
        <span className="truncate text-sm font-medium">{label}</span>
      </div>

      {(summary || children) && (
        <div className="px-3 py-2 text-xs text-muted-foreground">
          {summary}
          {children}
        </div>
      )}
    </div>
  );
}
