import { cn } from "@dasd/ui";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}

/** A pill-shaped toggle/selector button. */
export function Chip({ active = false, icon, children, className, ...props }: ChipProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "border-transparent bg-[var(--color-primary)] text-[var(--color-primary-foreground)]"
          : "border-[var(--color-border)] bg-[var(--color-surface-2)] text-foreground hover:bg-[var(--color-muted)]",
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
}
