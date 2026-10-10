import {
  STAGE_LABEL,
  type Invoice,
  type PricingSettings,
  type RowEdit,
  type StageAmounts,
} from '@maxsen/domain';
import { formatMoney } from '@/lib/format';

export const money = (n: number) => `${n < 0 ? '-' : ''}S$${formatMoney(Math.abs(n))}`;

/** Sets one row's edit, dropping the row's entry once nothing on it is changed. */
export function withRowEdit(
  edits: Record<string, RowEdit> | undefined,
  key: string,
  patch: RowEdit,
): Record<string, RowEdit> {
  const next = { ...edits?.[key], ...patch };
  const out = { ...edits };
  if (next.unitPrice === undefined && !next.discount) delete out[key];
  else out[key] = next;
  return out;
}

/** The quotation as plain text, to paste into WhatsApp or an email. */
export function quotationText({
  invoice,
  pricing,
  number,
  clientName,
  payment,
}: {
  invoice: Invoice;
  pricing: PricingSettings;
  number: string;
  clientName: string;
  /** For a 2nd or final payment: what's been paid and what's due now. */
  payment?: StageAmounts;
}): string {
  const out: string[] = [
    `Quotation ${number}${clientName ? ` for ${clientName}` : ''}`,
    new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
    '',
  ];
  let n = 0;
  for (const row of invoice.rows) {
    if (row.kind === 'section') out.push('', row.title);
    else if (row.kind === 'item') {
      const price = row.unitPrice ?? 0;
      if (row.discount) {
        out.push(`   ${row.description}: ${money(price)}`);
        continue;
      }
      n++;
      out.push(
        `${n}. ${row.description.split('\n')[0]}`,
        `   ${row.quantity} × ${money(price)} = ${money(row.quantity * price)}`,
      );
    }
  }
  out.push(
    '',
    `Total: ${money(invoice.total)}`,
    ...(payment?.stage === 'full'
      ? [`${STAGE_LABEL.full} due: ${money(payment.due)}`]
      : payment && payment.stage !== 'deposit'
        ? [
            `Paid: ${money(-payment.paid)}`,
            `${STAGE_LABEL[payment.stage]} due: ${money(payment.due)}`,
          ]
        : [`Deposit (${pricing.depositPercent}%): ${money(invoice.deposit)}`]),
    '',
    pricing.warranty,
    '',
    `${pricing.company.name} · ${pricing.company.phone}`,
  );
  return out.join('\n');
}
