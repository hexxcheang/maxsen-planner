import { Trash2 } from 'lucide-react';
import type { MovementLine } from '@maxsen/domain';
import { IconButton, NumberField, Select } from '@/components/ui';
import { useQuoteCatalogue } from '@/features/quote/useQuoteCatalogue';
import { useItemNames } from './useItemNames';

/**
 * The items of a take-out, return, restock or correction: picked from the catalogue, with how
 * many of each. A correction may take stock down (negative).
 */
export function ItemsEditor({
  lines,
  onChange,
  allowNegative = false,
  /** Shown beside each item, e.g. how many are in stock. */
  hint,
}: {
  lines: MovementLine[];
  onChange: (lines: MovementLine[]) => void;
  allowNegative?: boolean;
  hint?: (variantId: string) => string | undefined;
}) {
  const { options, unitOf } = useQuoteCatalogue();
  const names = useItemNames();
  const used = new Set(lines.map((l) => l.variantId));

  return (
    <div className="flex flex-col gap-2">
      {lines.length > 0 && (
        <ul aria-label="Items" className="flex flex-col">
          {lines.map((l, i) => (
            <li
              key={l.variantId}
              className="grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-2 border-b border-rule py-1.5"
            >
              <span className="min-w-0 text-control text-ink">
                {l.name}
                {hint?.(l.variantId) && (
                  <span className="block text-meta text-ink-3">{hint(l.variantId)}</span>
                )}
              </span>
              <NumberField
                compact
                live
                stepper
                min={allowNegative ? -100000 : 0}
                max={100000}
                precision={unitOf(l.variantId) === 'm' ? 1 : 0}
                unit={unitOf(l.variantId) === 'm' ? 'm' : undefined}
                aria-label={`How many: ${l.name}`}
                value={l.qty}
                onChange={(v) =>
                  onChange(lines.map((x, j) => (j === i ? { ...x, qty: v ?? 0 } : x)))
                }
              />
              <IconButton
                size="sm"
                label={`Take off ${l.name}`}
                icon={<Trash2 />}
                onClick={() => onChange(lines.filter((_, j) => j !== i))}
              />
            </li>
          ))}
        </ul>
      )}
      <Select
        compact
        aria-label="Add an item"
        value=""
        placeholder="+ Add an item…"
        options={options.filter((o) => !used.has(o.value))}
        onChange={(variantId) =>
          onChange([
            ...lines,
            { variantId, name: names.get(variantId) ?? variantId, qty: allowNegative ? 0 : 1 },
          ])
        }
      />
    </div>
  );
}
