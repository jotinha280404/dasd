import { BaseEdge, type EdgeProps, getBezierPath } from "@xyflow/react";
import type { CSSProperties } from "react";
import { useRunStore } from "../../store/runStore";
import type { AppEdge } from "../../types";

interface FlowEdgeBaseProps extends EdgeProps<AppEdge> {
  color: string;
  dashWhenIdle?: boolean;
}

/** Shared bezier edge with a "flowing dot" overlay while the edge is active. */
export function FlowEdgeBase({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  color,
  dashWhenIdle = false,
}: FlowEdgeBaseProps) {
  const active = useRunStore((s) => s.activeEdges.has(id));
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const style: CSSProperties = {
    stroke: active ? color : "var(--color-border)",
    strokeWidth: active ? 2 : 1.5,
    strokeDasharray: active || dashWhenIdle ? "6 4" : undefined,
  };

  return (
    <>
      <BaseEdge id={id} path={edgePath} markerEnd={markerEnd} style={style} />
      {active && (
        <circle r={3.5} fill={color}>
          <animateMotion dur="1.4s" repeatCount="indefinite" path={edgePath} />
        </circle>
      )}
    </>
  );
}

export function DataEdge(props: EdgeProps<AppEdge>) {
  return <FlowEdgeBase {...props} color="var(--color-primary)" />;
}
