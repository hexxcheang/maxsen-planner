/**
 * Payment stages for a project's invoices, following Maxsen's terms: a deposit (60%), a second
 * payment when installation starts (30%, so 90% in all), and the balance before integration. Items
 * added after the first invoice raise the grand total; each later invoice asks for its share of the
 * new total less what has already been collected.
 */
import type { InvoiceStage, ProjectBilling } from '../types.ts';
import type { PricingSettings } from './pricing.ts';

export const INVOICE_STAGES: InvoiceStage[] = ['deposit', 'second', 'final', 'full'];

export const STAGE_LABEL: Record<InvoiceStage, string> = {
  deposit: 'Deposit',
  second: '2nd payment',
  final: 'Final payment',
  full: 'Full payment',
};

export interface StageAmounts {
  stage: InvoiceStage;
  /** Share of the grand total that should have been paid once this invoice is settled. */
  percent: number;
  /** What has already been collected: the typed-in amount, else `suggestedPaid`. */
  paid: number;
  /** The earlier invoices' amounts (or their share of today's total, if never generated). */
  suggestedPaid: number;
  /** How the suggestion was worked out, for showing beside it. */
  suggestedFrom: string;
  /** Asked for on this invoice. */
  due: number;
}

export function stageAmounts(
  total: number,
  pricing: Pick<PricingSettings, 'depositPercent' | 'secondPercent'>,
  billing: ProjectBilling | undefined,
  stage: InvoiceStage = billing?.stage ?? 'deposit',
): StageAmounts {
  const dep = pricing.depositPercent;
  const upToSecond = Math.min(100, dep + pricing.secondPercent);
  const issued = billing?.issued ?? {};
  const depositDue = issued.deposit?.due ?? round2((total * dep) / 100);
  const paidBeforeSecond = billing?.paid?.second ?? depositDue;
  const secondDue =
    issued.second?.due ?? Math.max(0, round2((total * upToSecond) / 100 - paidBeforeSecond));

  // Full payment: the whole total in one go, with nothing paid before it.
  const first = stage === 'deposit' || stage === 'full';
  const percent = stage === 'deposit' ? dep : stage === 'second' ? upToSecond : 100;
  const suggestedPaid = first
    ? 0
    : stage === 'second'
      ? depositDue
      : round2(paidBeforeSecond + secondDue);
  const suggestedFrom = first
    ? ''
    : stage === 'second'
      ? issued.deposit
        ? `Deposit invoice ${issued.deposit.number}`
        : `${dep}% deposit of today’s total`
      : [
          issued.deposit ? `deposit ${issued.deposit.number}` : `${dep}% deposit`,
          issued.second
            ? `2nd payment ${issued.second.number}`
            : `${pricing.secondPercent}% 2nd payment`,
        ].join(' + ');
  const typed = first ? undefined : billing?.paid?.[stage];
  const paid = round2(typed ?? suggestedPaid);
  const due = Math.max(0, round2((total * percent) / 100 - paid));
  return { stage, percent, paid, suggestedPaid, suggestedFrom, due };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
