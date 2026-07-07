import type { EdgeProps } from "@xyflow/react";
import type { AppEdge } from "../../types";
import { FlowEdgeBase } from "./DataEdge";

export function ControlEdge(props: EdgeProps<AppEdge>) {
  return <FlowEdgeBase {...props} color="var(--color-warning)" dashWhenIdle />;
}
