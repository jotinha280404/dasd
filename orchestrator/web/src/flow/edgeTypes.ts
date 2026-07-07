import type { EdgeTypes } from "@xyflow/react";
import { ControlEdge } from "./edges/ControlEdge";
import { DataEdge } from "./edges/DataEdge";

/** Declared once at module scope (stable identity across renders). */
export const edgeTypes = {
  data: DataEdge,
  control: ControlEdge,
} satisfies EdgeTypes;
