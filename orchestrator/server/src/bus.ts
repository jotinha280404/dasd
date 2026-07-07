import { EventEmitter } from "node:events";
import type { AgentEvent, NodeStatusValue, Project, RunStatus } from "@dasd/orch-shared";

/**
 * A tiny typed event bus wrapping Node's EventEmitter. Three channels: normalized
 * agent `event`s (carrying `{ agentId, runId?, nodeId?, source, raw }` inside the
 * AgentEvent envelope), `runStatus` updates from the engine, and `project`
 * snapshots from the project store (every backlog mutation). The ws hub
 * subscribes to all three and fans them out to clients.
 */

export interface RunStatusUpdate {
  runId: string;
  status: RunStatus;
  nodeStatus: Record<string, NodeStatusValue>;
  activeEdges: string[];
  /** Present on Ralph/Caveman runs (mirrors the run.status wire frame). */
  runner?: string;
  iteration?: number;
  projectId?: string;
}

class OrchestratorBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Many subscribers (one per ws connection) are expected; disable the warning.
    this.emitter.setMaxListeners(0);
  }

  emitEvent(e: AgentEvent): void {
    this.emitter.emit("event", e);
  }

  onEvent(fn: (e: AgentEvent) => void): () => void {
    this.emitter.on("event", fn);
    return () => {
      this.emitter.off("event", fn);
    };
  }

  emitRunStatus(s: RunStatusUpdate): void {
    this.emitter.emit("runStatus", s);
  }

  onRunStatus(fn: (s: RunStatusUpdate) => void): () => void {
    this.emitter.on("runStatus", fn);
    return () => {
      this.emitter.off("runStatus", fn);
    };
  }

  emitProject(p: Project): void {
    this.emitter.emit("project", p);
  }

  onProject(fn: (p: Project) => void): () => void {
    this.emitter.on("project", fn);
    return () => {
      this.emitter.off("project", fn);
    };
  }
}

export const bus = new OrchestratorBus();
