import { useState } from 'react';
import { Plus } from 'lucide-react';
import { newId, type ExtraLine } from '@maxsen/domain';
import { Button, Input, NumberField } from '@/components/ui';

/**
 * Adds an item that isn't in the catalogue, typed in with its quantity and unit price. It goes
 * under "Additional items", where its price can still be changed or discounted.
 */
export function CustomItemForm({ onAdd }: { onAdd: (line: ExtraLine) => void }) {
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState<number | null>(1);
  const [unitPrice, setUnitPrice] = useState<number | null>(null);
  const ok = description.trim() !== '' && (quantity ?? 0) > 0;

  return (
    <form
      aria-label="Add your own item"
      className="flex flex-col gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        if (!ok) return;
        onAdd({
          id: newId('el'),
          description: description.trim(),
          quantity: quantity ?? 1,
          unitPrice: unitPrice ?? 0,
          custom: true,
        });
        setDescription('');
        setQuantity(1);
        setUnitPrice(null);
      }}
    >
      <span className="text-meta font-medium text-ink-2">Your own item (not in the catalogue)</span>
      <div className="flex flex-wrap items-center gap-1.5">
        <Input
          aria-label="Item description"
          placeholder="e.g. Extra smart plug, site visit, transport"
          className="min-w-48 flex-1"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
        <NumberField
          compact
          live
          min={0}
          max={100000}
          precision={2}
          className="w-20"
          aria-label="Item quantity"
          value={quantity}
          onChange={setQuantity}
        />
        <NumberField
          compact
          live
          min={-1000000}
          max={1000000}
          precision={2}
          className="w-28"
          aria-label="Item unit price (S$)"
          placeholder="S$"
          value={unitPrice}
          onChange={setUnitPrice}
        />
        <Button type="submit" size="sm" icon={<Plus className="size-4" />} disabled={!ok}>
          Add
        </Button>
      </div>
    </form>
  );
}
