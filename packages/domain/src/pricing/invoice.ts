/**
 * Turns a project's final quantities (Review totals) into invoice lines the way Maxsen quotes:
 * 10 switches make the switch package, 12 downlights/surface lights the light package, and 30 m of
 * LED strip with 6 drivers the LED package. A quotation has at most one of each package; everything
 * beyond it is charged at add-on rates, and everything else at its catalogue price.
 */
import { SYSTEM_VARIANT_IDS, type CategoryId } from '../categories.ts';
import type { PricingSettings, SwitchPackage } from './pricing.ts';

/** The parts of a Review totals line the invoice needs. */
export interface InvoiceInputLine {
  variantId: string;
  categoryId: CategoryId;
  productName: string;
  variantName: string;
  unit: 'pcs' | 'm';
  /** The final quantity from Review totals. */
  exportQuantity: number;
}

export type InvoiceRow =
  | {
      kind: 'item';
      /** Stable id for the row (e.g. `switch-package`, `variant:<id>`), for price edits. */
      key: string;
      description: string;
      quantity: number;
      /** Null when the catalogue has no price yet. */
      unitPrice: number | null;
      /** Packages are printed highlighted, like the template's first line. */
      highlight?: boolean;
      /** A discount line (printed in red). */
      discount?: boolean;
    }
  | { kind: 'section'; title: string }
  | { kind: 'note'; text: string; tone?: 'warranty' };

export interface Invoice {
  rows: InvoiceRow[];
  total: number;
  deposit: number;
  /** Packages formed, for showing in the app. */
  packages: { switches: number; lights: number; led: number };
  /** Lines without a price, so the total is incomplete until they're set. */
  unpriced: string[];
}

const LIGHT_CATEGORIES: CategoryId[] = ['downlights', 'surface-lights'];
/** At most this many of each package in one quotation; the rest are add-ons. */
export const MAX_PACKAGES = 1;
const packagesFor = (amount: number, size: number) =>
  size > 0 ? Math.min(MAX_PACKAGES, Math.floor(amount / size)) : 0;

