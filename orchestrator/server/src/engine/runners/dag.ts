import type {
  AgentSpec,
  FlowGraph,
  FlowNode,
  RunnerIterationData,
  RunRecord,
} from "@dasd/orch-shared";
import pLimit from "p-limit";
import type { AgentPool } from "../../agents/pool";
import { bus } from "../../bus";
import { makeEvent } from "../../normalize";

/**
 * The `dag` runner strategy plus the shared machinery every strategy builds on:
 * one topological pass over the graph (`runDagPass`) with level parallelism
 * (Kahn levels, capped by `settings.maxParallelism`) and data passing (each
 * agent/task prompt gets upstream result texts appended; `record.outputs` holds
 * the actual agent answers). `ralph` and `caveman` loop this same pass.
 */

/** What a strategy needs from the engine to drive one run. */
export interface RunnerCtx {
  pool: AgentPool;
  graph: FlowGraph;
  record: RunRecord;
  publish: () => void;
  isCanceled: () => boolean;
}

export interface DagPassOptions {
  /** Extra text appended to every agent/task prompt this pass (Ralph/Caveman). */
  promptSuffix?: string;
}

export interface DagPassResult {
  ok: boolean;
  /** Agent result texts of this pass, in topological-level order. */
  texts: string[];
  combinedText: string;
  error?: string;
}

/** Upstream context appended to a downstream prompt is capped per source. */
const UPSTREAM_CAP = 4000;

/** The plain `dag` strategy: one pass, then a terminal status. */
export async function runDag(ctx: RunnerCtx): Promise<void> {
  const pass = await runDagPass(ctx);
  if (ctx.isCanceled()) return;
  finishRun(ctx, pass.ok ? "success" : "error");
}

/**
 * Execute one full pass over the graph: level by level, agents in the same
 * level run concurrently (capped), non-agent nodes are instant pass-through
 * successes. Returns without touching the record's terminal status — that is
 * the calling strategy's job. Checks cancellation between nodes and levels.
 */
export async function runDagPass(
  ctx: RunnerCtx,
  opts: DagPassOptions = {},
): Promise<DagPassResult> {
  const { graph, record } = ctx;
  const levels = topoLevels(graph);
  const textByNode = new Map<string, string>();
  const collect = (): { texts: string[]; combinedText: string } => {
    const texts: string[] = [];
    for (const level of levels) {
      for (const node of level) {
        const text = textByNode.get(node.id);
        if (text !== undefined) texts.push(text);
      }
    }
    return { texts, combinedText: texts.join("\n\n") };
  };

  // Fresh pass: all nodes back to idle, outputs cleared.
  for (const node of graph.nodes) record.nodeStatus[node.id] = "idle";
  record.activeEdges = [];
  record.outputs = {};
  ctx.publish();

  const limit = pLimit(graph.settings.maxParallelism);
  for (const level of levels) {
    if (ctx.isCanceled()) return { ok: false, ...collect(), error: "canceled" };

    const agentNodes: FlowNode[] = [];
    for (const node of level) {
      if (node.type === "agent" || node.type === "task") {
        agentNodes.push(node);
        record.nodeStatus[node.id] = "queued";
      } else {
        // trigger / tool / code / conditional / group — instant pass-through.
        record.nodeStatus[node.id] = "success";
      }
    }
    if (agentNodes.length === 0) {
      ctx.publish();
      continue;
    }
    const ids = new Set(agentNodes.map((n) => n.id));
    record.activeEdges = graph.edges.filter((e) => ids.has(e.target)).map((e) => e.id);
    ctx.publish();

    let failure: string | undefined;
    await Promise.all(
      agentNodes.map((node) =>
        limit(async () => {
          if (ctx.isCanceled() || failure !== undefined) {
            record.nodeStatus[node.id] = "skipped";
            ctx.publish();
            return;
          }
          record.nodeStatus[node.id] = "running";
          ctx.publish();

          const spec = buildSpec(node, record.runId);
          spec.prompt = `${spec.prompt}${upstreamContext(graph, record, node.id)}${opts.promptSuffix ?? ""}`;
          const result = await ctx.pool.launch(spec);
          if (ctx.isCanceled()) return;

          if (result.ok) {
            record.nodeStatus[node.id] = "success";
            if (typeof result.resultText === "string") {
              record.outputs[node.id] = result.resultText;
              textByNode.set(node.id, result.resultText);
            }
          } else {
            record.nodeStatus[node.id] = "error";
            failure = failure ?? result.error ?? "agent failed";
          }
          ctx.publish();
        }),
      ),
    );

    if (ctx.isCanceled()) return { ok: false, ...collect(), error: "canceled" };
    if (failure !== undefined) {
      record.activeEdges = [];
      ctx.publish();
      return { ok: false, ...collect(), error: failure };
    }
    record.activeEdges = graph.edges.filter((e) => ids.has(e.source)).map((e) => e.id);
    ctx.publish();
  }

  record.activeEdges = [];
  ctx.publish();
  return { ok: true, ...collect() };
}

