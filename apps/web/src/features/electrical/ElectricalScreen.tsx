import { useEffect, useState } from 'react';
import { Copy, Download, RotateCcw } from 'lucide-react';
import {
  ELECTRICAL_NOTES,
  ELECTRICAL_RATES,
  GST_PERCENT,
  invoiceNumber,
  resolvePricing,
} from '@maxsen/domain';
import { Button, Field, Input, NumberField, PageHeader, Switch, useToast } from '@/components/ui';
import { Page } from '@/components/Page';
import { useSettings } from '@/lib/data/hooks';
import { formatMoney } from '@/lib/format';
import { buildElectricalXlsx, electricalTotals, type ElectricalDraft } from './electrical-quote';

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
  const totals = electricalTotals(draft);
  const edited = Object.keys(draft.rates).length;

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
    out.push(`Subtotal: ${money(totals.subtotal)}`);
    if (draft.gst) out.push(`GST ${GST_PERCENT}%: ${money(totals.gst)}`);
    out.push(`Total: ${money(totals.total)}`);
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
                  const qty = draft.quantities[item.id] ?? 0;
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
                          min={0}
                          max={10000}
                          precision={item.unit === 'm' ? 1 : 0}
                          className="ml-auto w-20"
                          aria-label={`Quantity of ${item.description}`}
                          value={qty}
                          onChange={(v) => {
                            const quantities = { ...draft.quantities };
                            if (!v) delete quantities[item.id];
                            else quantities[item.id] = v;
                            set({ quantities });
                          }}
                        />
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
          <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-control">
            <dt className="text-ink-2">Items</dt>
            <dd className="tnum text-right">{totals.count}</dd>
            <dt className="text-ink-2">Subtotal</dt>
            <dd className="tnum text-right">{money(totals.subtotal)}</dd>
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
                  const blob = await buildElectricalXlsx(draft, pricing.company);
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
                  await navigator.clipboard.writeText(text());
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
              {ELECTRICAL_NOTES.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ol>
          </div>
        </aside>
      </div>
    </Page>
  );
}
