import { create } from "zustand";
import type { AgentEvent, NodeStatusValue, RunStatus } from "@dasd/orch-shared";

/** Payload of a `run.status` server frame (kept structural to avoid a wire import). */
export interface RunStatusFrame {
  runId: string;
  status: RunStatus;
  nodeStatus: Record<string, NodeStatusValue>;
  activeEdges: string[];
}

export interface RunState {
  runId: string | null;
  status: RunStatus | null;
  nodeStatus: Record<string, NodeStatusValue>;
  events: AgentEvent[];
  logsByAgent: Record<string, AgentEvent[]>;
  activeEdges: Set<string>;

  setRunId: (runId: string | null) => void;
  applyEvent: (e: AgentEvent) => void;
  applyRunStatus: (frame: RunStatusFrame) => void;
  reset: () => void;
}

const MAX_LOG = 500;

export const useRunStore = create<RunState>((set) => ({
  runId: null,
  status: null,
  nodeStatus: {},
  events: [],
  logsByAgent: {},
  activeEdges: new Set<string>(),

  setRunId: (runId) => set({ runId }),

  applyEvent: (e) =>
    set((s) => {
      const prev = s.logsByAgent[e.agentId] ?? [];
      const nextForAgent = [...prev, e];
      if (nextForAgent.length > MAX_LOG) nextForAgent.splice(0, nextForAgent.length - MAX_LOG);
      const events = [...s.events, e];
      if (events.length > MAX_LOG) events.splice(0, events.length - MAX_LOG);
      return {
        events,
        logsByAgent: { ...s.logsByAgent, [e.agentId]: nextForAgent },
      };
    }),

  applyRunStatus: (frame) =>
    set(() => ({
      runId: frame.runId,
      status: frame.status,
      nodeStatus: frame.nodeStatus,
      activeEdges: new Set(frame.activeEdges),
    })),

  reset: () =>
    set({
      runId: null,
      status: null,
      nodeStatus: {},
      events: [],
      logsByAgent: {},
      activeEdges: new Set<string>(),
    }),
}));
