import { z } from "zod";

/** Calendar domain. Times are ISO-8601 strings; `allDay` events use date-only
 *  semantics on the client. Event colors reuse the dataviz categorical names for
 *  a consistent look. A provider adapter fronts the local store or Google. */

export const EventColor = z.enum([
  "blue",
  "aqua",
  "yellow",
  "green",
  "violet",
  "red",
  "magenta",
  "orange",
]);
export type EventColorValue = z.infer<typeof EventColor>;

export const CalendarEvent = z.object({
  id: z.string(),
  calendarId: z.string().default("primary"),
  title: z.string(),
  description: z.string().optional(),
  location: z.string().optional(),
  /** ISO-8601 start (inclusive). */
  start: z.string(),
  /** ISO-8601 end (exclusive). */
  end: z.string(),
  allDay: z.boolean().default(false),
  color: EventColor.default("blue"),
  attendees: z.array(z.string()).default([]),
  source: z.enum(["local", "google"]).default("local"),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type CalendarEvent = z.infer<typeof CalendarEvent>;

/** Fields accepted when creating an event (server stamps id/source/timestamps). */
export const EventInput = z.object({
  title: z.string(),
  start: z.string(),
  end: z.string(),
  allDay: z.boolean().optional(),
  description: z.string().optional(),
  location: z.string().optional(),
  color: EventColor.optional(),
  attendees: z.array(z.string()).optional(),
  calendarId: z.string().optional(),
});
export type EventInput = z.infer<typeof EventInput>;

/** Partial patch for updating an event. */
export const EventPatch = EventInput.partial();
export type EventPatch = z.infer<typeof EventPatch>;

export interface DateRange {
  from: string; // ISO
  to: string; // ISO
}

/** Adapter fronting the local store (default) or Google Calendar (drop-in). */
export interface CalendarProvider {
  readonly id: "local" | "google";
  list(range: DateRange): Promise<CalendarEvent[]>;
  create(input: EventInput): Promise<CalendarEvent>;
  update(id: string, patch: EventPatch): Promise<CalendarEvent>;
  remove(id: string): Promise<void>;
}
