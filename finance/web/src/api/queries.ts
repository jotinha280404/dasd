import type { LedgerFilter } from "@dasd/fin-shared";
import {
  type UseMutationResult,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useUiStore } from "../store/ui";
import {
  type AccountInput,
  type AllocationBy,
  api,
  type BudgetInput,
  type CategoryInput,
  type GoalInput,
  type HoldingInput,
  type TransactionInput,
} from "./client";

/** Query-key factory — every read is keyed by `[resource, ledger]`. */
export const qk = {
  accounts: (l: LedgerFilter) => ["accounts", l] as const,
  balances: (l: LedgerFilter) => ["accounts", "balances", l] as const,
  categories: () => ["categories"] as const,
  transactions: (l: LedgerFilter) => ["transactions", l] as const,
  holdings: (l: LedgerFilter) => ["holdings", l] as const,
  budgets: (l: LedgerFilter) => ["budgets", l] as const,
  goals: (l: LedgerFilter) => ["goals", l] as const,
  dashboard: (l: LedgerFilter) => ["dashboard", l] as const,
  networth: (l: LedgerFilter) => ["report", "networth", l] as const,
  cashflow: (l: LedgerFilter) => ["report", "cashflow", l] as const,
  allocation: (l: LedgerFilter, by: AllocationBy) => ["report", "allocation", l, by] as const,
  budgetStatuses: (l: LedgerFilter) => ["report", "budgets", l] as const,
  goalProgress: (l: LedgerFilter) => ["report", "goals", l] as const,
  holdingValues: (l: LedgerFilter) => ["report", "holdings", l] as const,
};

/** The active global ledger filter. */
export function useLedger(): LedgerFilter {
  return useUiStore((s) => s.ledger);
}

// ── Reads ────────────────────────────────────────────────────────────
export function useAccounts() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.accounts(ledger), queryFn: () => api.accounts.list(ledger) });
}

export function useBalances() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.balances(ledger), queryFn: () => api.accounts.balances(ledger) });
}

export function useCategories() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.categories(), queryFn: () => api.categories.list(ledger) });
}

export function useTransactions() {
  const ledger = useLedger();
  return useQuery({
    queryKey: qk.transactions(ledger),
    queryFn: () => api.transactions.list(ledger),
  });
}

export function useHoldings() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.holdings(ledger), queryFn: () => api.holdings.list(ledger) });
}

export function useBudgets() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.budgets(ledger), queryFn: () => api.budgets.list(ledger) });
}

export function useGoals() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.goals(ledger), queryFn: () => api.goals.list(ledger) });
}

export function useDashboard() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.dashboard(ledger), queryFn: () => api.dashboard(ledger) });
}

export function useNetworth() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.networth(ledger), queryFn: () => api.networth(ledger) });
}

export function useCashflow() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.cashflow(ledger), queryFn: () => api.cashflow(ledger) });
}

export function useAllocation(by: AllocationBy) {
  const ledger = useLedger();
  return useQuery({
    queryKey: qk.allocation(ledger, by),
    queryFn: () => api.allocation(ledger, by),
  });
}

export function useBudgetStatuses() {
  const ledger = useLedger();
  return useQuery({
    queryKey: qk.budgetStatuses(ledger),
    queryFn: () => api.budgetStatuses(ledger),
  });
}

export function useGoalProgress() {
  const ledger = useLedger();
  return useQuery({ queryKey: qk.goalProgress(ledger), queryFn: () => api.goalProgress(ledger) });
}

export function useHoldingValues() {
  const ledger = useLedger();
  return useQuery({
    queryKey: qk.holdingValues(ledger),
    queryFn: () => api.holdingValues(ledger),
  });
}

// ── Mutations ────────────────────────────────────────────────────────
/**
 * All writes touch derived reports (dashboard, net worth, allocation…), so the
 * simplest correct cache policy is to invalidate everything on success.
 */
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries();
}

interface UpdateArgs<Input> {
  id: string;
  body: Partial<Input>;
}

export function useCreateAccount(): UseMutationResult<unknown, Error, AccountInput> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: AccountInput) => api.accounts.create(body),
    onSuccess: invalidate,
  });
}
export function useUpdateAccount(): UseMutationResult<unknown, Error, UpdateArgs<AccountInput>> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: UpdateArgs<AccountInput>) => api.accounts.update(id, body),
    onSuccess: invalidate,
  });
}
export function useDeleteAccount(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.accounts.remove(id),
    onSuccess: invalidate,
  });
}

export function useCreateCategory(): UseMutationResult<unknown, Error, CategoryInput> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CategoryInput) => api.categories.create(body),
    onSuccess: invalidate,
  });
}

export function useCreateTransaction(): UseMutationResult<unknown, Error, TransactionInput> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: TransactionInput) => api.transactions.create(body),
    onSuccess: invalidate,
  });
}
export function useUpdateTransaction(): UseMutationResult<
  unknown,
  Error,
  UpdateArgs<TransactionInput>
> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: UpdateArgs<TransactionInput>) => api.transactions.update(id, body),
    onSuccess: invalidate,
  });
}
export function useDeleteTransaction(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.transactions.remove(id),
    onSuccess: invalidate,
  });
}
export function useImportTransactions(): UseMutationResult<
  { created: number },
  Error,
  { accountId: string; csv: string }
> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ accountId, csv }: { accountId: string; csv: string }) =>
      api.transactions.import(accountId, csv),
    onSuccess: invalidate,
  });
}

export function useCreateHolding(): UseMutationResult<unknown, Error, HoldingInput> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: HoldingInput) => api.holdings.create(body),
    onSuccess: invalidate,
  });
}
export function useUpdateHolding(): UseMutationResult<unknown, Error, UpdateArgs<HoldingInput>> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: UpdateArgs<HoldingInput>) => api.holdings.update(id, body),
    onSuccess: invalidate,
  });
}
export function useDeleteHolding(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: string) => api.holdings.remove(id),
    onSuccess: invalidate,
  });
}
export function useRefreshPrices(): UseMutationResult<unknown, Error, void> {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: () => api.holdings.refreshPrices(), onSuccess: invalidate });
}

export function useCreateBudget(): UseMutationResult<unknown, Error, BudgetInput> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: BudgetInput) => api.budgets.create(body),
    onSuccess: invalidate,
  });
}
export function useUpdateBudget(): UseMutationResult<unknown, Error, UpdateArgs<BudgetInput>> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: UpdateArgs<BudgetInput>) => api.budgets.update(id, body),
    onSuccess: invalidate,
  });
}
export function useDeleteBudget(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.budgets.remove(id), onSuccess: invalidate });
}

export function useCreateGoal(): UseMutationResult<unknown, Error, GoalInput> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (body: GoalInput) => api.goals.create(body),
    onSuccess: invalidate,
  });
}
export function useUpdateGoal(): UseMutationResult<unknown, Error, UpdateArgs<GoalInput>> {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, body }: UpdateArgs<GoalInput>) => api.goals.update(id, body),
    onSuccess: invalidate,
  });
}
export function useDeleteGoal(): UseMutationResult<unknown, Error, string> {
  const invalidate = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api.goals.remove(id), onSuccess: invalidate });
}
