import type { Connection } from "@xyflow/react";
import type { AppEdge, AppNode } from "../types";

/**
 * Connection rules for the canvas:
 *  - handles must share the same `portType`,
 *  - no self-loops,
 *  - no duplicate edge (same source/target + handles),
 *  - data edges must keep the graph acyclic (DAG guard).
 */

function portTypeOf(
  nodes: AppNode[],
  nodeId: string | null,
  handleId: string | null,
  side: "outputs" | "inputs",
): string | undefined {
  if (!nodeId) return undefined;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return undefined;
  const ports = node.data.ports[side];
  const match = handleId ? ports.find((p) => p.id === handleId) : ports[0];
  return match?.portType;
}

function wouldCreateCycle(edges: AppEdge[], source: string, target: string): boolean {
  // Only data edges constrain the DAG. Walk forward from `target`; a cycle
  // exists if we can reach `source` again.
  const adjacency = new Map<string, string[]>();
  for (const e of edges) {
    if ((e.data?.kind ?? "data") !== "data") continue;
    const list = adjacency.get(e.source) ?? [];
    list.push(e.target);
    adjacency.set(e.source, list);
  }
  const seen = new Set<string>();
  const stack = [target];
  while (stack.length > 0) {
    const cur = stack.pop() as string;
    if (cur === source) return true;
    if (seen.has(cur)) continue;
    seen.add(cur);
    for (const next of adjacency.get(cur) ?? []) stack.push(next);
  }
  return false;
}

export function validateConnection(
  nodes: AppNode[],
  edges: AppEdge[],
  conn: Connection | AppEdge,
): boolean {
  const { source, target, sourceHandle = null, targetHandle = null } = conn;
  if (!source || !target) return false;
  if (source === target) return false;

  const outType = portTypeOf(nodes, source, sourceHandle, "outputs");
  const inType = portTypeOf(nodes, target, targetHandle, "inputs");
  if (!outType || !inType || outType !== inType) return false;

  const duplicate = edges.some(
    (e) =>
      e.source === source &&
      e.target === target &&
      (e.sourceHandle ?? null) === (sourceHandle ?? null) &&
      (e.targetHandle ?? null) === (targetHandle ?? null),
  );
  if (duplicate) return false;

  if (outType === "data" && wouldCreateCycle(edges, source, target)) return false;

  return true;
}
