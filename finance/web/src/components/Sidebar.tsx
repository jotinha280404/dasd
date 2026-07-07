import { cn } from "@dasd/ui";
import {
  ArrowLeftRight,
  Landmark,
  LayoutDashboard,
  type LucideIcon,
  PiggyBank,
  Target,
  TrendingUp,
} from "lucide-react";
import { type Page, useUiStore } from "../store/ui";

const NAV: { page: Page; label: string; Icon: LucideIcon }[] = [
  { page: "dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { page: "accounts", label: "Accounts", Icon: Landmark },
  { page: "transactions", label: "Transactions", Icon: ArrowLeftRight },
  { page: "investments", label: "Investments", Icon: TrendingUp },
  { page: "budgets", label: "Budgets", Icon: PiggyBank },
  { page: "goals", label: "Goals", Icon: Target },
];

export function Sidebar() {
  const page = useUiStore((s) => s.page);
  const setPage = useUiStore((s) => s.setPage);
  return (
    <aside className="flex w-14 shrink-0 flex-col gap-1 border-r border-border bg-surface p-2 sm:w-56">
      <div className="mb-3 flex items-center gap-2 px-1 py-2">
        <span className="text-xl" aria-hidden>
          💰
        </span>
        <span className="hidden text-sm font-semibold tracking-tight text-foreground sm:inline">
          Finance
        </span>
      </div>
      <nav className="flex flex-col gap-1">
        {NAV.map(({ page: p, label, Icon }) => {
          const active = p === page;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setPage(p)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
              )}
            >
              <Icon size={18} className="shrink-0" aria-hidden />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
