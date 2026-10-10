/**
 * The client invoice as an Excel file, filled into Maxsen's own invoice template (served from
 * /templates/invoice-template.xlsx) so fonts, colours, borders and print setup match it exactly.
 * The header, client and terms come from Admin › Pricing; the lines from Review totals.
 */
import {
  applyRowEdits,
  isRgbStripName,
  withExtraLines,
  buildInvoice,
  INVOICE_STAGES,
  invoiceNumber,
  resolvePricing,
  stageAmounts,
  withFullPayment,
  type Invoice,
  type InvoiceStage,
  type PricingSettings,
  type Project,
  type StageAmounts,
} from '@maxsen/domain';
import type { Cell, Font, Style as ExcelStyle, Worksheet } from 'exceljs';
import { buildQuotationPdf, type ExportContext } from './generate';

const TEMPLATE_URL = '/templates/invoice-template.xlsx';
const COLS = ['A', 'B', 'C', 'D', 'E', 'F'] as const;
/** First row of the item table in the template, and the template rows each kind is styled after. */
const HEADER_ROW = 14;
const STYLE_ROWS = {
  header: 14,
  package: 15,
  section: 16,
  item: 17,
  warranty: 32,
  total: 33,
  spacer: 34,
  grand: 35,
  deposit: 36,
  rule: 37,
  details: 38,
  terms: 39,
  bank: 40,
} as const;

type Style = Partial<ExcelStyle>;
const THIN = { style: 'thin' } as const;

/** Text colours from the invoice template. */
const INK = {
  header: 'FFFFC000',
  discount: 'FFFF0000',
  service: 'FF0043C1',
  text: 'FF000000',
} as const;

/**
 * A description as rich text. Packages show their name (the first line) highlighted, discounts in
 * red, installation & integration and warranty in blue and the rest in black. Other lines are black,
 * or red when they take money off.
 */
export function descriptionText(text: string, isPackage: boolean, isDiscount: boolean) {
  const run = (t: string, argb: string) => ({
    text: t,
    font: { name: 'Trebuchet MS', size: 11, bold: true, color: { argb } },
  });
  if (!isPackage) return { richText: [run(text, isDiscount ? INK.discount : INK.text)] };
  const lines = text.split('\n');
  return {
    richText: lines.map((line, i) =>
      run(
        (i > 0 ? '\n' : '') + line,
        i === 0
          ? INK.header
          : /discount|rebate|waive|free|\bwas\b|\bsave/i.test(line)
            ? INK.discount
            : /install|warrant/i.test(line)
              ? INK.service
              : INK.text,
      ),
    ),
  };
}

