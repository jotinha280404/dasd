import type { EventColorValue } from "@dasd/cal-shared";

/** EventColor → dataviz categorical hex. Kept in lockstep with the shared
 *  `EventColor` enum so the calendar reads as one palette in light and dark. */
export const EVENT_COLOR_HEX: Record<EventColorValue, string> = {
  blue: "#3987e5",
  aqua: "#199e70",
  yellow: "#c98500",
  green: "#008300",
  violet: "#9085e9",
  red: "#e66767",
  magenta: "#d55181",
  orange: "#d95926",
};

/** The colors in enum order — for the modal's color picker. */
export const EVENT_COLORS = Object.keys(EVENT_COLOR_HEX) as EventColorValue[];

export function colorHex(color: EventColorValue): string {
  return EVENT_COLOR_HEX[color];
}

/** A hex color with an alpha channel appended (alpha 0–1). */
export function withAlpha(hex: string, alpha: number): string {
  const clamped = Math.max(0, Math.min(1, alpha));
  const byte = Math.round(clamped * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${byte}`;
}