/** Stamp a terminal status on the record and broadcast it. */
export function finishRun(ctx: RunnerCtx, status: "success" | "error"): void {
  const { record } = ctx;
  record.activeEdges = [];
  record.status = status;
  record.endedAt = new Date().toISOString();
  ctx.publish();
}

/** Fail a run before any pass, leaving the reason in the record's outputs. */
export function failRun(ctx: RunnerCtx, message: string): void {
  ctx.record.outputs["runner:error"] = message;
  finishRun(ctx, "error");
}

/** Publish one `runner.iteration` event for the run's synthetic `runner:<runId>` agent. */
export function emitRunnerIteration(
  record: RunRecord,
  runner: string,
  iteration: number,
  maxIterations: number,
  note: string,
): void {
  const data: RunnerIterationData = { runner, iteration, maxIterations, note };
  bus.emitEvent(
    makeEvent(
      { agentId: `runner:${record.runId}`, runId: record.runId, source: "sdk" },
      "runner.iteration",
      data,
    ),
  );
}

/** Append each upstream agent's result text to a downstream node's prompt. */
function upstreamContext(graph: FlowGraph, record: RunRecord, nodeId: string): string {
  let out = "";
  for (const edge of graph.edges) {
    if (edge.target !== nodeId) continue;
    const output = record.outputs[edge.source];
    if (typeof output !== "string" || output.length === 0) continue;
    const source = graph.nodes.find((n) => n.id === edge.source);
    const label = source?.data.label ?? edge.source;
    out += `\n\n## Upstream context\n### From ${label}\n${output.slice(0, UPSTREAM_CAP)}`;
  }
  return out;
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

/**
 * Kahn's algorithm, grouped into levels: level N holds every node whose
 * dependencies all sit in levels < N, so one level can run concurrently.
 * Nodes on a cycle never reach in-degree 0 and are appended as a final level.
 */
function topoLevels(graph: FlowGraph): FlowNode[][] {
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

  const levels: FlowNode[][] = [];
  const placed = new Set<string>();
  let frontier = graph.nodes.filter((n) => (indeg.get(n.id) ?? 0) === 0);
  while (frontier.length > 0) {
    levels.push(frontier);
    const next: FlowNode[] = [];
    for (const node of frontier) {
      placed.add(node.id);
      for (const target of adj.get(node.id) ?? []) {
        const d = (indeg.get(target) ?? 0) - 1;
        indeg.set(target, d);
        if (d === 0 && !placed.has(target)) {
          const t = byId.get(target);
          if (t) next.push(t);
        }
      }
    }
    frontier = next;
  }
  const cyclic = graph.nodes.filter((n) => !placed.has(n.id));
  if (cyclic.length > 0) levels.push(cyclic);
  return levels;
}