export async function buildInvoiceXlsx({
  client,
  invoice,
  pricing,
  number,
  date = new Date(),
  payment,
}: {
  /** Who the invoice is for: printed in the template's client block. */
  client: { name: string; contact: string };
  invoice: Invoice;
  pricing: PricingSettings;
  number: string;
  date?: Date;
  /** For the 2nd and final invoices: what's been paid and what this one asks for. */
  payment?: StageAmounts;
}): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const res = await fetch(TEMPLATE_URL);
  if (!res.ok) throw new Error('Invoice template missing');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await res.arrayBuffer());
  const ws = wb.worksheets[0]!;

  // Remember how each kind of row looks in the template before clearing the item table.
  const styles = Object.fromEntries(
    Object.entries(STYLE_ROWS).map(([k, r]) => [
      k,
      {
        height: ws.getRow(r).height,
        cells: COLS.map((c): Style => structuredClone(ws.getCell(`${c}${r}`).style)),
      },
    ]),
  ) as Record<keyof typeof STYLE_ROWS, { height: number; cells: Style[] }>;

  for (const range of [...(ws.model.merges ?? [])]) {
    const top = Number(/\d+/.exec(range)?.[0] ?? 0);
    if (top >= HEADER_ROW) ws.unMergeCells(range);
  }
  // Empty the old item table first: its price column is one shared formula (F17 copied down), and
  // removing the rows alone leaves the copies pointing at it, which breaks longer invoices.
  for (let r = HEADER_ROW; r <= ws.rowCount; r++) {
    ws.getRow(r).eachCell({ includeEmpty: true }, (cell) => {
      cell.value = null;
      // Clear the styles too, or the template's old footer borders linger below the new one.
      cell.style = {};
    });
  }
  ws.spliceRows(HEADER_ROW, ws.rowCount - HEADER_ROW + 1);

  // --- header and client -----------------------------------------------------------------------
  const c = pricing.company;
  const [addr1 = '', ...rest] = c.address;
  const headerLines = [c.name, c.regNo, addr1, rest.join(', '), c.phone, c.email, c.website];
  headerLines.forEach((text, i) => (ws.getCell(`A${i + 1}`).value = text || null));
  ws.getCell('F7').value = date;
  ws.getCell('F7').numFmt = 'd mmm yyyy';
  ws.getCell('F8').value = number;
  ws.getCell('B10').value = client.contact || null;
  ws.getCell('B11').value = client.name || null;

  // --- item table ------------------------------------------------------------------------------
  let r = HEADER_ROW;
  const put = (
    kind: keyof typeof STYLE_ROWS,
    values: (string | number | object | null)[],
    height?: number,
  ) => {
    const row = ws.getRow(r);
    row.height = height ?? styles[kind].height;
    COLS.forEach((col, i) => {
      const cell = ws.getCell(`${col}${r}`);
      cell.style = structuredClone(styles[kind].cells[i]!);
      // Amounts sit level with the middle of tall description rows.
      if (i >= 3) cell.alignment = { ...cell.alignment, vertical: 'middle' };
      const v = values[i];
      if (v !== undefined) cell.value = v as never;
    });
    return r++;
  };
  /** Merge a row's cells, keeping the merged block's right edge (ExcelJS copies the first
   * cell's style across the merge, which drops the last cell's right border). */
  const merge = (row: number, from: (typeof COLS)[number], to: (typeof COLS)[number]) => {
    ws.mergeCells(`${from}${row}:${to}${row}`);
    const last = ws.getCell(`${to}${row}`);
    last.border = { ...last.border, right: THIN };
  };
  const heightFor = (text: string) => {
    // B and C together fit about 55 characters of bold 11pt Trebuchet per line.
    const lines = text.split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 55)), 0);
    return Math.max(35.25, lines * 16 + 8);
  };

  put('header', [
    'S/N',
    'ITEM/DESCRIPTION',
    'ITEM/DESCRIPTION',
    'QUANTITY',
    'UNIT PRICE (S$)',
    'PRICE (S$)',
  ]);
  merge(HEADER_ROW, 'B', 'C');
  // Lines between every heading, so Item/Description, Quantity and the prices read as columns.
  for (const col of COLS) {
    const cell = ws.getCell(`${col}${HEADER_ROW}`);
    cell.border = { top: THIN, bottom: THIN, left: THIN, right: THIN };
  }
  const first = r;
  let sn = 0;
  for (const row of invoice.rows) {
    if (row.kind === 'item') {
      sn++;
      const at = r;
      put(
        row.highlight ? 'package' : 'item',
        [
          sn,
          descriptionText(row.description, !!row.highlight, (row.unitPrice ?? 0) < 0),
          null,
          row.quantity,
          row.unitPrice,
          { formula: `D${at}*E${at}`, result: row.quantity * (row.unitPrice ?? 0) },
        ],
        heightFor(row.description),
      );
      merge(at, 'B', 'C');
    } else if (row.kind === 'section') {
      const at = put('section', [null, row.title, row.title, null, null, null]);
      merge(at, 'B', 'C');
    } else {
      const at = put(
        row.tone === 'warranty' ? 'warranty' : 'item',
        [null, row.text, row.text, null, null, null],
        heightFor(row.text),
      );
      merge(at, 'B', 'C');
    }
  }
  const last = r - 1;
  const totalRow = put('total', [
    null,
    'Smart Home + Installation Total Price',
    'Smart Home + Installation Total Price',
    null,
    null,
    { formula: `SUM(F${first}:F${last})`, result: invoice.total },
  ]);
  merge(totalRow, 'B', 'C');
  put('spacer', []);
  const grandRow = put('grand', [
    null,
    null,
    null,
    null,
    'GRANT TOTAL (S$)',
    { formula: `F${totalRow}`, result: invoice.total },
  ]);
  /** The amount asked for stands out: bigger than the grand total above it. */
  const emphasise = (row: number) => {
    ws.getRow(row).height = 26;
    for (const [col, size] of [
      ['E', 11],
      ['F', 14],
    ] as const) {
      const cell = ws.getCell(`${col}${row}`);
      cell.font = { ...cell.font, size, bold: true };
      cell.alignment = { ...cell.alignment, vertical: 'middle' };
    }
  };
  if (!payment || payment.stage === 'deposit') {
    const due = put('deposit', [
      null,
      null,
      null,
      null,
      'DEPOSIT REQUEST (S$)',
      { formula: `F${grandRow}*${pricing.depositPercent}/100`, result: invoice.deposit },
    ]);
    emphasise(due);
  } else if (payment.stage === 'full') {
    const due = put('deposit', [
      null,
      null,
      null,
      null,
      'FULL PAYMENT (S$)',
      { formula: `F${grandRow}`, result: payment.due },
    ]);
    emphasise(due);
  } else {
    const paidRow = put('deposit', [null, null, null, null, 'LESS PAID (S$)', payment.paid]);
    ws.getCell(`E${paidRow}`).font = {
      ...ws.getCell(`E${paidRow}`).font,
      color: { argb: INK.text },
    };
    const due = put('deposit', [
      null,
      null,
      null,
      null,
      payment.stage === 'second' ? '2ND PAYMENT (S$)' : 'FINAL PAYMENT (S$)',
      {
        formula: `MAX(0,F${grandRow}*${payment.percent}/100-F${paidRow})`,
        result: payment.due,
      },
    ]);
    emphasise(due);
  }
  put('rule', []);
  const details = put('details', [
    'DETAILS',
    'DETAILS',
    'DETAILS',
    'DETAILS',
    'DETAILS',
    'DETAILS',
  ]);
  merge(details, 'A', 'F');
  const terms = put(
    'terms',
    Array(6).fill(pricing.terms) as string[],
    Math.max(50.25, pricing.terms.split('\n').length * 25),
  );
  merge(terms, 'A', 'F');
  const bank = put(
    'bank',
    Array(6).fill(pricing.bankDetails) as string[],
    Math.max(103.5, pricing.bankDetails.split('\n').length * 17),
  );
  merge(bank, 'A', 'F');

  bakePrintScale(ws, bank);
  ws.pageSetup.printArea = `A1:F${bank}`;
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** The template prints at 69%, which only Excel and LibreOffice honour. */
const PRINT_SCALE = 0.69;

