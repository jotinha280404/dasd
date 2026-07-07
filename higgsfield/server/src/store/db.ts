import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Character, Generation } from "@dasd/higg-shared";

/**
 * A tiny JSON-file store: one file per collection under `<server>/store/data/`
 * (gitignored). Each collection loads its file into memory once on construction
 * and writes the whole array back synchronously on every mutation — plenty for a
 * single-user studio demo, and it keeps the routes purely synchronous over
 * in-memory arrays.
 */

const moduleDir = path.dirname(fileURLToPath(import.meta.url));
// moduleDir = <server>/src/store → data lives at <server>/store/data (gitignored).
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
  generations: Collection<Generation>;
  characters: Collection<Character>;
}

export const db: Db = {
  generations: new Collection<Generation>("generations"),
  characters: new Collection<Character>("characters"),
};
