import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileUp, Sparkles, TriangleAlert, Zap } from 'lucide-react';
import {
  applyRowEdits,
  buildInvoice,
  INVOICE_STAGES,
  invoiceNumber,
  issuedFromOld,
  newId,
  parseOldInvoice,
  pdfInvoiceGrid,
  resolvePricing,
  withDeposit,
  forStage,
  stageAmounts,
  STAGE_LABEL,
  type Cell,
  type ExtraLine,
  type QuoteLine,
  type Invoice,
  type InvoiceRow,
  type InvoiceStage,
  type ProjectBilling,
  type RowEdit,
} from '@maxsen/domain';
import {
  Button,
  Field,
  Input,
  NumberField,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { useSettings } from '@/lib/data/hooks';
import { buildInvoiceXlsx } from '@/features/exports/build/invoice';
import { buildQuotationPdf } from '@/features/exports/build/generate';
import { QuotationTable } from './QuotationTable';
import { CustomItemForm } from './CustomItemForm';
import { useQuoteCatalogue } from './useQuoteCatalogue';
import { ElectricalWorksDialog } from '@/features/electrical/ElectricalWorksDialog';
import { money, quotationText, withRowEdit } from './quotation';
import { copyText } from '@/lib/clipboard';
import { readPdfText } from '@/lib/images';
import { ocrPdf } from '@/lib/ocr';

type Line =
  | { id: string; kind: 'item'; description: string; quantity: number; unitPrice: number }
  | { id: string; kind: 'section'; title: string };

interface OldDraft {
  /** Where it was read from: the file's name, or "pasted rows". */
  source: string;
  oldNumber: string;
  date: string;
  clientName: string;
  clientContact: string;
  lines: Line[];
  issued: ProjectBilling['issued'];
  stage: InvoiceStage;
  /** Already collected, as typed in; suggested from the old invoice when absent. */
  paid?: number;
  /** This invoice's number. */
  number: string;
  edits: Record<string, RowEdit>;
  /** The deposit in percent, where changed from what the old invoice asked for. */
  depositPercent?: number;
  /** A client's message with items to add, and what in it wasn't recognised. */
  message?: string;
  unread?: string[];
}

const KEY = 'maxsen.quote.old-invoice.v1';

/** Where items added since the old invoice go. */
const ADDED = 'Additional items';

/** Lines added at the end of a section (made at the end of the invoice if it isn't there). */
function addToSection(lines: Line[], title: string, items: Line[]): Line[] {
  const at = lines.findIndex(
    (l) => l.kind === 'section' && l.title.toLowerCase() === title.toLowerCase(),
  );
  if (at < 0) return [...lines, { id: newId('room'), kind: 'section', title }, ...items];
  let end = at + 1;
  while (end < lines.length && lines[end]!.kind !== 'section') end++;
  return [...lines.slice(0, end), ...items, ...lines.slice(end)];
}

function load(): OldDraft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OldDraft) : null;
  } catch {
    return null;
  }
}

/** The cells of an invoice spreadsheet's first sheet, as text and numbers (formulas as results). */
async function readSheet(file: File): Promise<Cell[][]> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const grid: Cell[][] = [];
  for (let r = 1; r <= ws.rowCount; r++) {
    const row: Cell[] = [];
    for (let c = 1; c <= Math.min(ws.columnCount, 12); c++) {
      const v = ws.getCell(r, c).value as unknown;
      row.push(cellValue(v));
    }
    grid.push(row);
  }
  return grid;
}

function cellValue(v: unknown): Cell {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number' || typeof v === 'string') return v;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'object') {
    const o = v as { result?: unknown; richText?: { text: string }[]; text?: string };
    if ('result' in o) return cellValue(o.result);
    if (o.richText) return o.richText.map((t) => t.text).join('');
    if (typeof o.text === 'string') return o.text;
    return null;
  }
  return typeof v === 'boolean' ? String(v) : null;
}

/** Rows pasted from a spreadsheet (tab-separated) or typed one per line. */
const pastedGrid = (text: string): Cell[][] =>
  text
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => (l.includes('\t') ? l.split('\t') : l.split(/\s{2,}|,(?=\s*\d)/)));

/**
 * An old invoice read back in, to collect the next payment: its lines exactly as invoiced
 * (quantities and unit prices, editable like a quick quote), what it asked for already, and the
 * 2nd or final payment worked out from that.
 */