/**
 * Shrink the sheet itself to its printed size, so it fits one A4 page across at 100% — in apps
 * that ignore the print scale and fit-to-width (Google Sheets, Numbers, tablet viewers), the
 * columns otherwise spill onto extra pages.
 */
function bakePrintScale(ws: Worksheet, lastRow: number) {
  const k = PRINT_SCALE;
  const shrink = (font: Partial<Font> | undefined) =>
    font ? { ...font, size: Math.round((font.size ?? 11) * k * 2) / 2 } : font;
  for (let c = 1; c <= 9; c++) {
    const col = ws.getColumn(c);
    if (col.width) col.width = col.width * k;
  }
  // Cells can share one style object, so read every font before writing any back.
  const cells: { cell: Cell; font: Partial<Font> | undefined }[] = [];
  for (let r = 1; r <= lastRow; r++) {
    const row = ws.getRow(r);
    row.height = (row.height || 15) * k;
    row.eachCell({ includeEmpty: true }, (cell) => {
      if (cell.isMerged && cell.master !== cell) return;
      cells.push({ cell, font: cell.font ? { ...cell.font } : undefined });
    });
  }
  for (const { cell, font } of cells) {
    cell.style = { ...cell.style, font: shrink(font ?? { size: 11 }) };
    const v = cell.value;
    if (v && typeof v === 'object' && 'richText' in v) {
      cell.value = { richText: v.richText.map((run) => ({ ...run, font: shrink(run.font) })) };
    }
  }
  ws.pageSetup = {
    ...ws.pageSetup,
    scale: 100,
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 },
  };
  ws.views = ws.views.map((v) => ({ ...v, zoomScale: 100, zoomScaleNormal: 100 }));
}

