import { useMemo } from 'react';
import { useCatalogue } from '@/lib/data/hooks';

/** "Product, variant" for a catalogue variant, as the ledger names it. */
export function useItemNames() {
  const { data } = useCatalogue();
  return useMemo(() => {
    const products = new Map(data.products.map((p) => [p.id, p]));
    return new Map(
      data.variants.map((v) => [v.id, `${products.get(v.productId)?.name ?? 'Item'}, ${v.name}`]),
    );
  }, [data]);
}
