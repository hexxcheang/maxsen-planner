import { useState, type ReactNode } from 'react';
import { PencilLine, Trash2 } from 'lucide-react';
import { parseDiscount, TOTAL_DISCOUNT, type Invoice, type RowEdit } from '@maxsen/domain';
import { IconButton, Input, NumberField, Textarea } from '@/components/ui';
import { money } from './quotation';

/**
 * The priced quotation as a table, with each row's unit price and discount editable. `base` is the
 * invoice before edits (for the list prices), `invoice` after them.
 */
export function QuotationTable({
  base,
  invoice,
  edits,
  onEdit,
  depositPercent,
  footer,
  aboveTotal,
  onQuantity,
  onRemove,
  editable = () => true,
  onDescription,
  renamable = () => false,
  showDeposit = true,
}: {
  base: Invoice;
  invoice: Invoice;
  edits: Record<string, RowEdit>;
  onEdit: (key: string, patch: RowEdit) => void;
  depositPercent: number;
  /** Extra rows under the deposit (e.g. what's been paid). */
  footer?: ReactNode;
  /** Shown across the table just above the total (e.g. the deposit's settings). */
  aboveTotal?: ReactNode;
  /** Makes quantities editable (an old invoice's lines; a quote's come from its items). */
  onQuantity?: (key: string, quantity: number) => void;
  /** Lets rows be taken off. */
  onRemove?: (key: string) => void;
  /** Which rows' quantity can be changed and the row taken off (all, by default). */
  editable?: (key: string) => boolean;
  /** Changes a row's wording (items typed in by hand). */
  onDescription?: (key: string, text: string) => void;
  /** Which rows' wording can be changed (none, by default). */
  renamable?: (key: string) => boolean;
  showDeposit?: boolean;
}) {
  /** The row whose wording is being changed. */
  const [editing, setEditing] = useState<string | null>(null);
  const commit = (key: string, before: string, typed: string) => {
    const text = typed.trim();
    if (text && text !== before) onDescription?.(key, text);
    setEditing(null);
  };
  const listPrice = new Map(
    base.rows.flatMap((r) => (r.kind === 'item' ? [[r.key, r.unitPrice] as const] : [])),
  );
  return (
    <table className="w-full text-control">
      <thead>
        <tr className="border-b border-rule-2 text-left text-meta text-ink-2">
          <th className="py-1.5 font-medium">Item</th>
          <th className="py-1.5 pl-3 text-right font-medium">Qty</th>
          <th className="py-1.5 pl-3 text-right font-medium">Unit price (S$)</th>
          <th className="py-1.5 pl-3 text-right font-medium">Discount</th>
          <th className="py-1.5 pl-4 text-right font-medium">Amount</th>
        </tr>
      </thead>
      <tbody>
        {invoice.rows.map((row, i) =>
          row.kind === 'section' ? (
            <tr key={i}>
              <td colSpan={5} className="pt-3 pb-1 text-meta font-semibold text-ink-2">
                {row.title}
              </td>
            </tr>
          ) : row.kind === 'item' && row.discount ? (
            <tr key={i} className="border-b border-rule align-top text-danger">
              <td colSpan={4} className="py-1.5 pl-3">
                {row.description}
              </td>
              <td className="tnum py-1.5 pl-4 text-right whitespace-nowrap">
                {money(row.unitPrice ?? 0)}
              </td>
            </tr>
          ) : row.kind === 'item' ? (
            <tr key={i} className="border-b border-rule align-top">
              <td className={row.highlight ? 'py-1.5 font-semibold text-ink' : 'py-1.5 text-ink'}>
                <span className="flex items-start gap-1">
                  {onDescription && editing === row.key ? (
                    row.description.includes('\n') ? (
                      // A package's lines stay lines.
                      <Textarea
                        autoFocus
                        aria-label={`Wording of ${row.description.split('\n')[0]}`}
                        className="min-w-0 flex-1 text-control"
                        rows={Math.min(8, row.description.split('\n').length)}
                        defaultValue={row.description}
                        onBlur={(e) => commit(row.key, row.description, e.target.value)}
                      />
                    ) : (
                      <Input
                        autoFocus
                        compact
                        aria-label={`Wording of ${row.description}`}
                        className="min-w-0 flex-1"
                        defaultValue={row.description}
                        onBlur={(e) => commit(row.key, row.description, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') e.currentTarget.blur();
                          if (e.key === 'Escape') setEditing(null);
                        }}
                      />
                    )
                  ) : (
                    <span className="line-clamp-3 flex-1 whitespace-pre-line">
                      {row.description}
                    </span>
                  )}
                  {onDescription && renamable(row.key) && editing !== row.key && (
                    <IconButton
                      size="sm"
                      label={`Change wording of ${row.description.split('\n')[0]}`}
                      icon={<PencilLine className="size-4" />}
                      onClick={() => setEditing(row.key)}
                    />
                  )}
                  {onRemove && editable(row.key) && (
                    <IconButton
                      size="sm"
                      label={`Remove ${row.description.split('\n')[0]}`}
                      icon={<Trash2 className="size-4" />}
                      onClick={() => onRemove(row.key)}
                    />
                  )}
                </span>
              </td>
              {onQuantity && editable(row.key) ? (
                <td className="py-1 pl-3">
                  <NumberField
                    compact
                    live
                    min={0}
                    max={100000}
                    precision={1}
                    className="w-20"
                    aria-label={`Quantity of ${row.description.split('\n')[0]}`}
                    value={row.quantity}
                    onChange={(v) => v !== null && onQuantity(row.key, v)}
                  />
                </td>
              ) : (
                <td className="tnum py-1.5 pl-3 text-right">{row.quantity}</td>
              )}
              <td className="py-1 pl-3">
                <NumberField
                  compact
                  live
                  allowEmpty
                  min={-100000}
                  max={1000000}
                  precision={2}
                  className="w-28"
                  aria-label={`Unit price of ${row.description.split('\n')[0]}`}
                  placeholder={listPrice.get(row.key) == null ? 'Price' : undefined}
                  value={row.unitPrice}
                  onChange={(v) =>
                    onEdit(row.key, {
                      unitPrice: v === null || v === listPrice.get(row.key) ? undefined : v,
                    })
                  }
                />
                {edits[row.key]?.unitPrice !== undefined && (
                  <p className="mt-0.5 text-right text-meta text-ink-3">
                    List {listPrice.get(row.key) == null ? '—' : money(listPrice.get(row.key)!)}
                  </p>
                )}
              </td>
              <td className="py-1 pl-3">
                <Input
                  compact
                  className="w-24 text-right"
                  aria-label={`Discount on ${row.description.split('\n')[0]}`}
                  placeholder="S$ or %"
                  value={edits[row.key]?.discount ?? ''}
                  aria-invalid={
                    !!edits[row.key]?.discount &&
                    parseDiscount(edits[row.key]?.discount).discount === undefined
                  }
                  onChange={(e) => onEdit(row.key, { discount: e.target.value })}
                />
              </td>
              <td className="tnum py-1.5 pl-4 text-right whitespace-nowrap">
                {money(row.quantity * (row.unitPrice ?? 0))}
              </td>
            </tr>
          ) : null,
        )}
      </tbody>
      <tfoot>
        {/* A discount on the whole invoice: its line shows above, at the end of the items. */}
        <tr>
          <td colSpan={3} className="pt-3 text-right text-ink-2">
            Total discount
          </td>
          <td className="pt-2 pl-3">
            <Input
              compact
              className="w-24 text-right"
              aria-label="Total discount"
              placeholder="S$ or %"
              value={edits[TOTAL_DISCOUNT]?.discount ?? ''}
              aria-invalid={
                !!edits[TOTAL_DISCOUNT]?.discount &&
                parseDiscount(edits[TOTAL_DISCOUNT]?.discount).discount === undefined
              }
              onChange={(e) => onEdit(TOTAL_DISCOUNT, { discount: e.target.value })}
            />
          </td>
          <td />
        </tr>
        {aboveTotal && (
          <tr>
            <td colSpan={5} className="pt-3">
              {aboveTotal}
            </td>
          </tr>
        )}
        <tr>
          <td colSpan={4} className="pt-3 text-right font-semibold text-ink">
            Total
          </td>
          <td className="tnum pt-3 text-right text-body font-semibold text-ink">
            {money(invoice.total)}
          </td>
        </tr>
        {showDeposit && (
          <tr>
            <td colSpan={4} className="py-1 text-right text-ink-2">
              Deposit ({depositPercent}%)
            </td>
            <td className="tnum py-1 text-right text-ink-2">{money(invoice.deposit)}</td>
          </tr>
        )}
        {footer}
      </tfoot>
    </table>
  );
}
