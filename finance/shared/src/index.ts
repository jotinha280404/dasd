/**
 * @dasd/fin-shared — the contract shared between the finance web app and server:
 * the domain model (accounts, transactions, holdings, budgets, goals), the
 * derived summary types, and money helpers.
 */
export const FIN_SHARED_VERSION = "1.0.0";

export interface Health {
  ok: true;
  service: string;
  ts: string;
}

export * from "./models";
export * from "./money";
