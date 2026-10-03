import { useEffect, useMemo, useState } from 'react';
import { Copy, Download, MessageSquareText, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import {
  buildInvoice,
  categoryById,
  CATEGORIES,
  invoiceNumber,
  parseQuoteMessage,
  resolvePricing,
  withLedDrivers,
  type InvoiceInputLine,
  type QuoteLine,
} from '@maxsen/domain';
import {
  Button,
  Field,
  IconButton,
  Input,
  NumberField,
  PageHeader,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { formatMoney } from '@/lib/format';
import { useCatalogue, useSettings } from '@/lib/data/hooks';
import { buildInvoiceXlsx } from '@/features/exports/build/invoice';
import { buildQuotationPdf } from '@/features/exports/build/generate';

interface Draft {
  message: string;
  clientName: string;
  clientContact: string;
  number: string;
  lines: QuoteLine[];
  unread: string[];
}

const KEY = 'maxsen.quote.draft.v1';

/** The quote being worked on, kept in this browser so a reload doesn't lose it. */
function loadDraft(prefix: string): Draft {
  const blank: Draft = {
    message: '',
    clientName: '',
    clientContact: '',
    number: invoiceNumber(prefix, new Date()),
    lines: [],
    unread: [],
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...blank, ...(JSON.parse(raw) as Partial<Draft>) } : blank;
  } catch {
    return blank;
  }
}

const money = (n: number) => `${n < 0 ? '-' : ''}S$${formatMoney(Math.abs(n))}`;

/**
 * Quick quote: paste a client's message, check the items it was read into, and get the exact
 * quotation (packages, add-ons and deposit priced as on the invoice), to copy back as text or
 * download as the invoice spreadsheet.
 */
export function QuoteScreen() {
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const pricing = resolvePricing(settings);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(pricing.invoicePrefix));
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(draft));
    } catch {
      // Private mode or full storage: the quote just isn't kept across reloads.
    }
  }, [draft]);

  const products = useMemo(
    () => new Map(catalogue.products.map((p) => [p.id, p])),
    [catalogue.products],
  );
  const variants = useMemo(
    () => new Map(catalogue.variants.map((v) => [v.id, v])),
    [catalogue.variants],
  );
  const order = (categoryId: string) => CATEGORIES.findIndex((c) => c.id === categoryId);
  // Everything that can be quoted: visible products, plus the drivers.
  const options = catalogue.variants
    .flatMap((v) => {
      const p = products.get(v.productId);
      if (!p || v.hidden || (p.hidden && !p.system)) return [];
      return [{ v, p }];
    })
    .sort(
      (a, b) =>
        order(a.p.categoryId) - order(b.p.categoryId) ||
        a.p.sortOrder - b.p.sortOrder ||
        a.v.sortOrder - b.v.sortOrder,
    )
    .map(({ v, p }) => ({
      value: v.id,
      label: `${categoryById(p.categoryId).name} · ${p.name}, ${v.name}`,
    }));
  const unitOf = (variantId: string): 'pcs' | 'm' => {
    const p = products.get(variants.get(variantId)?.productId ?? '');
    return p?.categoryId === 'led-strips' ? 'm' : 'pcs';
  };

  const read = () => {
    const parsed = parseQuoteMessage(draft.message, catalogue, {
      preferred: settings.favouriteVariantIds,
    });
    const metresPerDriver = pricing.led.packageMetres / Math.max(1, pricing.led.packageDrivers);
    const lines = withLedDrivers(parsed.lines, metresPerDriver);
    set({ lines, unread: parsed.unread });
    toast({
      title: lines.length
        ? `Read ${lines.length} ${lines.length === 1 ? 'item' : 'items'}`
        : 'No products found in the message',
      body: lines.length ? 'Check them below and adjust anything that’s off.' : undefined,
    });
  };

  const inputs: InvoiceInputLine[] = draft.lines.flatMap((l) => {
    const v = variants.get(l.variantId);
    const p = v && products.get(v.productId);
    if (!v || !p || l.quantity <= 0) return [];
    return [
      {
        variantId: v.id,
        categoryId: p.categoryId,
        productName: p.name,
        variantName: v.name,
        unit: unitOf(v.id),
        exportQuantity: l.quantity,
      },
    ];
  });
  const invoice = buildInvoice(inputs, (id) => variants.get(id)?.price ?? null, pricing);

  const updateLine = (i: number, patch: Partial<QuoteLine>) =>
    set({ lines: draft.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const asText = () => {
    const out: string[] = [
      `Quotation ${draft.number}${draft.clientName ? ` for ${draft.clientName}` : ''}`,
      new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' }),
      '',
    ];
    let n = 0;
    for (const row of invoice.rows) {
      if (row.kind === 'section') out.push('', row.title);
      else if (row.kind === 'item') {
        n++;
        const price = row.unitPrice ?? 0;
        out.push(
          `${n}. ${row.description.split('\n')[0]}`,
          `   ${row.quantity} × ${money(price)} = ${money(row.quantity * price)}`,
        );
      }
    }
    out.push(
      '',
      `Total: ${money(invoice.total)}`,
      `Deposit (${pricing.depositPercent}%): ${money(invoice.deposit)}`,
      '',
      pricing.warranty,
      '',
      `${pricing.company.name} · ${pricing.company.phone}`,
    );
    return out.join('\n');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(asText());
      toast({ title: 'Quotation copied', body: 'Paste it into WhatsApp or an email.' });
    } catch {
      toast({
        title: 'Couldn’t copy',
        body: 'Your browser blocked the clipboard.',
        tone: 'danger',
      });
    }
  };

  const [making, setMaking] = useState<'pdf' | 'xlsx' | null>(null);
  /** Builds the quotation file and hands it to the browser to save. */
  const download = async (kind: 'pdf' | 'xlsx') => {
    setMaking(kind);
    try {
      const client = { name: draft.clientName, contact: draft.clientContact };
      const blob =
        kind === 'pdf'
          ? await buildQuotationPdf({ client, invoice, pricing, number: draft.number, settings })
          : await buildInvoiceXlsx({ client, invoice, pricing, number: draft.number });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Quotation ${draft.number}${draft.clientName ? ` - ${draft.clientName}` : ''}.${kind}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      toast({ title: 'The quotation couldn’t be made', tone: 'danger' });
    } finally {
      setMaking(null);
    }
  };

  const items = invoice.rows.filter((r) => r.kind === 'item').length;

  return (
    <Page wide>
      <PageHeader
        title="Quick quote"
        description="Paste a client’s message to price it exactly: packages, add-ons and deposit, as on the invoice. Check the items, then copy the quotation back or download it."
        actions={
          <Button
            variant="ghost"
            onClick={() =>
              setDraft({
                message: '',
                clientName: '',
                clientContact: '',
                number: invoiceNumber(pricing.invoicePrefix, new Date()),
                lines: [],
                unread: [],
              })
            }
          >
            New quote
          </Button>
        }
      />
      <div className="grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 max-[1100px]:grid-cols-1">
        {/* The message and who it's for. */}
        <section aria-label="Client's message" className="flex flex-col gap-4">
          <Field label="Client’s message" hint="Paste it as it is: a list, or a sentence.">
            <Textarea
              rows={11}
              value={draft.message}
              placeholder={
                'Hi, can I get a quote for\n- 10 switches (3 of them 2 gang)\n- 15 downlights warm white\n- 2 motorised curtains\n- 20m LED strip'
              }
              onChange={(e) => set({ message: e.target.value })}
            />
          </Field>
          <Button
            variant="primary"
            icon={<Sparkles className="size-4" />}
            disabled={!draft.message.trim()}
            onClick={read}
          >
            Read message
          </Button>
          {draft.unread.length > 0 && (
            <div
              role="alert"
              className="flex gap-2 border-l-[3px] border-warn bg-warn-tint px-3 py-2 text-control text-ink"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
              <div>
                <p className="font-semibold">Not recognised, add these by hand if needed:</p>
                <ul className="mt-1 list-disc pl-4">
                  {draft.unread.map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Field label="Client’s name">
              <Input
                value={draft.clientName}
                onChange={(e) => set({ clientName: e.target.value })}
              />
            </Field>
            <Field label="Contact number">
              <Input
                type="tel"
                value={draft.clientContact}
                onChange={(e) => set({ clientContact: e.target.value })}
              />
            </Field>
            <Field label="Quotation number" className="col-span-2">
              <Input value={draft.number} onChange={(e) => set({ number: e.target.value })} />
            </Field>
          </div>
        </section>

        <div className="flex min-w-0 flex-col gap-8">
          {/* The items read from the message, to check and adjust. */}
          <section aria-label="Items" className="flex flex-col gap-2">
            <h2 className="border-b border-rule pb-1.5 text-section text-ink">Items</h2>
            {draft.lines.length === 0 ? (
              <p className="flex items-center gap-2 py-4 text-control text-ink-2">
                <MessageSquareText aria-hidden className="size-4 text-ink-3" />
                Read a message, or add items below.
              </p>
            ) : (
              <ul aria-label="Quoted items" className="flex flex-col">
                {draft.lines.map((l, i) => {
                  const v = variants.get(l.variantId);
                  return (
                    <li
                      key={`${l.variantId}-${i}`}
                      className="grid grid-cols-[minmax(0,1fr)_150px_auto] items-center gap-2 border-b border-rule py-1.5"
                    >
                      <div className="min-w-0">
                        <Select
                          compact
                          aria-label={`Item ${i + 1}`}
                          value={l.variantId}
                          options={options}
                          onChange={(variantId) =>
                            updateLine(i, { variantId, unit: unitOf(variantId) })
                          }
                        />
                        <p className="mt-0.5 truncate text-meta text-ink-3">
                          {v?.price != null
                            ? `${money(v.price)}${unitOf(l.variantId) === 'm' ? ' per m' : ' each'}`
                            : 'No price in the catalogue'}
                          {l.source ? ` · “${l.source}”` : ''}
                        </p>
                      </div>
                      <NumberField
                        compact
                        aria-label={`Quantity of item ${i + 1}`}
                        live
                        value={l.quantity}
                        min={0}
                        max={10000}
                        precision={unitOf(l.variantId) === 'm' ? 1 : 0}
                        unit={unitOf(l.variantId) === 'm' ? 'm' : 'pcs'}
                        onChange={(q) => q !== null && updateLine(i, { quantity: q })}
                      />
                      <IconButton
                        size="sm"
                        label={`Remove item ${i + 1}`}
                        icon={<Trash2 />}
                        onClick={() => set({ lines: draft.lines.filter((_, j) => j !== i) })}
                      />
                    </li>
                  );
                })}
              </ul>
            )}
            <Select
              compact
              aria-label="Add an item"
              value=""
              placeholder="+ Add an item…"
              options={options}
              onChange={(variantId) =>
                set({
                  lines: [
                    ...draft.lines,
                    { variantId, quantity: 1, unit: unitOf(variantId), source: '' },
                  ],
                })
              }
            />
          </section>

          {/* The quotation, priced as on the invoice. */}
          <section aria-label="Quotation" className="flex flex-col gap-3">
            <h2 className="border-b border-rule pb-1.5 text-section text-ink">Quotation</h2>
            {items === 0 ? (
              <p className="text-control text-ink-2">The priced quotation appears here.</p>
            ) : (
              <>
                <table className="w-full text-control">
                  <thead>
                    <tr className="border-b border-rule-2 text-left text-meta text-ink-2">
                      <th className="py-1.5 font-medium">Item</th>
                      <th className="py-1.5 pl-3 text-right font-medium">Qty</th>
                      <th className="py-1.5 pl-4 text-right font-medium">Unit price</th>
                      <th className="py-1.5 pl-4 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoice.rows.map((row, i) =>
                      row.kind === 'section' ? (
                        <tr key={i}>
                          <td colSpan={4} className="pt-3 pb-1 text-meta font-semibold text-ink-2">
                            {row.title}
                          </td>
                        </tr>
                      ) : row.kind === 'item' ? (
                        <tr key={i} className="border-b border-rule align-top">
                          <td
                            className={
                              row.highlight ? 'py-1.5 font-semibold text-ink' : 'py-1.5 text-ink'
                            }
                          >
                            <span className="line-clamp-3 whitespace-pre-line">
                              {row.description}
                            </span>
                          </td>
                          <td className="tnum py-1.5 pl-3 text-right">{row.quantity}</td>
                          <td className="tnum py-1.5 pl-4 text-right whitespace-nowrap">
                            {row.unitPrice === null ? '—' : money(row.unitPrice)}
                          </td>
                          <td className="tnum py-1.5 pl-4 text-right whitespace-nowrap">
                            {money(row.quantity * (row.unitPrice ?? 0))}
                          </td>
                        </tr>
                      ) : null,
                    )}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="pt-3 text-right font-semibold text-ink">
                        Total
                      </td>
                      <td className="tnum pt-3 text-right text-body font-semibold text-ink">
                        {money(invoice.total)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={3} className="py-1 text-right text-ink-2">
                        Deposit ({pricing.depositPercent}%)
                      </td>
                      <td className="tnum py-1 text-right text-ink-2">{money(invoice.deposit)}</td>
                    </tr>
                  </tfoot>
                </table>
                {invoice.unpriced.length > 0 && (
                  <p role="alert" className="text-meta text-warn">
                    No price yet for {invoice.unpriced.join(', ')}. Set it in Catalogue for an exact
                    total.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button icon={<Copy className="size-4" />} onClick={() => void copy()}>
                    Copy as text
                  </Button>
                  <Button
                    icon={<Download className="size-4" />}
                    loading={making === 'xlsx'}
                    onClick={() => void download('xlsx')}
                  >
                    Download quotation (Excel)
                  </Button>
                  <Button
                    variant="primary"
                    icon={<Download className="size-4" />}
                    loading={making === 'pdf'}
                    onClick={() => void download('pdf')}
                  >
                    Download quotation (PDF)
                  </Button>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </Page>
  );
}
