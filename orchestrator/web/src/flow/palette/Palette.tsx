import type { NodeType } from "@dasd/orch-shared";
import { useReactFlow } from "@xyflow/react";
import { Bot, Box, Code2, GitBranch, ListChecks, type LucideIcon, Wrench, Zap } from "lucide-react";
import { ObservedSection } from "../../observed/ObservedSection";
import { useGraphStore } from "../../store/graphStore";
import { NODE_TYPES } from "../../types";

const META: Record<NodeType, { icon: LucideIcon; label: string; hint: string }> = {
  trigger: { icon: Zap, label: "Trigger", hint: "Flow entry point" },
  agent: { icon: Bot, label: "Agent", hint: "Claude Code agent" },
  task: { icon: ListChecks, label: "Task", hint: "Task for an agent" },
  tool: { icon: Wrench, label: "Tool", hint: "Agent tool" },
  code: { icon: Code2, label: "Code", hint: "JS/TS snippet" },
  conditional: { icon: GitBranch, label: "If", hint: "Branch on a condition" },
  group: { icon: Box, label: "Group", hint: "Visual grouping" },
};

export const DND_MIME = "application/x-orch-node";

export function Palette() {
  const addNode = useGraphStore((s) => s.addNode);
  const { screenToFlowPosition } = useReactFlow();

  const spawn = (type: NodeType) => {
    const jitter = () => (Math.random() - 0.5) * 80;
    const position = screenToFlowPosition({
      x: window.innerWidth / 2 + jitter(),
      y: window.innerHeight / 2 + jitter(),
    });
    addNode(type, position);
  };

  return (
    <aside className="flex h-full w-52 shrink-0 flex-col gap-1 border-r border-border bg-surface p-3">
      <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Nodes
      </p>
      {NODE_TYPES.map((type) => {
        const { icon: Icon, label, hint } = META[type];
        return (
          <button
            key={type}
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(DND_MIME, type);
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => spawn(type)}
            className="flex items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left transition-colors hover:border-border hover:bg-surface-2"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded bg-surface-2 text-foreground">
              <Icon size={15} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium leading-tight text-foreground">
                {label}
              </span>
              <span className="block truncate text-xs text-muted-foreground">{hint}</span>
            </span>
          </button>
        );
      })}
      <p className="px-1 pt-1 text-[11px] leading-snug text-muted-foreground">
        Click to add, or drag onto the canvas.
      </p>
      <div className="mt-auto border-t border-border pt-3">
        <ObservedSection />
      </div>
    </aside>
  );
}
