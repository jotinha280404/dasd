import type { CalendarEvent } from "./events";

/**
 * The chat contract: the user messages Claude in natural language, Claude calls
 * calendar tools (create/update/delete/list) that the server executes, and the
 * response carries the assistant's reply plus the structured actions it took
 * (for an audit trail in the UI) and the refreshed events.
 */
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export type CalendarActionType = "create" | "update" | "delete" | "list";

export interface CalendarAction {
  type: CalendarActionType;
  eventId?: string;
  /** Human-readable summary, e.g. "Created 'Dentist' — Fri Jul 10, 3:00 PM". */
  summary: string;
  event?: CalendarEvent;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  /** IANA tz (e.g. "America/Sao_Paulo") so relative dates resolve correctly. */
  timezone?: string;
  /** ISO "now" from the client, so "tomorrow" is anchored to the user's clock. */
  now?: string;
}

export interface ChatResponse {
  reply: string;
  actions: CalendarAction[];
  /** Events touched or the current window, so the UI can refresh. */
  events: CalendarEvent[];
  /** false when the heuristic fallback answered (no Claude auth available). */
  usedRealClaude: boolean;
}
