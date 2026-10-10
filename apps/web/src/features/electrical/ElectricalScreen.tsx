import { useEffect, useState } from 'react';
import { Copy, Download, Minus, Plus, RotateCcw, Trash2 } from 'lucide-react';
import {
  ELECTRICAL_NOTES,
  ELECTRICAL_RATES,
  GST_PERCENT,
  invoiceNumber,
  newId,
  resolvePricing,
} from '@maxsen/domain';
import {
  Button,
  Field,
  IconButton,
  Input,
  NumberField,
  PageHeader,
  SegmentedControl,
  Switch,
  useToast,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { useSettings } from '@/lib/data/hooks';
import { formatMoney } from '@/lib/format';
import {
  buildElectricalXlsx,
  electricalTotals,
  paymentNote,
  type ElectricalAdjustment,
  type ElectricalDraft,
} from './electrical-quote';
import { buildElectricalPlanPdf } from './electrical-plan-pdf';
import { ElectricalPlanView } from './ElectricalPlanView';
import { copyText } from '@/lib/clipboard';

const KEY = 'maxsen.electrical.v1';
const money = (n: number) => `S$${formatMoney(n)}`;

function load(prefix: string): ElectricalDraft {
  const blank: ElectricalDraft = {
    client: '',
    address: '',
    number: invoiceNumber(`${prefix}E-`, new Date()),
    rates: {},
    quantities: {},
    gst: false,
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...blank, ...(JSON.parse(raw) as Partial<ElectricalDraft>) } : blank;
  } catch {
    return blank;
  }
}

/**
 * Electrical works: average Singapore rates for supply and install (per point or item), laid out
 * the way an electrician quotes, with quantities to price a job. Rates can be changed for your own
 * electrician's prices; both are kept in this browser.
 */
