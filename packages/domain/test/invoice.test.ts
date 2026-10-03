import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildInvoice, invoiceNumber, type InvoiceInputLine } from '../src/pricing/invoice.ts';
import { DEFAULT_PRICING, resolvePricing } from '../src/pricing/pricing.ts';
import { SYSTEM_VARIANT_IDS } from '../src/categories.ts';
import { SAMPLE_VARIANTS } from '../src/sample/catalogue.ts';

const line = (
  variantId: string,
  categoryId: InvoiceInputLine['categoryId'],
  exportQuantity: number,
  unit: 'pcs' | 'm' = 'pcs',
): InvoiceInputLine => ({
  variantId,
  categoryId,
  productName: variantId,
  variantName: 'Std',
  unit,
  exportQuantity,
});
const prices = new Map(SAMPLE_VARIANTS.map((v) => [v.id, v.price ?? null]));
const priceOf = (id: string) => prices.get(id) ?? null;
type ItemRow = Extract<ReturnType<typeof buildInvoice>['rows'][number], { kind: 'item' }>;
const items = (inv: ReturnType<typeof buildInvoice>) =>
  inv.rows.filter((r): r is ItemRow => r.kind === 'item');

describe('buildInvoice', () => {
  // Like the template: 10 switches, 24 lights, 60 m of LED with 12 drivers, a few extras.
  const inv = buildInvoice(
    [
      line('var_nova_pro_2g_black', 'smart-switches', 6),
      line('var_nova_pro_3g_black', 'smart-switches', 4),
      line('var_ir_aircon', 'aircon-controllers', 4),
      line('var_gateway', 'gateways', 1),
      line('var_luna_dl_3000', 'downlights', 20),
      line('var_lumi_surface_round', 'surface-lights', 4),
      line('var_lumi_cove_3000', 'led-strips', 60, 'm'),
      line(SYSTEM_VARIANT_IDS.smartLedDriver, 'misc-lighting', 12),
      line('var_temp_sensor', 'sensors', 3),
      line('var_nova_s8', 'control-panels', 1),
    ],
    priceOf,
    DEFAULT_PRICING,
  );

  it('forms one package each of 10 switches, 12 lights and 30 m + 6 drivers, at most', () => {
    assert.deepEqual(inv.packages, { switches: 1, lights: 1, led: 1 });
    const pkg = items(inv).filter((r) => r.highlight);
    assert.deepEqual(
      pkg.map((r) => [r.quantity, r.unitPrice]),
      [
        [1, 1990],
        [1, 988],
        [1, 988],
      ],
    );
    assert.match(pkg[1]!.description, /Total 12 Selection/);
    assert.match(pkg[2]!.description, /Total 30Meters, 6 Drivers/);
  });

  it('charges everything beyond the one package as add-ons', () => {
    const find = (re: RegExp) => items(inv).find((r) => re.test(r.description));
    // 24 lights: 12 in the package, 12 add-ons; 60 m with 12 drivers: 30 m and 6 drivers more.
    assert.equal(find(/Add On Per Luna/)!.quantity, 12);
    assert.equal(find(/Per 1 Meter/)!.quantity, 30);
    assert.equal(find(/Per Smart Control \+ Driver/)!.quantity, 6);
    const switches = buildInvoice(
      [line('var_nova_pro_1g_black', 'smart-switches', 25)],
      priceOf,
      DEFAULT_PRICING,
    );
    assert.equal(switches.packages.switches, 1);
    assert.equal(
      items(switches).find((r) => /Add-On Per Nova\+ Pro/.test(r.description))!.quantity,
      15,
    );
  });

  it('does not charge again for the IR blasters and gateway in the switch package', () => {
    assert.ok(!items(inv).some((r) => /var_ir_aircon|var_gateway/.test(r.description)));
  });

  it('charges integration per light and waives it', () => {
    const integ = items(inv).filter((r) => /^Integration/.test(r.description));
    assert.deepEqual(
      integ.map((r) => [r.quantity, r.unitPrice]),
      [
        [24, 15],
        [24, -15],
        [12, 15],
        [12, -15],
      ],
    );
  });

  it('prices other devices from the catalogue and totals with a 60% deposit', () => {
    assert.ok(
      items(inv).some((r) => r.description.startsWith('var_temp_sensor') && r.unitPrice === 48),
    );
    assert.equal(inv.total, 1990 + 988 + 12 * 78 + 988 + 30 * 18 + 6 * 78 + 3 * 48 + 680);
    assert.equal(inv.deposit, Math.round(inv.total * 0.6 * 100) / 100);
    assert.equal(inv.rows.at(-1)!.kind, 'note');
  });

  it('charges what is left over beyond a package at add-on rates', () => {
    const more = buildInvoice(
      [
        line('var_nova_pro_1g_black', 'smart-switches', 13),
        line('var_luna_dl_3000', 'downlights', 14),
        line('var_lumi_cove_3000', 'led-strips', 34.5, 'm'),
        line(SYSTEM_VARIANT_IDS.smartLedDriver, 'misc-lighting', 7),
      ],
      priceOf,
      DEFAULT_PRICING,
    );
    const find = (re: RegExp) => items(more).find((r) => re.test(r.description));
    assert.equal(find(/Add-On Per Nova\+ Pro/)!.quantity, 3);
    assert.equal(find(/Add On Per Luna/)!.quantity, 2);
    assert.equal(find(/Per Smart Control \+ Driver/)!.quantity, 1);
    assert.equal(find(/Per 1 Meter/)!.quantity, 4.5);
  });

  it('prices pieces individually below a package, and lists anything without a price', () => {
    const few = buildInvoice(
      [
        line('var_nova_pro_1g_black', 'smart-switches', 4),
        line('var_breeze_fan_52', 'ceiling-fans', 2),
      ],
      priceOf,
      DEFAULT_PRICING,
    );
    assert.equal(few.packages.switches, 0);
    assert.ok(items(few).some((r) => r.quantity === 4 && r.unitPrice === 180));
    assert.deepEqual(few.unpriced, ['var_breeze_fan_52, Std']);
  });
});

