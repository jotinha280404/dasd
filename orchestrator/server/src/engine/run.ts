import { nanoid } from "nanoid";
import type { AgentSpec, FlowGraph, FlowNode, NodeStatusValue, RunRecord } from "@dasd/orch-shared";
import type { AgentPool } from "../agents/pool";
import { bus } from "../bus";

/**
 * The MVP run engine. Topologically orders a FlowGraph from its trigger and runs
 * agent/task nodes sequentially through the pool, awaiting each `agent.result`
 * before advancing. Node-status + active-edge changes are pushed to the bus as
 * `run.status` frames; a per-run `RunRecord` is kept for the REST API.
 */
export class Engine {
  private readonly runs = new Map<string, RunRecord>();

  constructor(private readonly pool: AgentPool) {}

  startRun(graph: FlowGraph): string {
    const runId = nanoid();
    const nodeStatus: Record<string, NodeStatusValue> = {};
    for (const node of graph.nodes) nodeStatus[node.id] = "idle";
    const record: RunRecord = {
      runId,
      workflowId: graph.id,
      startedAt: new Date().toISOString(),
      status: "running",
      nodeStatus,
      activeEdges: [],
      outputs: {},
    };
    this.runs.set(runId, record);
    void this.runWorkflow(graph, record).catch((err: unknown) => {
      record.status = "error";
      record.endedAt = new Date().toISOString();
      this.publish(record);
      console.error("[engine] run failed", err);
    });
    return runId;
  }

  getRun(runId: string): RunRecord | null {
    return this.runs.get(runId) ?? null;
  }

  stopRun(runId: string): boolean {
    const record = this.runs.get(runId);
    if (!record) return false;
    this.pool.stopRun(runId);
    if (record.status === "running") {
      record.status = "canceled";
      record.endedAt = new Date().toISOString();
      record.activeEdges = [];
      this.publish(record);
    }
    return true;
  }

  private isCanceled(record: RunRecord): boolean {
    return record.status === "canceled";
  }

  private publish(record: RunRecord): void {
    bus.emitRunStatus({
      runId: record.runId,
      status: record.status,
      nodeStatus: { ...record.nodeStatus },
      activeEdges: [...record.activeEdges],
    });
  }

  private async runWorkflow(graph: FlowGraph, record: RunRecord): Promise<void> {
    this.publish(record);
    for (const node of topoOrder(graph)) {
      if (this.isCanceled(record)) return;

      if (node.type === "agent" || node.type === "task") {
        record.nodeStatus[node.id] = "running";
        record.activeEdges = graph.edges.filter((e) => e.target === node.id).map((e) => e.id);
        this.publish(record);

        const spec = buildSpec(node, record.runId);
        const result = await this.pool.launch(spec);
        if (this.isCanceled(record)) return;

        if (result.ok) {
          record.nodeStatus[node.id] = "success";
          record.outputs[node.id] = spec.prompt;
          record.activeEdges = graph.edges.filter((e) => e.source === node.id).map((e) => e.id);
          this.publish(record);
        } else {
          record.nodeStatus[node.id] = "error";
          record.activeEdges = [];
          record.status = "error";
          record.endedAt = new Date().toISOString();
          this.publish(record);
          return;
        }
      } else {
        // trigger / tool / code / conditional / group — MVP pass-through.
        record.nodeStatus[node.id] = "success";
        this.publish(record);
      }
    }

    record.activeEdges = [];
    record.status = "success";
    record.endedAt = new Date().toISOString();
    this.publish(record);
  }
}

function buildSpec(node: FlowNode, runId: string): AgentSpec {
  const base = { agentId: node.id, nodeId: node.id, runId };
  if (node.type === "agent") {
    const c = node.data.config;
    return {
      ...base,
      prompt: c.prompt || c.goal || c.role,
      systemPrompt: c.systemPrompt,
      usePreset: c.usePreset,
      model: c.model,
      allowedTools: c.allowedTools,
      disallowedTools: c.disallowedTools,
      effort: c.effort,
      permissionMode: c.permissionMode,
      cwd: c.cwd,
      maxTurns: c.maxTurns,
    };
  }
  if (node.type === "task") {
    const c = node.data.config;
    return {
      ...base,
      prompt: c.description || c.expectedOutput || "Complete the task.",
      model: "claude-opus-4-8",
    };
  }
  return { ...base, prompt: "Complete the task." };
}

/** Kahn's topological sort; trigger nodes are ordered first, cycles appended last. */
function topoOrder(graph: FlowGraph): FlowNode[] {
  const byId = new Map<string, FlowNode>();
  const indeg = new Map<string, number>();
  for (const node of graph.nodes) {
    byId.set(node.id, node);
    indeg.set(node.id, 0);
  }
  const adj = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (!byId.has(edge.source) || !byId.has(edge.target)) continue;
    const list = adj.get(edge.source) ?? [];
    list.push(edge.target);
    adj.set(edge.source, list);
    indeg.set(edge.target, (indeg.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const node of graph.nodes) if ((indeg.get(node.id) ?? 0) === 0) queue.push(node.id);
  queue.sort((a, b) => rank(byId.get(a)) - rank(byId.get(b)));

  const out: FlowNode[] = [];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    const node = byId.get(id);
    if (node) out.push(node);
    for (const target of adj.get(id) ?? []) {
      const d = (indeg.get(target) ?? 0) - 1;
      indeg.set(target, d);
      if (d <= 0 && !seen.has(target)) queue.push(target);
    }
  }
  for (const node of graph.nodes) if (!seen.has(node.id)) out.push(node);
  return out;
}

function rank(node: FlowNode | undefined): number {
  return node?.type === "trigger" ? 0 : 1;
}