export function buildInvoice(
  lines: InvoiceInputLine[],
  priceOf: (variantId: string) => number | null | undefined,
  pricing: PricingSettings,
): Invoice {
  const rows: InvoiceRow[] = [];
  const unpriced: string[] = [];
  const used = new Set<string>();
  const qty = (pred: (l: InvoiceInputLine) => boolean) =>
    lines.filter(pred).reduce((s, l) => s + l.exportQuantity, 0);
  const item = (
    key: string,
    description: string,
    quantity: number,
    unitPrice: number | null,
    highlight = false,
  ) => {
    if (quantity <= 0) return;
    if (unitPrice === null) unpriced.push(description);
    rows.push({
      kind: 'item',
      key,
      description,
      quantity,
      unitPrice,
      ...(highlight ? { highlight } : {}),
    });
  };
  /** One line per catalogue item, at its catalogue price (or `fallback`), less `free` pieces. */
  const perVariant = (
    pick: (l: InvoiceInputLine) => boolean,
    fallback: number | null,
    free = 0,
  ) => {
    let left = free;
    for (const l of lines.filter((x) => pick(x) && x.exportQuantity > 0)) {
      used.add(l.variantId);
      const covered = Math.min(left, l.exportQuantity);
      left -= covered;
      const name = `${l.productName}, ${l.variantName}`;
      item(
        `variant:${l.variantId}`,
        name,
        round(l.exportQuantity - covered),
        priceOf(l.variantId) ?? fallback,
      );
    }
  };

  // --- smart home packages --------------------------------------------------------------------
  // Each switch series has its own package (Ark, Nova+ Pro, Lusano+). Still at most one switch
  // package per quotation: it goes to the series with the most switches, if that fills one; every
  // other switch is priced individually (at its catalogue price, else its series' add-on rate).
  const isSwitch = (l: InvoiceInputLine) => l.categoryId === 'smart-switches';
  const seriesOf = (l: InvoiceInputLine): SwitchPackage | undefined => {
    const name = l.productName.toLowerCase();
    return pricing.switches.find((s) =>
      s.match
        .split(',')
        .map((w) => w.trim().toLowerCase())
        .some((w) => w && name.includes(w)),
    );
  };
  const counts = pricing.switches.map((s) => ({
    s,
    count: qty((l) => isSwitch(l) && seriesOf(l) === s),
  }));
  const packaged = counts
    .filter(({ s, count }) => packagesFor(count, s.packageSize) > 0)
    .sort((a, b) => b.count - a.count)[0];
  let swPackages = 0;
  if (packaged) {
    const { s: sw, count } = packaged;
    swPackages = packagesFor(count, sw.packageSize);
    item('switch-package', sw.description, swPackages, sw.packagePrice, true);
    item('switch-addon', sw.addOnName, count - swPackages * sw.packageSize, sw.addOnPrice);
    for (const l of lines.filter((x) => isSwitch(x) && seriesOf(x) === sw)) used.add(l.variantId);
  }
  for (const { s } of counts)
    if (s !== packaged?.s) perVariant((l) => isSwitch(l) && seriesOf(l) === s, s.addOnPrice);
  perVariant((l) => isSwitch(l) && !seriesOf(l), null);
  // IR blasters and gateways in the switch package aren't charged again.
  const sw = packaged?.s;
  perVariant(
    (l) => l.categoryId === 'aircon-controllers',
    null,
    swPackages * (sw?.includesAircon ?? 0),
  );
  perVariant((l) => l.categoryId === 'gateways', null, swPackages * (sw?.includesGateways ?? 0));

  // --- lighting --------------------------------------------------------------------------------
  const lt = pricing.lights;
  const isLight = (l: InvoiceInputLine) => LIGHT_CATEGORIES.includes(l.categoryId);
  const isStrip = (l: InvoiceInputLine) => l.categoryId === 'led-strips';
  const isDriver = (l: InvoiceInputLine) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver;
  /** Packages are CCT (white + warm) strip; RGBCCT strip is upgraded per metre. */
  const isRgbStrip = (l: InvoiceInputLine) =>
    isStrip(l) && /rgb/i.test(`${l.productName} ${l.variantName}`);
  const lights = qty(isLight);
  const metres = round(qty(isStrip));
  const drivers = qty(isDriver);
  if (lights + metres + drivers > 0) rows.push({ kind: 'section', title: 'Lighting' });

  const ltPackages = packagesFor(lights, lt.packageSize);
  if (ltPackages > 0) {
    item(
      'light-package',
      fill(lt.description, { total: ltPackages * lt.packageSize }),
      ltPackages,
      lt.packagePrice,
      true,
    );
    item('light-addon', lt.addOnName, lights - ltPackages * lt.packageSize, lt.addOnPrice);
    for (const l of lines.filter(isLight)) used.add(l.variantId);
  } else perVariant(isLight, lt.addOnPrice);
  if (lights > 0 && lt.integrationPrice > 0) {
    item('light-integration', lt.integrationName, lights, lt.integrationPrice);
    if (lt.integrationWaived)
      item('light-integration-waived', 'Integration Waived', lights, -lt.integrationPrice);
  }

  const led = pricing.led;
  const ledPackages = packagesFor(metres, led.packageMetres);
  if (ledPackages > 0) {
    item(
      'led-package',
      fill(led.description, {
        metres: ledPackages * led.packageMetres,
        drivers: ledPackages * led.packageDrivers,
      }),
      ledPackages,
      led.packagePrice,
      true,
    );
  }
  for (const l of lines.filter((x) => isStrip(x) || isDriver(x))) used.add(l.variantId);
  item(
    'led-driver-addon',
    led.driverAddOnName,
    Math.max(0, drivers - ledPackages * led.packageDrivers),
    led.driverAddOnPrice,
  );
  item(
    'led-metre-addon',
    led.metreAddOnName,
    round(Math.max(0, metres - ledPackages * led.packageMetres)),
    led.metreAddOnPrice,
  );
  item('led-rgb-upgrade', led.rgbUpgradeName, round(qty(isRgbStrip)), led.rgbUpgradePrice);
  if (drivers > 0 && led.integrationPrice > 0) {
    item('led-integration', led.integrationName, drivers, led.integrationPrice);
    if (led.integrationWaived)
      item('led-integration-waived', 'Integration Waived', drivers, -led.integrationPrice);
  }

  // --- everything else, at catalogue prices ------------------------------------------------------
  perVariant((l) => !used.has(l.variantId), null);

  rows.push({ kind: 'note', text: pricing.warranty, tone: 'warranty' });

  const total = round2(
    rows.reduce((s, r) => (r.kind === 'item' ? s + r.quantity * (r.unitPrice ?? 0) : s), 0),
  );
  return {
    rows,
    total,
    deposit: round2((total * pricing.depositPercent) / 100),
    packages: { switches: swPackages, lights: ltPackages, led: ledPackages },
    unpriced,
  };
}

/** A hand-set unit price and/or discount for one invoice row. */
export interface PriceEdit {
  unitPrice?: number;
  /** Taken off the row: S$ for the whole row, or a percentage when `discountPercent`. */
  discount?: number;
  discountPercent?: boolean;
}

/**
 * The invoice with hand-set unit prices and discounts. Each discount is its own line under the
 * item it's for (one at minus the amount, as the template shows rebates), so it reads clearly on
 * the quotation and the Excel; the total and deposit follow.
 */
