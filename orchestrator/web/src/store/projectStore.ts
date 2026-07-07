import type { Project, ProjectProgress } from "@dasd/orch-shared";
import { projectProgress } from "@dasd/orch-shared";
import { create } from "zustand";

/**
 * Project/backlog state (Phase 2). Filled from GET /api/projects on boot and
 * kept live by `project.update` WS frames (see api/useSocket) — every
 * server-side mutation broadcasts the full updated project, so `applyProject`
 * is a plain upsert.
 */
export interface ProjectState {
  projects: Record<string, Project>;
  /** Upsert one project (WS frame, REST mutation response, optimistic flip). */
  applyProject: (p: Project) => void;
  /** Replace with the server list; keeps any live copy that is newer. */
  setProjects: (list: Project[]) => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  projects: {},

  applyProject: (p) => set((s) => ({ projects: { ...s.projects, [p.id]: p } })),

  setProjects: (list) =>
    set((s) => {
      const next: Record<string, Project> = {};
      for (const p of list) {
        const live = s.projects[p.id];
        next[p.id] = live && live.updatedAt > p.updatedAt ? live : p;
      }
      return { projects: next };
    }),
}));

/** Selector hook: one project by id (stable reference; safe as a zustand selector). */
export function useProject(id: string | null | undefined): Project | undefined {
  return useProjectStore((s) => (id ? s.projects[id] : undefined));
}

/** Selector hook: all projects sorted by name (memo-computed in the caller's render). */
export function useProjectList(): Project[] {
  const projects = useProjectStore((s) => s.projects);
  return Object.values(projects).sort((a, b) => a.name.localeCompare(b.name));
}

const EMPTY_PROGRESS: ProjectProgress = { total: 0, todo: 0, doing: 0, done: 0, pct: 0 };

/** Progress via the shared `projectProgress()`; undefined-safe for missing projects. */
export function progressOf(p: Pick<Project, "items"> | undefined): ProjectProgress {
  return p ? projectProgress(p) : EMPTY_PROGRESS;
}
