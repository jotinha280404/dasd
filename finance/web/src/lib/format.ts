/** Small display formatters shared across pages and charts. */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2025-01" -> "Jan". Falls back to the raw value if unparseable. */
export function monthLabel(period: string): string {
  const parts = period.split("-");
  const m = parts[1];
  if (!m) return period;
  const name = MONTHS[Number(m) - 1];
  return name ?? period;
}

/** "2025-01" -> "Jan '25". */
export function monthYearLabel(period: string): string {
  const parts = period.split("-");
  const y = parts[0];
  const m = parts[1];
  if (!y || !m) return period;
  const name = MONTHS[Number(m) - 1] ?? m;
  return `${name} '${y.slice(2)}`;
}

/** 0.734 -> "73%". */
export function pctLabel(pct: number): string {
  return `${Math.round(pct * 100)}%`;
}

/** Today's date as an ISO YYYY-MM-DD string (local). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
