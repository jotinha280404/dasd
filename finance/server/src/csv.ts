import { type Cents, toCents } from "@dasd/fin-shared";

/**
 * Minimal CSV import. Expects a header row containing `date,amount,description,
 * category` (case-insensitive, any order); handles quoted fields, embedded
 * commas/newlines, and doubled `""` escapes. Amount is a signed major-unit
 * value → integer cents (positive inflow / negative outflow); `(1.23)` and a
 * leading `-` both read as negative.
 */

export interface ParsedRow {
  date: string; // YYYY-MM-DD
  amount: Cents; // signed
  description: string;
  category: string; // "" when absent
}

/** Tokenize CSV text into a matrix of string cells (RFC-4180-ish). */
function tokenize(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;
  const pushField = (): void => {
    row.push(field);
    field = "";
  };
  const pushRow = (): void => {
    pushField();
    rows.push(row);
    row = [];
  };
  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushField();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  // Flush trailing field/row unless the input ended on a clean newline.
  if (field.length > 0 || row.length > 0) pushRow();
  return rows;
}

/** Parse a signed major-unit amount string into integer cents. */
function parseAmount(raw: string): Cents {
  let s = raw.trim();
  let negative = false;
  if (s.startsWith("(") && s.endsWith(")")) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[^0-9.-]/g, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  }
  const value = Number.parseFloat(s);
  if (!Number.isFinite(value)) return 0;
  const cents = toCents(value);
  return negative ? -cents : cents;
}

/** Normalize a date cell to YYYY-MM-DD when it is a recognizable format. */
function parseDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const mdy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (mdy) {
    const month = mdy[1] ?? "";
    const day = mdy[2] ?? "";
    const year = mdy[3] ?? "";
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }
  const parsed = new Date(s);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, "0");
    const d = String(parsed.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  return s;
}

function findColumn(header: string[], ...names: string[]): number {
  const lowered = header.map((h) => h.trim().toLowerCase());
  for (const name of names) {
    const idx = lowered.indexOf(name);
    if (idx !== -1) return idx;
  }
  return -1;
}

export function parseCsv(text: string): ParsedRow[] {
  const matrix = tokenize(text).filter((r) => r.some((cell) => cell.trim().length > 0));
  if (matrix.length === 0) return [];
  const header = matrix[0] ?? [];
  const dateCol = findColumn(header, "date");
  const amountCol = findColumn(header, "amount");
  const descCol = findColumn(header, "description", "payee", "memo");
  const catCol = findColumn(header, "category");

  const cellAt = (row: string[], idx: number): string => (idx >= 0 ? (row[idx] ?? "") : "");

  const rows: ParsedRow[] = [];
  for (let r = 1; r < matrix.length; r++) {
    const row = matrix[r] ?? [];
    rows.push({
      date: parseDate(cellAt(row, dateCol)),
      amount: parseAmount(cellAt(row, amountCol)),
      description: cellAt(row, descCol).trim(),
      category: cellAt(row, catCol).trim(),
    });
  }
  return rows;
}
