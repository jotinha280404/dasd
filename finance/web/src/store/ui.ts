import type { LedgerFilter } from "@dasd/fin-shared";
import { create } from "zustand";

/** The six routed pages. A tiny state router avoids a react-router dependency. */
export type Page =
  | "dashboard"
  | "accounts"
  | "transactions"
  | "investments"
  | "budgets"
  | "goals";

interface UiState {
  page: Page;
  /** Global ledger filter — every data query keys off this. */
  ledger: LedgerFilter;
  /** Base display currency for all money formatting. */
  currency: string;
  setPage: (page: Page) => void;
  setLedger: (ledger: LedgerFilter) => void;
  setCurrency: (currency: string) => void;
}

export const useUiStore = create<UiState>((set) => ({
  page: "dashboard",
  ledger: "all",
  currency: "USD",
  setPage: (page) => set({ page }),
  setLedger: (ledger) => set({ ledger }),
  setCurrency: (currency) => set({ currency }),
}));
