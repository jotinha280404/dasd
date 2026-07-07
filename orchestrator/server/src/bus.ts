import { EventEmitter } from "node:events";
import type { AgentEvent, NodeStatusValue, RunStatus } from "@dasd/orch-shared";

/**
 * A tiny typed event bus wrapping Node's EventEmitter. Two channels: normalized
 * agent `event`s (carrying `{ agentId, runId?, nodeId?, source, raw }` inside the
 * AgentEvent envelope) and `runStatus` updates from the engine. The ws hub
 * subscribes to both and fans them out to clients.
 */

export interface RunStatusUpdate {
  runId: string;
  status: RunStatus;
  nodeStatus: Record<string, NodeStatusValue>;
  activeEdges: string[];
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
}

export const bus = new OrchestratorBus();