/**
 * A strip drawn on the plan as RGBCCT is still strip: its metres count as CCT strip (towards the
 * package and add-on metres) as well as the RGBCCT upgrade. In a quick quote, by contrast, RGBCCT
 * is just the add-on.
 */
function withDrawnRgbStrip(lines: ExportContext['lines']): ExportContext['lines'] {
  return lines.flatMap((l) =>
    l.categoryId === 'led-strips' && isRgbStripName(l.productName, l.variantName)
      ? [
          l,
          {
            ...l,
            variantId: `${l.variantId}:cct`,
            productName: l.productName.replace(/rgb\w*/gi, '').trim() || 'LED strip',
            variantName: 'CCT',
          },
        ]
      : [l],
  );
}

/**
 * The invoice for a project: lines priced from the live catalogue and Admin › Pricing, with the
 * project's own unit prices and discounts.
 */
export function projectInvoice(
  ctx: Pick<ExportContext, 'lines' | 'settings' | 'variants' | 'project'>,
) {
  const pricing = resolvePricing(ctx.settings);
  const prices = new Map(ctx.variants.map((v) => [v.id, v.price ?? null]));
  // Before and after the unit prices and discounts set for this project.
  const base = withExtraLines(
    buildInvoice(withDrawnRgbStrip(ctx.lines), (id) => prices.get(id) ?? null, pricing),
    ctx.project.exportSettings.extraLines,
    pricing.depositPercent,
  );
  const invoice = applyRowEdits(
    base,
    ctx.project.exportSettings.priceEdits,
    pricing.depositPercent,
  );
  return { pricing, base, invoice };
}

/**
 * The project's invoice number for a payment stage, or a new one from today's date (counting up
 * per stage, so the deposit, 2nd and final invoices made on one day don't share a number).
 */
export function projectInvoiceNumber(
  project: Project,
  pricing: PricingSettings,
  stage: InvoiceStage = 'deposit',
): string {
  const s = project.exportSettings;
  const saved = stage === 'deposit' ? s.invoiceNumber : s.billing?.numbers?.[stage];
  return (
    saved || invoiceNumber(pricing.invoicePrefix, new Date(), INVOICE_STAGES.indexOf(stage) + 1)
  );
}

/** Which payment the project's invoice asks for, with its number and amounts. */
export function projectPayment(
  ctx: Pick<ExportContext, 'lines' | 'settings' | 'variants' | 'project'>,
) {
  const { pricing: plan, base, invoice } = projectInvoice(ctx);
  const billing = ctx.project.exportSettings.billing;
  const amounts = stageAmounts(invoice.total, plan, billing);
  // Paid in full: the terms ask for the whole amount instead of a deposit.
  const pricing = amounts.stage === 'full' ? withFullPayment(plan) : plan;
  return {
    pricing,
    base,
    invoice,
    amounts,
    number: projectInvoiceNumber(ctx.project, pricing, amounts.stage),
  };
}

/** The project's invoice as the premium PDF (the Quick quote style), for the same payment. */
export async function buildProjectInvoicePdf(ctx: ExportContext): Promise<Blob> {
  const { pricing, invoice, amounts, number } = projectPayment(ctx);
  return buildQuotationPdf({
    client: { name: ctx.project.customerName, contact: ctx.project.customerContact },
    invoice,
    pricing,
    number,
    settings: ctx.settings,
    payment: amounts,
    label: 'Invoice',
  });
}

export async function buildProjectInvoice(ctx: ExportContext): Promise<Blob> {
  const { pricing, invoice, amounts, number } = projectPayment(ctx);
  return buildInvoiceXlsx({
    client: { name: ctx.project.customerName, contact: ctx.project.customerContact },
    invoice,
    pricing,
    number,
    payment: amounts,
  });
}
