import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { CalendarEvent } from "@dasd/cal-shared";

/**
 * A tiny JSON-file store: one file per collection under `<server>/store/data/`
 * (gitignored). The collection loads its file into memory once on construction
 * and writes the whole array back synchronously on every mutation. This is more
 * than fast enough for a single-user calendar and keeps the provider layer a
 * thin synchronous wrapper over an in-memory array.
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

  /** All rows (a copy, so callers can't mutate the backing array). */
  all(): T[] {
    return [...this.items];
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

  update(id: string, next: T): T | undefined {
    const idx = this.items.findIndex((it) => it.id === id);
    if (idx === -1) return undefined;
    this.items[idx] = next;
    this.persist();
    return next;
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
  events: Collection<CalendarEvent>;
}

export const db: Db = {
  events: new Collection<CalendarEvent>("events"),
};
