import type { FlowGraph, NodeStatusValue, RunRecord } from "@dasd/orch-shared";
import { nanoid } from "nanoid";
import type { AgentPool } from "../agents/pool";
import { bus } from "../bus";
import { runCaveman } from "./runners/caveman";
import { type RunnerCtx, runDag } from "./runners/dag";
import { runRalph } from "./runners/ralph";

/**
 * The run engine. `startRun` builds a RunRecord, then dispatches on
 * `settings.runner.kind` to a strategy in `./runners/` — `dag` (one parallel
 * topological pass), `ralph` (loop over a project backlog), or `caveman`
 * (brute-force re-invoke until a done-marker). Strategies push node-status /
 * iteration changes to the bus as `run.status` frames; the per-run RunRecord
 * backs the REST API. `stopRun` cancels between nodes and between iterations.
 */
export class Engine {
  private readonly runs = new Map<string, RunRecord>();

  constructor(private readonly pool: AgentPool) {}

  startRun(graph: FlowGraph): string {
    const runId = nanoid();
    const nodeStatus: Record<string, NodeStatusValue> = {};
    for (const node of graph.nodes) nodeStatus[node.id] = "idle";
    const runner = graph.settings.runner;
    const record: RunRecord = {
      runId,
      workflowId: graph.id,
      startedAt: new Date().toISOString(),
      status: "running",
      nodeStatus,
      activeEdges: [],
      outputs: {},
      runner: runner.kind,
    };
    if (runner.kind === "ralph" && runner.projectId) record.projectId = runner.projectId;
    this.runs.set(runId, record);

    const ctx: RunnerCtx = {
      pool: this.pool,
      graph,
      record,
      publish: () => this.publish(record),
      isCanceled: () => record.status === "canceled",
    };
    const strategy =
      runner.kind === "ralph" ? runRalph : runner.kind === "caveman" ? runCaveman : runDag;
    void strategy(ctx).catch((err: unknown) => {
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
    if (record.status === "running") {
      record.status = "canceled";
      record.endedAt = new Date().toISOString();
      record.activeEdges = [];
      this.publish(record);
    }
    this.pool.stopRun(runId);
    return true;
  }

  private publish(record: RunRecord): void {
    bus.emitRunStatus({
      runId: record.runId,
      status: record.status,
      nodeStatus: { ...record.nodeStatus },
      activeEdges: [...record.activeEdges],
      ...(record.runner !== undefined ? { runner: record.runner } : {}),
      ...(record.iteration !== undefined ? { iteration: record.iteration } : {}),
      ...(record.projectId !== undefined ? { projectId: record.projectId } : {}),
    });
  }
}
