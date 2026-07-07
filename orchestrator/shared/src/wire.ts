import type { AgentEvent, RunStatus } from "./events";
import type { NodeStatusValue } from "./graph";
import type { Project } from "./project";

/**
 * WebSocket frames between the orchestrator web app and server. Bidirectional
 * because the platform launches AND controls agents AND answers live
 * permission prompts (an SSE one-way channel wouldn't cover the client→server
 * control traffic).
 */

/** What the server needs to launch one real Claude Code agent. */
export interface AgentSpec {
  agentId: string;
  nodeId?: string;
  runId?: string;
  prompt: string;
  systemPrompt?: string | null;
  usePreset?: boolean;
  model?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  effort?: string;
  permissionMode?: string;
  cwd?: string | null;
  maxTurns?: number;
  /** Use the scripted mock provider instead of the real SDK (keyless demo). */
  mock?: boolean;
}

// server → client
export type ServerFrame =
  | { t: "hello"; service: string }
  | { t: "event"; e: AgentEvent }
  | { t: "snapshot"; agentId: string; events: AgentEvent[] }
  | {
      t: "run.status";
      runId: string;
      status: RunStatus;
      nodeStatus: Record<string, NodeStatusValue>;
      activeEdges: string[];
      /** Present on Ralph/Caveman runs. */
      runner?: string;
      iteration?: number;
      projectId?: string;
    }
  | { t: "project.update"; project: Project };

// client → server
export type ClientFrame =
  | { t: "subscribe"; agentIds: string[] }
  | { t: "launch"; runId: string; spec: AgentSpec }
  | { t: "interrupt"; agentId: string }
  | { t: "stop"; agentId: string }
  | { t: "permission"; agentId: string; toolUseId: string; decision: "allow" | "deny" }
  | { t: "resumeFrom"; agentId: string; afterSeq: number };
