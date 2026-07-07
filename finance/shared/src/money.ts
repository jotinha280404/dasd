/** Money helpers. Amounts are integer minor units (cents). */

/** Format integer cents as a localized currency string. */
export function formatCents(cents: number, currency = "USD", locale?: string): string {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(cents / 100);
}

/** Compact currency (e.g. $1.2K) for tight tiles/axes. */
export function formatCentsCompact(cents: number, currency = "USD", locale?: string): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

/** Round a major-unit number (e.g. 12.34) to integer cents. */
export function toCents(major: number): number {
  return Math.round(major * 100);
}

/** Integer cents → major units number (e.g. 1234 → 12.34). */
export function toMajor(cents: number): number {
  return cents / 100;
}
