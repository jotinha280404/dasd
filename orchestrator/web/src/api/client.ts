import type { BacklogStatus, FlowGraph, Project, ProjectInput } from "@dasd/orch-shared";
import { Project as ProjectSchema } from "@dasd/orch-shared";

/** Thin REST helpers over the orchestrator server (proxied at `/api` in dev). */

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${body ? `: ${body}` : ""}`);
  }
  return (await res.json()) as T;
}

const JSON_HEADERS = { "content-type": "application/json" };

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
      headers: JSON_HEADERS,
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

// ── projects (Phase 2) ────────────────────────────────────────────────
// Mutation responses are zod-validated against the shared `Project` schema so a
// malformed body can never poison the store; the `project.update` WS broadcast
// is the reconciling source of truth either way.

export async function listProjects(): Promise<Project[]> {
  const list = await json<unknown[]>(await fetch("/api/projects"));
  return list.map((p) => ProjectSchema.parse(p));
}

export async function createProject(input: ProjectInput): Promise<Project> {
  return ProjectSchema.parse(
    await json<unknown>(
      await fetch("/api/projects", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
      }),
    ),
  );
}

export async function addItem(
  projectId: string,
  input: { title: string; description?: string },
): Promise<Project> {
  return ProjectSchema.parse(
    await json<unknown>(
      await fetch(`/api/projects/${encodeURIComponent(projectId)}/items`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify(input),
      }),
    ),
  );
}

export async function patchItemStatus(
  projectId: string,
  itemId: string,
  status: BacklogStatus,
): Promise<Project> {
  return ProjectSchema.parse(
    await json<unknown>(
      await fetch(
        `/api/projects/${encodeURIComponent(projectId)}/items/${encodeURIComponent(itemId)}`,
        {
          method: "PATCH",
          headers: JSON_HEADERS,
          body: JSON.stringify({ status }),
        },
      ),
    ),
  );
}

// ── observed ("ghost") Claude Code sessions ───────────────────────────
export interface ObservedSession {
  agentId: string;
  sessionId: string;
  cwd?: string;
  lastEvent: string;
  eventCount: number;
  firstSeen: string;
}

export async function getObserved(): Promise<ObservedSession[]> {
  return json<ObservedSession[]>(await fetch("/api/observed"));
}
