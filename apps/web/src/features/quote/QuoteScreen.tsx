import { useEffect, useMemo, useState } from 'react';
import {
  Copy,
  Download,
  MessageSquareText,
  Sparkles,
  Trash2,
  TriangleAlert,
  Zap,
} from 'lucide-react';
import {
  applyRowEdits,
  mergeExtraLines,
  withExtraLines,
  type ExtraLine,
  buildInvoice,
  categoryById,
  CATEGORIES,
  invoiceNumber,
  parseQuoteMessage,
  resolvePricing,
  stageAmounts,
  STAGE_LABEL,
  withDeposit,
  withLedDrivers,
  type InvoiceInputLine,
  type RowEdit,
  type QuoteLine,
} from '@maxsen/domain';
import {
  Button,
  Field,
  IconButton,
  Input,
  NumberField,
  PageHeader,
  SegmentedControl,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { useCatalogue, useSettings } from '@/lib/data/hooks';
import { buildInvoiceXlsx } from '@/features/exports/build/invoice';
import { buildQuotationPdf } from '@/features/exports/build/generate';
import { QuotationTable } from './QuotationTable';
import { OldInvoiceSection } from './OldInvoiceSection';
import { ElectricalWorksDialog } from '@/features/electrical/ElectricalWorksDialog';
import { CustomItemForm } from './CustomItemForm';
import { money, quotationText, withRowEdit } from './quotation';
import { copyText } from '@/lib/clipboard';

interface Draft {
  message: string;
  clientName: string;
  clientContact: string;
  number: string;
  lines: QuoteLine[];
  unread: string[];
  /** Hand-set prices and discounts per quotation row (by row key); discounts as typed. */
  edits: Record<string, RowEdit>;
  /** Electrical works added from the Electrical rates, and items typed in by hand. */
  extraLines: ExtraLine[];
  /** This quote's deposit, in percent; Admin › Pricing's when absent. */
  depositPercent?: number;
  /** What the client has paid as deposit, once they have; absent until then. */
  depositPaid?: number;
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
    edits: {},
    extraLines: [],
  };
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...blank, ...(JSON.parse(raw) as Partial<Draft>) } : blank;
  } catch {
    return blank;
  }
}

/**
 * Quick quote: paste a client's message, check the items it was read into, and get the exact
 * quotation (packages, add-ons and deposit priced as on the invoice), to copy back as text or
 * download as the invoice spreadsheet.
 */
type QuoteMode = 'new' | 'old';
const MODE_KEY = 'maxsen.quote.mode';

