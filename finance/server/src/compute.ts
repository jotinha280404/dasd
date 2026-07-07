import {
  LIABILITY_TYPES,
  type AccountBalance,
  type Account,
  type AllocationSlice,
  type AssetClass,
  type BudgetStatus,
  type CashflowPoint,
  type DashboardSummary,
  type GoalProgress,
  type HoldingValue,
  type LedgerFilter,
  type LedgerKind,
  type NetWorthPoint,
  type Transaction,
} from "@dasd/fin-shared";
import { db } from "./store/db";

/**
 * Pure read-model computations over the in-memory collections. Everything is
 * synchronous and honors a `LedgerFilter` (personal | business | all). Money is
 * integer cents throughout.
 */

// ── Ledger helpers ──────────────────────────────────────────────────────
function matchesLedger(ledger: LedgerKind, filter: LedgerFilter): boolean {
  return filter === "all" || ledger === filter;
}

function isLiabilityType(account: Account): boolean {
  return LIABILITY_TYPES.includes(account.type);
}

/** YYYY-MM key for an ISO date string (YYYY-MM-DD). */
function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7);
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function isoOf(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** The trailing `n` months as { key: "YYYY-MM", end: last-day ISO } ending this month. */
function lastMonths(n: number): { key: string; end: string }[] {
  const now = new Date();
  const out: { key: string; end: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const anchor = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const endDate = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
    out.push({ key: `${anchor.getFullYear()}-${pad2(anchor.getMonth() + 1)}`, end: isoOf(endDate) });
  }
  return out;
}

function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}`;
}

// ── Balances ────────────────────────────────────────────────────────────
/** Market value of an investment account = Σ holding quantity × current price. */
function investmentValue(accountId: string): number {
  let sum = 0;
  for (const h of db.holdings.all()) {
    if (h.accountId === accountId) sum += Math.round(h.quantity * h.currentPrice);
  }
  return sum;
}

/** Cash balance up to (and including) `asOf` ISO date, or all-time when omitted. */
function cashBalance(account: Account, asOf?: string): number {
  let sum = account.openingBalance;
  for (const t of db.transactions.all()) {
    if (t.accountId !== account.id) continue;
    if (asOf !== undefined && t.date > asOf) continue;
    sum += t.amount;
  }
  return sum;
}

function balanceOf(account: Account, asOf?: string): number {
  // Simplification: investment accounts always report their *current* market
  // value (holdings carry no history), even when replaying a past month end.
  return account.type === "investment" ? investmentValue(account.id) : cashBalance(account, asOf);
}

export function accountBalances(ledger: LedgerFilter): AccountBalance[] {
  return db.accounts
    .all()
    .filter((a) => !a.archived && matchesLedger(a.ledger, ledger))
    .map((a) => ({
      accountId: a.id,
      name: a.name,
      ledger: a.ledger,
      type: a.type,
      balance: balanceOf(a),
      isLiability: isLiabilityType(a),
    }));
}

// ── Net worth ───────────────────────────────────────────────────────────
export function netWorthSeries(ledger: LedgerFilter, months = 12): NetWorthPoint[] {
  const accounts = db.accounts.all().filter((a) => !a.archived && matchesLedger(a.ledger, ledger));
  return lastMonths(months).map(({ key, end }) => {
    let assets = 0;
    let liabilities = 0;
    for (const a of accounts) {
      const bal = balanceOf(a, end);
      if (isLiabilityType(a)) liabilities += bal;
      else assets += bal;
    }
    const liabMagnitude = Math.abs(liabilities);
    return { date: key, assets, liabilities: liabMagnitude, net: assets - liabMagnitude };
  });
}

/** Net worth right now for a ledger (assets − |liabilities|). */
function netWorthNow(ledger: LedgerFilter): { net: number; assets: number; liabilities: number } {
  let assets = 0;
  let liabilities = 0;
  for (const b of accountBalances(ledger)) {
    if (b.isLiability) liabilities += b.balance;
    else assets += b.balance;
  }
  const liabMagnitude = Math.abs(liabilities);
  return { net: assets - liabMagnitude, assets, liabilities: liabMagnitude };
}

// ── Cashflow ────────────────────────────────────────────────────────────
export function cashflowSeries(ledger: LedgerFilter, months = 12): CashflowPoint[] {
  const income = new Map<string, number>();
  const expense = new Map<string, number>();
  for (const t of db.transactions.all()) {
    if (t.type === "transfer") continue;
    if (!matchesLedger(t.ledger, ledger)) continue;
    const key = monthKey(t.date);
    if (t.amount >= 0) income.set(key, (income.get(key) ?? 0) + t.amount);
    else expense.set(key, (expense.get(key) ?? 0) + Math.abs(t.amount));
  }
  return lastMonths(months).map(({ key }) => {
    const inc = income.get(key) ?? 0;
    const exp = expense.get(key) ?? 0;
    return { period: key, income: inc, expense: exp, net: inc - exp };
  });
}

// ── Allocation ──────────────────────────────────────────────────────────
const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: "Checking",
  savings: "Savings",
  credit: "Credit",
  cash: "Cash",
  investment: "Investment",
  loan: "Loan",
  other: "Other",
};

const ASSET_CLASS_LABEL: Record<AssetClass, string> = {
  equity: "Equity",
  etf: "ETF",
  crypto: "Crypto",
  bond: "Bond",
  cash: "Cash",
  reit: "REIT",
  other: "Other",
};

export function allocation(ledger: LedgerFilter, by: "accountType" | "assetClass"): AllocationSlice[] {
  const totals = new Map<string, number>();
  if (by === "assetClass") {
    for (const hv of holdingValues(ledger)) {
      if (hv.value <= 0) continue;
      totals.set(hv.assetClass, (totals.get(hv.assetClass) ?? 0) + hv.value);
    }
    return [...totals.entries()]
      .map(([key, value]) => ({ key, label: ASSET_CLASS_LABEL[key as AssetClass] ?? key, value }))
      .sort((a, b) => b.value - a.value);
  }
  for (const b of accountBalances(ledger)) {
    if (b.isLiability || b.balance <= 0) continue;
    totals.set(b.type, (totals.get(b.type) ?? 0) + b.balance);
  }
  return [...totals.entries()]
    .map(([key, value]) => ({ key, label: ACCOUNT_TYPE_LABEL[key] ?? key, value }))
    .sort((a, b) => b.value - a.value);
}

// ── Budgets ─────────────────────────────────────────────────────────────
/** Spend for a category within a ledger for the given YYYY-MM (positive magnitude). */
function monthSpend(categoryId: string, ledger: LedgerKind, month: string): number {
  let spent = 0;
  for (const t of db.transactions.all()) {
    if (t.type !== "expense") continue;
    if (t.categoryId !== categoryId) continue;
    if (t.ledger !== ledger) continue;
    if (monthKey(t.date) !== month) continue;
    spent += Math.abs(t.amount);
  }
  return spent;
}

export function budgetStatuses(ledger: LedgerFilter): BudgetStatus[] {
  const month = currentMonthKey();
  return db.budgets
    .all()
    .filter((b) => matchesLedger(b.ledger, ledger))
    .map((b) => {
      const cat = db.categories.get(b.categoryId);
      const spent = monthSpend(b.categoryId, b.ledger, month);
      return {
        budgetId: b.id,
        categoryId: b.categoryId,
        categoryName: cat?.name ?? "Uncategorized",
        ledger: b.ledger,
        limit: b.limit,
        spent,
        remaining: b.limit - spent,
        pct: b.limit > 0 ? spent / b.limit : 0,
      };
    });
}

// ── Goals ───────────────────────────────────────────────────────────────
function matchesGoalLedger(goalLedger: LedgerKind | null, filter: LedgerFilter): boolean {
  if (filter === "all" || goalLedger === null) return true;
  return goalLedger === filter;
}

export function goalProgress(ledger: LedgerFilter): GoalProgress[] {
  return db.goals
    .all()
    .filter((g) => matchesGoalLedger(g.ledger, ledger))
    .map((g) => {
      let current = g.currentAmount;
      if (g.linkedAccountId) {
        const acct = db.accounts.get(g.linkedAccountId);
        if (acct) current = balanceOf(acct);
      }
      return {
        goalId: g.id,
        name: g.name,
        target: g.targetAmount,
        current,
        pct: g.targetAmount > 0 ? current / g.targetAmount : 0,
        deadline: g.deadline,
      };
    });
}

// ── Holdings ────────────────────────────────────────────────────────────
export function holdingValues(ledger: LedgerFilter): HoldingValue[] {
  return db.holdings
    .all()
    .filter((h) => matchesLedger(h.ledger, ledger))
    .map((h) => {
      const value = Math.round(h.quantity * h.currentPrice);
      const gain = value - h.costBasis;
      return {
        holdingId: h.id,
        symbol: h.symbol,
        name: h.name,
        assetClass: h.assetClass,
        quantity: h.quantity,
        costBasis: h.costBasis,
        price: h.currentPrice,
        value,
        gain,
        gainPct: h.costBasis > 0 ? gain / h.costBasis : 0,
      };
    });
}

// ── This-month cashflow (single point) ──────────────────────────────────
function thisMonthCashflow(ledger: LedgerFilter): { income: number; expense: number } {
  const month = currentMonthKey();
  let income = 0;
  let expense = 0;
  for (const t of db.transactions.all()) {
    if (t.type === "transfer") continue;
    if (!matchesLedger(t.ledger, ledger)) continue;
    if (monthKey(t.date) !== month) continue;
    if (t.amount >= 0) income += t.amount;
    else expense += Math.abs(t.amount);
  }
  return { income, expense };
}

// ── Dashboard ───────────────────────────────────────────────────────────
export function dashboard(ledger: LedgerFilter): DashboardSummary {
  const nw = netWorthNow(ledger);
  const invValue = holdingValues(ledger).reduce((s, h) => s + h.value, 0);
  const invGain = holdingValues(ledger).reduce((s, h) => s + h.gain, 0);
  const flow = thisMonthCashflow(ledger);
  return {
    ledger,
    baseCurrency: "USD",
    netWorth: nw.net,
    assets: nw.assets,
    liabilities: nw.liabilities,
    investmentsValue: invValue,
    investmentsGain: invGain,
    monthIncome: flow.income,
    monthExpense: flow.expense,
    monthNet: flow.income - flow.expense,
    netWorthByLedger: {
      personal: netWorthNow("personal").net,
      business: netWorthNow("business").net,
    },
  };
}

/** Convenience re-export for routes that need the raw filtered transaction list. */
export function transactionsFor(ledger: LedgerFilter): Transaction[] {
  return db.transactions.all().filter((t) => matchesLedger(t.ledger, ledger));
}
