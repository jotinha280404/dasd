import { z } from "zod";

/**
 * Finance domain model. Money is stored as an integer number of MINOR units
 * (cents) to avoid floating-point drift; the UI formats via Intl. A single base
 * currency is assumed for cross-account rollups (per-account `currency` is kept
 * for display / future FX). Personal vs business is the `ledger` dimension.
 */

export const Cents = z.number().int();
export type Cents = number;

export const LedgerKind = z.enum(["personal", "business"]);
export type LedgerKind = z.infer<typeof LedgerKind>;

/** Query dimension: one ledger or the combined view. */
export const LedgerFilter = z.enum(["personal", "business", "all"]);
export type LedgerFilter = z.infer<typeof LedgerFilter>;

export const AccountType = z.enum([
  "checking",
  "savings",
  "credit",
  "cash",
  "investment",
  "loan",
  "other",
]);
export type AccountType = z.infer<typeof AccountType>;

/** Liability account types (subtracted from net worth). */
export const LIABILITY_TYPES: readonly AccountType[] = ["credit", "loan"];

export const TxnType = z.enum(["income", "expense", "transfer"]);
export type TxnType = z.infer<typeof TxnType>;

export const CategoryKind = z.enum(["income", "expense"]);
export type CategoryKind = z.infer<typeof CategoryKind>;

export const AssetClass = z.enum(["equity", "etf", "crypto", "bond", "cash", "reit", "other"]);
export type AssetClass = z.infer<typeof AssetClass>;

// ── Entities ──────────────────────────────────────────────────────────
export const Account = z.object({
  id: z.string(),
  name: z.string(),
  ledger: LedgerKind,
  type: AccountType,
  currency: z.string().default("USD"),
  /** Balance before any recorded transactions (cents). */
  openingBalance: Cents.default(0),
  institution: z.string().optional(),
  archived: z.boolean().default(false),
  createdAt: z.string(),
});
export type Account = z.infer<typeof Account>;

export const Category = z.object({
  id: z.string(),
  name: z.string(),
  kind: CategoryKind,
  icon: z.string().optional(),
  color: z.string().optional(),
});
export type Category = z.infer<typeof Category>;

export const Transaction = z.object({
  id: z.string(),
  accountId: z.string(),
  /** Denormalized from the account for fast ledger filtering. */
  ledger: LedgerKind,
  /** ISO date (YYYY-MM-DD). */
  date: z.string(),
  /** Signed cents: positive = inflow, negative = outflow. */
  amount: Cents,
  type: TxnType,
  categoryId: z.string().nullable().default(null),
  payee: z.string().optional(),
  note: z.string().optional(),
  tags: z.array(z.string()).default([]),
  /** For transfers: the other account. */
  transferAccountId: z.string().nullable().default(null),
  cleared: z.boolean().default(true),
  createdAt: z.string(),
});
export type Transaction = z.infer<typeof Transaction>;

export const Holding = z.object({
  id: z.string(),
  accountId: z.string(),
  ledger: LedgerKind,
  symbol: z.string(),
  name: z.string().optional(),
  assetClass: AssetClass.default("equity"),
  quantity: z.number(),
  /** Total cost basis in cents. */
  costBasis: Cents.default(0),
  /** Latest price per unit in cents (manual or from a price provider). */
  currentPrice: Cents.default(0),
  currency: z.string().default("USD"),
  updatedAt: z.string(),
});
export type Holding = z.infer<typeof Holding>;

export const Budget = z.object({
  id: z.string(),
  categoryId: z.string(),
  ledger: LedgerKind,
  period: z.literal("monthly").default("monthly"),
  /** Monthly limit in cents. */
  limit: Cents,
});
export type Budget = z.infer<typeof Budget>;

export const Goal = z.object({
  id: z.string(),
  name: z.string(),
  ledger: LedgerKind.nullable().default(null),
  targetAmount: Cents,
  currentAmount: Cents.default(0),
  /** ISO date. */
  deadline: z.string().nullable().default(null),
  /** If set, progress tracks this account's balance instead of currentAmount. */
  linkedAccountId: z.string().nullable().default(null),
  note: z.string().optional(),
  createdAt: z.string(),
});
export type Goal = z.infer<typeof Goal>;

// ── Derived / summary types (server-computed) ─────────────────────────
export interface NetWorthPoint {
  date: string; // YYYY-MM
  assets: Cents;
  liabilities: Cents; // positive magnitude
  net: Cents;
}

export interface CashflowPoint {
  period: string; // YYYY-MM
  income: Cents;
  expense: Cents; // positive magnitude
  net: Cents;
}

export interface AllocationSlice {
  key: string;
  label: string;
  value: Cents;
}

export interface AccountBalance {
  accountId: string;
  name: string;
  ledger: LedgerKind;
  type: AccountType;
  /** Cash balance (transactions) or market value (investment accounts), cents. */
  balance: Cents;
  isLiability: boolean;
}

export interface BudgetStatus {
  budgetId: string;
  categoryId: string;
  categoryName: string;
  ledger: LedgerKind;
  limit: Cents;
  spent: Cents;
  remaining: Cents;
  pct: number; // 0..1+ (over budget > 1)
}

export interface GoalProgress {
  goalId: string;
  name: string;
  target: Cents;
  current: Cents;
  pct: number; // 0..1
  deadline: string | null;
}

export interface HoldingValue {
  holdingId: string;
  symbol: string;
  name?: string;
  assetClass: AssetClass;
  quantity: number;
  costBasis: Cents;
  price: Cents;
  value: Cents;
  gain: Cents;
  gainPct: number;
}

export interface DashboardSummary {
  ledger: LedgerFilter;
  baseCurrency: string;
  netWorth: Cents;
  assets: Cents;
  liabilities: Cents;
  investmentsValue: Cents;
  investmentsGain: Cents;
  /** This month. */
  monthIncome: Cents;
  monthExpense: Cents;
  monthNet: Cents;
  netWorthByLedger: { personal: Cents; business: Cents };
}