export function applyPriceEdits(
  invoice: Invoice,
  edits: Record<string, PriceEdit>,
  depositPercent: number,
): Invoice {
  const rows: InvoiceRow[] = [];
  for (const row of invoice.rows) {
    if (row.kind !== 'item') {
      rows.push(row);
      continue;
    }
    const edit = edits[row.key];
    const unitPrice = edit?.unitPrice ?? row.unitPrice;
    rows.push({ ...row, unitPrice });
    const gross = row.quantity * (unitPrice ?? 0);
    const off = round2(
      Math.min(
        gross,
        edit?.discountPercent ? (gross * (edit.discount ?? 0)) / 100 : (edit?.discount ?? 0),
      ),
    );
    if (off > 0) {
      const name = row.description.split('\n')[0]!.trim();
      rows.push({
        kind: 'item',
        key: `${row.key}:discount`,
        description: `Discount${edit?.discountPercent ? ` ${edit.discount}%` : ''}: ${name}`,
        quantity: 1,
        unitPrice: -off,
        discount: true,
      });
    }
  }
  const total = round2(
    rows.reduce((s, r) => (r.kind === 'item' ? s + r.quantity * (r.unitPrice ?? 0) : s), 0),
  );
  return {
    ...invoice,
    rows,
    total,
    deposit: round2((total * depositPercent) / 100),
    unpriced: rows.flatMap((r) =>
      r.kind === 'item' && r.unitPrice === null ? [r.description] : [],
    ),
  };
}

/** A line added to an invoice by hand, e.g. electrical works from the Electrical rates. */
export interface ExtraLine {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  /** Where it comes from, e.g. the electrical rate's id, so the same item adds up. */
  sourceId?: string;
}

export const EXTRA_SECTION = 'Electrical works';

/**
 * The invoice with added lines under their own heading ("Electrical works"), before the warranty;
 * the total and deposit include them. Their rows' keys are `extra:<id>`.
 */
export function withExtraLines(
  invoice: Invoice,
  extras: ExtraLine[] | undefined,
  depositPercent: number,
): Invoice {
  const lines = (extras ?? []).filter((l) => l.quantity > 0);
  if (!lines.length) return invoice;
  const added: InvoiceRow[] = [
    { kind: 'section', title: EXTRA_SECTION },
    ...lines.map((l): InvoiceRow => ({
      kind: 'item',
      key: `extra:${l.id}`,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
    })),
  ];
  const at = invoice.rows.findIndex((r) => r.kind === 'note');
  const rows =
    at < 0
      ? [...invoice.rows, ...added]
      : [...invoice.rows.slice(0, at), ...added, ...invoice.rows.slice(at)];
  const total = round2(
    rows.reduce((t, r) => (r.kind === 'item' ? t + r.quantity * (r.unitPrice ?? 0) : t), 0),
  );
  return { ...invoice, rows, total, deposit: round2((total * depositPercent) / 100) };
}

/** Adds lines to a list, adding to the quantity of a line from the same source. */
export function mergeExtraLines(current: ExtraLine[] | undefined, more: ExtraLine[]): ExtraLine[] {
  const out = [...(current ?? [])];
  for (const m of more) {
    const same = m.sourceId
      ? out.findIndex((l) => l.sourceId === m.sourceId && l.unitPrice === m.unitPrice)
      : -1;
    if (same >= 0) out[same] = { ...out[same]!, quantity: out[same]!.quantity + m.quantity };
    else out.push(m);
  }
  return out;
}

/** A row's edits as typed in the app: the discount kept as text ("50" or "10%"). */
export interface RowEdit {
  unitPrice?: number;
  discount?: string;
}

/** A typed discount: "50" is S$50 off the row, "10%" is 10% off; anything else is no discount. */
export function parseDiscount(text: string | undefined): Omit<PriceEdit, 'unitPrice'> {
  const m = /^\s*(?:S?\$)?\s*(\d+(?:\.\d+)?)\s*(%)?\s*$/i.exec(text ?? '');
  if (!m) return {};
  return { discount: Number(m[1]), ...(m[2] ? { discountPercent: true } : {}) };
}

/** `applyPriceEdits` with the edits as typed in the app. */
export function applyRowEdits(
  invoice: Invoice,
  edits: Record<string, RowEdit> | undefined,
  depositPercent: number,
): Invoice {
  return applyPriceEdits(
    invoice,
    Object.fromEntries(
      Object.entries(edits ?? {}).map(([k, e]) => [
        k,
        { unitPrice: e.unitPrice, ...parseDiscount(e.discount) },
      ]),
    ),
    depositPercent,
  );
}

/** Invoice number: prefix, yymmdd, then a 2-digit count for the day. */
export function invoiceNumber(prefix: string, date: Date, count = 1): string {
  const two = (n: number) => String(n).padStart(2, '0');
  return `${prefix}${two(date.getFullYear() % 100)}${two(date.getMonth() + 1)}${two(date.getDate())}${two(count)}`;
}

const fill = (text: string, values: Record<string, number>) =>
  text.replace(/\{(\w+)\}/g, (m, k: string) => (k in values ? String(values[k]) : m));
const round = (n: number) => Math.round(n * 10) / 10;
const round2 = (n: number) => Math.round(n * 100) / 100;
