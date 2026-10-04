import { useEffect, useRef, useState } from 'react';
import { Copy, Download, FileUp, Plus, TriangleAlert } from 'lucide-react';
import {
  applyRowEdits,
  INVOICE_STAGES,
  invoiceNumber,
  issuedFromOld,
  newId,
  parseOldInvoice,
  resolvePricing,
  stageAmounts,
  STAGE_LABEL,
  type Cell,
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
  Textarea,
  useToast,
} from '@/components/ui';
import { useSettings } from '@/lib/data/hooks';
import { buildInvoiceXlsx } from '@/features/exports/build/invoice';
import { buildQuotationPdf } from '@/features/exports/build/generate';
import { QuotationTable } from './QuotationTable';
import { money, quotationText, withRowEdit } from './quotation';

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
}

const KEY = 'maxsen.quote.old-invoice.v1';

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
  const pricing = resolvePricing(settings);
  const [draft, setDraft] = useState<OldDraft | null>(load);
  const [pasted, setPasted] = useState('');
  const [making, setMaking] = useState<'pdf' | 'xlsx' | null>(null);
  const [adding, setAdding] = useState({ description: '', quantity: 1, unitPrice: 0 });
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
      open(await readSheet(file), file.name);
    } catch (e) {
      console.error(e);
      toast({
        title: 'That file couldn’t be read',
        body: 'Use the invoice’s Excel file (.xlsx), or paste its rows instead.',
        tone: 'danger',
      });
    }
  };

  if (!draft) {
    return (
      <div className="grid max-w-[900px] grid-cols-2 gap-8 max-[800px]:grid-cols-1">
        <section aria-label="Open an old invoice" className="flex flex-col gap-3">
          <h2 className="border-b border-rule pb-1.5 text-section text-ink">Open an old invoice</h2>
          <p className="text-control text-ink-2">
            Choose the invoice’s Excel file. Every line is read as it was invoiced, with its
            quantity and unit price, along with the deposit or payment it asked for.
          </p>
          <input
            ref={fileInput}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            aria-label="Old invoice file"
            className="sr-only"
            onChange={(e) => void onFile(e.target.files?.[0])}
          />
          <Button
            variant="primary"
            icon={<FileUp className="size-4" />}
            onClick={() => fileInput.current?.click()}
          >
            Choose invoice (.xlsx)
          </Button>
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
      await navigator.clipboard.writeText(
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
            ]}
          />
        </Field>
        <Field label="Invoice number">
          <Input value={draft.number} onChange={(e) => set({ number: e.target.value })} />
        </Field>
        {draft.stage !== 'deposit' && (
          <Field
            label="Already paid (S$)"
            hint={`Suggested ${money(amounts.suggestedPaid)} (${amounts.suggestedFrom}); change it to what was collected.`}
          >
            <div className="flex items-center gap-2">
              <NumberField
                compact
                live
                min={0}
                precision={2}
                value={amounts.paid}
                aria-label="Already paid (S$)"
                onChange={(v) => set({ paid: v ?? 0 })}
              />
              {draft.paid !== undefined && (
                <Button size="sm" variant="ghost" onClick={() => set({ paid: undefined })}>
                  Use suggested
                </Button>
              )}
            </div>
          </Field>
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
                : `Balance of ${money(invoice.total)}, less ${money(amounts.paid)} paid`}
          </p>
        </div>
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

      <section aria-label="Invoice lines" className="flex min-w-0 flex-col gap-3">
        <h2 className="border-b border-rule pb-1.5 text-section text-ink">Invoice lines</h2>
        <p className="text-meta text-ink-2">
          As invoiced. Change a quantity or unit price, or give a discount (S$ or %), for items
          added or changed since; the total and the payment due follow.
        </p>
        <QuotationTable
          base={base}
          invoice={invoice}
          edits={draft.edits}
          onEdit={(key, patch) => set({ edits: withRowEdit(draft.edits, key, patch) })}
          onQuantity={(key, quantity) => updateLine(key, { quantity })}
          onRemove={(key) => set({ lines: draft.lines.filter((l) => l.id !== key) })}
          depositPercent={pricing.depositPercent}
          showDeposit={draft.stage === 'deposit'}
          footer={
            draft.stage !== 'deposit' && (
              <>
                <tr>
                  <td colSpan={4} className="py-1 text-right text-ink-2">
                    Already paid
                  </td>
                  <td className="tnum py-1 text-right text-ink-2">{money(-amounts.paid)}</td>
                </tr>
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
        {/* Items added since the old invoice. */}
        <div className="grid grid-cols-[minmax(0,1fr)_90px_120px_auto] items-end gap-2">
          <Field label="Add a line">
            <Input
              compact
              placeholder="Description"
              value={adding.description}
              onChange={(e) => setAdding({ ...adding, description: e.target.value })}
            />
          </Field>
          <NumberField
            compact
            aria-label="New line quantity"
            min={0}
            precision={1}
            value={adding.quantity}
            onChange={(v) => setAdding({ ...adding, quantity: v ?? 0 })}
          />
          <NumberField
            compact
            aria-label="New line unit price (S$)"
            min={-100000}
            precision={2}
            unit="S$"
            value={adding.unitPrice}
            onChange={(v) => setAdding({ ...adding, unitPrice: v ?? 0 })}
          />
          <Button
            icon={<Plus className="size-4" />}
            disabled={!adding.description.trim()}
            onClick={() => {
              set({
                lines: [
                  ...draft.lines,
                  {
                    id: newId('room'),
                    kind: 'item',
                    ...adding,
                    description: adding.description.trim(),
                  },
                ],
              });
              setAdding({ description: '', quantity: 1, unitPrice: 0 });
            }}
          >
            Add
          </Button>
        </div>
        {draft.lines.length === 0 && (
          <p className="flex items-center gap-2 text-meta text-warn">
            <TriangleAlert aria-hidden className="size-4" />
            No lines left on this invoice.
          </p>
        )}
      </section>
    </div>
  );
}
