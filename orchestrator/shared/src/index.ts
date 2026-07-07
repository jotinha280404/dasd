/**
 * @dasd/orch-shared — types shared between the orchestrator web app and server.
 *
 * Phase 1 fills this out:
 *   - graph.ts  → zod FlowGraph / Node / Edge + per-type config
 *   - events.ts → the normalized AgentEvent union (SDK + hook sources)
 *   - wire.ts   → WebSocket client<->server frame types
 */
export const ORCH_SHARED_VERSION = "0.0.0";

export interface Health {
  ok: true;
  service: string;
  ts: string;
}
