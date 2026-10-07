/**
 * Turns the text of an invoice or quotation PDF back into rows for `parseOldInvoice`. A PDF has
 * no cells, only words at positions, and wraps descriptions over several lines, sometimes
 * centred beside the numbers (an Excel invoice printed to PDF), sometimes starting level with
 * them (the app's own quotation PDF). So the item table is rebuilt from the column headings:
 * each quantity starts an item, and the description lines nearest it, grouped by their spacing,
 * are its description.
 */
import type { Cell } from './old-invoice.ts';

/** One run of text as a PDF reader gives it: position of its left baseline, in points. */
export interface PdfText {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  str: string;
  /** The page's height in points (A4 when absent), to tell its margins. */
  pageHeight?: number;
}

interface Run {
  x: number;
  /** Down the document: later pages and lower lines are larger. */
  top: number;
  width: number;
  height: number;
  str: string;
  /** In the top or bottom margin of its page, where running titles and footers go. */
  margin: boolean;
}

/** "Q T Y" and "P R I C E" (letter-spaced headings) read as words. */
const unspace = (s: string) =>
  /^(\S )+\S$/.test(s.trim()) ? s.trim().replace(/ /g, '') : s.trim();

const NUMBER = /^\(?-?\s*(S\$|\$)?\s*-?[\d,]+(\.\d+)?\)?$/i;
const isNumber = (s: string) => NUMBER.test(s.replace(/\s/g, ''));

/** Runs on (about) the same baseline, left to right, with close neighbours joined into cells. */
function lines(runs: Run[]): Run[][] {
  const sorted = [...runs].sort((a, b) => a.top - b.top || a.x - b.x);
  const out: Run[][] = [];
  for (const r of sorted) {
    const line = out.at(-1);
    if (line && Math.abs(line[0]!.top - r.top) <= Math.max(2, 0.45 * r.height)) line.push(r);
    else out.push([r]);
  }
  return out.map((line) => {
    const cells: Run[] = [];
    for (const r of line.sort((a, b) => a.x - b.x)) {
      const last = cells.at(-1);
      const gap = last ? r.x - (last.x + last.width) : Infinity;
      if (last && gap < Math.max(3, 1.2 * r.height)) {
        last.str = `${last.str} ${r.str}`;
        last.width = r.x + r.width - last.x;
      } else cells.push({ ...r });
    }
    return cells;
  });
}

