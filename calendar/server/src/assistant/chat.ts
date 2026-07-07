import { query, type Options } from "@anthropic-ai/claude-agent-sdk";
import type {
  CalendarAction,
  CalendarEvent,
  CalendarProvider,
  ChatRequest,
  ChatResponse,
} from "@dasd/cal-shared";
import { agentMode, hasAuth } from "../auth";
import { getProvider } from "../providers";
import { heuristicChat } from "./heuristic";
import { buildCalendarServer } from "./tools";

/**
 * `handleChat` is the star feature: the user messages Claude in natural
 * language, Claude drives the in-process calendar tools, and we return its
 * reply plus the structured actions it took and the refreshed events. When no
 * Claude auth is present (or the SDK errors), a keyless heuristic parser answers
 * instead and `usedRealClaude` is false.
 */

const CALENDAR_TOOLS = [
  "mcp__calendar__create_event",
  "mcp__calendar__list_events",
  "mcp__calendar__update_event",
  "mcp__calendar__delete_event",
];

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

/** Concatenate the text blocks of a BetaMessage's content array. */
function extractText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (isRecord(block) && block["type"] === "text" && typeof block["text"] === "string") {
      parts.push(block["text"]);
    }
  }
  return parts.join("");
}

function systemTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

function buildSystemPrompt(now: Date, tz: string): string {
  let today: string;
  try {
    today = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    }).format(now);
  } catch {
    today = now.toISOString();
  }
  return (
    `You are a calendar assistant. Today is ${today} (timezone ${tz}). ` +
    "Use the calendar tools to fulfill the user's request; resolve relative " +
    "dates (like \"tomorrow\", \"Friday\", or \"next week\") against today. " +
    "Default meetings to 1 hour unless a duration is given. Look up event ids " +
    "with list_events before updating or deleting. Confirm what you did in one " +
    "short sentence. Never invent events you did not create or read via a tool."
  );
}

async function runWithClaude(
  message: string,
  now: Date,
  tz: string,
  provider: CalendarProvider,
  collector: CalendarAction[],
): Promise<string> {
  const server = buildCalendarServer(provider, collector, tz);
  const options: Options = {
    model: process.env["CHAT_MODEL"] ?? "claude-opus-4-8",
    // Small custom system prompt — deliberately NOT the claude_code preset,
    // to keep the context tiny and the call cheap.
    systemPrompt: buildSystemPrompt(now, tz),
    mcpServers: { calendar: server },
    allowedTools: CALENDAR_TOOLS,
    permissionMode: "bypassPermissions",
    allowDangerouslySkipPermissions: true,
    maxTurns: 8,
    includePartialMessages: false,
    // env REPLACES the subprocess environment, so spread process.env to keep
    // PATH/HOME plus the local-login credentials the SDK subprocess inherits.
    env: { ...process.env },
  };

  const q = query({ prompt: message, options });
  let lastAssistant = "";
  let resultText = "";
  for await (const m of q) {
    if (m.type === "assistant") {
      const text = extractText(m.message.content);
      if (text.trim().length > 0) lastAssistant = text;
    } else if (m.type === "result" && m.subtype === "success") {
      resultText = m.result;
    }
  }

  const reply = (lastAssistant || resultText).trim();
  if (!reply) throw new Error("Claude returned no assistant text");
  return reply;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

/** Events in a window spanning this month and any months an action touched. */
async function affectedEvents(
  provider: CalendarProvider,
  now: Date,
  collector: CalendarAction[],
): Promise<CalendarEvent[]> {
  const stamps: number[] = [now.getTime()];
  for (const action of collector) {
    if (action.event) {
      stamps.push(Date.parse(action.event.start));
      stamps.push(Date.parse(action.event.end));
    }
  }
  const from = startOfMonth(new Date(Math.min(...stamps)));
  const to = endOfMonth(new Date(Math.max(...stamps)));
  return provider.list({ from: from.toISOString(), to: to.toISOString() });
}

export async function handleChat(req: ChatRequest): Promise<ChatResponse> {
  const provider = getProvider();
  const parsedNow = req.now ? new Date(req.now) : new Date();
  const now = Number.isNaN(parsedNow.getTime()) ? new Date() : parsedNow;
  const tz = req.timezone || systemTimezone();
  const collector: CalendarAction[] = [];

  let reply: string;
  let usedRealClaude = false;

  if (hasAuth() && agentMode() !== "mock") {
    try {
      reply = await runWithClaude(req.message, now, tz, provider, collector);
      usedRealClaude = true;
    } catch (err) {
      // Roll back any partial actions and fall back to the heuristic parser.
      collector.length = 0;
      const note = err instanceof Error ? err.message : String(err);
      console.warn(`[calendar-chat] real Claude failed (${note}); using heuristic`);
      reply = await heuristicChat(req.message, now, provider, collector, tz);
    }
  } else {
    reply = await heuristicChat(req.message, now, provider, collector, tz);
  }

  const events = await affectedEvents(provider, now, collector);
  return { reply, actions: collector, events, usedRealClaude };
}
