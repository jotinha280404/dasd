/**
 * Chart theme — the VALIDATED dataviz palette (dark mode).
 *
 * Rules baked in wherever these are used:
 *  - Color is by job, not decoration. Categorical hues in a FIXED order, never
 *    cycled. One axis only, never dual-axis.
 *  - Grid/axes are recessive; tick + label text wears the ink tokens below,
 *    never a series color.
 *  - A legend appears whenever there are >= 2 series; money via `formatCents`,
 *    axis ticks via `formatCentsCompact`; numbers are `tabular-nums`.
 */

/** Categorical palette — assign in order, never cycle past the end. */
export const SERIES = [
  "#3987e5",
  "#199e70",
  "#c98500",
  "#008300",
  "#9085e9",
  "#e66767",
  "#d55181",
  "#d95926",
] as const;

/** Sequential blue ramp for magnitude encodings (light -> dark). */
export const SEQ_BLUE = ["#cde2fb", "#86b6ef", "#3987e5", "#1c5cab", "#104281"] as const;

/** Status palette — reserved; always shipped with an icon + label, never color alone. */
export const STATUS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

/** Dark chart chrome. Text uses `ink`/`inkSecondary`/`muted`; marks use SERIES. */
export const CHART = {
  surface: "#1a1a19",
  grid: "#2c2c2a",
  axis: "#383835",
  ink: "#ffffff",
  inkSecondary: "#c3c2b7",
  muted: "#898781",
} as const;

/** Polarity: income / gains (aqua-green) vs expense / losses (red). */
export const POS = "#199e70";
export const NEG = "#e66767";

/** Pick the ink color for a signed money value (income green / expense red). */
export function moneyColor(cents: number): string | undefined {
  if (cents > 0) return POS;
  if (cents < 0) return NEG;
  return undefined;
}

/** Budget status color by spend ratio: <=0.8 good, <=1 warning, >1 critical. */
export function budgetStatusColor(pct: number): string {
  if (pct > 1) return STATUS.critical;
  if (pct > 0.8) return STATUS.warning;
  return STATUS.good;
}

export function budgetStatusLabel(pct: number): string {
  if (pct > 1) return "over budget";
  if (pct > 0.8) return "near limit";
  return "on track";
}

/** Goal status color by progress ratio. */
export function goalStatusColor(pct: number): string {
  if (pct >= 1) return STATUS.good;
  if (pct >= 0.5) return SERIES[0];
  return CHART.inkSecondary;
}
