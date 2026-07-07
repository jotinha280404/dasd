import { nanoid } from "nanoid";
import {
  CalendarEvent,
  type CalendarProvider,
  type DateRange,
  type EventInput,
  type EventPatch,
} from "@dasd/cal-shared";
import { db } from "../store/db";

/**
 * The default provider: a `CalendarProvider` over the local JSON store. `list`
 * returns every event whose [start,end) interval overlaps the requested range.
 */
export class LocalCalendarProvider implements CalendarProvider {
  readonly id = "local" as const;

  async list(range: DateRange): Promise<CalendarEvent[]> {
    const from = Date.parse(range.from);
    const to = Date.parse(range.to);
    const events = db.events.all().filter((e) => {
      const start = Date.parse(e.start);
      const end = Date.parse(e.end);
      // Overlap: event starts before the window ends AND ends after it starts.
      return start < to && end > from;
    });
    events.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    return events;
  }

  async create(input: EventInput): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const event = CalendarEvent.parse({
      id: nanoid(),
      calendarId: input.calendarId ?? "primary",
      title: input.title,
      description: input.description,
      location: input.location,
      start: input.start,
      end: input.end,
      allDay: input.allDay ?? false,
      color: input.color ?? "blue",
      attendees: input.attendees ?? [],
      source: "local",
      createdAt: now,
      updatedAt: now,
    });
    db.events.insert(event);
    return event;
  }

  async update(id: string, patch: EventPatch): Promise<CalendarEvent> {
    const current = db.events.get(id);
    if (!current) throw new Error(`event ${id} not found`);
    const merged = CalendarEvent.parse({
      ...current,
      ...patch,
      id: current.id,
      source: current.source,
      createdAt: current.createdAt,
      updatedAt: new Date().toISOString(),
    });
    const saved = db.events.update(id, merged);
    if (!saved) throw new Error(`event ${id} not found`);
    return saved;
  }

  async remove(id: string): Promise<void> {
    db.events.remove(id);
  }
}
