import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";
import { FlowGraph } from "@dasd/orch-shared";

/**
 * JSON-file CRUD for saved workflows. Files live under `<server>/store/data/`
 * (gitignored), one `<id>.json` per graph, validated with `FlowGraph.parse` on
 * every read and write. Seeds a demo Trigger → Agent graph on first run.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// moduleDir = <server>/src/store → data lives at <server>/store/data (see .gitignore).
const DATA_DIR = path.join(moduleDir, "..", "..", "store", "data");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
function fileFor(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function list(): Promise<FlowGraph[]> {
  await ensureDir();
  const names = await fs.readdir(DATA_DIR);
  const graphs: FlowGraph[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, name), "utf8");
      graphs.push(FlowGraph.parse(JSON.parse(raw)));
    } catch {
      // Skip unreadable / invalid files rather than failing the whole list.
    }
  }
  return graphs;
}

export async function get(id: string): Promise<FlowGraph | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return FlowGraph.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function save(input: unknown): Promise<FlowGraph> {
  await ensureDir();
  const graph = FlowGraph.parse(input);
  const now = new Date().toISOString();
  graph.meta = {
    ...(graph.meta ?? {}),
    createdAt: graph.meta?.createdAt ?? now,
    updatedAt: now,
  };
  await fs.writeFile(fileFor(graph.id), JSON.stringify(graph, null, 2), "utf8");
  return graph;
}

export async function remove(id: string): Promise<void> {
  await ensureDir();
  try {
    await fs.unlink(fileFor(id));
  } catch {
    // Already gone — treat delete as idempotent.
  }
}

export async function seedIfEmpty(): Promise<FlowGraph | null> {
  const existing = await list();
  if (existing.length > 0) return null;
  return save(demoGraph());
}

function demoGraph(): unknown {
  const triggerId = nanoid();
  const agentId = nanoid();
  const now = new Date().toISOString();
  return {
    schemaVersion: "1.0",
    id: nanoid(),
    name: "TypeScript Benefits — Demo",
    meta: { createdAt: now, updatedAt: now, author: "seed" },
    settings: { process: "sequential", maxParallelism: 4, timeoutSec: 600 },
    nodes: [
      {
        id: triggerId,
        type: "trigger",
        position: { x: 80, y: 160 },
        data: {
          label: "Manual Trigger",
          ports: { inputs: [], outputs: [{ id: "out", name: "Start", portType: "control" }] },
          config: { kind: "trigger", triggerType: "manual", cron: null },
        },
      },
      {
        id: agentId,
        type: "agent",
        position: { x: 440, y: 120 },
        data: {
          label: "Researcher",
          ports: {
            inputs: [{ id: "in", name: "In", portType: "control" }],
            outputs: [{ id: "out", name: "Out", portType: "control" }],
          },
          config: {
            kind: "agent",
            role: "Researcher",
            goal: "Summarize the top benefits of TypeScript for a React team.",
            prompt: "Summarize the top 3 benefits of TypeScript for a React team.",
            systemPrompt: null,
            usePreset: false,
            model: "claude-opus-4-8",
            allowedTools: [],
            disallowedTools: [],
            effort: "high",
            permissionMode: "bypassPermissions",
            cwd: null,
          },
        },
      },
    ],
    edges: [
      {
        id: nanoid(),
        source: triggerId,
        target: agentId,
        sourceHandle: "out",
        targetHandle: "in",
        type: "control",
        data: { kind: "control", active: false },
      },
    ],
  };
}