/** The line under the items: "Total", "Grand total", "Smart Home + Installation Total Price". */
const TOTAL_LINE = /^(sub-?|grand |gran[dt] )?total\b|\btotal\s*(price|amount|\(|$)/i;

const HEAD = {
  qty: /^(qty|quantity)\b/i,
  unit: /unit\s*(price|rate|cost)|^rate\b/i,
  amount: /^(amount|price|total|line total)\b/i,
  sn: /^(s\/?n|no\.?|#)$/i,
};

export function pdfInvoiceGrid(texts: PdfText[]): Cell[][] {
  const runs: Run[] = texts
    .map((t) => ({ ...t, str: unspace(t.str) }))
    .filter((t) => t.str)
    // Pages one after another; PDF y counts up from the bottom of each page.
    .map((t) => {
      const h = t.pageHeight ?? 842;
      return {
        x: t.x,
        top: t.page * 10_000 - t.y,
        width: t.width,
        height: t.height,
        str: t.str,
        margin: t.y < 0.08 * h || t.y > 0.92 * h,
      };
    });
  // Page furniture (running titles, footers, page numbers) repeats on every page: leave it out.
  const pages = new Map<string, Set<number>>();
  const key = (l: Run[]) => l.map((c) => c.str.replace(/\d/g, '')).join('|');
  const page = (l: Run[]) => Math.floor(l[0]!.top / 10_000);
  for (const l of lines(runs)) {
    const k = key(l);
    pages.set(k, (pages.get(k) ?? new Set()).add(page(l)));
  }
  const pageCount = new Set(texts.map((t) => t.page)).size;
  const all = lines(runs).filter((l, i, ls) => {
    if (pageCount < 2 || !l.every((c) => c.margin) || (pages.get(key(l))?.size ?? 0) < 2)
      return true;
    // Keep the first copy, so the number and client on the first page are still read.
    return ls.findIndex((m) => key(m) === key(l)) === i;
  });
  const asRows = (ls: Run[][]): Cell[][] => ls.map((l) => l.map((c) => c.str));

  const headAt0 = all.findIndex(
    (l) => l.some((c) => HEAD.qty.test(c.str)) && l.some((c) => HEAD.unit.test(c.str)),
  );
  if (headAt0 < 0) return [...labelsAbove(all), ...asRows(all)];
  const headAt = headAt0;
  const head = all[headAt]!;
  const centre = (c: Run) => c.x + c.width / 2;
  const colOf = (re: RegExp) => head.find((c) => re.test(c.str));
  const qtyCol = colOf(HEAD.qty)!;
  const unitCol = colOf(HEAD.unit)!;
  const numberCols = [
    { key: 'qty', at: centre(qtyCol) },
    { key: 'unit', at: centre(unitCol) },
    ...head
      .filter(
        (c) => c !== qtyCol && c !== unitCol && (HEAD.amount.test(c.str) || HEAD.sn.test(c.str)),
      )
      .map((c) => ({ key: 'other', at: centre(c) })),
  ];
  const headText = head.map((c) => c.str.toLowerCase()).join('|');

  // The table runs from the heading to its total line; repeated headings on later pages go.
  let body: Run[] = [];
  let end = all.length;
  for (let i = headAt + 1; i < all.length; i++) {
    const line = all[i]!;
    if (line.map((c) => c.str.toLowerCase()).join('|') === headText) {
      // A continuation page: what's above its heading ("Invoice (continued)") isn't items.
      const top = line[0]!.top;
      body = body.filter(
        (r) => Math.floor(r.top / 10_000) !== Math.floor(top / 10_000) || r.top > top,
      );
      continue;
    }
    const words = line.filter((c) => !isNumber(c.str));
    if (words.some((c) => TOTAL_LINE.test(c.str))) {
      end = i;
      break;
    }
    body.push(...line);
  }

  // Numbers go to the column whose heading they sit under; words are description.
  const nearest = (r: Run) =>
    numberCols.reduce((best, c) =>
      Math.abs(c.at - centre(r)) < Math.abs(best.at - centre(r)) ? c : best,
    ).key;
  const qtys = body.filter((r) => isNumber(r.str) && nearest(r) === 'qty');
  const units = body.filter((r) => isNumber(r.str) && nearest(r) === 'unit');
  const words = body
    .filter((r) => !isNumber(r.str) && /[a-z]/i.test(r.str))
    .sort((a, b) => a.top - b.top);

  // Description lines in blocks: a gap wider than a line's spacing starts a new block.
  const blocks: Run[][] = [];
  for (const w of words) {
    const block = blocks.at(-1);
    const prev = block?.at(-1);
    if (block && prev && w.top - prev.top <= 1.7 * Math.max(w.height, prev.height)) block.push(w);
    else blocks.push([w]);
  }

  const rows: { top: number; cells: Cell[] }[] = [];
  const used = new Set<Run[]>();
  const span = (b: Run[]) => ({ from: b[0]!.top - b[0]!.height, to: b.at(-1)!.top + 2 });
  const distance = (b: Run[], top: number) => {
    const s = span(b);
    return top < s.from ? s.from - top : top > s.to ? top - s.to : 0;
  };
  for (const q of qtys) {
    const free = blocks.filter((b) => !used.has(b));
    const block = free.reduce<Run[] | null>(
      (best, b) => (!best || distance(b, q.top) < distance(best, q.top) ? b : best),
      null,
    );
    if (block) used.add(block);
    const unit = units.reduce<Run | null>(
      (best, u) => (!best || Math.abs(u.top - q.top) < Math.abs(best.top - q.top) ? u : best),
      null,
    );
    rows.push({
      top: block ? Math.min(block[0]!.top, q.top) : q.top,
      cells: [
        describe(block ?? []),
        q.str,
        unit && Math.abs(unit.top - q.top) < 20 ? unit.str : null,
      ],
    });
  }
  // Blocks without a quantity are headings ("Lighting") or notes; parseOldInvoice sorts them.
  for (const b of blocks) if (!used.has(b)) rows.push({ top: b[0]!.top, cells: [describe(b)] });
  rows.sort((a, b) => a.top - b.top);

  return [
    ...labelsAbove(all.slice(0, headAt)),
    ...asRows(all.slice(0, headAt)),
    ['Description', 'Qty', 'Unit price'],
    ...rows.map((r) => r.cells),
    ['Total'],
    ...asRows(all.slice(end)),
  ];
}

/**
 * Labels printed above their values ("PREPARED FOR" over "Mr Tan", "DATE" over "7 Oct 2026") as
 * label-and-value rows, the way a spreadsheet has them side by side.
 */
function labelsAbove(ls: Run[][]): Cell[][] {
  const label = (s: string) => /^[A-Z][A-Z\s#&./]{1,30}$/.test(s);
  const out: Cell[][] = [];
  ls.forEach((line, i) => {
    const below = ls[i + 1];
    if (!below || !line.every((c) => label(c.str))) return;
    for (const c of line) {
      const value = below.find((v) => Math.abs(v.x - c.x) < 3 && !label(v.str));
      if (value) out.push([c.str, value.str]);
    }
  });
  return out;
}

/** A block's lines as one description: wrapped lines of a sentence joined, separate lines kept. */
function describe(block: Run[]): string {
  const widest = Math.max(0, ...block.map((r) => r.width));
  return block
    .map((r) => r.str)
    .reduce((out, s, i) => {
      if (i === 0) return s;
      const prev = block[i - 1]!;
      const wrapped = prev.width > 0.8 * widest && Math.abs(prev.height - block[i]!.height) < 0.5;
      return `${out}${wrapped ? ' ' : '\n'}${s}`;
    }, '');
}