export function OldInvoiceSection() {
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const [draft, setDraft] = useState<OldDraft | null>(load);
  // The deposit the old invoice asked for, as a percentage, so the 2nd and final payments follow
  // its terms rather than today's usual deposit.
  const asked = draft?.issued?.deposit;
  const askedPercent =
    asked && asked.total > 0
      ? Math.round((asked.due / asked.total) * 100)
      : resolvePricing(settings).depositPercent;
  const plan = withDeposit(resolvePricing(settings), draft?.depositPercent ?? askedPercent);
  // Paid in full: the whole total at once. The final and full payments print their own terms.
  const full = draft?.stage === 'full';
  const pricing = draft ? forStage(plan, draft.stage) : plan;
  const quoteCatalogue = useQuoteCatalogue();
  const [addingWorks, setAddingWorks] = useState(false);
  const [pasted, setPasted] = useState('');
  /** What's happening while a scanned PDF is read, which takes a few seconds a page. */
  const [reading, setReading] = useState<string | null>(null);
  const [making, setMaking] = useState<'pdf' | 'xlsx' | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    try {
      if (draft) window.localStorage.setItem(KEY, JSON.stringify(draft));
      else window.localStorage.removeItem(KEY);
    } catch {
      // Private mode or full storage: it just isn't kept across reloads.
    }
  }, [draft]);
  const set = (patch: Partial<OldDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  const open = (grid: Cell[][], source: string) => {
    const old = parseOldInvoice(grid);
    const items = old.rows.filter((r) => r.kind === 'item');
    if (!items.length) {
      toast({
        title: 'No invoice lines found',
        body: 'It needs columns for the description, quantity and unit price.',
        tone: 'danger',
      });
      return;
    }
    const issued = issuedFromOld(old);
    const stage: InvoiceStage = issued.second ? 'final' : 'second';
    setDraft({
      source,
      oldNumber: old.number,
      date: old.date,
      clientName: old.client.name,
      clientContact: old.client.contact,
      lines: old.rows.map((r) => ({ id: newId('room'), ...r })),
      issued,
      stage,
      number: invoiceNumber(pricing.invoicePrefix, new Date(), INVOICE_STAGES.indexOf(stage) + 1),
      edits: {},
    });
    toast({
      title: `Read ${items.length} lines`,
      body: issued.second
        ? 'It was a 2nd payment invoice, so this one is for the final payment.'
        : issued.deposit
          ? 'It asked for the deposit, so this one is for the 2nd payment.'
          : 'Choose which payment this invoice is for.',
    });
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
        const text = await readPdfText(file);
        if (text.length) open(pdfInvoiceGrid(text), file.name);
        else {
          // No text in it (a scan, or letters drawn as shapes): read the words off the pages.
          setReading('Reading the scanned invoice…');
          const { texts, rules } = await ocrPdf(file, setReading);
          open(pdfInvoiceGrid(texts, rules), file.name);
        }
      } else open(await readSheet(file), file.name);
    } catch (e) {
      console.error(e);
      toast({
        title: 'That file couldn’t be read',
        body: 'Use the invoice’s PDF or Excel file (.xlsx), or paste its rows instead.',
        tone: 'danger',
      });
    } finally {
      setReading(null);
    }
  };

  if (!draft) {
    return (
      <div className="grid max-w-[900px] grid-cols-2 gap-8 max-[800px]:grid-cols-1">
        <section aria-label="Open an old invoice" className="flex flex-col gap-3">
          <h2 className="border-b border-rule pb-1.5 text-section text-ink">Open an old invoice</h2>
          <p className="text-control text-ink-2">
            Choose the invoice’s PDF or Excel file. Every line is read as it was invoiced, with its
            quantity and unit price, along with the deposit or payment it asked for. Check the lines
            after reading a PDF.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".pdf,application/pdf,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Old invoice file"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            variant="primary"
            icon={<FileUp className="size-4" />}
            loading={reading !== null}
            onClick={() => fileInput.current?.click()}
          >
            Choose invoice (PDF or Excel)
          </Button>
          {reading && (
            <p role="status" className="text-meta text-ink-2">
              {reading} Scanned pages take a few seconds each.
            </p>
          )}
        </section>
        <section aria-label="Paste invoice lines" className="flex flex-col gap-3">
          <h2 className="border-b border-rule pb-1.5 text-section text-ink">Or paste its lines</h2>
          <Field
            label="Invoice lines"
            hint="Copy the rows from the spreadsheet (description, quantity, unit price) and paste them here."
          >
            <Textarea
              rows={7}
              value={pasted}
              placeholder={'Nova Package\t1\t1990\nSmart Curtain Track, Single\t2\t380'}
              onChange={(e) => setPasted(e.target.value)}
            />
          </Field>
          <Button
            disabled={!pasted.trim()}
            onClick={() => open(pastedGrid(pasted), 'pasted lines')}
          >
            Read lines
          </Button>
        </section>
      </div>
    );
  }

  // The invoice as it was, then with any price changes and discounts.
  const rows: InvoiceRow[] = [
    ...draft.lines.map((l): InvoiceRow =>
      l.kind === 'section'
        ? { kind: 'section', title: l.title }
        : {
            kind: 'item',
            key: l.id,
            description: l.description,
            quantity: l.quantity,
            unitPrice: l.unitPrice,
            ...(/package/i.test(l.description.split('\n')[0] ?? '') &&
            !/add[- ]?on/i.test(l.description)
              ? { highlight: true }
              : {}),
          },
    ),
    { kind: 'note', text: pricing.warranty, tone: 'warranty' },
  ];
  const total = rows.reduce(
    (s, r) => (r.kind === 'item' ? s + r.quantity * (r.unitPrice ?? 0) : s),
    0,
  );
  const base: Invoice = {
    rows,
    total: Math.round(total * 100) / 100,
    deposit: Math.round(total * pricing.depositPercent) / 100,
    packages: { switches: 0, lights: 0, led: 0 },
    unpriced: [],
  };
  const invoice = applyRowEdits(base, draft.edits, pricing.depositPercent);
  const billing: ProjectBilling = {
    stage: draft.stage,
    issued: draft.issued,
    ...(draft.paid !== undefined ? { paid: { [draft.stage]: draft.paid } } : {}),
  };
  const amounts = stageAmounts(invoice.total, pricing, billing);
  const client = { name: draft.clientName, contact: draft.clientContact };
  const updateLine = (id: string, patch: Partial<Extract<Line, { kind: 'item' }>>) =>
    set({
      lines: draft.lines.map((l) => (l.id === id && l.kind === 'item' ? { ...l, ...patch } : l)),
    });
  /** Items picked from the catalogue (or read from a message), priced as on a new quote. */
  const addItems = (picked: QuoteLine[]) => {
    const priced = buildInvoice(
      quoteCatalogue.invoiceInputs(picked),
      quoteCatalogue.priceOf,
      pricing,
    );
    const added = priced.rows.flatMap((r): Line[] =>
      r.kind === 'item'
        ? [
            {
              id: newId('room'),
              kind: 'item',
              description: r.description,
              quantity: r.quantity,
              unitPrice: r.unitPrice ?? 0,
            },
          ]
        : [],
    );
    if (!added.length) return 0;
    setDraft((d) => (d ? { ...d, lines: addToSection(d.lines, ADDED, added) } : d));
    if (priced.unpriced.length)
      toast({
        title: `No price yet for ${priced.unpriced.join(', ')}`,
        body: 'Type its unit price in the invoice lines, or set it in Catalogue.',
        tone: 'danger',
      });
    return added.length;
  };
  const addExtras = (extras: ExtraLine[], title: string) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            lines: addToSection(
              d.lines,
              title,
              extras.map((l) => ({
                id: newId('room'),
                kind: 'item' as const,
                description: l.description,
                quantity: l.quantity,
                unitPrice: l.unitPrice,
              })),
            ),
          }
        : d,
    );
  const readMessage = () => {
    const { lines, unread } = quoteCatalogue.readMessage(draft.message ?? '', pricing);
    const n = addItems(lines);
    set({ unread, ...(n ? { message: '' } : {}) });
    toast({
      title: n ? `Added ${n} ${n === 1 ? 'line' : 'lines'}` : 'No products found in the message',
      body: n ? `Under “${ADDED}”, priced as on a new quote.` : undefined,
    });
  };

  const download = async (kind: 'pdf' | 'xlsx') => {
    setMaking(kind);
    try {
      const blob =
        kind === 'pdf'
          ? await buildQuotationPdf({
              client,
              invoice,
              pricing,
              number: draft.number,
              settings,
              payment: amounts,
            })
          : await buildInvoiceXlsx({
              client,
              invoice,
              pricing,
              number: draft.number,
              payment: amounts,
            });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Invoice ${draft.number} - ${STAGE_LABEL[draft.stage]}${client.name ? ` - ${client.name}` : ''}.${kind}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      console.error(e);
      toast({ title: 'The invoice couldn’t be made', tone: 'danger' });
    } finally {
      setMaking(null);
    }
  };
  const copy = async () => {
    try {
      await copyText(
        quotationText({
          invoice,
          pricing,
          number: draft.number,
          clientName: client.name,
          payment: amounts,
        }),
      );
      toast({ title: 'Invoice copied', body: 'Paste it into WhatsApp or an email.' });
    } catch {
      toast({
        title: 'Couldn’t copy',
        body: 'Your browser blocked the clipboard.',
        tone: 'danger',
      });
    }
  };

  return (
    <div className="grid grid-cols-[minmax(0,4fr)_minmax(0,8fr)] gap-8 max-[1100px]:grid-cols-1">
      <section aria-label="Old invoice details" className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-2 border-b border-rule pb-1.5">
          <h2 className="text-section text-ink">Old invoice</h2>
          <Button size="sm" variant="ghost" onClick={() => setDraft(null)}>
            Open another
          </Button>
        </div>
        <p className="text-meta text-ink-2">
          Read from {draft.source}
          {draft.oldNumber ? `: invoice ${draft.oldNumber}` : ''}
          {draft.date ? `, ${draft.date}` : ''}.
          {draft.issued?.second
            ? ` It asked for the 2nd payment of ${money(draft.issued.second.due)} after ${money(draft.issued.deposit?.due ?? 0)} paid.`
            : draft.issued?.deposit
              ? ` It asked for a deposit of ${money(draft.issued.deposit.due)}.`
              : ''}
        </p>
        <Field
          label="Items to add (client’s message)"
          hint="Anything added since, as the client wrote it. It’s priced as on a new quote."
        >
          <Textarea
            rows={3}
            value={draft.message ?? ''}
            placeholder={'e.g. add 2 more switches\n10m LED strip for the living room'}
            onChange={(e) => set({ message: e.target.value })}
          />
        </Field>
        <Button
          icon={<Sparkles className="size-4" />}
          disabled={!draft.message?.trim()}
          onClick={readMessage}
        >
          Add from message
        </Button>
        {(draft.unread?.length ?? 0) > 0 && (
          <div
            role="alert"
            className="flex gap-2 border-l-[3px] border-warn bg-warn-tint px-3 py-2 text-control text-ink"
          >
            <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <div>
              <p className="font-semibold">Not recognised, add these by hand if needed:</p>
              <ul className="mt-1 list-disc pl-4">
                {draft.unread!.map((u) => (
                  <li key={u}>{u}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Client’s name">
            <Input value={draft.clientName} onChange={(e) => set({ clientName: e.target.value })} />
          </Field>
          <Field label="Contact number">
            <Input
              type="tel"
              value={draft.clientContact}
              onChange={(e) => set({ clientContact: e.target.value })}
            />
          </Field>
          <Field label="Invoice number" className="col-span-2">
            <Input value={draft.number} onChange={(e) => set({ number: e.target.value })} />
          </Field>
        </div>
        <Field label="This invoice is for">
          <SegmentedControl<InvoiceStage>
            size="sm"
            label="This invoice is for"
            value={draft.stage}
            onChange={(stage) =>
              set({
                stage,
                paid: undefined,
                number: invoiceNumber(
                  pricing.invoicePrefix,
                  new Date(),
                  INVOICE_STAGES.indexOf(stage) + 1,
                ),
              })
            }
            options={[
              { value: 'deposit', label: 'Deposit' },
              { value: 'second', label: '2nd payment' },
              { value: 'final', label: 'Final' },
              { value: 'full', label: 'Full payment' },
            ]}
          />
        </Field>
        {!full && (
          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Deposit (%)"
              hint={
                draft.depositPercent === undefined
                  ? 'As the old invoice asked; the terms follow it.'
                  : 'Changed; the terms follow it.'
              }
            >
              <NumberField
                compact
                live
                min={0}
                max={100}
                precision={2}
                value={plan.depositPercent}
                aria-label="Deposit (%)"
                onChange={(v) =>
                  set({ depositPercent: v === null || v === askedPercent ? undefined : v })
                }
              />
            </Field>
            {draft.stage !== 'deposit' && (
              <Field label="Already paid (S$)">
                <NumberField
                  compact
                  live
                  min={0}
                  precision={2}
                  value={amounts.paid}
                  aria-label="Already paid (S$)"
                  onChange={(v) => set({ paid: v ?? 0 })}
                />
              </Field>
            )}
          </div>
        )}
        {draft.stage !== 'deposit' && !full && (
          <p className="-mt-2 text-meta text-ink-2">
            Suggested {money(amounts.suggestedPaid)} ({amounts.suggestedFrom}).{' '}
            {draft.paid !== undefined && (
              <button
                type="button"
                className="font-medium text-ink underline"
                onClick={() => set({ paid: undefined })}
              >
                Use suggested
              </button>
            )}
          </p>
        )}
        <div className="border-l-[3px] border-brass bg-brass-tint px-3 py-2.5">
          <p className="text-meta text-ink-2">{STAGE_LABEL[draft.stage]} due</p>
          <p className="tnum text-title text-ink" data-testid="old-invoice-due">
            {money(amounts.due)}
          </p>
          <p className="text-meta text-ink-2">
            {draft.stage === 'deposit'
              ? `${amounts.percent}% of ${money(invoice.total)}`
              : draft.stage === 'second'
                ? `${amounts.percent}% of ${money(invoice.total)}, less ${money(amounts.paid)} paid`
                : full
                  ? `The whole of ${money(invoice.total)}`
                  : `Balance of ${money(invoice.total)}, less ${money(amounts.paid)} paid`}
          </p>
        </div>
      </section>

      <div className="flex min-w-0 flex-col gap-6">
        <section aria-label="Add items" className="flex flex-col gap-2">
          <h2 className="border-b border-rule pb-1.5 text-section text-ink">Add items</h2>
          <Select
            compact
            aria-label="Add an item"
            value=""
            placeholder="+ Add an item…"
            options={quoteCatalogue.options}
            onChange={(variantId) =>
              addItems([
                { variantId, quantity: 1, unit: quoteCatalogue.unitOf(variantId), source: '' },
              ])
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
            onAdd={(added) => addExtras(added, 'Electrical works')}
          />
          <CustomItemForm onAdd={(line) => addExtras([line], ADDED)} />
        </section>

        <section aria-label="Invoice lines" className="flex min-w-0 flex-col gap-3">
          <h2 className="border-b border-rule pb-1.5 text-section text-ink">Invoice lines</h2>
          <p className="text-meta text-ink-2">
            As invoiced, with anything added since. Change any line’s wording, quantity or unit
            price, give a discount (S$ or %), or take it off; the total and the payment due follow.
          </p>
          <QuotationTable
            base={base}
            invoice={invoice}
            edits={draft.edits}
            onEdit={(key, patch) => set({ edits: withRowEdit(draft.edits, key, patch) })}
            onQuantity={(key, quantity) => updateLine(key, { quantity })}
            onRemove={(key) => set({ lines: draft.lines.filter((l) => l.id !== key) })}
            renamable={() => true}
            onDescription={(key, description) => updateLine(key, { description })}
            depositPercent={pricing.depositPercent}
            showDeposit={draft.stage === 'deposit'}
            footer={
              draft.stage !== 'deposit' && (
                <>
                  {!full && (
                    <tr>
                      <td colSpan={4} className="py-1 text-right text-ink-2">
                        Already paid
                      </td>
                      <td className="tnum py-1 text-right text-ink-2">{money(-amounts.paid)}</td>
                    </tr>
                  )}
                  <tr>
                    <td colSpan={4} className="py-1 text-right font-semibold text-ink">
                      {STAGE_LABEL[draft.stage]} due
                    </td>
                    <td className="tnum py-1 text-right text-body font-semibold text-ink">
                      {money(amounts.due)}
                    </td>
                  </tr>
                </>
              )
            }
          />
          {draft.lines.length === 0 && (
            <p className="flex items-center gap-2 text-meta text-warn">
              <TriangleAlert aria-hidden className="size-4" />
              No lines left on this invoice.
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
              Download invoice (Excel)
            </Button>
            <Button
              variant="primary"
              icon={<Download className="size-4" />}
              loading={making === 'pdf'}
              onClick={() => void download('pdf')}
            >
              Download invoice (PDF)
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
