import { cn } from "@dasd/ui";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

/** Inline loading spinner for query panels. */
export function Loading({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  );
}

/** Error panel — the server is optional in this build, so keep it calm. */
export function ErrorState({ error, className }: { error: unknown; className?: string }) {
  const message = error instanceof Error ? error.message : "Something went wrong";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-1 py-12 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      <span className="font-medium text-foreground">Couldn’t load data</span>
      <span className="max-w-sm text-xs">{message}</span>
      <span className="text-xs">Is the finance server running? (npm run dev:finance)</span>
    </div>
  );
}

/** Empty placeholder with an optional call to action. */
export function EmptyState({
  icon,
  title,
  hint,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-2 py-12 text-center text-sm text-muted-foreground",
        className,
      )}
    >
      {icon && <span className="text-muted-foreground">{icon}</span>}
      <span className="font-medium text-foreground">{title}</span>
      {hint && <span className="max-w-sm text-xs">{hint}</span>}
      {action}
    </div>
  );
}
