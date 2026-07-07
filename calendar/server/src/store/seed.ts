import { nanoid } from "nanoid";
import { CalendarEvent, type EventColorValue } from "@dasd/cal-shared";
import { db } from "./db";

/**
 * Seeds ~8 believable events spread across the current week and month, anchored
 * to `new Date()` so the calendar always looks alive on first boot. Times are
 * built in local time and stored as ISO-8601. Idempotent: does nothing if the
 * events collection already holds rows.
 */

interface SeedSpec {
  title: string;
  /** Days from today (0 = today). */
  dayOffset: number;
  /** Local start hour (ignored for all-day). */
  startHour?: number;
  startMinute?: number;
  /** Duration in minutes (ignored for all-day). */
  durationMin?: number;
  allDay?: boolean;
  /** For all-day events, how many days it spans. */
  spanDays?: number;
  color: EventColorValue;
  location?: string;
  description?: string;
  attendees?: string[];
}

function dayStart(base: Date, dayOffset: number): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function buildEvent(spec: SeedSpec, base: Date): CalendarEvent {
  const nowIso = new Date().toISOString();
  const start = dayStart(base, spec.dayOffset);
  let end: Date;

  if (spec.allDay) {
    end = new Date(start);
    end.setDate(end.getDate() + (spec.spanDays ?? 1));
  } else {
    start.setHours(spec.startHour ?? 9, spec.startMinute ?? 0, 0, 0);
    end = new Date(start.getTime() + (spec.durationMin ?? 60) * 60_000);
  }

  return CalendarEvent.parse({
    id: nanoid(),
    calendarId: "primary",
    title: spec.title,
    description: spec.description,
    location: spec.location,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay: spec.allDay ?? false,
    color: spec.color,
    attendees: spec.attendees ?? [],
    source: "local",
    createdAt: nowIso,
    updatedAt: nowIso,
  });
}

/** Distance (in days) from `base` to the given weekday (0=Sun..6=Sat), forward. */
function daysUntilWeekday(base: Date, weekday: number): number {
  const diff = (weekday - base.getDay() + 7) % 7;
  return diff;
}

function specs(base: Date): SeedSpec[] {
  // Anchor a few items to specific weekdays this/next week for realism.
  const toMonday = daysUntilWeekday(base, 1);
  const toWednesday = daysUntilWeekday(base, 3);
  const toFriday = daysUntilWeekday(base, 5);

  return [
    {
      title: "Daily standup",
      dayOffset: 0,
      startHour: 9,
      startMinute: 30,
      durationMin: 15,
      color: "blue",
      location: "Zoom",
      description: "Quick team sync on yesterday/today/blockers.",
      attendees: ["team@dasd.dev"],
    },
    {
      title: "Lunch with Sam",
      dayOffset: 1,
      startHour: 12,
      startMinute: 0,
      durationMin: 60,
      color: "yellow",
      location: "Cafe Nero",
      attendees: ["sam@example.com"],
    },
    {
      title: "1:1 with Alex",
      dayOffset: toWednesday === 0 ? 7 : toWednesday,
      startHour: 14,
      startMinute: 0,
      durationMin: 30,
      color: "green",
      location: "Room 4B",
      description: "Weekly manager 1:1.",
      attendees: ["alex@example.com"],
    },
    {
      title: "Dentist appointment",
      dayOffset: toFriday === 0 ? 7 : toFriday,
      startHour: 15,
      startMinute: 0,
      durationMin: 60,
      color: "red",
      location: "Bright Smiles Dental",
    },
    {
      title: "Design review",
      dayOffset: toWednesday === 0 ? 7 : toWednesday,
      startHour: 11,
      startMinute: 0,
      durationMin: 60,
      color: "aqua",
      location: "Room 2A",
      description: "Review the calendar UI mocks.",
      attendees: ["design@dasd.dev"],
    },
    {
      title: "Sprint planning",
      dayOffset: toMonday === 0 ? 7 : toMonday,
      startHour: 10,
      startMinute: 0,
      durationMin: 90,
      color: "magenta",
      location: "Room 1C",
      attendees: ["team@dasd.dev"],
    },
    {
      title: "Gym",
      dayOffset: 2,
      startHour: 7,
      startMinute: 0,
      durationMin: 60,
      color: "orange",
      location: "Fitness First",
    },
    {
      title: "Offsite trip",
      dayOffset: toFriday === 0 ? 12 : toFriday + 7,
      allDay: true,
      spanDays: 3,
      color: "violet",
      location: "Lake District",
      description: "Team offsite — travel + workshops.",
    },
  ];
}

export function seedIfEmpty(): boolean {
  if (db.events.count() > 0) return false;
  const base = new Date();
  db.events.insertMany(specs(base).map((s) => buildEvent(s, base)));
  return true;
}
