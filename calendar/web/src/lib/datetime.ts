import type { CalendarEvent, DateRange } from "@dasd/cal-shared";
import {
  addDays,
  eachDayOfInterval,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";

/** Short weekday headers for the month grid (Sun-first). */
export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** All days shown in the month grid for `cursor` — full weeks padding the month. */
export function monthGridDays(cursor: Date): Date[] {
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  return eachDayOfInterval({ start, end });
}

/** Split a flat day list into rows of 7 (weeks). */
export function chunkWeeks(days: Date[]): Date[][] {
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }
  return weeks;
}

/** The ISO [from,to] window covering the visible month grid — used to query events. */
export function visibleRange(cursor: Date): DateRange {
  const start = startOfWeek(startOfMonth(cursor));
  const end = endOfWeek(endOfMonth(cursor));
  return { from: startOfDay(start).toISOString(), to: endOfDay(end).toISOString() };
}

/** True when `event` overlaps the calendar day `day` (end is exclusive). */
export function eventOverlapsDay(event: CalendarEvent, day: Date): boolean {
  const start = parseISO(event.start);
  const end = parseISO(event.end);
  return start < endOfDay(day) && end > startOfDay(day);
}

/** Events overlapping `day`, all-day first then chronological. */
export function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => eventOverlapsDay(e, day)).sort(compareForDisplay);
}

/** All-day events sort before timed ones; ties break on start time. */
export function compareForDisplay(a: CalendarEvent, b: CalendarEvent): number {
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  return parseISO(a.start).getTime() - parseISO(b.start).getTime();
}

export interface DayGroup {
  day: Date;
  events: CalendarEvent[];
}

/** Group events under their start day, ascending — for the agenda list. */
export function groupByStartDay(events: CalendarEvent[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const event of [...events].sort(compareForDisplay)) {
    const day = startOfDay(parseISO(event.start));
    const key = day.toISOString();
    const existing = groups.get(key);
    if (existing) existing.events.push(event);
    else groups.set(key, { day, events: [event] });
  }
  return [...groups.values()].sort((a, b) => a.day.getTime() - b.day.getTime());
}

// ── Formatting ─────────────────────────────────────────────────────────
export function formatMonthLabel(cursor: Date): string {
  return format(cursor, "MMMM yyyy");
}

export function formatDayNumber(day: Date): string {
  return format(day, "d");
}

/** Compact time for chips, e.g. "9am", "2:30pm". */
export function formatTimeCompact(iso: string): string {
  const d = parseISO(iso);
  return format(d, d.getMinutes() === 0 ? "ha" : "h:mma").toLowerCase();
}

/** Full time, e.g. "9:00 AM". */
export function formatTime(iso: string): string {
  return format(parseISO(iso), "h:mm a");
}

/** A human time range for an event, or "All day". */
export function formatEventRange(event: CalendarEvent): string {
  if (event.allDay) return "All day";
  return `${formatTime(event.start)} – ${formatTime(event.end)}`;
}

/** Heading for an agenda day group, e.g. "Mon, Jul 6". */
export function formatDayHeading(day: Date): string {
  if (isToday(day)) return `Today · ${format(day, "EEE, MMM d")}`;
  return format(day, "EEE, MMM d");
}

// ── Form <-> ISO helpers ───────────────────────────────────────────────
/** The date part (yyyy-MM-dd) of an ISO instant, in local time. */
export function toDateInput(iso: string): string {
  return format(parseISO(iso), "yyyy-MM-dd");
}

/** The time part (HH:mm) of an ISO instant, in local time. */
export function toTimeInput(iso: string): string {
  return format(parseISO(iso), "HH:mm");
}

/** A Date as a yyyy-MM-dd form value (local). */
export function dateInputFor(day: Date): string {
  return format(day, "yyyy-MM-dd");
}

/** Today's date as a yyyy-MM-dd form value. */
export function todayDateInput(): string {
  return format(new Date(), "yyyy-MM-dd");
}

/** Combine a yyyy-MM-dd date and HH:mm time (local) into an ISO instant. */
export function combineDateTime(date: string, time: string): string {
  return new Date(`${date}T${time}`).toISOString();
}

/** ISO instant at local start-of-day for an all-day event's date. */
export function allDayStart(date: string): string {
  return startOfDay(new Date(`${date}T00:00`)).toISOString();
}

/** ISO instant at the exclusive end (next local midnight) for an all-day date. */
export function allDayEnd(date: string): string {
  return startOfDay(addDays(new Date(`${date}T00:00`), 1)).toISOString();
}

export { isSameDay, isSameMonth, isToday, parseISO };
