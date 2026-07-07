import { nanoid } from "nanoid";
import type {
  Account,
  AccountType,
  AssetClass,
  Budget,
  Category,
  CategoryKind,
  Goal,
  Holding,
  LedgerKind,
  Transaction,
  TxnType,
} from "@dasd/fin-shared";
import { db } from "./db";

/**
 * Generates a RICH, believable demo the first time the server boots so the
 * dashboard looks alive: personal + business accounts, ~12 months of varied
 * transactions on both ledgers, a diversified brokerage, budgets and goals.
 * Amounts are integer cents; dates use real Date math for the trailing year.
 */

const NUM_MONTHS = 12;

function isoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** ISO date for `day` of the month `monthsAgo` months before today, never in the future. */
function seededDate(monthsAgo: number, day: number): string {
  const now = new Date();
  const anchor = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
  const lastDay = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
  let dayOfMonth = Math.min(day, lastDay);
  if (monthsAgo === 0 && dayOfMonth > now.getDate()) dayOfMonth = now.getDate();
  return isoDate(new Date(anchor.getFullYear(), anchor.getMonth(), dayOfMonth));
}

/** Deterministic month-to-month variation (in cents) around a base amount. */
function jitter(base: number, monthsAgo: number, spread: number): number {
  const wave = Math.sin(monthsAgo * 1.7 + base * 0.00013);
  return Math.round(base + wave * spread);
}

function account(
  name: string,
  ledger: LedgerKind,
  type: AccountType,
  openingBalance: number,
  institution: string,
): Account {
  return {
    id: nanoid(),
    name,
    ledger,
    type,
    currency: "USD",
    openingBalance,
    institution,
    archived: false,
    createdAt: seededDate(NUM_MONTHS, 1),
  };
}

function category(name: string, kind: CategoryKind, icon: string, color: string): Category {
  return { id: nanoid(), name, kind, icon, color };
}

interface TxnDraft {
  accountId: string;
  ledger: LedgerKind;
  date: string;
  amount: number;
  type: TxnType;
  categoryId: string | null;
  payee?: string;
  transferAccountId?: string | null;
}

function txn(draft: TxnDraft): Transaction {
  return {
    id: nanoid(),
    accountId: draft.accountId,
    ledger: draft.ledger,
    date: draft.date,
    amount: draft.amount,
    type: draft.type,
    categoryId: draft.categoryId,
    payee: draft.payee,
    tags: [],
    transferAccountId: draft.transferAccountId ?? null,
    cleared: true,
    createdAt: draft.date,
  };
}

function holding(
  accountId: string,
  ledger: LedgerKind,
  symbol: string,
  name: string,
  assetClass: AssetClass,
  quantity: number,
  costBasis: number,
  currentPrice: number,
): Holding {
  return {
    id: nanoid(),
    accountId,
    ledger,
    symbol,
    name,
    assetClass,
    quantity,
    costBasis,
    currentPrice,
    currency: "USD",
    updatedAt: isoDate(new Date()),
  };
}

