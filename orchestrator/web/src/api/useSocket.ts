import type { ClientFrame, ServerFrame } from "@dasd/orch-shared";
import { useEffect, useRef, useState } from "react";
import { useProjectStore } from "../store/projectStore";
import { useRunStore } from "../store/runStore";

/**
 * Single reconnecting WebSocket to the server's `/ws` hub. Parses `ServerFrame`s
 * into the run store; exposes `send` for `ClientFrame`s and a `connected` flag.
 * A module-level manager keeps one socket even across React StrictMode remounts.
 */

function wsUrl(): string {
  const proto = location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${location.host}/ws`;
}

function handleFrame(frame: ServerFrame): void {
  const run = useRunStore.getState();
  switch (frame.t) {
    case "event":
      run.applyEvent(frame.e);
      break;
    case "snapshot":
      for (const e of frame.events) run.applyEvent(e);
      break;
    case "run.status":
      run.applyRunStatus({
        runId: frame.runId,
        status: frame.status,
        nodeStatus: frame.nodeStatus,
        activeEdges: frame.activeEdges,
        runner: frame.runner,
        iteration: frame.iteration,
      });
      break;
    case "project.update":
      useProjectStore.getState().applyProject(frame.project);
      break;
    case "hello":
      break;
  }
}

class SocketManager {
  private ws: WebSocket | null = null;
  private backoff = 500;
  private closedByUser = false;
  private readonly listeners = new Set<(connected: boolean) => void>();
  private pendingSubscribe: string[] = ["*"];

  onStatus(fn: (connected: boolean) => void): () => void {
    this.listeners.add(fn);
    fn(this.isConnected());
    return () => this.listeners.delete(fn);
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  connect(): void {
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return;
    }
    this.closedByUser = false;
    let ws: WebSocket;
    try {
      ws = new WebSocket(wsUrl());
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.onopen = () => {
      this.backoff = 500;
      this.emit(true);
      this.subscribe(this.pendingSubscribe);
    };
    ws.onclose = () => {
      this.emit(false);
      if (!this.closedByUser) this.scheduleReconnect();
    };
    ws.onerror = () => {
      ws.close();
    };
    ws.onmessage = (ev: MessageEvent<string>) => {
      let frame: ServerFrame;
      try {
        frame = JSON.parse(ev.data) as ServerFrame;
      } catch {
        return;
      }
      handleFrame(frame);
    };
  }

  private scheduleReconnect(): void {
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, 8000);
    setTimeout(() => {
      if (!this.closedByUser) this.connect();
    }, delay);
  }

  private emit(connected: boolean): void {
    for (const fn of this.listeners) fn(connected);
  }

  send(frame: ClientFrame): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(frame));
    }
  }

  subscribe(agentIds: string[]): void {
    this.pendingSubscribe = agentIds;
    this.send({ t: "subscribe", agentIds });
  }
}

const manager = new SocketManager();

export interface UseSocket {
  connected: boolean;
  send: (frame: ClientFrame) => void;
  subscribe: (agentIds: string[]) => void;
}

export function useSocket(): UseSocket {
  const [connected, setConnected] = useState(manager.isConnected());
  const managerRef = useRef(manager);

  useEffect(() => {
    const m = managerRef.current;
    m.connect();
    const off = m.onStatus(setConnected);
    return off;
  }, []);

  return {
    connected,
    send: (frame) => managerRef.current.send(frame),
    subscribe: (agentIds) => managerRef.current.subscribe(agentIds),
  };
}
