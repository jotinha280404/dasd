import type { CalendarEvent } from "@dasd/cal-shared";

/**
 * Human-readable formatting for event summaries in `CalendarAction.summary`
 * and assistant replies, e.g. "Dentist appointment — Fri Jul 10, 3:00 PM".
 * All formatting honors the caller's timezone so relative phrasing lines up
 * with what the user sees.
 */

function fmt(iso: string, tz: string, opts: Intl.DateTimeFormatOptions): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso));
  } catch {
    return new Intl.DateTimeFormat("en-US", opts).format(new Date(iso));
  }
}

/** "Fri Jul 10" */
export function formatDate(iso: string, tz: string): string {
  return fmt(iso, tz, { weekday: "short", month: "short", day: "numeric" });
}

/** "3:00 PM" */
export function formatTime(iso: string, tz: string): string {
  return fmt(iso, tz, { hour: "numeric", minute: "2-digit" });
}

/** "Fri Jul 10, 3:00 PM" (or "Fri Jul 10 (all day)"). */
export function formatWhen(event: CalendarEvent, tz: string): string {
  if (event.allDay) return `${formatDate(event.start, tz)} (all day)`;
  return `${formatDate(event.start, tz)}, ${formatTime(event.start, tz)}`;
}

/** "'Dentist appointment' — Fri Jul 10, 3:00 PM". */
export function summarizeEvent(event: CalendarEvent, tz: string): string {
  return `'${event.title}' — ${formatWhen(event, tz)}`;
}
