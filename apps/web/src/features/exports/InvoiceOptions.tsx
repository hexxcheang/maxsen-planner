import { useState } from 'react';
import { Link } from 'react-router';
import { Percent, TriangleAlert, Zap } from 'lucide-react';
import {
  applyAdjustments,
  mergeExtraLines,
  STAGE_LABEL,
  type InvoiceStage,
  type Project,
  type Settings,
} from '@maxsen/domain';
import { Button, Field, Input, NumberField, SegmentedControl } from '@/components/ui';
import { useActions, useCatalogue, useProjectTotals } from '@/lib/data/hooks';
import { formatMoney } from '@/lib/format';
import { projectPayment } from './build/invoice';
import { InvoicePricesDialog } from './InvoicePricesDialog';
import { ElectricalWorksDialog } from '@/features/electrical/ElectricalWorksDialog';

/**
 * Which payment the invoice asks for, its number, who it's addressed to, and a preview of the
 * packages and amounts. For the 2nd and final payments, what's already been paid is suggested from
 * the earlier invoices and can be changed.
 */
export function InvoiceOptions({ project, settings }: { project: Project; settings: Settings }) {
  const actions = useActions();
  const { data: totals } = useProjectTotals(project.id);
  const { data: catalogue } = useCatalogue();
  const lines = applyAdjustments(totals, project.quantityAdjustments);
  const [editing, setEditing] = useState(false);
  const [addingWorks, setAddingWorks] = useState(false);
  const works = (project.exportSettings.extraLines ?? []).filter((l) => l.quantity > 0);
  const worksTotal = works.reduce((t, l) => t + l.quantity * l.unitPrice, 0);
  const { pricing, base, invoice, amounts, number } = projectPayment({
    lines,
    settings,
    variants: catalogue.variants,
    project,
  });
  const p = invoice.packages;
  const stage = amounts.stage;
  const billing = project.exportSettings.billing;
  const paidTyped = stage !== 'deposit' && billing?.paid?.[stage] !== undefined;
  const update = (recipe: (b: NonNullable<typeof billing>) => void) =>
    actions.updateExportSettings(project.id, (s) => {
      s.billing ??= { stage: 'deposit' };
      recipe(s.billing);
    });
  const issued = billing?.issued?.[stage];
  const edits = Object.keys(project.exportSettings.priceEdits ?? {}).length;
  const discounts = -invoice.rows.reduce(
    (sum, r) => (r.kind === 'item' && r.discount ? sum + (r.unitPrice ?? 0) * r.quantity : sum),
    0,
  );

  return (
    <div className="flex flex-col gap-4">
      <Field label="Invoice for">
        <SegmentedControl<InvoiceStage>
          size="sm"
          label="Invoice for"
          value={stage}
          onChange={(v) => update((b) => void (b.stage = v))}
          options={[
            { value: 'deposit', label: 'Deposit' },
            { value: 'second', label: '2nd payment' },
            { value: 'final', label: 'Final' },
          ]}
        />
      </Field>
      <Field
        label="Invoice number"
        hint={
          issued
            ? `Last generated ${new Date(issued.date).toLocaleDateString()} for S$${formatMoney(issued.due)}.`
            : 'Generated from today’s date; change it if needed.'
        }
      >
        <Input
          compact
          value={number}
          onChange={(e) =>
            actions.updateExportSettings(project.id, (s) => {
              if (stage === 'deposit') s.invoiceNumber = e.target.value;
              else {
                s.billing ??= { stage };
                s.billing.numbers = { ...s.billing.numbers, [stage]: e.target.value };
              }
            })
          }
        />
      </Field>
      {stage !== 'deposit' && (
        <Field
          label="Already paid (S$)"
          hint={
            paidTyped
              ? `Suggested S$${formatMoney(amounts.suggestedPaid)} (${amounts.suggestedFrom}).`
              : `Suggested from ${amounts.suggestedFrom}; change it to what was collected.`
          }
        >
          <div className="flex items-center gap-2">
            <NumberField
              compact
              live
              min={0}
              precision={2}
              value={amounts.paid}
              aria-label="Already paid (S$)"
              onChange={(v) =>
                update((b) => {
                  b.paid = { ...b.paid, [stage]: v ?? 0 };
                })
              }
            />
            {paidTyped && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update((b) => {
                    if (b.paid) delete b.paid[stage];
                  })
                }
              >
                Use suggested
              </Button>
            )}
          </div>
        </Field>
      )}
      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-meta">
        <dt className="text-ink-3">To</dt>
        <dd className="text-ink">
          {project.customerName || <span className="text-warn">No customer name</span>}
          {project.customerContact ? `, ${project.customerContact}` : ''}
        </dd>
        <dt className="text-ink-3">Packages</dt>
        <dd className="text-ink">
          {p.switches} switch, {p.lights} light, {p.led} LED
        </dd>
        <dt className="text-ink-3">Total</dt>
        <dd className="tnum text-ink">S${formatMoney(invoice.total)}</dd>
        {stage !== 'deposit' && (
          <>
            <dt className="text-ink-3">Paid</dt>
            <dd className="tnum text-ink">−S${formatMoney(amounts.paid)}</dd>
          </>
        )}
        <dt className="text-ink-3">{STAGE_LABEL[stage]}</dt>
        <dd className="tnum font-semibold text-ink" data-testid="invoice-due">
          S${formatMoney(amounts.due)}
          {stage === 'deposit'
            ? ` (${amounts.percent}% of total)`
            : stage === 'second'
              ? ` (${amounts.percent}% of total, less paid)`
              : ' (balance)'}
        </dd>
      </dl>
      <div className="flex flex-col gap-1">
        <Button icon={<Percent className="size-4" />} onClick={() => setEditing(true)}>
          Prices and discounts
        </Button>
        <p className="text-meta text-ink-2">
          {edits === 0
            ? 'At list prices. Change unit prices or give discounts, as in Quick quote.'
            : `${edits} ${edits === 1 ? 'row' : 'rows'} with your own price or discount${
                discounts > 0 ? `, S$${formatMoney(discounts)} off in all` : ''
              }.`}
        </p>
      </div>
      <div className="flex flex-col gap-1">
        <Button icon={<Zap className="size-4" />} onClick={() => setAddingWorks(true)}>
          Add electrical works
        </Button>
        <p className="text-meta text-ink-2" data-testid="electrical-works-summary">
          {works.length
            ? `Electrical works: ${works.length} ${works.length === 1 ? 'line' : 'lines'}, S$${formatMoney(worksTotal)}. Change or remove them in Prices and discounts.`
            : 'Wiring, sockets, isolators, profiles and more, at your Electrical tab rates.'}
        </p>
      </div>
      <ElectricalWorksDialog
        open={addingWorks}
        onOpenChange={setAddingWorks}
        onAdd={(lines) =>
          actions.updateExportSettings(project.id, (s) => {
            s.extraLines = mergeExtraLines(s.extraLines, lines);
          })
        }
      />
      <InvoicePricesDialog
        open={editing}
        onOpenChange={setEditing}
        project={project}
        settings={settings}
        pricing={pricing}
        base={base}
        invoice={invoice}
        amounts={amounts}
        number={number}
      />
      {invoice.unpriced.length > 0 && (
        <p className="flex items-start gap-2 border-l-[3px] border-warn bg-warn-tint px-3 py-2 text-meta text-ink">
          <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warn" />
          <span>
            No price yet for {invoice.unpriced.join('; ')}. Set prices in{' '}
            <Link to="/catalogue" className="text-brass-2 underline">
              Catalogue
            </Link>{' '}
            or fill them in on the invoice.
          </span>
        </p>
      )}
      <p className="text-meta text-ink-2">
        Every 10 switches, 12 downlights/surface lights, and 30 m of LED strip with 6 drivers form a
        package; the rest is charged at add-on rates. Quantities come from Review totals. Rates and
        terms are set in Admin settings ›{' '}
        <Link to="/admin" className="text-brass-2 underline">
          Pricing
        </Link>
        .
      </p>
    </div>
  );
}
