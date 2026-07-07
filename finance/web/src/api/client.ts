import type {
  Account,
  AccountBalance,
  AccountType,
  AllocationSlice,
  AssetClass,
  Budget,
  BudgetStatus,
  CashflowPoint,
  Category,
  CategoryKind,
  Cents,
  DashboardSummary,
  Goal,
  GoalProgress,
  Holding,
  HoldingValue,
  LedgerFilter,
  LedgerKind,
  NetWorthPoint,
  Transaction,
  TxnType,
} from "@dasd/fin-shared";

// ── Input payloads (server generates id / timestamps; zod applies defaults) ──
export interface AccountInput {
  name: string;
  ledger: LedgerKind;
  type: AccountType;
  currency?: string;
  openingBalance?: Cents;
  institution?: string;
  archived?: boolean;
}

export interface CategoryInput {
  name: string;
  kind: CategoryKind;
  icon?: string;
  color?: string;
}

export interface TransactionInput {
  accountId: string;
  ledger: LedgerKind;
  date: string;
  amount: Cents;
  type: TxnType;
  categoryId?: string | null;
  payee?: string;
  note?: string;
  tags?: string[];
  transferAccountId?: string | null;
  cleared?: boolean;
}

export interface HoldingInput {
  accountId: string;
  ledger: LedgerKind;
  symbol: string;
  name?: string;
  assetClass?: AssetClass;
  quantity: number;
  costBasis?: Cents;
  currentPrice?: Cents;
  currency?: string;
}

export interface BudgetInput {
  categoryId: string;
  ledger: LedgerKind;
  period?: "monthly";
  limit: Cents;
}

export interface GoalInput {
  name: string;
  ledger?: LedgerKind | null;
  targetAmount: Cents;
  currentAmount?: Cents;
  deadline?: string | null;
  linkedAccountId?: string | null;
  note?: string;
}

export type AllocationBy = "accountType" | "assetClass";

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

function ledgerQ(ledger: LedgerFilter, extra?: Record<string, string>): string {
  const params = new URLSearchParams({ ledger, ...extra });
  return `?${params.toString()}`;
}

/** Build a small CRUD surface for a collection resource. */
function crud<Entity, Input>(resource: string) {
  return {
    list: (ledger: LedgerFilter) => request<Entity[]>(`/${resource}${ledgerQ(ledger)}`),
    get: (id: string) => request<Entity>(`/${resource}/${id}`),
    create: (body: Input) =>
      request<Entity>(`/${resource}`, { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: Partial<Input>) =>
      request<Entity>(`/${resource}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
    remove: (id: string) => request<void>(`/${resource}/${id}`, { method: "DELETE" }),
  };
}

export const api = {
  accounts: {
    ...crud<Account, AccountInput>("accounts"),
    balances: (ledger: LedgerFilter) =>
      request<AccountBalance[]>(`/accounts/balances${ledgerQ(ledger)}`),
  },
  categories: crud<Category, CategoryInput>("categories"),
  transactions: {
    ...crud<Transaction, TransactionInput>("transactions"),
    import: (accountId: string, csv: string) =>
      request<{ created: number }>(`/transactions/import`, {
        method: "POST",
        body: JSON.stringify({ accountId, csv }),
      }),
  },
  holdings: {
    ...crud<Holding, HoldingInput>("holdings"),
    refreshPrices: () => request<Holding[]>(`/holdings/refresh-prices`, { method: "POST" }),
  },
  budgets: crud<Budget, BudgetInput>("budgets"),
  goals: crud<Goal, GoalInput>("goals"),

  // ── Reports (all honor ?ledger=) ──
  dashboard: (ledger: LedgerFilter) => request<DashboardSummary>(`/dashboard${ledgerQ(ledger)}`),
  networth: (ledger: LedgerFilter, months = 12) =>
    request<NetWorthPoint[]>(`/reports/networth${ledgerQ(ledger, { months: String(months) })}`),
  cashflow: (ledger: LedgerFilter, months = 12) =>
    request<CashflowPoint[]>(`/reports/cashflow${ledgerQ(ledger, { months: String(months) })}`),
  allocation: (ledger: LedgerFilter, by: AllocationBy) =>
    request<AllocationSlice[]>(`/reports/allocation${ledgerQ(ledger, { by })}`),
  budgetStatuses: (ledger: LedgerFilter) =>
    request<BudgetStatus[]>(`/reports/budgets${ledgerQ(ledger)}`),
  goalProgress: (ledger: LedgerFilter) =>
    request<GoalProgress[]>(`/reports/goals${ledgerQ(ledger)}`),
  holdingValues: (ledger: LedgerFilter) =>
    request<HoldingValue[]>(`/reports/holdings${ledgerQ(ledger)}`),
};
