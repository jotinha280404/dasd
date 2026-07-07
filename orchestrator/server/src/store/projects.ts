import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  type BacklogItem,
  type BacklogItemInput,
  type BacklogStatus,
  Project,
  type ProjectInput,
} from "@dasd/orch-shared";
import { nanoid } from "nanoid";
import { bus } from "../bus";

/**
 * JSON-file CRUD for projects (runner backlogs). Files live under
 * `<server>/store/data/projects/` — inside the gitignored
 * `orchestrator/server/store/data/` tree — one `<id>.json` per project,
 * validated with `Project.parse` on every read and write. Every mutation is
 * broadcast on the bus's `project` channel so the ws hub can fan out
 * `project.update` frames.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// moduleDir = <server>/src/store → data lives at <server>/store/data/projects (see .gitignore).
const DATA_DIR = path.join(moduleDir, "..", "..", "store", "data", "projects");

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}
function fileFor(id: string): string {
  return path.join(DATA_DIR, `${id}.json`);
}

export async function list(): Promise<Project[]> {
  await ensureDir();
  const names = await fs.readdir(DATA_DIR);
  const projects: Project[] = [];
  for (const name of names) {
    if (!name.endsWith(".json")) continue;
    try {
      const raw = await fs.readFile(path.join(DATA_DIR, name), "utf8");
      projects.push(Project.parse(JSON.parse(raw)));
    } catch {
      // Skip unreadable / invalid files rather than failing the whole list.
    }
  }
  return projects;
}

export async function get(id: string): Promise<Project | null> {
  await ensureDir();
  try {
    const raw = await fs.readFile(fileFor(id), "utf8");
    return Project.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

/** Validate, stamp `updatedAt`, persist, and broadcast the full project. */
export async function save(input: unknown): Promise<Project> {
  await ensureDir();
  const project = Project.parse(input);
  project.updatedAt = new Date().toISOString();
  await fs.writeFile(fileFor(project.id), JSON.stringify(project, null, 2), "utf8");
  bus.emitProject(project);
  return project;
}

export async function remove(id: string): Promise<void> {
  await ensureDir();
  try {
    await fs.unlink(fileFor(id));
  } catch {
    // Already gone — treat delete as idempotent.
  }
}

/** Build a full Project from client input: server assigns ids + timestamps. */
export async function createProject(input: ProjectInput): Promise<Project> {
  const now = new Date().toISOString();
  const project: Project = {
    schemaVersion: "1.0",
    id: nanoid(),
    name: input.name,
    workflowId: input.workflowId,
    items: input.items.map((item) => newItem(item, now)),
    createdAt: now,
    updatedAt: now,
  };
  return save(project);
}

/** Append one backlog item; returns the updated project, or null if missing. */
export async function addItem(projectId: string, input: BacklogItemInput): Promise<Project | null> {
  const project = await get(projectId);
  if (!project) return null;
  project.items.push(newItem(input, new Date().toISOString()));
  return save(project);
}

/**
 * Move one backlog item to `status` (recording the runner `iteration` that did
 * it, when given); returns the updated project, or null when the project or
 * item does not exist.
 */
export async function setItemStatus(
  projectId: string,
  itemId: string,
  status: BacklogStatus,
  iteration?: number,
): Promise<Project | null> {
  const project = await get(projectId);
  if (!project) return null;
  const item = project.items.find((i) => i.id === itemId);
  if (!item) return null;
  item.status = status;
  item.updatedAt = new Date().toISOString();
  if (iteration !== undefined) item.iteration = iteration;
  return save(project);
}

function newItem(input: BacklogItemInput, now: string): BacklogItem {
  return {
    id: nanoid(),
    title: input.title,
    description: input.description,
    status: "todo",
    createdAt: now,
    updatedAt: now,
  };
}
