import type {
  CalendarEvent,
  ChatRequest,
  ChatResponse,
  DateRange,
  EventInput,
  EventPatch,
} from "@dasd/cal-shared";

const BASE = "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText}${text ? `: ${text}` : ""}`);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  events: {
    list: (range: DateRange) =>
      request<CalendarEvent[]>(
        `/events?${new URLSearchParams({ from: range.from, to: range.to }).toString()}`,
      ),
    create: (body: EventInput) =>
      request<CalendarEvent>("/events", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, patch: EventPatch) =>
      request<CalendarEvent>(`/events/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
    remove: (id: string) => request<void>(`/events/${id}`, { method: "DELETE" }),
  },
  chat: (body: ChatRequest) =>
    request<ChatResponse>("/chat", { method: "POST", body: JSON.stringify(body) }),
};
