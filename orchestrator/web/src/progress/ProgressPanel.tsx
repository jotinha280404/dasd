import type { BacklogItem, BacklogStatus, Project } from "@dasd/orch-shared";
import { cn } from "@dasd/ui";
import { ChevronDown, ChevronUp } from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { addItem, patchItemStatus } from "../api/client";
import { useGraphStore } from "../store/graphStore";
import { progressOf, useProject, useProjectStore } from "../store/projectStore";
import { useRunStore } from "../store/runStore";

/**
 * Collapsible bottom drawer tracking the project selected in flow settings
 * (`settings.runner.projectId`). Live via `project.update` WS frames; clicking
 * an item flips its status (todo → doing → done → todo) with an optimistic
 * local update, then PATCHes — the broadcast frame reconciles.
 */

const NEXT_STATUS: Record<BacklogStatus, BacklogStatus> = {
  todo: "doing",
  doing: "done",
  done: "todo",
};

function runnerLabel(runner: string): string {
  return runner.charAt(0).toUpperCase() + runner.slice(1);
}

function flipStatus(project: Project, item: BacklogItem): void {
  const status = NEXT_STATUS[item.status];
  const { applyProject } = useProjectStore.getState();
  applyProject({
    ...project,
    items: project.items.map((i) => (i.id === item.id ? { ...i, status } : i)),
  });
  patchItemStatus(project.id, item.id, status)
    .then(applyProject)
    .catch(() => undefined); // the next project.update frame reconciles
}

function ItemRow({ project, item }: { project: Project; item: BacklogItem }) {
  return (
    <button
      type="button"
      onClick={() => flipStatus(project, item)}
      title={`${item.title} — click to mark ${NEXT_STATUS[item.status]}`}
      className={cn(
        "flex w-full items-center gap-1.5 rounded-md border px-2 py-1 text-left text-xs transition-colors",
        item.status === "doing"
          ? "border-[var(--color-primary)] bg-surface-2 text-foreground"
          : "border-transparent text-foreground hover:border-border hover:bg-surface-2",
        item.status === "done" && "text-muted-foreground line-through opacity-70",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{item.title}</span>
      {item.status === "done" && item.iteration != null && (
        <span
          title={`done in iteration ${item.iteration}`}
          className="shrink-0 rounded-full border border-border px-1.5 text-[10px] no-underline"
        >
          #{item.iteration}
        </span>
      )}
    </button>
  );
}

function AddItemInput({ project }: { project: Project }) {
  const [title, setTitle] = useState("");

  const submit = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTitle("");
    addItem(project.id, { title: trimmed })
      .then((p) => useProjectStore.getState().applyProject(p))
      .catch(() => undefined); // the project.update frame reconciles
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  };

  return (
    <input
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={onKeyDown}
      placeholder="Add item…"
      className="w-full rounded-md border border-dashed border-border bg-transparent px-2 py-1 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-[var(--color-primary)]"
    />
  );
}

function Column({
  status,
  title,
  project,
}: {
  status: BacklogStatus;
  title: string;
  project: Project;
}) {
  const items = project.items.filter((i) => i.status === status);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-1 rounded-md bg-surface-2/40 p-2">
      <p className="flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
        <span className="font-normal">{items.length}</span>
      </p>
      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {items.map((item) => (
          <ItemRow key={item.id} project={project} item={item} />
        ))}
        {status === "todo" && <AddItemInput project={project} />}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}

export function ProgressPanel() {
  const projectId = useGraphStore((s) => s.settings.runner.projectId);
  const maxIterations = useGraphStore((s) => s.settings.runner.maxIterations);
  const project = useProject(projectId);
  const status = useRunStore((s) => s.status);
  const runner = useRunStore((s) => s.runner);
  const iteration = useRunStore((s) => s.iteration);
  const [open, setOpen] = useState(false);

  const progress = progressOf(project);
  const loopBadge =
    status === "running" && runner && runner !== "dag" && iteration != null
      ? `${runnerLabel(runner)} · iteration ${iteration}/${maxIterations}`
      : null;

  return (
    <section className="shrink-0 border-t border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex h-9 w-full items-center gap-3 px-4 text-left hover:bg-surface-2/60"
      >
        {open ? (
          <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
        ) : (
          <ChevronUp size={14} className="shrink-0 text-muted-foreground" />
        )}
        <span className="text-sm font-semibold text-foreground">Progress</span>
        {project ? (
          <>
            <span className="truncate text-xs text-muted-foreground">{project.name}</span>
            <span className="h-1.5 w-36 shrink-0 overflow-hidden rounded-full bg-surface-2">
              <span
                className="block h-full rounded-full bg-[var(--color-primary)] transition-[width]"
                style={{ width: `${progress.pct}%` }}
              />
            </span>
            <span className="shrink-0 text-xs text-muted-foreground">
              {progress.pct}% · {progress.done}/{progress.total} done
            </span>
          </>
        ) : (
          <span className="truncate text-xs text-muted-foreground">no project</span>
        )}
        {loopBadge && (
          <span className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--color-primary)]" />
            {loopBadge}
          </span>
        )}
      </button>

      {open && (
        <div className="flex h-52 flex-col border-t border-border px-3 py-2">
          {!projectId ? (
            <EmptyState text="No project selected — pick one under Flow settings (click an empty spot on the canvas)." />
          ) : !project ? (
            <EmptyState text="Project not found — it may still be loading, or was deleted." />
          ) : project.items.length === 0 ? (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
              <p className="text-sm text-muted-foreground">Backlog is empty.</p>
              <div className="w-56">
                <AddItemInput project={project} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 gap-2">
              <Column status="todo" title="To do" project={project} />
              <Column status="doing" title="Doing" project={project} />
              <Column status="done" title="Done" project={project} />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
