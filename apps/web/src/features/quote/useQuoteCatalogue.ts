import { useMemo } from 'react';
import {
  categoryById,
  CATEGORIES,
  isRgbStripName,
  parseQuoteMessage,
  withLedDrivers,
  type InvoiceInputLine,
  type PricingSettings,
  type QuoteLine,
} from '@maxsen/domain';
import { useCatalogue, useSettings } from '@/lib/data/hooks';

/**
 * The catalogue as Quick quote uses it, for a new quote and an old invoice alike: what can be
 * picked, each item's unit, reading items from a client's message, and turning picked items into
 * invoice lines.
 */
export function useQuoteCatalogue() {
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const products = useMemo(
    () => new Map(catalogue.products.map((p) => [p.id, p])),
    [catalogue.products],
  );
  const variants = useMemo(
    () => new Map(catalogue.variants.map((v) => [v.id, v])),
    [catalogue.variants],
  );

  const order = (categoryId: string) => CATEGORIES.findIndex((c) => c.id === categoryId);
  // Everything that can be quoted: visible products, plus the drivers.
  const options = catalogue.variants
    .flatMap((v) => {
      const p = products.get(v.productId);
      if (!p || v.hidden || (p.hidden && !p.system)) return [];
      return [{ v, p }];
    })
    .sort(
      (a, b) =>
        order(a.p.categoryId) - order(b.p.categoryId) ||
        a.p.sortOrder - b.p.sortOrder ||
        a.v.sortOrder - b.v.sortOrder,
    )
    .map(({ v, p }) => ({
      value: v.id,
      label: `${categoryById(p.categoryId).name} · ${p.name}, ${v.name}`,
    }));

  const unitOf = (variantId: string): 'pcs' | 'm' => {
    const p = products.get(variants.get(variantId)?.productId ?? '');
    return p?.categoryId === 'led-strips' ? 'm' : 'pcs';
  };

  /** RGBCCT is an add-on to strip quoted anyway, so it needs no drivers of its own. */
  const isAddOnOnly = (variantId: string) => {
    const v = variants.get(variantId);
    const p = products.get(v?.productId ?? '');
    return !!v && !!p && isRgbStripName(p.name, v.name);
  };

  /** The items in a client's message, with LED drivers for the strip in it. */
  const readMessage = (message: string, pricing: PricingSettings) => {
    const parsed = parseQuoteMessage(message, catalogue, {
      preferred: settings.favouriteVariantIds,
    });
    const metresPerDriver = pricing.led.packageMetres / Math.max(1, pricing.led.packageDrivers);
    return {
      lines: withLedDrivers(parsed.lines, metresPerDriver, isAddOnOnly),
      unread: parsed.unread,
    };
  };

  /** Picked items as the invoice prices them. */
  const invoiceInputs = (lines: QuoteLine[]): InvoiceInputLine[] =>
    lines.flatMap((l) => {
      const v = variants.get(l.variantId);
      const p = v && products.get(v.productId);
      if (!v || !p || l.quantity <= 0) return [];
      return [
        {
          variantId: v.id,
          categoryId: p.categoryId,
          productName: p.name,
          variantName: v.name,
          unit: unitOf(v.id),
          exportQuantity: l.quantity,
        },
      ];
    });

  const priceOf = (variantId: string) => variants.get(variantId)?.price ?? null;

  return { options, products, variants, unitOf, readMessage, invoiceInputs, priceOf };
}
