/**
 * The client invoice as an Excel file, filled into Maxsen's own invoice template (served from
 * /templates/invoice-template.xlsx) so fonts, colours, borders and print setup match it exactly.
 * The header, client and terms come from Admin › Pricing; the lines from Review totals.
 */
import {
  buildInvoice,
  invoiceNumber,
  resolvePricing,
  type Invoice,
  type PricingSettings,
  type Project,
} from '@maxsen/domain';
import type { Style as ExcelStyle } from 'exceljs';
import type { ExportContext } from './generate';

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

export async function buildInvoiceXlsx({
  client,
  invoice,
  pricing,
  number,
  date = new Date(),
}: {
  /** Who the invoice is for: printed in the template's client block. */
  client: { name: string; contact: string };
  invoice: Invoice;
  pricing: PricingSettings;
  number: string;
  date?: Date;
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
      const v = values[i];
      if (v !== undefined) cell.value = v as never;
    });
    return r++;
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
  ws.mergeCells(`B${HEADER_ROW}:C${HEADER_ROW}`);
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
          row.description,
          row.description,
          row.quantity,
          row.unitPrice,
          { formula: `D${at}*E${at}`, result: row.quantity * (row.unitPrice ?? 0) },
        ],
        heightFor(row.description),
      );
      ws.mergeCells(`B${at}:C${at}`);
    } else if (row.kind === 'section') {
      const at = put('section', [null, row.title, row.title, null, null, null]);
      ws.mergeCells(`B${at}:C${at}`);
    } else {
      const at = put(
        row.tone === 'warranty' ? 'warranty' : 'item',
        [null, row.text, row.text, null, null, null],
        heightFor(row.text),
      );
      ws.mergeCells(`B${at}:C${at}`);
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
  ws.mergeCells(`B${totalRow}:C${totalRow}`);
  put('spacer', []);
  const grandRow = put('grand', [
    null,
    null,
    null,
    null,
    'GRANT TOTAL (S$)',
    { formula: `F${totalRow}`, result: invoice.total },
  ]);
  put('deposit', [
    null,
    null,
    null,
    null,
    'DEPOSIT REQUEST (S$)',
    { formula: `F${grandRow}*${pricing.depositPercent}/100`, result: invoice.deposit },
  ]);
  put('rule', []);
  const details = put('details', [
    'DETAILS',
    'DETAILS',
    'DETAILS',
    'DETAILS',
    'DETAILS',
    'DETAILS',
  ]);
  ws.mergeCells(`A${details}:F${details}`);
  const terms = put(
    'terms',
    Array(6).fill(pricing.terms) as string[],
    Math.max(50.25, pricing.terms.split('\n').length * 25),
  );
  ws.mergeCells(`A${terms}:F${terms}`);
  const bank = put(
    'bank',
    Array(6).fill(pricing.bankDetails) as string[],
    Math.max(103.5, pricing.bankDetails.split('\n').length * 17),
  );
  ws.mergeCells(`A${bank}:F${bank}`);

  ws.pageSetup.printArea = `A1:F${bank}`;
  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

/** The invoice for a project: lines priced from the live catalogue and Admin › Pricing. */
export function projectInvoice(ctx: Pick<ExportContext, 'lines' | 'settings' | 'variants'>) {
  const pricing = resolvePricing(ctx.settings);
  const prices = new Map(ctx.variants.map((v) => [v.id, v.price ?? null]));
  return { pricing, invoice: buildInvoice(ctx.lines, (id) => prices.get(id) ?? null, pricing) };
}

/** The project's invoice number, or a new one from today's date. */
export function projectInvoiceNumber(project: Project, pricing: PricingSettings): string {
  return project.exportSettings.invoiceNumber || invoiceNumber(pricing.invoicePrefix, new Date());
}

export async function buildProjectInvoice(ctx: ExportContext): Promise<Blob> {
  const { pricing, invoice } = projectInvoice(ctx);
  return buildInvoiceXlsx({
    client: { name: ctx.project.customerName, contact: ctx.project.customerContact },
    invoice,
    pricing,
    number: projectInvoiceNumber(ctx.project, pricing),
  });
}
