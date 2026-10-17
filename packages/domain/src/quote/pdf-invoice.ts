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
/** "-" in the amount column: nothing to pay. */
const DASH = /^[-–—]$/;

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

/** A horizontal line printed across the item table (a row's border), in PDF points from the bottom. */
export interface TableRule {
  page: number;
  y: number;
}

/**
 * `rules` are the table's row borders where known (found in the picture of a page read by OCR).
 * With them, each row is what lies between two borders, which holds however tightly the rows
 * are packed; without them, rows are worked out from the spacing of the text.
 */
export function pdfInvoiceGrid(texts: PdfText[], rules: TableRule[] = []): Cell[][] {
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
  // Page furniture (running titles, footers, page numbers) repeats in the margin of every page, at
  // the same height: leave it out. Items that read alike ("Extra item 12", "Extra item 13") at
  // the foot of one page and the top of the next aren't furniture.
  const pages = new Map<string, Set<number>>();
  const page = (l: Run[]) => Math.floor(l[0]!.top / 10_000);
  const key = (l: Run[]) =>
    `${Math.round((l[0]!.top % 10_000) / 12)}:${l.map((c) => c.str.replace(/\d/g, '')).join('|')}`;
  for (const l of lines(runs)) {
    if (!l.every((c) => c.margin)) continue;
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
      .map((c) => ({ key: HEAD.amount.test(c.str) ? 'amount' : 'other', at: centre(c) })),
  ];
  const headText = head.map((c) => c.str.toLowerCase()).join('|');
  // Numbers go to the column whose heading they sit under; words are description.
  const nearest = (r: Run) =>
    numberCols.reduce((best, c) =>
      Math.abs(c.at - centre(r)) < Math.abs(best.at - centre(r)) ? c : best,
    ).key;
  const hasQty = (line: Run[]) => line.some((c) => isNumber(c.str) && nearest(c) === 'qty');
  const isTotal = (line: Run[]) =>
    line.filter((c) => !isNumber(c.str)).some((c) => TOTAL_LINE.test(c.str));

  // The table runs from the heading to its total line; repeated headings on later pages go. A
  // total with more items after it (before the next total) is a section's subtotal ("Smart Home
  // + Installation Total Price" above "Electrical Wiring"): the items carry on, and the section
  // is named after it.
  let body: Run[] = [];
  let end = all.length;
  const subtotals: { top: number; title: string }[] = [];
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
    if (isTotal(line)) {
      const next = all.slice(i + 1);
      const nextTotal = next.findIndex(isTotal);
      const more = nextTotal < 0 ? next : next.slice(0, nextTotal);
      if (more.some(hasQty)) {
        const title = line
          .filter((c) => !isNumber(c.str))
          .map((c) => c.str)
          .join(' ')
          .replace(/\s*\btotal\b.*$/i, '')
          .replace(/[\s+&,-]+$/, '')
          .trim();
        subtotals.push({ top: line[0]!.top, title });
        continue;
      }
      end = i;
      break;
    }
    body.push(...line);
  }
  const qtys = body.filter((r) => isNumber(r.str) && nearest(r) === 'qty');
  const units = body.filter((r) => isNumber(r.str) && nearest(r) === 'unit');
  // Each line's printed amount, to check its quantity and unit price against.
  // A dash there means nothing to pay (a free gift).
  const amounts = body.filter(
    (r) => (isNumber(r.str) || DASH.test(r.str)) && nearest(r) === 'amount',
  );
  // A serial "a", "b" under S/N (free gifts) isn't description.
  const snCol = head.find((c) => HEAD.sn.test(c.str));
  const descCol = head.find((c) => /description|^item/i.test(c.str));
  const inSerials = (r: Run) =>
    !!snCol &&
    !!descCol &&
    /^[a-z]{1,2}\.?\)?$/i.test(r.str) &&
    Math.abs(centre(r) - centre(snCol)) < Math.abs(centre(r) - centre(descCol));
  const words = body
    // Lone strokes are table borders read as letters; anything in the number columns (an amount
    // misread as "BO.00") isn't description.
    .filter(
      (r) =>
        !isNumber(r.str) &&
        /[a-z]/i.test(r.str) &&
        !/^[|Il![\]]$/.test(r.str) &&
        !inSerials(r) &&
        centre(r) < qtyCol.x,
    )
    .sort((a, b) => a.top - b.top);

  const assemble = (rows: Cell[][]) => [
    ...labelsAbove(all.slice(0, headAt)),
    ...asRows(all.slice(0, headAt)),
    ['Description', 'Qty', 'Unit price', 'Amount'],
    ...rows,
    ['Total'],
    ...asRows(all.slice(end)),
  ];

  const endTop = all[end]?.[0]?.top ?? Infinity;
  const borders = rules
    .map((r) => r.page * 10_000 - r.y)
    .filter((t) => t > head[0]!.top && t < endTop)
    .sort((a, b) => a - b);
  if (borders.length >= 2) {
    const rows: Cell[][] = [];
    for (let i = 0; i + 1 < borders.length; i++) {
      const inside = (r: Run) => r.top > borders[i]! && r.top <= borders[i + 1]!;
      const text = joinLines(words.filter(inside));
      const qty = qtys.find(inside);
      const unit = units.find(inside);
      const amount = amounts.find(inside);
      if (qty) rows.push([describe(text), qty.str, unit?.str ?? null, amount?.str ?? null]);
      // A line with an amount and no quantity: a discount ("Discount 5%: …  -S$99.50").
      else if (text.length) rows.push([describe(text), null, null, amount?.str ?? null]);
    }
    return assemble(rows);
  }

  // Description lines in blocks: a gap wider than a line's spacing starts a new block, and so
  // does the line after a section's subtotal (that section's heading, "Electrical Wiring").
  const lineOf = (l: Run, top: number) => Math.abs(l.top - top) <= Math.max(2, 0.45 * l.height);
  const afterSubtotal = new Set<Run>();
  for (const st of subtotals) {
    const first = words.find((w) => w.top > st.top + 2);
    if (first && !qtys.some((q) => lineOf(first, q.top))) afterSubtotal.add(first);
  }
  const spaced: Run[][] = [];
  for (const w of words) {
    const block = spaced.at(-1);
    const prev = block?.at(-1);
    const near = prev && w.top - prev.top <= 1.7 * Math.max(w.height, prev.height);
    if (block && near && !afterSubtotal.has(w) && !afterSubtotal.has(prev)) block.push(w);
    else spaced.push([w]);
  }

  // Where a wrapped description sits beside its numbers: on its first line (the app's own PDF),
  // its last (an Excel invoice with the numbers at the foot of the row), or its middle. Told by
  // the blocks holding one quantity's line; it decides where tightly packed rows, read as one
  // block, divide.
  const onQty = (l: Run) => qtys.some((q) => lineOf(l, q.top));
  const votes = { first: 0, last: 0, middle: 0 };
  for (const b of spaced) {
    const at = b.map((l, i) => (onQty(l) ? i : -1)).filter((i) => i >= 0);
    if (b.length < 2 || at.length !== 1) continue;
    votes[at[0] === 0 ? 'first' : at[0] === b.length - 1 ? 'last' : 'middle'] += 1;
  }
  const align =
    votes.last > votes.first && votes.last >= votes.middle
      ? 'last'
      : votes.middle > votes.first
        ? 'middle'
        : 'first';
  const blocks: Run[][] = [];
  for (const b of spaced) {
    const at = b.map((l, i) => (onQty(l) ? i : -1)).filter((i) => i >= 0);
    if (at.length < 2) {
      blocks.push(b);
      continue;
    }
    // Cut between each pair of quantity lines: after the first (numbers on the last line),
    // before the second (on the first line), or halfway.
    let from = 0;
    for (let k = 0; k + 1 < at.length; k++) {
      const a = at[k]!;
      const z = at[k + 1]!;
      const cut =
        align === 'last'
          ? a + 1
          : align === 'first'
            ? z
            : a +
              1 +
              b.slice(a + 1, z).filter((l) => l.top - b[a]!.top <= b[z]!.top - l.top).length;
      blocks.push(b.slice(from, cut));
      from = cut;
    }
    blocks.push(b.slice(from));
  }

  const rows: { top: number; cells: Cell[] }[] = [];
  const used = new Set<Run[]>();
  const claimed = new Set<Run>();
  const span = (b: Run[]) => ({ from: b[0]!.top - b[0]!.height, to: b.at(-1)!.top + 2 });
  const distance = (b: Run[], top: number) => {
    const s = span(b);
    return top < s.from ? s.from - top : top > s.to ? top - s.to : 0;
  };
  for (const q of qtys) {
    const free = blocks.filter((b) => b.length && !used.has(b));
    // The block with a line beside the quantity is its description; else the nearest.
    const block =
      free.find((b) => b.some((l) => lineOf(l, q.top))) ??
      free.reduce<Run[] | null>(
        (best, b) => (!best || distance(b, q.top) < distance(best, q.top) ? b : best),
        null,
      );
    if (block) used.add(block);
    const unit = units.reduce<Run | null>(
      (best, u) => (!best || Math.abs(u.top - q.top) < Math.abs(best.top - q.top) ? u : best),
      null,
    );
    // The amount on the quantity's own line, or (centred in a row of several lines) beside its
    // description; never one further off, which may be the next row's.
    const s = block ? span(block) : null;
    const amount =
      amounts.find((a) => !claimed.has(a) && Math.abs(a.top - q.top) < 4) ??
      (s
        ? amounts.find(
            (a) => !claimed.has(a) && a.top >= Math.min(s.from, q.top - 4) && a.top <= s.to,
          )
        : undefined);
    if (amount) claimed.add(amount);
    rows.push({
      top: block ? Math.min(block[0]!.top, q.top) : q.top,
      cells: [
        describe(block ?? []),
        q.str,
        unit && Math.abs(unit.top - q.top) < 20 ? unit.str : null,
        amount?.str ?? null,
      ],
    });
  }
  // Blocks without a quantity: a discount line has its amount beside it; otherwise a heading.
  for (const b of blocks) {
    if (!b.length || used.has(b)) continue;
    const s = span(b);
    const amount = amounts.find((a) => !claimed.has(a) && a.top >= s.from && a.top <= s.to);
    if (amount) claimed.add(amount);
    rows.push({ top: b[0]!.top, cells: [describe(b), null, null, amount?.str ?? null] });
  }
  // The first section is named by its subtotal when nothing heads it ("Smart Home +
  // Installation"); parseOldInvoice keeps short headings with items under them.
  const firstTitle = subtotals[0]?.title;
  const firstItem = Math.min(...rows.filter((r) => r.cells[1] !== null).map((r) => r.top));
  if (firstTitle && !rows.some((r) => r.cells[1] === null && r.top < firstItem))
    rows.push({ top: head[0]!.top + 1, cells: [firstTitle, null, null, null] });
  rows.sort((a, b) => a.top - b.top);

  return assemble(rows.map((r) => r.cells));
}

/** Cells on the same line joined into one run per line, top to bottom, left to right. */
function joinLines(cells: Run[]): Run[] {
  const groups: Run[][] = [];
  for (const c of [...cells].sort((a, b) => a.top - b.top)) {
    const g = groups.at(-1);
    if (g && Math.abs(g[0]!.top - c.top) <= Math.max(2, 0.45 * c.height)) g.push(c);
    else groups.push([c]);
  }
  return groups.map((g) => {
    const row = [...g].sort((a, b) => a.x - b.x);
    const left = row[0]!;
    const right = Math.max(...row.map((c) => c.x + c.width));
    return { ...left, str: row.map((c) => c.str).join(' '), width: right - left.x };
  });
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
      // A line carries on the one above if it starts in lower case, or if the line above filled
      // the width (unless this one starts a new count, "5 x …", or a note in brackets).
      const wrapped =
        /^[a-z]/.test(s) ||
        (prev.width > 0.8 * widest &&
          Math.abs(prev.height - block[i]!.height) < 0.5 &&
          !/^[\d(]/.test(s));
      return `${out}${wrapped ? ' ' : '\n'}${s}`;
    }, '');
}
