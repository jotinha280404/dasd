import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Account, Budget, Category, Goal, Holding, Transaction } from "@dasd/fin-shared";

/**
 * A tiny JSON-file store: one file per collection under `<server>/store/data/`
 * (gitignored). Each collection loads its file into memory once on construction
 * and writes the whole array back synchronously on every mutation. This is more
 * than fast enough for a single-user demo and keeps the compute layer purely
 * synchronous over in-memory arrays.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// moduleDir = <server>/src/store → data lives at <server>/store/data (see .gitignore).
const DATA_DIR = path.join(moduleDir, "..", "..", "store", "data");

export interface Entity {
  id: string;
}

export class Collection<T extends Entity> {
  private items: T[];
  private readonly file: string;

  constructor(name: string) {
    this.file = path.join(DATA_DIR, `${name}.json`);
    this.items = this.load();
  }

  private load(): T[] {
    try {
      const raw = readFileSync(this.file, "utf8");
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }

  private persist(): void {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(this.file, JSON.stringify(this.items, null, 2), "utf8");
  }

  /** Live array of all rows (do not mutate the returned array). */
  all(): T[] {
    return this.items;
  }

  get(id: string): T | undefined {
    return this.items.find((it) => it.id === id);
  }

  insert(item: T): T {
    this.items.push(item);
    this.persist();
    return item;
  }

  insertMany(items: T[]): T[] {
    this.items.push(...items);
    this.persist();
    return items;
  }

  update(id: string, patch: Partial<T>): T | undefined {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return undefined;
    const current = this.items[idx];
    if (!current) return undefined;
    const updated: T = { ...current, ...patch, id };
    this.items[idx] = updated;
    this.persist();
    return updated;
  }

  remove(id: string): boolean {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    this.persist();
    return true;
  }

  count(): number {
    return this.items.length;
  }
}

export interface Db {
  accounts: Collection<Account>;
  categories: Collection<Category>;
  transactions: Collection<Transaction>;
  holdings: Collection<Holding>;
  budgets: Collection<Budget>;
  goals: Collection<Goal>;
}

export const db: Db = {
  accounts: new Collection<Account>("accounts"),
  categories: new Collection<Category>("categories"),
  transactions: new Collection<Transaction>("transactions"),
  holdings: new Collection<Holding>("holdings"),
  budgets: new Collection<Budget>("budgets"),
  goals: new Collection<Goal>("goals"),
};
