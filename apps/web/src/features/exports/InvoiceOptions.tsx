import { Link } from 'react-router';
import { TriangleAlert } from 'lucide-react';
import { applyAdjustments, type Project, type Settings } from '@maxsen/domain';
import { Field, Input } from '@/components/ui';
import { useActions, useCatalogue, useProjectTotals } from '@/lib/data/hooks';
import { formatMoney } from '@/lib/format';
import { projectInvoice, projectInvoiceNumber } from './build/invoice';

/** Invoice number, who it's addressed to, and a preview of the packages and total. */
export function InvoiceOptions({ project, settings }: { project: Project; settings: Settings }) {
  const actions = useActions();
  const { data: totals } = useProjectTotals(project.id);
  const { data: catalogue } = useCatalogue();
  const lines = applyAdjustments(totals, project.quantityAdjustments);
  const { pricing, invoice } = projectInvoice({ lines, settings, variants: catalogue.variants });
  const number = projectInvoiceNumber(project, pricing);
  const p = invoice.packages;

  return (
    <div className="flex flex-col gap-4">
      <Field label="Invoice number" hint="Generated from today’s date; change it if needed.">
        <Input
          compact
          value={number}
          onChange={(e) =>
            actions.updateExportSettings(project.id, (s) => {
              s.invoiceNumber = e.target.value;
            })
          }
        />
      </Field>
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
        <dd className="tnum text-ink">
          S${formatMoney(invoice.total)} (deposit S${formatMoney(invoice.deposit)})
        </dd>
      </dl>
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
