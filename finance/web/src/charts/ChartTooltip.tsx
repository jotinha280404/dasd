import { formatCents } from "@dasd/fin-shared";
import type { ReactNode } from "react";

/** One row recharts injects into the tooltip payload. */
export interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

export interface ChartTooltipProps {
  /** Injected by recharts. */
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  /** Supplied by us at the call site. */
  currency: string;
  /** Format the header label (e.g. month code -> "Jan"). */
  labelFormatter?: (label: string | number) => ReactNode;
  /** Hide the small color swatch (single-series charts). */
  hideSwatch?: boolean;
}

/** Money values in the payload are integer cents; anything else prints as-is. */
function renderValue(value: number | string | undefined, currency: string): ReactNode {
  if (typeof value === "number") return formatCents(value, currency);
  return value ?? "—";
}

/**
 * Custom tooltip on a `bg-surface border-border` card. Values via `formatCents`,
 * numbers `tabular-nums`, identity carried by a swatch — text stays in ink tokens.
 */
export function ChartTooltip({
  active,
  label,
  payload,
  currency,
  labelFormatter,
  hideSwatch,
}: ChartTooltipProps): ReactNode {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-surface px-3 py-2 text-xs shadow-lg">
      {label !== undefined && (
        <div className="mb-1.5 font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((entry, i) => (
          <div key={`${entry.dataKey ?? i}`} className="flex items-center justify-between gap-6">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              {!hideSwatch && (
                <span
                  className="inline-block h-2 w-2 shrink-0 rounded-sm"
                  style={{ backgroundColor: entry.color }}
                  aria-hidden
                />
              )}
              {entry.name}
            </span>
            <span className="font-medium tabular-nums text-foreground">
              {renderValue(entry.value, currency)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
