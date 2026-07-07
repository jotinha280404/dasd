import type { CalendarAction, CalendarProvider, EventColorValue } from "@dasd/cal-shared";
import { summarizeEvent } from "./format";

/**
 * A keyless, best-effort natural-language parser used when no Claude auth is
 * available (or AGENT_MODE=mock). No date libraries — just `Date` + regex. It
 * handles the common create / list / delete phrasings with today/tomorrow/
 * weekday + a time like "3pm" or "15:00". Deliberately modest: it's a fallback.
 */

const HOUR_MS = 60 * 60 * 1000;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

interface DayMatch {
  date: Date;
  label: string;
}

interface TimeMatch {
  hour: number;
  minute: number;
}

function midnight(base: Date, dayOffset = 0): Date {
  const d = new Date(base);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + dayOffset);
  return d;
}

function upcomingWeekday(base: Date, weekday: number, forceNext: boolean): Date {
  const today = midnight(base);
  let diff = (weekday - today.getDay() + 7) % 7;
  if (forceNext) diff += 7;
  return midnight(today, diff);
}

function parseDay(text: string, now: Date): DayMatch | null {
  if (/\bday after tomorrow\b/.test(text)) {
    return { date: midnight(now, 2), label: "day after tomorrow" };
  }
  if (/\btomorrow\b/.test(text)) return { date: midnight(now, 1), label: "tomorrow" };
  if (/\b(today|tonight)\b/.test(text)) return { date: midnight(now), label: "today" };

  for (let i = 0; i < WEEKDAYS.length; i++) {
    const name = WEEKDAYS[i];
    if (name === undefined) continue;
    const re = new RegExp(`\\b(next\\s+)?${name}\\b`);
    const m = re.exec(text);
    if (m) {
      const forceNext = Boolean(m[1]);
      return { date: upcomingWeekday(now, i, forceNext), label: name };
    }
  }
  return null;
}

function parseTime(text: string): TimeMatch | null {
  if (/\bnoon\b/.test(text)) return { hour: 12, minute: 0 };
  if (/\bmidnight\b/.test(text)) return { hour: 0, minute: 0 };

  const ampm = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/.exec(text);
  if (ampm) {
    let hour = Number(ampm[1]);
    const minute = ampm[2] ? Number(ampm[2]) : 0;
    const mer = ampm[3];
    if (mer === "pm" && hour < 12) hour += 12;
    if (mer === "am" && hour === 12) hour = 0;
    return { hour, minute };
  }

  const h24 = /\b(\d{1,2}):(\d{2})\b/.exec(text);
  if (h24) {
    const hour = Number(h24[1]);
    const minute = Number(h24[2]);
    if (hour <= 23 && minute <= 59) return { hour, minute };
  }

  const bare = /\bat\s+(\d{1,2})\b/.exec(text);
  if (bare) {
    const hour = Number(bare[1]);
    if (hour <= 23) return { hour, minute: 0 };
  }
  return null;
}

const COLOR_WORDS: Record<string, EventColorValue> = {
  blue: "blue",
  aqua: "aqua",
  cyan: "aqua",
  yellow: "yellow",
  green: "green",
  violet: "violet",
  purple: "violet",
  red: "red",
  magenta: "magenta",
  pink: "magenta",
  orange: "orange",
};

function parseColor(text: string): EventColorValue | undefined {
  for (const [word, color] of Object.entries(COLOR_WORDS)) {
    if (new RegExp(`\\b${word}\\b`).test(text)) return color;
  }
  return undefined;
}

