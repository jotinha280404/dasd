/**
 * @dasd/orch-shared — the contract shared between the orchestrator web app and
 * server: the flow-graph schema, the normalized agent-event stream, and the
 * WebSocket wire frames.
 */
export const ORCH_SHARED_VERSION = "1.0.0";

export interface Health {
  ok: true;
  service: string;
  ts: string;
}

export * from "./graph";
export * from "./events";
export * from "./wire";