export function seedIfEmpty(): boolean {
  if (db.accounts.count() > 0) return false;

  // ── Accounts ──────────────────────────────────────────────────────────
  const checking = account("Everyday Checking", "personal", "checking", 520_00, "Chase");
  const savings = account("High-Yield Savings", "personal", "savings", 1_480_000, "Ally");
  const creditCard = account("Sapphire Credit Card", "personal", "credit", 0, "Chase");
  const brokerage = account("Brokerage", "personal", "investment", 0, "Fidelity");
  const bizChecking = account("Business Checking", "business", "checking", 820_000, "Mercury");
  const bizCredit = account("Business Credit", "business", "credit", 0, "Amex");
  const accounts = [checking, savings, creditCard, brokerage, bizChecking, bizCredit];
  db.accounts.insertMany(accounts);

  // ── Categories ────────────────────────────────────────────────────────
  const salary = category("Salary", "income", "briefcase", "#199e70");
  const interest = category("Interest", "income", "percent", "#3987e5");
  const revenue = category("Business Revenue", "income", "trending-up", "#008300");
  const rent = category("Rent", "expense", "home", "#e66767");
  const groceries = category("Groceries", "expense", "shopping-cart", "#d55181");
  const utilities = category("Utilities", "expense", "zap", "#c98500");
  const dining = category("Dining", "expense", "utensils", "#d95926");
  const subscriptions = category("Subscriptions", "expense", "repeat", "#9085e9");
  const transport = category("Transport", "expense", "car", "#3987e5");
  const shopping = category("Shopping", "expense", "shopping-bag", "#d55181");
  const healthcare = category("Healthcare", "expense", "heart-pulse", "#e66767");
  const software = category("Software", "expense", "code", "#3987e5");
  const contractors = category("Contractors", "expense", "users", "#c98500");
  const advertising = category("Advertising", "expense", "megaphone", "#d95926");
  const categories = [
    salary, interest, revenue, rent, groceries, utilities, dining, subscriptions,
    transport, shopping, healthcare, software, contractors, advertising,
  ];
  db.categories.insertMany(categories);

  // ── Transactions (~12 months on both ledgers) ─────────────────────────
  const txns: Transaction[] = [];
  for (let m = NUM_MONTHS - 1; m >= 0; m--) {
    // Personal income.
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 1),
      amount: jitter(6_500_00, m, 220_00), type: "income", categoryId: salary.id,
      payee: "Acme Corp Payroll",
    }));
    txns.push(txn({
      accountId: savings.id, ledger: "personal", date: seededDate(m, 2),
      amount: jitter(34_00, m, 9_00), type: "income", categoryId: interest.id,
      payee: "Ally Interest",
    }));

    // Personal fixed + variable expenses from checking.
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 1),
      amount: -2_200_00, type: "expense", categoryId: rent.id, payee: "Sunrise Apartments",
    }));
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 5),
      amount: -jitter(148_00, m, 42_00), type: "expense", categoryId: utilities.id,
      payee: "City Utilities",
    }));
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 8),
      amount: -jitter(118_00, m, 55_00), type: "expense", categoryId: groceries.id,
      payee: "Whole Foods",
    }));
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 18),
      amount: -jitter(132_00, m, 48_00), type: "expense", categoryId: groceries.id,
      payee: "Trader Joe's",
    }));
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 12),
      amount: -jitter(92_00, m, 34_00), type: "expense", categoryId: transport.id,
      payee: "Shell",
    }));
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 22),
      amount: -jitter(74_00, m, 40_00), type: "expense", categoryId: healthcare.id,
      payee: "CVS Pharmacy",
    }));

    // Personal spending on the credit card (revolving liability).
    txns.push(txn({
      accountId: creditCard.id, ledger: "personal", date: seededDate(m, 6),
      amount: -jitter(63_00, m, 22_00), type: "expense", categoryId: subscriptions.id,
      payee: "Streaming Bundle",
    }));
    txns.push(txn({
      accountId: creditCard.id, ledger: "personal", date: seededDate(m, 14),
      amount: -jitter(178_00, m, 90_00), type: "expense", categoryId: dining.id,
      payee: "Local Restaurants",
    }));
    txns.push(txn({
      accountId: creditCard.id, ledger: "personal", date: seededDate(m, 20),
      amount: -jitter(214_00, m, 130_00), type: "expense", categoryId: shopping.id,
      payee: "Amazon",
    }));
    // Card payment (transfer checking → card): pays down most of the balance.
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 26),
      amount: -380_00, type: "transfer", categoryId: null, transferAccountId: creditCard.id,
      payee: "Credit Card Payment",
    }));
    txns.push(txn({
      accountId: creditCard.id, ledger: "personal", date: seededDate(m, 26),
      amount: 380_00, type: "transfer", categoryId: null, transferAccountId: checking.id,
      payee: "Payment Received",
    }));

    // Transfer to savings.
    txns.push(txn({
      accountId: checking.id, ledger: "personal", date: seededDate(m, 3),
      amount: -1_000_00, type: "transfer", categoryId: null, transferAccountId: savings.id,
      payee: "Monthly Savings",
    }));
    txns.push(txn({
      accountId: savings.id, ledger: "personal", date: seededDate(m, 3),
      amount: 1_000_00, type: "transfer", categoryId: null, transferAccountId: checking.id,
      payee: "Monthly Savings",
    }));

    // Business revenue + expenses.
    txns.push(txn({
      accountId: bizChecking.id, ledger: "business", date: seededDate(m, 4),
      amount: jitter(11_800_00, m, 3_400_00), type: "income", categoryId: revenue.id,
      payee: "Client Retainer",
    }));
    txns.push(txn({
      accountId: bizChecking.id, ledger: "business", date: seededDate(m, 15),
      amount: jitter(4_200_00, m, 2_600_00), type: "income", categoryId: revenue.id,
      payee: "Project Invoice",
    }));
    txns.push(txn({
      accountId: bizChecking.id, ledger: "business", date: seededDate(m, 10),
      amount: -jitter(2_600_00, m, 900_00), type: "expense", categoryId: contractors.id,
      payee: "Freelance Designer",
    }));
    txns.push(txn({
      accountId: bizCredit.id, ledger: "business", date: seededDate(m, 7),
      amount: -jitter(320_00, m, 110_00), type: "expense", categoryId: software.id,
      payee: "SaaS Subscriptions",
    }));
    txns.push(txn({
      accountId: bizCredit.id, ledger: "business", date: seededDate(m, 16),
      amount: -jitter(540_00, m, 260_00), type: "expense", categoryId: advertising.id,
      payee: "Google Ads",
    }));
    // Business card payment (transfer biz checking → biz card).
    txns.push(txn({
      accountId: bizChecking.id, ledger: "business", date: seededDate(m, 25),
      amount: -760_00, type: "transfer", categoryId: null, transferAccountId: bizCredit.id,
      payee: "Card Payment",
    }));
    txns.push(txn({
      accountId: bizCredit.id, ledger: "business", date: seededDate(m, 25),
      amount: 760_00, type: "transfer", categoryId: null, transferAccountId: bizChecking.id,
      payee: "Payment Received",
    }));
  }
  db.transactions.insertMany(txns);

  // ── Holdings (personal brokerage) ─────────────────────────────────────
  const holdings: Holding[] = [
    holding(brokerage.id, "personal", "VOO", "Vanguard S&P 500 ETF", "etf", 25, 1_100_000, 512_00),
    holding(brokerage.id, "personal", "AAPL", "Apple Inc.", "equity", 40, 720_000, 225_00),
    holding(brokerage.id, "personal", "BTC", "Bitcoin", "crypto", 0.35, 1_680_000, 65_000_00),
    holding(brokerage.id, "personal", "BND", "Vanguard Total Bond ETF", "bond", 60, 450_000, 72_00),
    holding(brokerage.id, "personal", "VNQ", "Vanguard Real Estate ETF", "reit", 30, 270_000, 88_00),
  ];
  db.holdings.insertMany(holdings);

  // ── Budgets ───────────────────────────────────────────────────────────
  const budgets: Budget[] = [
    { id: nanoid(), categoryId: groceries.id, ledger: "personal", period: "monthly", limit: 600_00 },
    { id: nanoid(), categoryId: dining.id, ledger: "personal", period: "monthly", limit: 300_00 },
    { id: nanoid(), categoryId: subscriptions.id, ledger: "personal", period: "monthly", limit: 80_00 },
    { id: nanoid(), categoryId: transport.id, ledger: "personal", period: "monthly", limit: 200_00 },
    { id: nanoid(), categoryId: shopping.id, ledger: "personal", period: "monthly", limit: 250_00 },
    { id: nanoid(), categoryId: software.id, ledger: "business", period: "monthly", limit: 500_00 },
    { id: nanoid(), categoryId: advertising.id, ledger: "business", period: "monthly", limit: 800_00 },
  ];
  db.budgets.insertMany(budgets);

  // ── Goals ─────────────────────────────────────────────────────────────
  const now = new Date();
  const inMonths = (n: number): string =>
    isoDate(new Date(now.getFullYear(), now.getMonth() + n, 15));
  const goals: Goal[] = [
    {
      id: nanoid(), name: "Emergency Fund", ledger: "personal", targetAmount: 3_000_000,
      currentAmount: 0, deadline: null, linkedAccountId: savings.id,
      note: "Six months of expenses.", createdAt: seededDate(NUM_MONTHS, 1),
    },
    {
      id: nanoid(), name: "Vacation to Japan", ledger: "personal", targetAmount: 500_000,
      currentAmount: 232_000, deadline: inMonths(8), linkedAccountId: null,
      note: "Spring trip.", createdAt: seededDate(6, 1),
    },
    {
      id: nanoid(), name: "New Equipment", ledger: "business", targetAmount: 1_500_000,
      currentAmount: 640_000, deadline: inMonths(10), linkedAccountId: null,
      note: "Workstations + camera gear.", createdAt: seededDate(4, 1),
    },
  ];
  db.goals.insertMany(goals);

  return true;
}
