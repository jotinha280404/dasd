import { Button } from "@dasd/ui";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import { formatMonthLabel } from "../lib/datetime";
import { type CalendarView, useUiStore } from "../store/ui";

const VIEWS: { value: CalendarView; label: string; icon: typeof CalendarDays }[] = [
  { value: "month", label: "Month", icon: CalendarDays },
  { value: "agenda", label: "Agenda", icon: List },
];

export function CalendarHeader() {
  const view = useUiStore((s) => s.view);
  const cursor = useUiStore((s) => s.cursor);
  const setView = useUiStore((s) => s.setView);
  const nextPeriod = useUiStore((s) => s.nextPeriod);
  const prevPeriod = useUiStore((s) => s.prevPeriod);
  const today = useUiStore((s) => s.today);
  const openNewEvent = useUiStore((s) => s.openNewEvent);

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="min-w-[10ch] text-lg font-semibold tracking-tight text-foreground">
          {formatMonthLabel(cursor)}
        </h1>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prevPeriod} aria-label="Previous">
            <ChevronLeft size={18} />
          </Button>
          <Button variant="outline" size="sm" onClick={today}>
            Today
          </Button>
          <Button variant="ghost" size="icon" onClick={nextPeriod} aria-label="Next">
            <ChevronRight size={18} />
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-border bg-surface-2 p-0.5">
          {VIEWS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setView(value)}
              aria-pressed={view === value}
              className={
                view === value
                  ? "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-6px)] bg-surface px-2.5 py-1 text-xs font-medium text-foreground shadow-sm"
                  : "inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-6px)] px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              }
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <Button size="sm" onClick={() => openNewEvent()}>
          <Plus size={16} /> New event
        </Button>
      </div>
    </header>
  );
}
