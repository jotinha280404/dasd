import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { AgendaView } from "./calendar/AgendaView";
import { CalendarHeader } from "./calendar/CalendarHeader";
import { EventModal } from "./calendar/EventModal";
import { MonthView } from "./calendar/MonthView";
import { ChatPanel } from "./chat/ChatPanel";
import { useUiStore } from "./store/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: 1, refetchOnWindowFocus: false },
  },
});

function Shell() {
  const view = useUiStore((s) => s.view);
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <header className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <CalendarDays size={18} className="text-[var(--color-primary)]" aria-hidden />
        <span className="text-sm font-semibold tracking-tight text-foreground">Smart Calendar</span>
        <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">
          Manage your schedule by messaging Claude
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col">
          <CalendarHeader />
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {view === "month" ? <MonthView /> : <AgendaView />}
          </div>
        </main>

        <aside className="hidden w-[360px] shrink-0 border-l border-border bg-surface md:flex md:flex-col">
          <ChatPanel />
        </aside>
      </div>

      <EventModal />
    </div>
  );
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Shell />
    </QueryClientProvider>
  );
}
