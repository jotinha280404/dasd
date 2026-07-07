import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import {
  EventColor,
  type CalendarAction,
  type CalendarEvent,
  type CalendarProvider,
  type EventInput,
  type EventPatch,
} from "@dasd/cal-shared";
import { summarizeEvent } from "./format";

/**
 * Builds an in-process MCP server exposing the four calendar tools Claude may
 * call. Each handler runs the real provider AND records a structured
 * `CalendarAction` into the request-scoped `collector`, so the HTTP layer can
 * return an audit trail alongside the assistant's prose. Verified against
 * `@anthropic-ai/claude-agent-sdk@0.3.202`: `createSdkMcpServer({name,tools})`
 * returns a config with a live `instance`, and `tool(name, desc, zodShape,
 * handler)` handlers resolve to a `CallToolResult` (`{ content: [...] }`).
 */

function textResult(text: string): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text", text }] };
}

const HOUR_MS = 60 * 60 * 1000;

/** A range wide enough to find any stored event by id. */
function wideRange(): { from: string; to: string } {
  const from = new Date(0).toISOString();
  const to = new Date(Date.now() + 3650 * 24 * HOUR_MS).toISOString();
  return { from, to };
}

export function buildCalendarServer(
  provider: CalendarProvider,
  collector: CalendarAction[],
  tz: string,
) {
  const findById = async (id: string): Promise<CalendarEvent | undefined> => {
    const all = await provider.list(wideRange());
    return all.find((e) => e.id === id);
  };

  const createEvent = tool(
    "create_event",
    "Create a calendar event. Resolve relative dates ('tomorrow', 'Friday') " +
      "against today before calling. Provide ISO-8601 `start` and `end`; if you " +
      "omit `end`, a 1-hour event is assumed. Set `allDay` for date-only events.",
    {
      title: z.string().describe("Short event title, e.g. 'Dentist appointment'."),
      start: z.string().describe("ISO-8601 start datetime (or date if allDay)."),
      end: z.string().optional().describe("ISO-8601 end; defaults to start + 1h."),
      allDay: z.boolean().optional().describe("True for all-day events."),
      location: z.string().optional(),
      description: z.string().optional(),
      color: EventColor.optional().describe("One of the categorical color names."),
      attendees: z.array(z.string()).optional().describe("Attendee emails/names."),
    },
    async (args) => {
      const start = new Date(args.start);
      const end = args.end
        ? new Date(args.end)
        : new Date(start.getTime() + HOUR_MS);
      const input: EventInput = {
        title: args.title,
        start: start.toISOString(),
        end: end.toISOString(),
        allDay: args.allDay,
        location: args.location,
        description: args.description,
        color: args.color,
        attendees: args.attendees,
      };
      const event = await provider.create(input);
      collector.push({
        type: "create",
        eventId: event.id,
        summary: `Created ${summarizeEvent(event, tz)}`,
        event,
      });
      return textResult(`Created ${summarizeEvent(event, tz)} (id ${event.id}).`);
    },
  );

  const listEvents = tool(
    "list_events",
    "List events overlapping an ISO-8601 [from, to] window. Use this to see " +
      "what's on a day/range and to look up event ids before updating or deleting.",
    {
      from: z.string().describe("ISO-8601 start of the window (inclusive)."),
      to: z.string().describe("ISO-8601 end of the window (exclusive)."),
    },
    async (args) => {
      const events = await provider.list({ from: args.from, to: args.to });
      collector.push({
        type: "list",
        summary: `Listed ${events.length} event${events.length === 1 ? "" : "s"}`,
      });
      if (events.length === 0) return textResult("No events in that window.");
      const lines = events.map(
        (e) => `- [${e.id}] ${summarizeEvent(e, tz)}${e.location ? ` @ ${e.location}` : ""}`,
      );
      return textResult(`${events.length} event(s):\n${lines.join("\n")}`);
    },
  );

  const updateEvent = tool(
    "update_event",
    "Update an existing event by id (get the id from list_events first). Only " +
      "the fields you pass are changed. Times are ISO-8601.",
    {
      eventId: z.string().describe("Id of the event to update."),
      title: z.string().optional(),
      start: z.string().optional(),
      end: z.string().optional(),
      allDay: z.boolean().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      color: EventColor.optional(),
    },
    async (args) => {
      const patch: EventPatch = {
        title: args.title,
        start: args.start,
        end: args.end,
        allDay: args.allDay,
        location: args.location,
        description: args.description,
        color: args.color,
      };
      try {
        const event = await provider.update(args.eventId, patch);
        collector.push({
          type: "update",
          eventId: event.id,
          summary: `Updated ${summarizeEvent(event, tz)}`,
          event,
        });
        return textResult(`Updated ${summarizeEvent(event, tz)}.`);
      } catch {
        return textResult(`No event with id ${args.eventId} was found.`);
      }
    },
  );

  const deleteEvent = tool(
    "delete_event",
    "Delete an event by id (get the id from list_events first).",
    {
      eventId: z.string().describe("Id of the event to delete."),
    },
    async (args) => {
      const event = await findById(args.eventId);
      if (!event) {
        return textResult(`No event with id ${args.eventId} was found.`);
      }
      await provider.remove(args.eventId);
      collector.push({
        type: "delete",
        eventId: event.id,
        summary: `Deleted ${summarizeEvent(event, tz)}`,
        event,
      });
      return textResult(`Deleted ${summarizeEvent(event, tz)}.`);
    },
  );

  return createSdkMcpServer({
    name: "calendar",
    version: "1.0.0",
    tools: [createEvent, listEvents, updateEvent, deleteEvent],
  });
}
