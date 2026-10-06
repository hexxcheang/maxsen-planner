import { useMemo, useState } from 'react';
import { Search, Zap } from 'lucide-react';
import { newId, type ExtraLine } from '@maxsen/domain';
import { Button, Dialog, Input, NumberField } from '@/components/ui';
import { formatMoney } from '@/lib/format';
import { currentElectricalRates } from './electrical-quote';

/**
 * Picks electrical works to add to an invoice: the Electrical tab's rates (yours where changed),
 * by section, with a quantity for each. Added lines go under "Electrical works" on the invoice.
 */
export function ElectricalWorksDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (lines: ExtraLine[]) => void;
}) {
  const sections = useMemo(() => (open ? currentElectricalRates() : []), [open]);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const items = sections.flatMap((s) => s.items);
  const picked = items.filter((i) => (qty[i.id] ?? 0) > 0);
  const total = picked.reduce((t, i) => t + i.rate * qty[i.id]!, 0);
  const close = (o: boolean) => {
    if (!o) {
      setQty({});
      setSearch('');
    }
    onOpenChange(o);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      width="lg"
      title="Add electrical works"
      description="Rates from the Electrical tab (supply and install, before GST). Set how many of each; they're added under Electrical works, where prices can still be changed or discounted."
      footer={
        <>
          <span className="mr-auto text-control text-ink-2" data-testid="electrical-pick-total">
            {picked.length
              ? `${picked.length} ${picked.length === 1 ? 'item' : 'items'}, S$${formatMoney(total)}`
              : 'Nothing picked yet'}
          </span>
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button
            variant="primary"
            icon={<Zap className="size-4" />}
            disabled={!picked.length}
            onClick={() => {
              onAdd(
                picked.map((i) => ({
                  id: newId('el'),
                  sourceId: i.id,
                  description: i.description,
                  quantity: qty[i.id]!,
                  unitPrice: i.rate,
                })),
              );
              close(false);
            }}
          >
            Add to invoice
          </Button>
        </>
      }
    >
      <Input
        type="search"
        aria-label="Search electrical works"
        leading={<Search />}
        placeholder="Search, e.g. socket, isolator, profile"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      <div className="mt-3 flex flex-col gap-4">
        {sections.map((s) => {
          const shown = s.items.filter((i) => !q || i.description.toLowerCase().includes(q));
          if (!shown.length) return null;
          return (
            <section key={s.id} aria-label={s.title}>
              <h3 className="border-b border-rule pb-1 text-control font-semibold text-ink">
                {s.title}
              </h3>
              <ul className="flex flex-col">
                {shown.map((i) => (
                  <li
                    key={i.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-rule py-1.5"
                  >
                    <span className="min-w-0 text-control text-ink">{i.description}</span>
                    <span className="tnum text-meta whitespace-nowrap text-ink-2">
                      S${formatMoney(i.rate)} / {i.unit}
                    </span>
                    <NumberField
                      compact
                      stepper
                      live
                      min={0}
                      max={10000}
                      precision={i.unit === 'm' ? 1 : 0}
                      className="w-32"
                      aria-label={`How many: ${i.description}`}
                      value={qty[i.id] ?? 0}
                      onChange={(v) => setQty((m) => ({ ...m, [i.id]: v ?? 0 }))}
                    />
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </Dialog>
  );
}
