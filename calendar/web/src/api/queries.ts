import type {
  CalendarEvent,
  ChatRequest,
  ChatResponse,
  DateRange,
  EventInput,
  EventPatch,
} from "@dasd/cal-shared";
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { visibleRange } from "../lib/datetime";
import { useUiStore } from "../store/ui";
import { api } from "./client";

/** Query-key factory. All event reads share the `["events", …]` prefix so a
 *  single invalidation refreshes the whole calendar after any write or chat. */
export const qk = {
  events: (range: DateRange) => ["events", range.from, range.to] as const,
};

/** The ISO window covering the currently visible month grid. */
export function useVisibleRange(): DateRange {
  const cursor = useUiStore((s) => s.cursor);
  return visibleRange(cursor);
}

/** Events overlapping `range` (defaults to the visible month grid). */
export function useEvents(range: DateRange) {
  return useQuery({ queryKey: qk.events(range), queryFn: () => api.events.list(range) });
}

/** Convenience hook: the events for the current cursor's visible range. */
export function useCalendarEvents() {
  return useEvents(useVisibleRange());
}

function useInvalidateEvents() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["events"] });
}

interface UpdateArgs {
  id: string;
  patch: EventPatch;
}

export function useCreateEvent(): UseMutationResult<CalendarEvent, Error, EventInput> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (body: EventInput) => api.events.create(body),
    onSuccess: invalidate,
  });
}

export function useUpdateEvent(): UseMutationResult<CalendarEvent, Error, UpdateArgs> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: ({ id, patch }: UpdateArgs) => api.events.update(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteEvent(): UseMutationResult<void, Error, string> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (id: string) => api.events.remove(id),
    onSuccess: invalidate,
  });
}

export function useChat(): UseMutationResult<ChatResponse, Error, ChatRequest> {
  const invalidate = useInvalidateEvents();
  return useMutation({
    mutationFn: (body: ChatRequest) => api.chat(body),
    onSuccess: invalidate,
  });
}
