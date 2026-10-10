import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { CATEGORIES, resolveCategoryStyle, type TotalLine } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatQuantity } from '@/lib/format';
import { useProjectTotals, useSettings } from '@/lib/data/hooks';

/** Project-wide counts while planning: every level and both plan types, drivers included. */
export function LiveTotals({ projectId }: { projectId: string }) {
  const { data: lines } = useProjectTotals(projectId);
  const { data: settings } = useSettings();
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = (id: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const groups = CATEGORIES.map((c) => ({
    category: c,
    lines: lines.filter((l) => l.categoryId === c.id),
  })).filter((g) => g.lines.length > 0);

  if (groups.length === 0) {
    return (
      <p className="px-4 py-4 text-control text-ink-2">
        Nothing placed yet. Totals appear as you add devices.
      </p>
    );
  }

  const total = (ls: TotalLine[]) => {
    const unit = ls.every((l) => l.unit === 'm') ? 'm' : 'pcs';
    const sum = ls.reduce((s, l) => s + (l.unit === unit ? l.calculated : 0), 0);
    return formatQuantity(Math.round(sum * 10) / 10, unit);
  };

  return (
    <ul aria-label="Live totals by category">
      {groups.map(({ category, lines: ls }) => {
        const expanded = open.has(category.id);
        return (
          <li key={category.id} className="border-b border-rule last:border-b-0">
            <button
              type="button"
              aria-expanded={expanded}
              onClick={() => toggle(category.id)}
              className="flex h-9 w-full items-center gap-2 px-4 text-left hover:bg-paper"
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0 text-ink-3 transition-transform',
                  expanded && 'rotate-90',
                )}
              />
              <CategoryGlyph
                categoryId={category.id}
                style={resolveCategoryStyle(category.id, settings)}
                size={16}
                showBadge={false}
              />
              <span className="min-w-0 flex-1 truncate text-control text-ink">{category.name}</span>
              <span className="tnum text-control font-medium text-ink">{total(ls)}</span>
            </button>
            {expanded && (
              <ul className="pb-2">
                {ls.map((l) => (
                  <li key={l.key} className="flex items-center gap-2 py-1 pr-4 pl-[52px]">
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-meta text-ink">{l.productName}</span>
                      <span className="truncate text-caption text-ink-2">{l.variantName}</span>
                    </span>
                    {l.autoAdded && <Badge tone="brass">Auto-added</Badge>}
                    {l.runsMissingMetres > 0 && <Badge tone="warn">Length missing</Badge>}
                    <span className="tnum text-meta text-ink">
                      {formatQuantity(l.calculated, l.unit)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}
