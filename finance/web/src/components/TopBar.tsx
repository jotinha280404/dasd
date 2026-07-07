import { cn } from "@dasd/ui";
import type { LedgerFilter } from "@dasd/fin-shared";
import { useUiStore, type Page } from "../store/ui";

const PAGE_TITLES: Record<Page, string> = {
  dashboard: "Dashboard",
  accounts: "Accounts",
  transactions: "Transactions",
  investments: "Investments",
  budgets: "Budgets",
  goals: "Goals",
};

const LEDGERS: { value: LedgerFilter; label: string }[] = [
  { value: "personal", label: "Personal" },
  { value: "business", label: "Business" },
  { value: "all", label: "All" },
];

/** Segmented ledger toggle bound to the global `useUiStore`. */
function LedgerToggle() {
  const ledger = useUiStore((s) => s.ledger);
  const setLedger = useUiStore((s) => s.setLedger);
  return (
    <div
      role="tablist"
      aria-label="Ledger"
      className="inline-flex rounded-md border border-border bg-surface p-0.5"
    >
      {LEDGERS.map(({ value, label }) => {
        const active = value === ledger;
        return (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setLedger(value)}
            className={cn(
              "rounded px-3 py-1 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-[var(--color-primary-foreground)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function TopBar() {
  const page = useUiStore((s) => s.page);
  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3 sm:px-6">
      <h1 className="text-base font-semibold tracking-tight text-foreground">{PAGE_TITLES[page]}</h1>
      <LedgerToggle />
    </header>
  );
}