export function QuoteScreen() {
  const [quoteMode, setQuoteMode] = useState<QuoteMode>(() => {
    try {
      return window.localStorage.getItem(MODE_KEY) === 'old' ? 'old' : 'new';
    } catch {
      return 'new';
    }
  });
  const changeMode = (m: QuoteMode) => {
    setQuoteMode(m);
    try {
      window.localStorage.setItem(MODE_KEY, m);
    } catch {
      // Not kept across reloads.
    }
  };
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const listPricing = resolvePricing(settings);
  const [draft, setDraft] = useState<Draft>(() => loadDraft(listPricing.invoicePrefix));
  // This quote's own deposit, with the payment terms worded to match.
  const pricing = withDeposit(listPricing, draft.depositPercent ?? listPricing.depositPercent);
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
  const base = withExtraLines(
    buildInvoice(inputs, (id) => variants.get(id)?.price ?? null, pricing),
    draft.extraLines,
    pricing.depositPercent,
  );
  const [addingWorks, setAddingWorks] = useState(false);
  const extraId = (key: string) => key.slice('extra:'.length);
  const invoice = applyRowEdits(base, draft.edits, pricing.depositPercent);
  // Once the deposit is paid, the document asks for the 2nd payment instead.
  const payment =
    draft.depositPaid !== undefined
      ? stageAmounts(invoice.total, pricing, {
          stage: 'second',
          paid: { second: draft.depositPaid },
        })
      : undefined;

  const updateLine = (i: number, patch: Partial<QuoteLine>) =>
    set({ lines: draft.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const asText = () =>
    quotationText({
      invoice,
      pricing,
      number: draft.number,
      clientName: draft.clientName,
      payment,
    });

  const copy = async () => {
    try {
      await copyText(asText());
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
          ? await buildQuotationPdf({
              client,
              invoice,
              pricing,
              number: draft.number,
              settings,
              payment,
              label: payment ? 'Invoice' : 'Quotation',
            })
          : await buildInvoiceXlsx({ client, invoice, pricing, number: draft.number, payment });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${payment ? 'Invoice' : 'Quotation'} ${draft.number}${payment ? ' - 2nd payment' : ''}${draft.clientName ? ` - ${draft.clientName}` : ''}.${kind}`;
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
        description={
          quoteMode === 'old'
            ? 'Open an old invoice to collect the next payment: its lines as invoiced, editable like a quote, with the 2nd or final payment worked out from what was paid.'
            : 'Paste a client’s message to price it exactly: packages, add-ons and deposit, as on the invoice. Check the items, then copy the quotation back or download it.'
        }
        actions={
          quoteMode === 'new' && (
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
                  edits: {},
                  extraLines: [],
                })
              }
            >
              New quote
            </Button>
          )
        }
      />
      <SegmentedControl<QuoteMode>
        label="Quote or old invoice"
        className="mb-5"
        value={quoteMode}
        onChange={changeMode}
        options={[
          { value: 'new', label: 'New quote' },
          { value: 'old', label: 'Old invoice: next payment' },
        ]}
      />
      {quoteMode === 'old' ? (
        <OldInvoiceSection />
      ) : (
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
              <Button
                size="sm"
                icon={<Zap className="size-4" />}
                className="self-start"
                onClick={() => setAddingWorks(true)}
              >
                Add electrical works
              </Button>
              <ElectricalWorksDialog
                open={addingWorks}
                onOpenChange={setAddingWorks}
                onAdd={(added) =>
                  setDraft((d) => ({ ...d, extraLines: mergeExtraLines(d.extraLines, added) }))
                }
              />
              <CustomItemForm
                onAdd={(line) => setDraft((d) => ({ ...d, extraLines: [...d.extraLines, line] }))}
              />
            </section>

            {/* The quotation, priced as on the invoice. */}
            <section aria-label="Quotation" className="flex flex-col gap-3">
              <h2 className="border-b border-rule pb-1.5 text-section text-ink">Quotation</h2>
              {items === 0 ? (
                <p className="text-control text-ink-2">The priced quotation appears here.</p>
              ) : (
                <>
                  <QuotationTable
                    base={base}
                    invoice={invoice}
                    edits={draft.edits}
                    onEdit={(key, patch) =>
                      setDraft((d) => ({ ...d, edits: withRowEdit(d.edits, key, patch) }))
                    }
                    depositPercent={pricing.depositPercent}
                    showDeposit={!payment}
                    aboveTotal={
                      <DepositControls
                        percent={pricing.depositPercent}
                        usual={listPricing.depositPercent}
                        deposit={invoice.deposit}
                        paid={draft.depositPaid}
                        onPercent={(depositPercent) => setDraft((d) => ({ ...d, depositPercent }))}
                        onPaid={(depositPaid) => setDraft((d) => ({ ...d, depositPaid }))}
                      />
                    }
                    footer={
                      payment && (
                        <>
                          <tr>
                            <td colSpan={4} className="py-1 text-right text-ink-2">
                              Deposit paid
                            </td>
                            <td className="tnum py-1 text-right text-ink-2">
                              {money(-payment.paid)}
                            </td>
                          </tr>
                          <tr>
                            <td colSpan={4} className="py-1 text-right font-semibold text-ink">
                              {STAGE_LABEL.second} due ({payment.percent}% less paid)
                            </td>
                            <td
                              data-testid="quote-due"
                              className="tnum py-1 text-right font-semibold text-ink"
                            >
                              {money(payment.due)}
                            </td>
                          </tr>
                        </>
                      )
                    }
                    editable={(key) => key.startsWith('extra:')}
                    renamable={(key) =>
                      draft.extraLines.some((l) => l.custom && l.id === extraId(key))
                    }
                    onDescription={(key, description) =>
                      setDraft((d) => ({
                        ...d,
                        extraLines: d.extraLines.map((l) =>
                          l.id === extraId(key) ? { ...l, description } : l,
                        ),
                      }))
                    }
                    onQuantity={(key, quantity) =>
                      setDraft((d) => ({
                        ...d,
                        extraLines: d.extraLines.map((l) =>
                          l.id === extraId(key) ? { ...l, quantity } : l,
                        ),
                      }))
                    }
                    onRemove={(key) =>
                      setDraft((d) => ({
                        ...d,
                        extraLines: d.extraLines.filter((l) => l.id !== extraId(key)),
                      }))
                    }
                  />
                  {invoice.unpriced.length > 0 && (
                    <p role="alert" className="text-meta text-warn">
                      No price yet for {invoice.unpriced.join(', ')}. Set it in Catalogue for an
                      exact total.
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
      )}
    </Page>
  );
}

/**
 * Just above the total: this quote's deposit (any percentage; the payment terms follow it), and
 * whether the client has paid it, and how much.
 */
function DepositControls({
  percent,
  usual,
  deposit,
  paid,
  onPercent,
  onPaid,
}: {
  percent: number;
  usual: number;
  deposit: number;
  paid: number | undefined;
  onPercent: (percent: number | undefined) => void;
  onPaid: (paid: number | undefined) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Deposit"
      className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 rounded-md bg-paper px-3 py-2"
    >
      <label className="flex items-center gap-2 text-control text-ink-2">
        Deposit
        <NumberField
          compact
          live
          min={0}
          max={100}
          precision={2}
          className="w-20"
          aria-label="Deposit (%)"
          value={percent}
          onChange={(v) => onPercent(v === null || v === usual ? undefined : v)}
        />
        %
      </label>
      <Switch
        checked={paid !== undefined}
        onCheckedChange={(on) => onPaid(on ? deposit : undefined)}
        label="Deposit paid"
      />
      {paid !== undefined && (
        <label className="flex items-center gap-2 text-control text-ink-2">
          Amount paid (S$)
          <NumberField
            compact
            live
            min={0}
            max={10_000_000}
            precision={2}
            className="w-28"
            aria-label="Deposit paid (S$)"
            value={paid}
            onChange={(v) => onPaid(v ?? 0)}
          />
        </label>
      )}
    </div>
  );
}
