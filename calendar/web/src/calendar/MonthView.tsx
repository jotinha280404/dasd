import type { CalendarEvent } from "@dasd/cal-shared";
import { Loader2 } from "lucide-react";
import { colorHex, withAlpha } from "../lib/colors";
import {
  chunkWeeks,
  dateInputFor,
  eventsForDay,
  formatDayNumber,
  formatTimeCompact,
  isSameMonth,
  isToday,
  monthGridDays,
  WEEKDAY_LABELS,
} from "../lib/datetime";
import { useCalendarEvents } from "../api/queries";
import { useUiStore } from "../store/ui";

const MAX_CHIPS = 3;

function EventChip({ event, onClick }: { event: CalendarEvent; onClick: () => void }) {
  const hex = colorHex(event.color);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title={event.title}
      className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] leading-tight text-foreground hover:brightness-110"
      style={{ backgroundColor: withAlpha(hex, 0.18) }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: hex }} />
      {!event.allDay && (
        <span className="shrink-0 tabular-nums text-muted-foreground">
          {formatTimeCompact(event.start)}
        </span>
      )}
      <span className="truncate">{event.title}</span>
    </button>
  );
}

export function MonthView() {
  const cursor = useUiStore((s) => s.cursor);
  const openNewEvent = useUiStore((s) => s.openNewEvent);
  const openEvent = useUiStore((s) => s.openEvent);
  const eventsQ = useCalendarEvents();
  const events = eventsQ.data ?? [];

  const weeks = chunkWeeks(monthGridDays(cursor));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {label}
          </div>
        ))}
      </div>

      <div className="relative grid flex-1 auto-rows-fr grid-cols-7">
        {eventsQ.isLoading && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Loading…
          </div>
        )}
        {weeks.map((week) =>
          week.map((day) => {
            const inMonth = isSameMonth(day, cursor);
            const dayEvents = eventsForDay(events, day);
            const shown = dayEvents.slice(0, MAX_CHIPS);
            const overflow = dayEvents.length - shown.length;
            const today = isToday(day);
            return (
              <div
                key={day.toISOString()}
                onClick={() => openNewEvent(dateInputFor(day))}
                className={`flex min-h-[92px] cursor-pointer flex-col gap-1 border-b border-r border-border p-1 transition-colors hover:bg-surface-2 ${
                  inMonth ? "" : "bg-background/40"
                }`}
              >
                <div className="flex items-center justify-between px-0.5">
                  <span
                    className={
                      today
                        ? "flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-primary)] text-xs font-semibold text-[var(--color-primary-foreground)]"
                        : `text-xs font-medium ${inMonth ? "text-foreground" : "text-muted-foreground"}`
                    }
                  >
                    {formatDayNumber(day)}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  {shown.map((event) => (
                    <EventChip key={event.id} event={event} onClick={() => openEvent(event.id)} />
                  ))}
                  {overflow > 0 && (
                    <span className="px-1 text-[11px] font-medium text-muted-foreground">
                      +{overflow} more
                    </span>
                  )}
                </div>
              </div>
            );
          }),
        )}
      </div>
    </div>
  );
}
