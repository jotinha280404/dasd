import { cn } from "@dasd/ui";
import type { HTMLAttributes } from "react";

/** A rounded, bordered surface card — the base for feed / gallery tiles. */
export function Tile({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]",
        className,
      )}
      {...props}
    />
  );
}
