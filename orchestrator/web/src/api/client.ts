import type { FlowGraph } from "@dasd/orch-shared";

/** Thin REST helpers over the orchestrator server (proxied at `/api` in dev). */

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
  }
  return (await res.json()) as T;
}

export interface WorkflowSummary {
  id: string;
  name: string;
  updatedAt?: string;
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  return json<WorkflowSummary[]>(await fetch("/api/workflows"));
}

export async function getWorkflow(id: string): Promise<FlowGraph> {
  return json<FlowGraph>(await fetch(`/api/workflows/${encodeURIComponent(id)}`));
}

export async function saveWorkflow(graph: FlowGraph): Promise<FlowGraph> {
  return json<FlowGraph>(
    await fetch(`/api/workflows/${encodeURIComponent(graph.id)}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(graph),
    }),
  );
}

export async function runWorkflow(id: string): Promise<{ runId: string }> {
  return json<{ runId: string }>(
    await fetch(`/api/workflows/${encodeURIComponent(id)}/run`, { method: "POST" }),
  );
}

export async function stopRun(runId: string): Promise<{ ok: boolean }> {
  return json<{ ok: boolean }>(
    await fetch(`/api/runs/${encodeURIComponent(runId)}/stop`, { method: "POST" }),
  );
}
