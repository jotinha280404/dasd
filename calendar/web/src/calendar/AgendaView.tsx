import type { CalendarEvent } from "@dasd/cal-shared";
import { CalendarX2, Loader2, MapPin } from "lucide-react";
import { useCalendarEvents } from "../api/queries";
import { colorHex } from "../lib/colors";
import { formatDayHeading, formatEventRange, groupByStartDay } from "../lib/datetime";
import { useUiStore } from "../store/ui";

function AgendaRow({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const hex = colorHex(event.color);
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-md border border-border bg-surface px-3 py-2 text-left transition-colors hover:bg-surface-2"
    >
      <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium text-foreground">{event.title}</span>
        <span className="text-xs text-muted-foreground">{formatEventRange(event)}</span>
        {event.location && (
          <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin size={12} /> {event.location}
          </span>
        )}
      </div>
    </button>
  );
}

export function AgendaView() {
  const openEvent = useUiStore((s) => s.openEvent);
  const eventsQ = useCalendarEvents();
  const groups = groupByStartDay(eventsQ.data ?? []);

  if (eventsQ.isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center text-sm text-muted-foreground">
        <CalendarX2 size={22} aria-hidden />
        <span className="font-medium text-foreground">Nothing scheduled</span>
        <span className="text-xs">Add an event or ask the assistant to schedule one.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 overflow-y-auto p-4">
      {groups.map((group) => (
        <section key={group.day.toISOString()} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {formatDayHeading(group.day)}
          </h2>
          <div className="flex flex-col gap-1.5">
            {group.events.map((event) => (
              <AgendaRow key={event.id} event={event} onClick={() => openEvent(event.id)} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
