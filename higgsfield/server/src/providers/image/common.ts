/** Shared helpers for the image providers. */

/** Clamp a requested output count into the supported 1–4 range. */
export function clampCount(count: number | undefined): number {
  if (count === undefined || Number.isNaN(count)) return 1;
  return Math.max(1, Math.min(4, Math.floor(count)));
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
