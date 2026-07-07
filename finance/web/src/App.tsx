import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ComponentType } from "react";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { Accounts } from "./pages/Accounts";
import { Budgets } from "./pages/Budgets";
import { Dashboard } from "./pages/Dashboard";
import { Goals } from "./pages/Goals";
import { Investments } from "./pages/Investments";
import { Transactions } from "./pages/Transactions";
import { type Page, useUiStore } from "./store/ui";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

const PAGES: Record<Page, ComponentType> = {
  dashboard: Dashboard,
  accounts: Accounts,
  transactions: Transactions,
  investments: Investments,
  budgets: Budgets,
  goals: Goals,
};

function Shell() {
  const page = useUiStore((s) => s.page);
  const Current = PAGES[page];
  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-6xl">
            <Current />
          </div>
        </main>
      </div>
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