export function ElectricalScreen() {
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const pricing = resolvePricing(settings);
  const [draft, setDraft] = useState<ElectricalDraft>(() => load(pricing.invoicePrefix));
  const [making, setMaking] = useState(false);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Not kept across reloads.
    }
  }, [draft]);
  const set = (patch: Partial<ElectricalDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const totals = electricalTotals(draft, pricing.depositPercent);
  const [tab, setTab] = useState<'quote' | 'plan'>('quote');
  const plotted = draft.plan?.points.length ?? 0;
  const downloadPlan = async () => {
    if (!draft.plan) return;
    try {
      const blob = await buildElectricalPlanPdf(
        draft.plan,
        { client: draft.client, address: draft.address, number: draft.number },
        pricing.company,
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Electrical Layout ${draft.number}${draft.client ? ` - ${draft.client}` : ''}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      toast({ title: 'The plan couldn’t be made', tone: 'danger' });
    }
  };
  const edited = Object.keys(draft.rates).length;
  const adjustments = draft.adjustments ?? [];
  const adjust = (id: string, patch: Partial<ElectricalAdjustment>) =>
    set({ adjustments: adjustments.map((a) => (a.id === id ? { ...a, ...patch } : a)) });
  const addAdjustment = (kind: ElectricalAdjustment['kind']) =>
    set({
      adjustments: [
        ...adjustments,
        {
          id: newId('el'),
          kind,
          label: kind === 'discount' ? 'Discount' : 'Additional charge',
          value: 0,
          unit: kind === 'discount' ? 'percent' : 'amount',
        },
      ],
    });
  const adjustmentText = (a: (typeof totals.adjustments)[number]) =>
    a.unit === 'percent' ? `${a.label} (${a.value}%)` : a.label;

  const text = () => {
    const out = [
      `Electrical quotation ${draft.number}${draft.client ? ` for ${draft.client}` : ''}`,
      draft.address,
      '',
    ];
    for (const s of totals.sections) {
      if (!s.lines.length) continue;
      out.push(s.title);
      for (const l of s.lines)
        out.push(
          `  ${l.sn}. ${l.description}: ${l.quantity} ${l.unit} × ${money(l.rate)} = ${money(l.amount)}`,
        );
      out.push('');
    }
    out.push(`Subtotal: ${money(totals.works)}`);
    if (totals.adjustments.length) {
      for (const a of totals.adjustments) out.push(`${adjustmentText(a)}: ${money(a.amount)}`);
      out.push(`Subtotal after adjustments: ${money(totals.subtotal)}`);
    }
    if (draft.gst) out.push(`GST ${GST_PERCENT}%: ${money(totals.gst)}`);
    out.push(`Total: ${money(totals.total)}`);
    if (totals.paid !== undefined)
      out.push(
        `Deposit paid: ${money(-totals.paid)}`,
        `Balance due: ${money(totals.balance ?? 0)}`,
      );
    else out.push(`Deposit (${totals.depositPercent}%): ${money(totals.deposit)}`);
    out.push('', paymentNote(totals.depositPercent));
    return out.filter((l, i, a) => l || a[i - 1]).join('\n');
  };

  return (
    <Page wide>
      <PageHeader
        title="Electrical"
        description={`Average Singapore rates for electrical works, supply and install, before GST. Enter quantities to price a job the way an electrician quotes it. Rates are a guide: concealed wiring, access and the site change real quotes, so adjust any rate to your electrician's.`}
        actions={
          edited > 0 && (
            <Button
              variant="ghost"
              icon={<RotateCcw className="size-4" />}
              onClick={() => set({ rates: {} })}
            >
              Reset {edited} {edited === 1 ? 'rate' : 'rates'} to average
            </Button>
          )
        }
      />
      <SegmentedControl<'quote' | 'plan'>
        label="Electrical view"
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: 'quote', label: 'Quotation' },
          {
            value: 'plan',
            label: plotted ? `Electrical plan (${plotted} points)` : 'Electrical plan',
          },
        ]}
      />
      {tab === 'plan' ? (
        <ElectricalPlanView
          plan={draft.plan}
          onChange={(plan) => setDraft((d) => ({ ...d, plan }))}
          onDownload={downloadPlan}
        />
      ) : (
        <div className="grid grid-cols-[minmax(0,8fr)_minmax(0,3fr)] gap-8 max-[1100px]:grid-cols-1">
          <section aria-label="Rates" className="min-w-0">
            <table className="w-full text-control">
              <thead>
                <tr className="border-b-2 border-ink text-left text-meta text-ink-2">
                  <th className="w-10 py-1.5 font-medium">S/N</th>
                  <th className="py-1.5 font-medium">Description of works</th>
                  <th className="py-1.5 pl-3 font-medium">Unit</th>
                  <th className="py-1.5 pl-3 text-right font-medium">Rate (S$)</th>
                  <th className="py-1.5 pl-3 text-right font-medium">Qty</th>
                  <th className="py-1.5 pl-4 text-right font-medium">Amount (S$)</th>
                </tr>
              </thead>
              {ELECTRICAL_RATES.map((section, si) => (
                <tbody key={section.id} aria-label={section.title}>
                  <tr>
                    <td colSpan={6} className="pt-4 pb-1 text-control font-semibold text-ink">
                      {String.fromCharCode(65 + si)}. {section.title}
                    </td>
                  </tr>
                  {section.items.map((item, i) => {
                    const rate = draft.rates[item.id] ?? item.rate;
                    const onPlan = totals.plotted[item.id] ?? 0;
                    const qty = onPlan + (draft.quantities[item.id] ?? 0);
                    return (
                      <tr key={item.id} className="border-b border-rule align-top">
                        <td className="tnum py-1.5 text-ink-3">
                          {String.fromCharCode(65 + si)}
                          {i + 1}
                        </td>
                        <td className="py-1.5 text-ink">
                          {item.description}
                          <span className="block text-meta text-ink-3">
                            Market S${item.low}–{item.high}
                            {draft.rates[item.id] !== undefined && ` · average S$${item.rate}`}
                          </span>
                        </td>
                        <td className="py-1.5 pl-3 text-ink-2">{item.unit}</td>
                        <td className="py-1 pl-3">
                          <NumberField
                            compact
                            live
                            min={0}
                            max={100000}
                            precision={2}
                            className="ml-auto w-24"
                            aria-label={`Rate for ${item.description}`}
                            value={rate}
                            onChange={(v) => {
                              const rates = { ...draft.rates };
                              if (v === null || v === item.rate) delete rates[item.id];
                              else rates[item.id] = v;
                              set({ rates });
                            }}
                          />
                        </td>
                        <td className="py-1 pl-3">
                          <NumberField
                            compact
                            live
                            min={onPlan}
                            max={10000}
                            precision={item.unit === 'm' ? 1 : 0}
                            className="ml-auto w-20"
                            aria-label={`Quantity of ${item.description}`}
                            value={qty}
                            onChange={(v) => {
                              // What's on the plan counts by itself; typed in is anything more.
                              const extra = Math.max(0, (v ?? 0) - onPlan);
                              const quantities = { ...draft.quantities };
                              if (!extra) delete quantities[item.id];
                              else quantities[item.id] = extra;
                              set({ quantities });
                            }}
                          />
                          {onPlan > 0 && (
                            <span className="mt-0.5 block text-right text-meta whitespace-nowrap text-brass-2">
                              {onPlan} on plan
                            </span>
                          )}
                        </td>
                        <td className="tnum py-1.5 pl-4 text-right whitespace-nowrap text-ink">
                          {qty ? formatMoney(qty * rate) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              ))}
            </table>
          </section>

          <aside aria-label="Electrical quotation" className="flex flex-col gap-4 self-start">
            <h2 className="border-b border-rule pb-1.5 text-section text-ink">Quotation</h2>
            <Field label="Client">
              <Input value={draft.client} onChange={(e) => set({ client: e.target.value })} />
            </Field>
            <Field label="Site address">
              <Input value={draft.address} onChange={(e) => set({ address: e.target.value })} />
            </Field>
            <Field label="Quotation number">
              <Input value={draft.number} onChange={(e) => set({ number: e.target.value })} />
            </Field>
            <Switch
              checked={draft.gst}
              onCheckedChange={(gst) => set({ gst })}
              label={`Add GST (${GST_PERCENT}%)`}
            />
            <section aria-label="Price adjustments" className="flex flex-col gap-2">
              <p className="text-meta font-semibold text-ink-2">Price adjustments</p>
              {adjustments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col gap-1.5 rounded-md border border-rule p-2"
                  data-testid="electrical-adjustment"
                >
                  <div className="flex items-center gap-1.5">
                    <Input
                      aria-label="Adjustment name"
                      className="min-w-0 flex-1"
                      value={a.label}
                      onChange={(e) => adjust(a.id, { label: e.target.value })}
                    />
                    <IconButton
                      size="sm"
                      label={`Remove ${a.label || 'adjustment'}`}
                      icon={<Trash2 className="size-4" />}
                      onClick={() => set({ adjustments: adjustments.filter((x) => x.id !== a.id) })}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SegmentedControl
                      size="sm"
                      label="Discount or charge"
                      value={a.kind}
                      options={[
                        { value: 'discount', label: 'Less' },
                        { value: 'charge', label: 'Add' },
                      ]}
                      onChange={(kind) => adjust(a.id, { kind })}
                    />
                    <NumberField
                      compact
                      live
                      min={0}
                      max={a.unit === 'percent' ? 100 : 1000000}
                      precision={2}
                      className="w-24"
                      aria-label={`${a.label || 'Adjustment'} ${a.unit === 'percent' ? '%' : 'S$'}`}
                      value={a.value}
                      onChange={(v) => adjust(a.id, { value: v ?? 0 })}
                    />
                    <SegmentedControl
                      size="sm"
                      label="S$ or percent"
                      value={a.unit}
                      options={[
                        { value: 'amount', label: 'S$' },
                        { value: 'percent', label: '%' },
                      ]}
                      onChange={(unit) => adjust(a.id, { unit })}
                    />
                  </div>
                </div>
              ))}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  icon={<Minus className="size-4" />}
                  onClick={() => addAdjustment('discount')}
                >
                  Discount
                </Button>
                <Button
                  size="sm"
                  icon={<Plus className="size-4" />}
                  onClick={() => addAdjustment('charge')}
                >
                  Extra charge
                </Button>
              </div>
            </section>
            <section aria-label="Deposit" className="flex flex-col gap-2">
              <p className="text-meta font-semibold text-ink-2">Deposit</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <label className="flex items-center gap-2 text-control text-ink-2">
                  <NumberField
                    compact
                    live
                    min={0}
                    max={100}
                    precision={2}
                    className="w-20"
                    aria-label="Deposit (%)"
                    value={totals.depositPercent}
                    onChange={(v) =>
                      set({
                        depositPercent: v === null || v === pricing.depositPercent ? undefined : v,
                      })
                    }
                  />
                  %
                </label>
                <Switch
                  checked={draft.depositPaid !== undefined}
                  onCheckedChange={(on) => set({ depositPaid: on ? totals.deposit : undefined })}
                  label="Deposit paid"
                />
              </div>
              {draft.depositPaid !== undefined && (
                <label className="flex items-center justify-between gap-2 text-control text-ink-2">
                  Amount paid (S$)
                  <NumberField
                    compact
                    live
                    min={0}
                    max={10_000_000}
                    precision={2}
                    className="w-28"
                    aria-label="Deposit paid (S$)"
                    value={draft.depositPaid}
                    onChange={(v) => set({ depositPaid: v ?? 0 })}
                  />
                </label>
              )}
            </section>
            <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-control">
              <dt className="text-ink-2">Items</dt>
              <dd className="tnum text-right">{totals.count}</dd>
              <dt className="text-ink-2">Subtotal</dt>
              <dd className="tnum text-right">{money(totals.works)}</dd>
              {totals.adjustments.map((a) => (
                <div key={a.id} className="contents">
                  <dt className="text-ink-2">{adjustmentText(a)}</dt>
                  <dd className={`tnum text-right ${a.amount < 0 ? 'text-danger' : ''}`}>
                    {a.amount < 0 ? `−${money(-a.amount)}` : money(a.amount)}
                  </dd>
                </div>
              ))}
              {totals.adjustments.length > 0 && (
                <>
                  <dt className="text-ink-2">After adjustments</dt>
                  <dd className="tnum text-right">{money(totals.subtotal)}</dd>
                </>
              )}
              {draft.gst && (
                <>
                  <dt className="text-ink-2">GST {GST_PERCENT}%</dt>
                  <dd className="tnum text-right">{money(totals.gst)}</dd>
                </>
              )}
              <dt className="border-t border-rule pt-1 font-semibold text-ink">Total</dt>
              <dd
                data-testid="electrical-total"
                className="tnum border-t border-rule pt-1 text-right text-body font-semibold"
              >
                {money(totals.total)}
              </dd>
              {totals.paid !== undefined ? (
                <>
                  <dt className="text-ink-2">Deposit paid</dt>
                  <dd className="tnum text-right text-ink-2">−{money(totals.paid)}</dd>
                  <dt className="font-semibold text-ink">Balance due</dt>
                  <dd data-testid="electrical-due" className="tnum text-right font-semibold">
                    {money(totals.balance ?? 0)}
                  </dd>
                </>
              ) : (
                <>
                  <dt className="font-semibold text-ink">Deposit ({totals.depositPercent}%)</dt>
                  <dd data-testid="electrical-due" className="tnum text-right font-semibold">
                    {money(totals.deposit)}
                  </dd>
                </>
              )}
            </dl>
            <div className="flex flex-col gap-2">
              <Button
                variant="primary"
                icon={<Download className="size-4" />}
                loading={making}
                disabled={totals.count === 0}
                onClick={async () => {
                  setMaking(true);
                  try {
                    const blob = await buildElectricalXlsx(
                      draft,
                      pricing.company,
                      pricing.depositPercent,
                    );
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `Electrical Quotation ${draft.number}${draft.client ? ` - ${draft.client}` : ''}.xlsx`;
                    a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 10_000);
                  } catch (e) {
                    console.error(e);
                    toast({ title: 'The quotation couldn’t be made', tone: 'danger' });
                  } finally {
                    setMaking(false);
                  }
                }}
              >
                Download quotation (Excel)
              </Button>
              <Button
                icon={<Copy className="size-4" />}
                disabled={totals.count === 0}
                onClick={async () => {
                  try {
                    await copyText(text());
                    toast({ title: 'Quotation copied' });
                  } catch {
                    toast({ title: 'Couldn’t copy', tone: 'danger' });
                  }
                }}
              >
                Copy as text
              </Button>
              {Object.keys(draft.quantities).length > 0 && (
                <Button variant="ghost" onClick={() => set({ quantities: {} })}>
                  Clear quantities
                </Button>
              )}
            </div>
            <div>
              <p className="mb-1 text-meta font-semibold text-ink-2">Notes on the quotation</p>
              <ol className="list-decimal pl-4 text-meta text-ink-2">
                {[...ELECTRICAL_NOTES, paymentNote(totals.depositPercent)].map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ol>
            </div>
          </aside>
        </div>
      )}
    </Page>
  );
}