describe('pricing settings', () => {
  it('fills in defaults around saved changes', () => {
    const p = resolvePricing({
      pricing: { ...DEFAULT_PRICING, lights: { ...DEFAULT_PRICING.lights, packagePrice: 1000 } },
    });
    assert.equal(p.lights.packagePrice, 1000);
    assert.equal(p.led.packagePrice, 988);
  });

  it('numbers invoices by date', () => {
    assert.equal(invoiceNumber('MXN-HX-', new Date(2026, 8, 16), 2), 'MXN-HX-26091602');
  });
});

describe('switch packages per series', () => {
  const sw = (variantId: string, productName: string, n: number): InvoiceInputLine => ({
    ...line(variantId, 'smart-switches', n),
    productName,
  });
  const pkgOf = (inv: ReturnType<typeof buildInvoice>) => items(inv).filter((r) => r.highlight);

  it('prices 10 Ark switches as the Ark Core package at S$1,390, more as S$100 add-ons', () => {
    const inv = buildInvoice([sw('var_ark_2g', 'Ark Series', 12)], priceOf, DEFAULT_PRICING);
    assert.deepEqual(
      pkgOf(inv).map((r) => [r.quantity, r.unitPrice]),
      [[1, 1390]],
    );
    assert.match(pkgOf(inv)[0]!.description, /^Ark Core Package/);
    const addOn = items(inv).find((r) => /Add-On Per Ark Series/.test(r.description))!;
    assert.deepEqual([addOn.quantity, addOn.unitPrice], [2, 100]);
    assert.equal(inv.total, 1390 + 200);
  });

  it('keeps Nova+ Pro at S$1,990 and Lusano+ at S$3,590', () => {
    const nova = buildInvoice(
      [sw('var_nova_pro_1g_black', 'Nova+ Pro', 10)],
      priceOf,
      DEFAULT_PRICING,
    );
    assert.equal(pkgOf(nova)[0]!.unitPrice, 1990);
    const lusano = buildInvoice(
      [sw('var_lusano_1g', 'Lusano+ Prestige', 10)],
      priceOf,
      DEFAULT_PRICING,
    );
    assert.equal(pkgOf(lusano)[0]!.unitPrice, 3590);
  });

  it('gives the one switch package to the series with most switches; the rest are priced singly', () => {
    const inv = buildInvoice(
      [sw('var_ark_1g', 'Ark Series', 12), sw('var_nova_pro_1g_black', 'Nova+ Pro', 10)],
      priceOf,
      DEFAULT_PRICING,
    );
    assert.equal(inv.packages.switches, 1);
    assert.match(pkgOf(inv)[0]!.description, /^Ark Core Package/);
    const nova = items(inv).find((r) => r.description.startsWith('Nova+ Pro'))!;
    assert.deepEqual([nova.quantity, nova.unitPrice], [10, 180]);
  });

  it('turns a single saved switch package (from before series) into the Nova+ Pro one', () => {
    const p = resolvePricing({
      pricing: {
        ...DEFAULT_PRICING,
        switches: { ...DEFAULT_PRICING.switches[1]!, packagePrice: 1890 } as never,
      },
    });
    assert.deepEqual(
      p.switches.map((s) => [s.id, s.packagePrice]),
      [
        ['ark', 1390],
        ['nova', 1890],
        ['lusano', 3590],
      ],
    );
  });
});
