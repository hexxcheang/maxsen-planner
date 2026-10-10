import {
  ELECTRICAL_NOTES,
  ELECTRICAL_RATES,
  GST_PERCENT,
  plottedRates,
  type ElectricalPlan,
  type PricingSettings,
} from '@maxsen/domain';

export interface ElectricalDraft {
  client: string;
  address: string;
  number: string;
  /** Rates changed from the average, by item id. */
  rates: Record<string, number>;
  /** Quantities typed in, on top of the points plotted on the electrical plan. */
  quantities: Record<string, number>;
  /** The electrical layout: the drawing and the points plotted on it. */
  plan?: ElectricalPlan;
  /** The deposit asked for, in percent (Admin › Pricing's when absent). */
  depositPercent?: number;
  /** What the client has paid as deposit, once they have. */
  depositPaid?: number;
  gst: boolean;
  /** Discounts and extra charges, in S$ or as a % of the works. */
  adjustments?: ElectricalAdjustment[];
}

export interface ElectricalAdjustment {
  id: string;
  kind: 'discount' | 'charge';
  label: string;
  /** S$, or % of the works' subtotal. */
  value: number;
  unit: 'amount' | 'percent';
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The priced lines, by section (A, B, …; items numbered A1, A2, …), and the totals. Each item's
 * quantity is what's plotted on the plan plus what's typed in.
 */
export function electricalTotals(d: ElectricalDraft, usualDeposit = 60) {
  const plotted = d.plan ? plottedRates(d.plan.points) : {};
  const sections = ELECTRICAL_RATES.map((s, si) => {
    const letter = String.fromCharCode(65 + si);
    return {
      letter,
      title: s.title,
      lines: s.items.flatMap((item, i) => {
        const quantity = (plotted[item.id] ?? 0) + (d.quantities[item.id] ?? 0);
        if (!quantity) return [];
        const rate = d.rates[item.id] ?? item.rate;
        return [
          {
            sn: `${letter}${i + 1}`,
            description: item.description,
            unit: item.unit,
            quantity,
            rate,
            amount: round2(quantity * rate),
          },
        ];
      }),
    };
  });
  const works = round2(sections.flatMap((s) => s.lines).reduce((t, l) => t + l.amount, 0));
  const adjustments = (d.adjustments ?? [])
    .filter((a) => a.value > 0)
    .map((a) => {
      const signed = a.kind === 'discount' ? -a.value : a.value;
      return {
        ...a,
        signed,
        label: a.label.trim() || (a.kind === 'discount' ? 'Discount' : 'Additional charge'),
        amount: round2(a.unit === 'percent' ? (works * signed) / 100 : signed),
      };
    });
  // Discounts never take the quotation below zero.
  const subtotal = Math.max(0, round2(works + adjustments.reduce((t, a) => t + a.amount, 0)));
  const gst = d.gst ? round2((subtotal * GST_PERCENT) / 100) : 0;
  const total = round2(subtotal + gst);
  const depositPercent = d.depositPercent ?? usualDeposit;
  const paid = d.depositPaid;
  return {
    sections,
    plotted,
    count: sections.reduce((n, s) => n + s.lines.length, 0),
    works,
    adjustments,
    subtotal,
    gst,
    total,
    depositPercent,
    deposit: round2((total * depositPercent) / 100),
    /** Once the deposit is paid: what was paid, and the balance left to collect. */
    paid,
    balance: paid === undefined ? undefined : Math.max(0, round2(total - paid)),
  };
}

/** The quotation as an Excel sheet, laid out as Singapore electricians quote. */
export async function buildElectricalXlsx(
  d: ElectricalDraft,
  company: PricingSettings['company'],
  usualDeposit = 60,
): Promise<Blob> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Electrical Quotation', {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
    },
  });
  ws.columns = [
    { width: 7 },
    { width: 58 },
    { width: 8 },
    { width: 8 },
    { width: 13 },
    { width: 15 },
  ];
  const font = { name: 'Arial', size: 10 };
  const bold = { ...font, bold: true };
  const thin = { style: 'thin' as const };
  const box = { top: thin, left: thin, bottom: thin, right: thin };
  const money = '#,##0.00';

  ws.addRow([company.name]).font = { ...bold, size: 14 };
  for (const l of [company.regNo, ...company.address, company.phone, company.email])
    if (l) ws.addRow([l]).font = font;
  ws.addRow([]);
  const title = ws.addRow(['QUOTATION FOR ELECTRICAL WORKS']);
  title.font = { ...bold, size: 13 };
  ws.addRow([]);
  for (const [k, v] of [
    ['To:', d.client],
    ['Site:', d.address],
    ['Ref:', d.number],
    [
      'Date:',
      new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
    ],
  ])
    ws.addRow([k, v]).font = font;
  ws.addRow([]);

  const head = ws.addRow([
    'S/N',
    'Description of works',
    'Qty',
    'Unit',
    'Rate (S$)',
    'Amount (S$)',
  ]);
  head.eachCell((c) => {
    c.font = bold;
    c.border = box;
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFE1CB' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  const t = electricalTotals(d, usualDeposit);
  const first = ws.rowCount + 1;
  for (const s of t.sections) {
    if (!s.lines.length) continue;
    const sec = ws.addRow([s.letter, s.title]);
    sec.font = bold;
    sec.eachCell({ includeEmpty: true }, (c) => (c.border = box));
    for (const l of s.lines) {
      const r = ws.rowCount + 1;
      const row = ws.addRow([
        l.sn,
        l.description,
        l.quantity,
        l.unit,
        l.rate,
        { formula: `C${r}*E${r}`, result: l.amount },
      ]);
      row.font = font;
      row.getCell(5).numFmt = money;
      row.getCell(6).numFmt = money;
      row.getCell(1).alignment = { horizontal: 'center' };
      row.getCell(3).alignment = { horizontal: 'center' };
      row.getCell(4).alignment = { horizontal: 'center' };
      row.eachCell({ includeEmpty: true }, (c) => (c.border = box));
    }
  }
  const last = ws.rowCount;
  const total = (label: string, value: { formula: string; result: number }, strong = false) => {
    const row = ws.addRow([null, null, null, null, label, value]);
    row.getCell(5).font = strong ? bold : font;
    row.getCell(6).font = strong ? { ...bold, size: 12 } : font;
    row.getCell(6).numFmt = '#,##0.00;(#,##0.00)';
    row.getCell(5).border = box;
    row.getCell(6).border = box;
    return row.number;
  };
  let sub = total('Subtotal', { formula: `SUM(F${first}:F${last})`, result: t.works });
  if (t.adjustments.length) {
    const works = sub;
    const rows = t.adjustments.map((a) => {
      const label = a.unit === 'percent' ? `${a.label} (${Math.abs(a.value)}%)` : a.label;
      const row = total(label, {
        formula: a.unit === 'percent' ? `F${works}*${a.signed}/100` : `${a.signed}`,
        result: a.amount,
      });
      if (a.amount < 0) ws.getCell(`F${row}`).font = { ...font, color: { argb: 'FFFF0000' } };
      return row;
    });
    sub = total('Subtotal after adjustments', {
      formula: `MAX(0,F${works}+${rows.map((r) => `F${r}`).join('+')})`,
      result: t.subtotal,
    });
  }
  const gst = d.gst
    ? total(`GST ${GST_PERCENT}%`, { formula: `F${sub}*${GST_PERCENT}/100`, result: t.gst })
    : null;
  const totalRow = total(
    'Total',
    { formula: gst ? `F${sub}+F${gst}` : `F${sub}`, result: t.total },
    true,
  );
  if (t.paid !== undefined) {
    const paidRow = total('Less deposit paid', { formula: `-${t.paid}`, result: -t.paid });
    ws.getCell(`F${paidRow}`).font = { ...font, color: { argb: 'FFFF0000' } };
    total(
      'Balance due',
      { formula: `MAX(0,F${totalRow}+F${paidRow})`, result: t.balance ?? 0 },
      true,
    );
  } else {
    total(
      `Deposit (${t.depositPercent}%)`,
      { formula: `F${totalRow}*${t.depositPercent}/100`, result: t.deposit },
      true,
    );
  }

  ws.addRow([]);
  ws.addRow(['Notes:']).font = bold;
  [...ELECTRICAL_NOTES, paymentNote(t.depositPercent)].forEach((n, i) => {
    const row = ws.addRow([`${i + 1}.`, n]);
    row.font = font;
    row.getCell(2).alignment = { wrapText: true };
  });
  if (!d.gst) ws.addRow([null, 'Prices are before GST.']).font = font;

  const buf = await wb.xlsx.writeBuffer();
  return new Blob([buf], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}

const KEY = 'maxsen.electrical.v1';

/** The payment terms line, following the deposit asked for. */
export function paymentNote(depositPercent: number) {
  return depositPercent >= 100
    ? 'Full payment upon confirmation of this quotation.'
    : depositPercent <= 0
      ? 'Full payment upon completion of works.'
      : `${depositPercent}% deposit upon confirmation; the balance of ${round2(100 - depositPercent)}% upon completion of works.`;
}

/**
 * The electrical rates as they stand in the Electrical tab (your own rates where changed, else the
 * averages), by section, for adding electrical works to an invoice.
 */
export function currentElectricalRates() {
  let rates: Record<string, number> = {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) rates = (JSON.parse(raw) as Partial<ElectricalDraft>).rates ?? {};
  } catch {
    // Not saved, or storage unavailable: the averages.
  }
  return ELECTRICAL_RATES.map((s) => ({
    ...s,
    items: s.items.map((i) => ({ ...i, rate: rates[i.id] ?? i.rate })),
  }));
}
