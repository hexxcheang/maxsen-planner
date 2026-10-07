/**
 * Reads an old invoice back in: from the cells of an invoice spreadsheet (Maxsen's template or
 * any sheet with Description / Qty / Unit price columns) or rows pasted from one. Every line is
 * kept as it was invoiced, quantity and unit price, along with what was asked for already (the
 * deposit, a 2nd payment), so the next payment's invoice can be made from it.
 */

export type Cell = string | number | null | undefined;

export interface OldInvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
}

export type OldInvoiceRow =
  ({ kind: 'item' } & OldInvoiceLine) | { kind: 'section'; title: string };

export interface OldInvoice {
  number: string;
  date: string;
  client: { name: string; contact: string };
  rows: OldInvoiceRow[];
  /** The totals and payments printed on it, when found. */
  total: number | null;
  deposit: number | null;
  lessPaid: number | null;
  secondPayment: number | null;
  finalPayment: number | null;
}

const text = (c: Cell) => (c === null || c === undefined ? '' : String(c).trim());
const num = (c: Cell): number | null => {
  if (typeof c === 'number') return Number.isFinite(c) ? c : null;
  const t = text(c).replace(/[,\s]|S\$|\$/gi, '');
  if (!/^-?\d+(\.\d+)?$/.test(t)) return null;
  return Number(t);
};

/** The first non-empty cell after a label (in the same row), for header fields. */
function after(grid: Cell[][], label: RegExp): Cell {
  for (const row of grid) {
    const i = row.findIndex((c) => label.test(text(c)));
    if (i < 0) continue;
    // The value may share the cell ("Name: Mr Tan").
    const own = text(row[i])
      .replace(label, '')
      .replace(/^[:\s]+/, '');
    if (own) return own;
    for (let j = i + 1; j < row.length; j++) if (text(row[j])) return row[j];
  }
  return null;
}

/** The amount printed beside a total/payment label anywhere on the sheet. */
function amountBeside(grid: Cell[][], label: RegExp): number | null {
  for (const row of grid) {
    const i = row.findIndex((c) => label.test(text(c)));
    if (i < 0) continue;
    for (let j = i + 1; j < row.length; j++) {
      const v = num(row[j]);
      if (v !== null) return v;
    }
  }
  return null;
}

const TOTAL = /total/i;

export function parseOldInvoice(grid: Cell[][]): OldInvoice {
  // The item table's heading row, and which columns hold what.
  let head = -1;
  let col = { desc: -1, qty: -1, unit: -1 };
  for (let r = 0; r < grid.length && head < 0; r++) {
    const cells = grid[r]!.map((c) => text(c).toLowerCase());
    const qty = cells.findIndex((c) => /^(qty|quantity)\b/.test(c));
    const unit = cells.findIndex((c) => /unit\s*(price|rate|cost)|^rate\b/.test(c));
    const desc = cells.findIndex((c) => /description|^item/.test(c));
    if (qty >= 0 && unit >= 0) {
      head = r;
      col = { desc: desc >= 0 ? desc : Math.max(0, Math.min(qty, unit) - 1), qty, unit };
    }
  }

  const rows: OldInvoiceRow[] = [];
  const start = head >= 0 ? head + 1 : 0;
  for (let r = start; r < grid.length; r++) {
    const row = grid[r]!;
    let description: string;
    let quantity: number | null;
    let unitPrice: number | null;
    if (head >= 0) {
      description = text(row[col.desc]) || text(row[col.desc + 1]);
      quantity = num(row[col.qty]);
      unitPrice = num(row[col.unit]);
    } else {
      // Pasted rows: the words are the description, then quantity and unit price.
      description = row
        .filter((c) => num(c) === null && text(c))
        .map(text)
        .join(' ');
      const nums = row.map(num).filter((v): v is number => v !== null);
      // A leading serial number isn't the quantity.
      if (nums.length >= 3 && typeof row[0] !== 'undefined' && num(row[0]) !== null) nums.shift();
      [quantity = null, unitPrice = null] = nums;
    }
    // The total row ends the items (a package's text can mention a total too, with a quantity).
    if (head >= 0 && quantity === null && TOTAL.test(description)) break;
    if (!description && quantity === null) continue;
    if (quantity !== null && unitPrice !== null && description) {
      rows.push({ kind: 'item', description, quantity, unitPrice });
    } else if (description && quantity === null && unitPrice === null) {
      // A short heading (e.g. "Lighting") starts a section; longer text (warranty) is left out.
      if (description.length <= 40 && !/warranty|terms|deposit|payment/i.test(description))
        rows.push({ kind: 'section', title: description });
    }
  }
  // Drop sections with nothing under them.
  const kept = rows.filter(
    (r, i) => r.kind === 'item' || (rows[i + 1] !== undefined && rows[i + 1]!.kind === 'item'),
  );

  const date = after(grid, /^date\b/i);
  const paid = amountBeside(grid, /less\s*paid|already\s*paid|deposit\b.*\bpaid\b/i);
  return {
    number: text(
      after(grid, /invoice\s*(#|no\.?|number)|quotation\s*(#|no\.?)/i) ??
        // The app's own PDF: "QUOTATION MX-…" or "INVOICE MX-…".
        after(grid, /^(invoice|quotation)\b\s*:?/i),
    ),
    date: text(date),
    client: {
      name:
        text(after(grid, /^name\s*:?/i)) ||
        text(after(grid, /^prepared\s*for\s*:?/i)) ||
        text(after(grid, /^(to|attn)\b\s*:?/i)),
      contact: text(after(grid, /^(phone|contact|tel)\s*:?/i)),
    },
    rows: kept,
    total:
      amountBeside(grid, /gran[dt]\s*total/i) ??
      amountBeside(grid, /total\s*price/i) ??
      amountBeside(grid, /^total$/i),
    deposit: amountBeside(grid, /deposit\s*request/i) ?? amountBeside(grid, /^deposit\s*\(\d+%\)/i),
    // Printed as "-S$2,353.20" on the PDF.
    lessPaid: paid === null ? null : Math.abs(paid),
    secondPayment: amountBeside(grid, /(2nd|second)\s*payment(?!\s*paid)/i),
    finalPayment: amountBeside(grid, /final\s*payment(?!\s*paid)/i),
  };
}

/** What the old invoice asked for already, as the issued invoices a payment stage builds on. */
export function issuedFromOld(old: OldInvoice): {
  deposit?: { number: string; total: number; due: number; date: string };
  second?: { number: string; total: number; due: number; date: string };
} {
  const total = old.total ?? 0;
  const at = { number: old.number, total, date: old.date };
  if (old.secondPayment !== null) {
    return {
      deposit: { ...at, due: old.lessPaid ?? 0 },
      second: { ...at, due: old.secondPayment },
    };
  }
  if (old.deposit !== null) return { deposit: { ...at, due: old.deposit } };
  return {};
}
