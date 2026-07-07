import type { AgentEvent } from "@dasd/orch-shared";
import { cn } from "@dasd/ui";
import { Ghost, X } from "lucide-react";
import { useEffect, useState } from "react";
import { getObserved, type ObservedSession } from "../api/client";
import { LogsView } from "../flow/inspector/LogsView";
import { useRunStore } from "../store/runStore";

/**
 * "Ghost flows": Claude Code sessions observed via orchestrator/hooks, not
 * launched by the canvas. Seeded from GET /api/observed on mount, then merged
 * with live `cc:*` events already flowing in over the wildcard WS
 * subscription. Clicking one opens its live event log (same renderer as the
 * Inspector's Logs tab).
 */

interface Entry {
  agentId: string;
  sessionId: string;
  cwd?: string;
  lastEvent: string;
  eventCount: number;
}

function dataStr(data: unknown, key: string): string | undefined {
  if (data && typeof data === "object" && key in data) {
    const val = (data as Record<string, unknown>)[key];
    if (typeof val === "string") return val;
  }
  return undefined;
}

function mergeObserved(rest: ObservedSession[], logs: Record<string, AgentEvent[]>): Entry[] {
  const map = new Map<string, Entry>();
  for (const o of rest) {
    map.set(o.agentId, {
      agentId: o.agentId,
      sessionId: o.sessionId,
      cwd: o.cwd,
      lastEvent: o.lastEvent,
      eventCount: o.eventCount,
    });
  }
  for (const [agentId, events] of Object.entries(logs)) {
    if (!agentId.startsWith("cc:")) continue;
    const last = events[events.length - 1];
    if (!last) continue;
    const cwd = events.map((e) => dataStr(e.data, "cwd")).find(Boolean);
    const cur = map.get(agentId);
    if (cur) {
      map.set(agentId, {
        ...cur,
        cwd: cur.cwd ?? cwd,
        lastEvent: last.ts > cur.lastEvent ? last.ts : cur.lastEvent,
        // The REST count and the live buffer overlap; the larger is closest to truth.
        eventCount: Math.max(cur.eventCount, events.length),
      });
    } else {
      map.set(agentId, {
        agentId,
        sessionId: last.sessionId ?? agentId.slice(3),
        cwd,
        lastEvent: last.ts,
        eventCount: events.length,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.lastEvent.localeCompare(a.lastEvent));
}

function timeAgo(iso: string): string {
  const ms = Date.now() - Date.parse(iso);
  if (!Number.isFinite(ms) || ms < 1000) return "now";
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function basename(cwd: string | undefined): string | undefined {
  return cwd?.split(/[\\/]/).filter(Boolean).pop();
}

function LogOverlay({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  return (
    <div className="fixed bottom-14 left-56 z-50 flex max-h-[60vh] w-[26rem] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xl">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <Ghost size={13} className="shrink-0 text-muted-foreground" />
        <span className="font-mono text-xs font-medium text-foreground">
          {entry.sessionId.slice(0, 8)}
        </span>
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {basename(entry.cwd) ?? "unknown dir"} · observed session
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close log"
          className="ml-auto rounded p-0.5 text-muted-foreground hover:bg-surface-2 hover:text-foreground"
        >
          <X size={14} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <LogsView
          agentId={entry.agentId}
          emptyText="No live events from this session yet — new activity will stream in here."
        />
      </div>
    </div>
  );
}

export function ObservedSection() {
  const [fetched, setFetched] = useState<ObservedSession[]>([]);
  const logsByAgent = useRunStore((s) => s.logsByAgent);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getObserved()
      .then((list) => {
        if (!cancelled) setFetched(list);
      })
      .catch(() => undefined); // server offline — live merge still works
    return () => {
      cancelled = true;
    };
  }, []);

  const entries = mergeObserved(fetched, logsByAgent);
  const openEntry = entries.find((e) => e.agentId === openId) ?? null;

  return (
    <div className="flex min-h-0 flex-col gap-1">
      <p className="flex items-center gap-1.5 px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Ghost size={12} /> Observed
      </p>
      {entries.length === 0 ? (
        <p className="px-1 text-[11px] leading-snug text-muted-foreground">No sessions observed.</p>
      ) : (
        <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
          {entries.map((e) => (
            <button
              key={e.agentId}
              type="button"
              onClick={() => setOpenId((cur) => (cur === e.agentId ? null : e.agentId))}
              className={cn(
                "flex flex-col rounded-md border border-dashed border-border px-2 py-1.5 text-left opacity-70 transition-all hover:bg-surface-2 hover:opacity-100",
                openId === e.agentId && "border-solid border-[var(--color-primary)] opacity-100",
              )}
            >
              <span className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-xs font-medium text-foreground">
                  {e.sessionId.slice(0, 8)}
                </span>
                <span className="shrink-0 text-[10px] text-muted-foreground">
                  {timeAgo(e.lastEvent)}
                </span>
              </span>
              <span className="truncate text-[11px] text-muted-foreground">
                {basename(e.cwd) ?? "unknown dir"} · {e.eventCount} events
              </span>
            </button>
          ))}
        </div>
      )}
      <p className="px-1 pt-1 text-[10px] leading-snug text-muted-foreground">
        Wire your Claude Code sessions in via orchestrator/hooks — see README.
      </p>
      {openEntry && <LogOverlay entry={openEntry} onClose={() => setOpenId(null)} />}
    </div>
  );
}
