import { Link } from 'react-router';
import { ListChecks, TriangleAlert } from 'lucide-react';
import {
  applyAdjustments,
  categoryById,
  resolveCategoryStyle,
  type PlanType,
  type ReviewLine,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import {
  Badge,
  buttonClass,
  EmptyState,
  NumberField,
  PageHeader,
  Table,
  Td,
  Th,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { cn } from '@/lib/cn';
import { formatQuantity } from '@/lib/format';
import { useActions, useProjectTotals, useSettings } from '@/lib/data/hooks';
import { useCurrentProject } from '@/features/project/useProjectContext';

const SECTIONS: { planType: PlanType; title: string }[] = [
  { planType: 'smart-home', title: 'Smart Home Products' },
  { planType: 'lighting', title: 'Lighting Products' },
];

export function ReviewTotalsScreen() {
  const project = useCurrentProject();
  const actions = useActions();
  const { data: settings } = useSettings();
  const { data: totals } = useProjectTotals(project.id);
  const lines = applyAdjustments(totals, project.quantityAdjustments);
  const warnings = lines.filter((l) => l.warning).length;
  const missing = lines.reduce((n, l) => n + l.runsMissingMetres, 0);

  const goToExports = (
    <Link to={`/projects/${project.id}/exports`} className={buttonClass('primary')}>
      Go to exports
    </Link>
  );

  return (
    <Page>
      <PageHeader
        title="Review totals"
        description="Adjustments change export quantities only. Plans are never modified."
        actions={lines.length > 0 && goToExports}
      />
      {(warnings > 0 || missing > 0) && (
        <div
          role="note"
          className="mb-5 flex items-start gap-2.5 border-l-[3px] border-warn bg-warn-tint px-4 py-3"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          <p className="text-control text-ink">
            {warnings > 0 &&
              `${warnings} adjusted ${warnings === 1 ? 'quantity needs' : 'quantities need'} a second look because the plans changed since. `}
            {missing > 0 &&
              `${missing} LED strip ${missing === 1 ? 'run has' : 'runs have'} no length yet and ${missing === 1 ? 'counts' : 'count'} as 0 m. `}
            Warnings never block exports.
          </p>
        </div>
      )}
      {lines.length === 0 ? (
        <EmptyState
          icon={<ListChecks />}
          title="Nothing to count yet"
          body="Place devices on a plan and they appear here, consolidated across every level."
          action={
            <Link to={`/projects/${project.id}/plan`} className={buttonClass('primary')}>
              Open the planner
            </Link>
          }
        />
      ) : (
        <Table>
          <thead className="border-b border-rule-2">
            <tr>
              <Th className="w-[30%]">Category</Th>
              <Th>Product</Th>
              <Th>Variant</Th>
              <Th numeric className="w-28">
                Calculated
              </Th>
              <Th numeric className="w-36">
                Export quantity
              </Th>
            </tr>
          </thead>
          {SECTIONS.map((section) => {
            const rows = lines.filter(
              (l) => categoryById(l.categoryId).planType === section.planType,
            );
            if (rows.length === 0) return null;
            const id = `section-${section.planType}`;
            return (
              <tbody key={section.planType} aria-labelledby={id}>
                <tr>
                  <th
                    id={id}
                    colSpan={5}
                    scope="rowgroup"
                    className="pt-6 pb-2 text-left text-section text-ink"
                  >
                    {section.title}
                  </th>
                </tr>
                {rows.map((l) => (
                  <Row
                    key={l.key}
                    line={l}
                    color={resolveCategoryStyle(l.categoryId, settings)}
                    onChange={(q) =>
                      actions.setExportQuantity(project.id, l.variantId, q, l.calculated)
                    }
                  />
                ))}
              </tbody>
            );
          })}
        </Table>
      )}
    </Page>
  );
}

function Row({
  line,
  color,
  onChange,
}: {
  line: ReviewLine;
  color: ReturnType<typeof resolveCategoryStyle>;
  onChange: (q: number) => void;
}) {
  const metres = line.unit === 'm';
  const name = `${line.productName}, ${line.variantName}`;
  return (
    <tr
      data-adjusted={line.adjusted || undefined}
      className={cn(
        'border-t border-rule',
        line.adjusted && 'bg-brass-tint/50 [&>td:first-child]:shadow-[inset_3px_0_0_var(--brass)]',
      )}
    >
      <Td className="pl-3">
        <span className="flex items-center gap-2">
          <CategoryGlyph categoryId={line.categoryId} style={color} size={16} showBadge={false} />
          {categoryById(line.categoryId).name}
        </span>
      </Td>
      <Td>
        <span className="flex flex-wrap items-center gap-2">
          {line.productName}
          {line.autoAdded && <Badge tone="brass">Auto-added</Badge>}
        </span>
      </Td>
      <Td>
        {line.variantName}
        {line.runsMissingMetres > 0 && (
          <span className="block text-meta text-warn">
            {line.runsMissingMetres} {line.runsMissingMetres === 1 ? 'run' : 'runs'} without a
            length
          </span>
        )}
        {line.warning && line.adjustment && (
          <span className="mt-0.5 flex items-center gap-1 text-meta text-warn">
            <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
            Calculated quantity changed since you adjusted this (was{' '}
            {formatQuantity(line.adjustment.calculatedAtAdjustment, line.unit)})
          </span>
        )}
      </Td>
      <Td numeric className={cn(line.adjusted && 'text-ink-2')}>
        {formatQuantity(line.calculated, line.unit)}
      </Td>
      <Td numeric>
        <NumberField
          compact
          aria-label={`Export quantity for ${name}`}
          value={line.exportQuantity}
          min={0}
          precision={metres ? 1 : 0}
          unit={metres ? 'm' : undefined}
          onChange={(q) => q !== null && onChange(q)}
        />
      </Td>
    </tr>
  );
}
