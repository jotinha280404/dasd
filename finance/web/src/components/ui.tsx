import { formatCents, formatCentsCompact } from "@dasd/fin-shared";
import { cn } from "@dasd/ui";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { moneyColor } from "../charts/theme";

/** A surface card — the standard container for content blocks and charts. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-lg border border-border bg-surface p-4", className)}>
      {children}
    </div>
  );
}

/** A card with a title / optional action header, used for chart panels. */
export function Panel({
  title,
  action,
  className,
  bodyClassName,
  children,
}: {
  title: ReactNode;
  action?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}) {
  return (
    <Card className={className}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {action}
      </div>
      <div className={bodyClassName}>{children}</div>
    </Card>
  );
}

/** Signed money, `tabular-nums`, optionally colored income-green / expense-red. */
export function Amount({
  cents,
  currency,
  colored = false,
  compact = false,
  className,
}: {
  cents: number;
  currency: string;
  colored?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const text = compact ? formatCentsCompact(cents, currency) : formatCents(cents, currency);
  const color = colored ? moneyColor(cents) : undefined;
  return (
    <span className={cn("tabular-nums", className)} style={color ? { color } : undefined}>
      {text}
    </span>
  );
}

/** A delta with an arrow + sign (non-color cue) and income/expense color. */
export function Delta({
  cents,
  currency,
  suffix,
}: {
  cents: number;
  currency: string;
  suffix?: string;
}) {
  const up = cents >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const color = up ? moneyColor(1) : moneyColor(-1);
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium tabular-nums"
      style={{ color }}
    >
      <Icon size={13} aria-hidden />
      {up ? "+" : "−"}
      {formatCents(Math.abs(cents), currency)}
      {suffix ? <span className="text-muted-foreground">{suffix}</span> : null}
    </span>
  );
}

/** A KPI tile: label, big value, optional delta / hint line. */
export function StatTile({
  label,
  value,
  delta,
  hint,
}: {
  label: string;
  value: ReactNode;
  delta?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <Card className="flex flex-col gap-1">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="text-2xl font-semibold tabular-nums text-foreground">{value}</span>
      {(delta || hint) && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {delta}
          {hint}
        </span>
      )}
    </Card>
  );
}

/** A thin progress bar with a caller-supplied fill color. */
export function ProgressBar({
  value,
  color,
  className,
}: {
  value: number;
  color: string;
  className?: string;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-surface-2", className)}>
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct * 100}%`, backgroundColor: color }}
      />
    </div>
  );
}

/** A small labeled chip (categories, asset classes, account types). */
export function Chip({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
