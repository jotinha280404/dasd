import { z } from "zod";

/**
 * The project/progress model (Phase 2): a backlog the runner drives and the
 * progress panel renders. Stored server-side as JSON; every mutation is
 * broadcast to clients as a `project.update` wire frame. Ralph runs loop over
 * exactly this backlog — one iteration per `todo` item.
 */

export const BacklogStatus = z.enum(["todo", "doing", "done"]);
export type BacklogStatus = z.infer<typeof BacklogStatus>;

export const BacklogItem = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().default(""),
  status: BacklogStatus.default("todo"),
  /** Runner iteration that moved this item to `done` (Ralph). */
  iteration: z.number().int().nonnegative().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BacklogItem = z.infer<typeof BacklogItem>;

export const Project = z.object({
  schemaVersion: z.literal("1.0").default("1.0"),
  id: z.string(),
  name: z.string(),
  /** Workflow this project tracks (optional back-reference). */
  workflowId: z.string().nullable().default(null),
  items: z.array(BacklogItem).default([]),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type Project = z.infer<typeof Project>;

/** Client payloads for project CRUD (server assigns ids + timestamps). */
export const BacklogItemInput = z.object({
  title: z.string().min(1),
  description: z.string().default(""),
});
export type BacklogItemInput = z.infer<typeof BacklogItemInput>;

export const ProjectInput = z.object({
  name: z.string().min(1),
  workflowId: z.string().nullable().default(null),
  items: z.array(BacklogItemInput).default([]),
});
export type ProjectInput = z.infer<typeof ProjectInput>;

export interface ProjectProgress {
  total: number;
  todo: number;
  doing: number;
  done: number;
  /** 0–100 integer; an empty backlog reads as 0. */
  pct: number;
}

export function projectProgress(p: Pick<Project, "items">): ProjectProgress {
  let todo = 0;
  let doing = 0;
  let done = 0;
  for (const item of p.items) {
    if (item.status === "todo") todo += 1;
    else if (item.status === "doing") doing += 1;
    else done += 1;
  }
  const total = p.items.length;
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { total, todo, doing, done, pct };
}
