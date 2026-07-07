import type { Server } from "node:http";
import { WebSocket, WebSocketServer } from "ws";
import type { AgentEvent, AgentSpec, ClientFrame, ServerFrame } from "@dasd/orch-shared";
import type { AgentPool } from "../agents/pool";
import { bus } from "../bus";

/**
 * The WebSocket hub at `/ws`. Records every bus event into a bounded per-agent
 * ring buffer, fans events + run-status frames out to subscribers, and handles
 * client control frames (subscribe / launch / interrupt / stop / permission /
 * resumeFrom). A `subscribe(["*"])` gets snapshots of all known agents then all
 * future events live.
 */

const RING_LIMIT = 500;

interface Subscription {
  socket: WebSocket;
  agentIds: Set<string>;
  wildcard: boolean;
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}
function isStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.every((i) => typeof i === "string");
}

function send(socket: WebSocket, frame: ServerFrame): void {
  if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
}

export function attachHub(server: Server, pool: AgentPool): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });
  const ring = new Map<string, AgentEvent[]>();
  const subs = new Map<WebSocket, Subscription>();

  bus.onEvent((e) => {
    const buf = ring.get(e.agentId) ?? [];
    buf.push(e);
    if (buf.length > RING_LIMIT) buf.splice(0, buf.length - RING_LIMIT);
    ring.set(e.agentId, buf);

    const frame: ServerFrame = { t: "event", e };
    for (const sub of subs.values()) {
      if (sub.wildcard || sub.agentIds.has(e.agentId)) send(sub.socket, frame);
    }
  });

  bus.onRunStatus((s) => {
    const frame: ServerFrame = {
      t: "run.status",
      runId: s.runId,
      status: s.status,
      nodeStatus: s.nodeStatus,
      activeEdges: s.activeEdges,
    };
    for (const sub of subs.values()) send(sub.socket, frame);
  });

  wss.on("connection", (socket) => {
    const sub: Subscription = { socket, agentIds: new Set(), wildcard: false };
    subs.set(socket, sub);
    send(socket, { t: "hello", service: "orchestrator-server" });

    socket.on("message", (buf: Buffer) => {
      const frame = parseClientFrame(buf);
      if (frame) handleClientFrame(frame, sub, pool, ring);
    });
    socket.on("close", () => subs.delete(socket));
    socket.on("error", () => subs.delete(socket));
  });

  return wss;
}

function handleClientFrame(
  frame: ClientFrame,
  sub: Subscription,
  pool: AgentPool,
  ring: Map<string, AgentEvent[]>,
): void {
  switch (frame.t) {
    case "subscribe": {
      if (frame.agentIds.includes("*")) {
        sub.wildcard = true;
        for (const [agentId, events] of ring) send(sub.socket, { t: "snapshot", agentId, events });
      } else {
        for (const id of frame.agentIds) {
          sub.agentIds.add(id);
          send(sub.socket, { t: "snapshot", agentId: id, events: ring.get(id) ?? [] });
        }
      }
      return;
    }
    case "launch": {
      sub.agentIds.add(frame.spec.agentId);
      const spec: AgentSpec = { ...frame.spec, runId: frame.spec.runId ?? frame.runId };
      void pool.launch(spec);
      return;
    }
    case "interrupt":
      pool.interrupt(frame.agentId);
      return;
    case "stop":
      pool.stop(frame.agentId);
      return;
    case "permission":
      // Phase 2: accept + ignore for now.
      return;
    case "resumeFrom": {
      const events = (ring.get(frame.agentId) ?? []).filter((e) => e.seq > frame.afterSeq);
      for (const e of events) send(sub.socket, { t: "event", e });
      return;
    }
    default:
      return;
  }
}

function parseClientFrame(buf: Buffer): ClientFrame | null {
  let data: unknown;
  try {
    data = JSON.parse(buf.toString());
  } catch {
    return null;
  }
  if (!isRecord(data)) return null;

  switch (data["t"]) {
    case "subscribe":
      return isStringArray(data["agentIds"]) ? { t: "subscribe", agentIds: data["agentIds"] } : null;
    case "launch":
      return typeof data["runId"] === "string" && isRecord(data["spec"]) && typeof data["spec"]["agentId"] === "string"
        ? { t: "launch", runId: data["runId"], spec: data["spec"] as unknown as AgentSpec }
        : null;
    case "interrupt":
      return typeof data["agentId"] === "string" ? { t: "interrupt", agentId: data["agentId"] } : null;
    case "stop":
      return typeof data["agentId"] === "string" ? { t: "stop", agentId: data["agentId"] } : null;
    case "permission":
      return typeof data["agentId"] === "string" &&
        typeof data["toolUseId"] === "string" &&
        (data["decision"] === "allow" || data["decision"] === "deny")
        ? { t: "permission", agentId: data["agentId"], toolUseId: data["toolUseId"], decision: data["decision"] }
        : null;
    case "resumeFrom":
      return typeof data["agentId"] === "string" && typeof data["afterSeq"] === "number"
        ? { t: "resumeFrom", agentId: data["agentId"], afterSeq: data["afterSeq"] }
        : null;
    default:
      return null;
  }
}