/** Strip verb, day, and time phrases to leave a plausible title. */
function extractTitle(raw: string): string {
  let t = raw
    .replace(/\b(schedule|add|create|book|set up|set-up|plan|new|put|make)\b/gi, " ")
    .replace(/\b(an?|the|my|a)\b/gi, " ")
    .replace(/\bday after tomorrow\b/gi, " ")
    .replace(
      /\b(next\s+)?(today|tonight|tomorrow|sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi,
      " ",
    )
    .replace(/\b(on|at|for|from|to)\b/gi, " ")
    .replace(/\bnoon\b|\bmidnight\b/gi, " ")
    .replace(/\b\d{1,2}(?::\d{2})?\s*(am|pm)\b/gi, " ")
    .replace(/\b\d{1,2}:\d{2}\b/g, " ")
    .replace(/\b(blue|aqua|cyan|yellow|green|violet|purple|red|magenta|pink|orange)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!t) t = "New event";
  return t.charAt(0).toUpperCase() + t.slice(1);
}

async function doCreate(
  text: string,
  now: Date,
  provider: CalendarProvider,
  collector: CalendarAction[],
  tz: string,
): Promise<string> {
  const day = parseDay(text, now);
  const time = parseTime(text);
  const baseDay = day ? day.date : midnight(now);
  const title = extractTitle(text);
  const color = parseColor(text);

  let start: Date;
  let end: Date;
  let allDay = false;

  if (time) {
    start = new Date(baseDay);
    start.setHours(time.hour, time.minute, 0, 0);
    end = new Date(start.getTime() + HOUR_MS);
  } else {
    // No time → treat as an all-day event on the resolved day.
    allDay = true;
    start = new Date(baseDay);
    end = midnight(baseDay, 1);
  }

  const event = await provider.create({
    title,
    start: start.toISOString(),
    end: end.toISOString(),
    allDay,
    color,
  });
  collector.push({
    type: "create",
    eventId: event.id,
    summary: `Created ${summarizeEvent(event, tz)}`,
    event,
  });
  return `Scheduled ${summarizeEvent(event, tz)}.`;
}

async function doList(
  text: string,
  now: Date,
  provider: CalendarProvider,
  collector: CalendarAction[],
  tz: string,
): Promise<string> {
  const day = parseDay(text, now);
  let from: Date;
  let to: Date;
  let label: string;

  if (day) {
    from = day.date;
    to = midnight(day.date, 1);
    label = `on ${day.label}`;
  } else if (/\bnext week\b/.test(text)) {
    from = midnight(now, 7);
    to = midnight(now, 14);
    label = "next week";
  } else if (/\bweek\b/.test(text)) {
    from = midnight(now);
    to = midnight(now, 7);
    label = "this week";
  } else {
    from = midnight(now);
    to = midnight(now, 7);
    label = "in the next 7 days";
  }

  const events = await provider.list({ from: from.toISOString(), to: to.toISOString() });
  collector.push({
    type: "list",
    summary: `Listed ${events.length} event${events.length === 1 ? "" : "s"} ${label}`,
  });
  if (events.length === 0) return `You have nothing ${label}.`;
  const lines = events.map((e) => `• ${summarizeEvent(e, tz)}`);
  return `You have ${events.length} event${events.length === 1 ? "" : "s"} ${label}:\n${lines.join("\n")}`;
}

async function doDelete(
  text: string,
  now: Date,
  provider: CalendarProvider,
  collector: CalendarAction[],
  tz: string,
): Promise<string> {
  const query = text
    .replace(/\b(cancel|delete|remove|clear|drop)\b/gi, " ")
    .replace(/\b(an?|the|my)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  // Search a wide window and match the first event whose title overlaps.
  const from = midnight(now, -30).toISOString();
  const to = midnight(now, 365).toISOString();
  const events = await provider.list({ from, to });
  const match = events.find((e) => query.length > 0 && e.title.toLowerCase().includes(query));
  if (!match) {
    return `I couldn't find an event matching "${query}" to cancel.`;
  }
  await provider.remove(match.id);
  collector.push({
    type: "delete",
    eventId: match.id,
    summary: `Deleted ${summarizeEvent(match, tz)}`,
    event: match,
  });
  return `Cancelled ${summarizeEvent(match, tz)}.`;
}

export async function heuristicChat(
  message: string,
  now: Date,
  provider: CalendarProvider,
  collector: CalendarAction[],
  tz: string,
): Promise<string> {
  const text = message.toLowerCase();

  if (/\b(cancel|delete|remove|clear|drop)\b/.test(text)) {
    return doDelete(text, now, provider, collector, tz);
  }
  if (/\b(schedule|add|create|book|set up|set-up|plan|new)\b/.test(text)) {
    return doCreate(text, now, provider, collector, tz);
  }
  if (/\b(what'?s on|whats on|show|list|agenda|what do i have|do i have)\b/.test(text)) {
    return doList(text, now, provider, collector, tz);
  }
  // Default: treat an ambiguous ask as a listing of the upcoming week.
  return doList(text, now, provider, collector, tz);
}
