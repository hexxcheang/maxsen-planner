import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CloudOff,
  Lock,
  PackageMinus,
  PackagePlus,
  Search,
  SlidersHorizontal,
  Trash2,
  TriangleAlert,
} from 'lucide-react';
import {
  checkouts,
  discrepancies,
  MOVEMENT_LABEL,
  stockLevels,
  type Movement,
  type MovementKind,
  type MovementLine,
} from '@maxsen/domain';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  Input,
  NumberField,
  PageHeader,
  SegmentedControl,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { useAdmin } from '@/app/auth/useAdmin';
import { useProjects } from '@/lib/data/hooks';
import { formatDateTime } from '@/lib/format';
import { savedByName, setSavedByName } from '@/lib/shared/api';
import { useEnsureName } from '@/lib/shared/useEnsureName';
import { cn } from '@/lib/cn';
import { ItemsEditor } from './ItemsEditor';
import {
  InventoryError,
  recordMovement,
  removeMovement,
  saveMinimums,
  useInventory,
  verifyMovement,
} from './inventory-api';

type View = 'stock' | 'out' | 'checks' | 'history';

const summary = (lines: MovementLine[]) => lines.map((l) => `${l.name} × ${l.qty}`).join(', ');

/**
 * Inventory: installers take items out for each site (and return what's unused); the inventory
 * manager checks each site's take-out, restocks and corrects counts. Shared by everyone.
 */
export function InventoryScreen() {
  const { data, state, refresh } = useInventory();
  const { unlocked, requireAdmin } = useAdmin();
  const { toast } = useToast();
  const [view, setView] = useState<View>('stock');
  const [dialog, setDialog] = useState<'restock' | 'adjust' | null>(null);
  const { ensureName, dialog: nameDialog } = useEnsureName();
  const levels = useMemo(() => stockLevels(data), [data]);
  const stockOf = useMemo(() => new Map(levels.map((l) => [l.variantId, l.inStock])), [levels]);
  const pendingChecks = data.movements.filter((m) => m.kind === 'checkout' && !m.verified).length;

  /** Runs a change, asking the manager to unlock first when it needs them. */
  const run = async <T,>(
    work: () => Promise<T>,
    manager = false,
    done?: string,
  ): Promise<T | undefined> => {
    if (manager && !(await requireAdmin('manage the inventory'))) return undefined;
    if (!(await ensureName())) return undefined;
    try {
      const out = await work();
      if (done) toast({ title: done });
      return out;
    } catch (e) {
      toast({
        title:
          e instanceof InventoryError && e.needsManager
            ? 'Unlock admin (inventory manager) to do this'
            : 'Not recorded',
        body: e instanceof Error ? e.message : undefined,
        tone: 'danger',
      });
      return undefined;
    } finally {
      void refresh();
    }
  };

  if (state === 'unavailable')
    return (
      <Page>
        <PageHeader title="Inventory" />
        <p className="flex items-center gap-2 border-t border-rule py-10 text-body text-ink-2">
          <CloudOff aria-hidden className="size-5" />
          Inventory is shared through the team server, which can’t be reached from here.
        </p>
      </Page>
    );

  return (
    <Page wide>
      <PageHeader
        title="Inventory"
        description="What’s in stock, what installers took out for each site, and what the inventory manager has checked. Shared by the whole team."
        actions={
          unlocked ? (
            <>
              <Button
                icon={<SlidersHorizontal className="size-4" />}
                onClick={() => setDialog('adjust')}
              >
                Count correction
              </Button>
              <Button
                variant="primary"
                icon={<PackagePlus className="size-4" />}
                onClick={() => setDialog('restock')}
              >
                Restock
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              icon={<Lock className="size-4" />}
              onClick={() => void requireAdmin('manage the inventory')}
            >
              Inventory manager
            </Button>
          )
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <SegmentedControl<View>
          label="Inventory view"
          value={view}
          onChange={setView}
          options={[
            { value: 'stock', label: 'Stock' },
            { value: 'out', label: 'Take out / return' },
            {
              value: 'checks',
              label: pendingChecks ? `Site checks (${pendingChecks})` : 'Site checks',
            },
            { value: 'history', label: 'History' },
          ]}
        />
        {state === 'offline' && (
          <span className="flex items-center gap-1.5 text-meta text-ink-2">
            <CloudOff aria-hidden className="size-4" />
            Offline: showing the last copy
          </span>
        )}
      </div>

      {view === 'stock' && (
        <StockView
          levels={levels}
          minimums={data.minimums}
          manager={unlocked}
          onMinimum={(variantId, min) =>
            void run(() => saveMinimums({ ...data.minimums, [variantId]: min }), true)
          }
        />
      )}
      {view === 'out' && (
        <TakeOutView
          stockOf={stockOf}
          onRecord={async (input) =>
            !!(await run(
              () => recordMovement(input),
              false,
              input.kind === 'checkout' ? 'Take-out recorded' : 'Return recorded',
            ))
          }
        />
      )}
      {view === 'checks' && (
        <ChecksView
          movements={checkouts(data)}
          manager={unlocked}
          onVerify={async (m, counts, note) =>
            !!(await run(() => verifyMovement(m.id, counts, note), true, `Checked: ${m.site}`))
          }
        />
      )}
      {view === 'history' && (
        <HistoryView
          movements={data.movements}
          manager={unlocked}
          onRemove={(m) => void run(() => removeMovement(m.id), true, 'Entry removed')}
        />
      )}

      {nameDialog}
      <MovementDialog
        kind={dialog}
        stockOf={stockOf}
        onClose={() => setDialog(null)}
        onSave={async (lines, note) => {
          const ok = await run(
            () => recordMovement({ kind: dialog!, lines, ...(note ? { note } : {}) }),
            true,
            dialog === 'restock' ? 'Restock added' : 'Count corrected',
          );
          if (ok) setDialog(null);
        }}
      />
    </Page>
  );
}

function StockView({
  levels,
  minimums,
  manager,
  onMinimum,
}: {
  levels: ReturnType<typeof stockLevels>;
  minimums: Record<string, number>;
  manager: boolean;
  onMinimum: (variantId: string, min: number) => void;
}) {
  const [search, setSearch] = useState('');
  const q = search.trim().toLowerCase();
  const shown = levels.filter((l) => !q || l.name.toLowerCase().includes(q));
  const low = levels.filter((l) => l.low).length;
  if (!levels.length)
    return (
      <p className="border-t border-rule py-10 text-body text-ink-2">
        Nothing in stock yet. The inventory manager adds stock with <strong>Restock</strong>.
      </p>
    );
  return (
    <section aria-label="Stock" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-72">
          <Input
            type="search"
            compact
            aria-label="Search stock"
            leading={<Search />}
            placeholder="Search products"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {low > 0 && (
          <span className="flex items-center gap-1.5 text-control text-warn">
            <TriangleAlert aria-hidden className="size-4" />
            {low} {low === 1 ? 'item is' : 'items are'} low on stock
          </span>
        )}
      </div>
      <table className="w-full text-control">
        <thead>
          <tr className="border-b-2 border-ink text-left text-meta text-ink-2">
            <th className="py-1.5 font-medium">Product</th>
            <th className="py-1.5 pl-3 text-right font-medium">In stock</th>
            <th className="py-1.5 pl-3 text-right font-medium">Out, not checked</th>
            <th className="py-1.5 pl-3 text-right font-medium">Low at</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((l) => (
            <tr key={l.variantId} className="border-b border-rule">
              <td className="py-1.5 text-ink">
                {l.name}
                {l.low && (
                  <span className="ml-2 rounded-chip bg-warn-tint px-1.5 py-0.5 text-caption font-semibold text-warn">
                    Low
                  </span>
                )}
              </td>
              <td
                data-testid={`stock-${l.variantId}`}
                className={cn(
                  'tnum py-1.5 pl-3 text-right font-semibold',
                  l.inStock < 0 ? 'text-danger' : l.low ? 'text-warn' : 'text-ink',
                )}
              >
                {l.inStock}
              </td>
              <td className="tnum py-1.5 pl-3 text-right text-ink-2">{l.pending || '—'}</td>
              <td className="py-1 pl-3">
                {manager ? (
                  <NumberField
                    compact
                    min={0}
                    max={100000}
                    className="ml-auto w-20"
                    aria-label={`Low-stock level for ${l.name}`}
                    value={minimums[l.variantId] ?? 0}
                    onChange={(v) => onMinimum(l.variantId, v ?? 0)}
                  />
                ) : (
                  <span className="tnum block text-right text-ink-3">
                    {minimums[l.variantId] || '—'}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function TakeOutView({
  stockOf,
  onRecord,
}: {
  stockOf: Map<string, number>;
  onRecord: (input: {
    kind: MovementKind;
    lines: MovementLine[];
    site: string;
    projectId?: string;
    note?: string;
  }) => Promise<boolean>;
}) {
  const { data: projects } = useProjects();
  const [kind, setKind] = useState<'checkout' | 'return'>('checkout');
  const [name, setName] = useState(savedByName());
  const [projectId, setProjectId] = useState('');
  const [site, setSite] = useState('');
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const ready = name.trim() && site.trim() && lines.some((l) => l.qty > 0);

  return (
    <section aria-label="Take out or return" className="flex max-w-3xl flex-col gap-4">
      <SegmentedControl<'checkout' | 'return'>
        label="Taking out or returning"
        value={kind}
        onChange={setKind}
        options={[
          { value: 'checkout', label: 'Take out for a site' },
          { value: 'return', label: 'Return unused' },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 max-[700px]:grid-cols-1">
        <Field label="Your name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Project (optional)">
          <Select
            value={projectId}
            placeholder="Choose a project"
            options={projects.map((p) => ({ value: p.id, label: p.title }))}
            onChange={(id) => {
              setProjectId(id);
              const p = projects.find((x) => x.id === id);
              if (p) setSite([p.title, p.propertyAddress].filter(Boolean).join(', '));
            }}
          />
        </Field>
        <Field label="Site" className="col-span-2 max-[700px]:col-span-1">
          <Input
            value={site}
            placeholder="e.g. Tan residence, Blk 452 Tampines St 42"
            onChange={(e) => setSite(e.target.value)}
          />
        </Field>
      </div>
      <div>
        <p className="mb-1 text-control font-medium text-ink">
          {kind === 'checkout' ? 'What you’re taking' : 'What you’re bringing back'}
        </p>
        <ItemsEditor
          lines={lines}
          onChange={setLines}
          hint={(id) => `${stockOf.get(id) ?? 0} in stock`}
        />
      </div>
      <Field label="Note (optional)">
        <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      <Button
        variant="primary"
        className="self-start"
        icon={<PackageMinus className="size-4" />}
        disabled={!ready}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          setSavedByName(name);
          const ok = await onRecord({
            kind,
            site: site.trim(),
            lines: lines.filter((l) => l.qty > 0),
            ...(projectId ? { projectId } : {}),
            ...(note.trim() ? { note: note.trim() } : {}),
          });
          setBusy(false);
          if (ok) {
            setLines([]);
            setNote('');
          }
        }}
      >
        {kind === 'checkout' ? 'Record take-out' : 'Record return'}
      </Button>
      <p className="text-meta text-ink-3">
        A take-out comes off stock at once, and waits for the inventory manager to check it for the
        site.
      </p>
    </section>
  );
}

function ChecksView({
  movements,
  manager,
  onVerify,
}: {
  movements: Movement[];
  manager: boolean;
  onVerify: (m: Movement, counts: Record<string, number>, note?: string) => Promise<boolean>;
}) {
  if (!movements.length)
    return <p className="border-t border-rule py-10 text-body text-ink-2">No take-outs yet.</p>;
  return (
    <section aria-label="Site checks" className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
      {movements.map((m) => (
        <CheckCard key={m.id} m={m} manager={manager} onVerify={onVerify} />
      ))}
    </section>
  );
}

function CheckCard({
  m,
  manager,
  onVerify,
}: {
  m: Movement;
  manager: boolean;
  onVerify: (m: Movement, counts: Record<string, number>, note?: string) => Promise<boolean>;
}) {
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(m.lines.map((l) => [l.variantId, m.verified?.counts[l.variantId] ?? l.qty])),
  );
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const diff = discrepancies(m);
  return (
    <article
      aria-label={`Take-out for ${m.site}`}
      className={cn(
        'flex flex-col gap-2 rounded-md border p-3',
        m.verified ? 'border-rule bg-surface/60' : 'border-brass bg-surface',
      )}
    >
      <header className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-control font-semibold text-ink">{m.site}</h3>
          <p className="text-meta text-ink-2">
            Taken out by {m.by}, {formatDateTime(m.at)}
          </p>
        </div>
        {m.verified ? (
          <span className="flex items-center gap-1 text-meta font-medium text-ok">
            <CheckCircle2 aria-hidden className="size-4" />
            Checked
          </span>
        ) : (
          <span className="rounded-chip bg-brass-tint px-1.5 py-0.5 text-caption font-semibold text-brass-2">
            To check
          </span>
        )}
      </header>
      <table className="w-full text-control">
        <thead>
          <tr className="text-left text-meta text-ink-2">
            <th className="py-1 font-medium">Item</th>
            <th className="py-1 pl-2 text-right font-medium">Written</th>
            <th className="py-1 pl-2 text-right font-medium">Counted</th>
          </tr>
        </thead>
        <tbody>
          {m.lines.map((l) => {
            const d = diff.get(l.variantId);
            return (
              <tr key={l.variantId} className="border-t border-rule">
                <td className="py-1 text-ink">{l.name}</td>
                <td className="tnum py-1 pl-2 text-right text-ink-2">{l.qty}</td>
                <td className="py-1 pl-2">
                  {manager && !m.verified ? (
                    <NumberField
                      compact
                      live
                      min={0}
                      max={100000}
                      className="ml-auto w-20"
                      aria-label={`Counted for ${m.site}: ${l.name}`}
                      value={counts[l.variantId] ?? l.qty}
                      onChange={(v) => setCounts((c) => ({ ...c, [l.variantId]: v ?? 0 }))}
                    />
                  ) : (
                    <span
                      className={cn(
                        'tnum block text-right',
                        d ? 'font-semibold text-warn' : 'text-ink',
                      )}
                    >
                      {m.verified ? (m.verified.counts[l.variantId] ?? l.qty) : '—'}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {m.note && <p className="text-meta text-ink-2">Note: {m.note}</p>}
      {m.verified ? (
        <p className="text-meta text-ink-2">
          Checked by {m.verified.by}, {formatDateTime(m.verified.at)}
          {diff.size > 0 &&
            `: ${diff.size} ${diff.size === 1 ? 'count differed' : 'counts differed'}`}
          {m.verified.note && ` · ${m.verified.note}`}
        </p>
      ) : manager ? (
        <div className="flex items-end gap-2">
          <Input
            compact
            aria-label={`Check note for ${m.site}`}
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button
            size="sm"
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              await onVerify(m, counts, note.trim() || undefined);
              setBusy(false);
            }}
          >
            Confirm count
          </Button>
        </div>
      ) : (
        <p className="text-meta text-ink-3">Waiting for the inventory manager to check.</p>
      )}
    </article>
  );
}

function HistoryView({
  movements,
  manager,
  onRemove,
}: {
  movements: Movement[];
  manager: boolean;
  onRemove: (m: Movement) => void;
}) {
  const [removing, setRemoving] = useState<Movement | null>(null);
  const sorted = [...movements].sort((a, b) => b.at.localeCompare(a.at));
  if (!sorted.length)
    return <p className="border-t border-rule py-10 text-body text-ink-2">Nothing recorded yet.</p>;
  return (
    <section aria-label="History">
      <table className="w-full text-control">
        <thead>
          <tr className="border-b-2 border-ink text-left text-meta text-ink-2">
            <th className="py-1.5 font-medium">When</th>
            <th className="py-1.5 pl-3 font-medium">What</th>
            <th className="py-1.5 pl-3 font-medium">Site</th>
            <th className="py-1.5 pl-3 font-medium">Items</th>
            <th className="py-1.5 pl-3 font-medium">By</th>
            {manager && <th />}
          </tr>
        </thead>
        <tbody>
          {sorted.map((m) => (
            <tr key={m.id} className="border-b border-rule align-top">
              <td className="py-1.5 whitespace-nowrap text-ink-2">{formatDateTime(m.at)}</td>
              <td className="py-1.5 pl-3 whitespace-nowrap text-ink">
                {MOVEMENT_LABEL[m.kind]}
                {m.kind === 'checkout' && (
                  <span className="block text-meta text-ink-3">
                    {m.verified ? `Checked by ${m.verified.by}` : 'Not checked yet'}
                  </span>
                )}
              </td>
              <td className="py-1.5 pl-3 text-ink-2">{m.site ?? '—'}</td>
              <td className="py-1.5 pl-3 text-ink">
                {summary(m.lines)}
                {m.note && <span className="block text-meta text-ink-3">{m.note}</span>}
              </td>
              <td className="py-1.5 pl-3 whitespace-nowrap text-ink-2">{m.by}</td>
              {manager && (
                <td className="py-1 pl-2">
                  <IconButton
                    size="sm"
                    label="Remove this entry"
                    icon={<Trash2 />}
                    onClick={() => setRemoving(m)}
                  />
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <ConfirmDialog
        open={removing !== null}
        title="Remove this entry?"
        body="For entries recorded by mistake: stock is worked out again without it."
        confirmLabel="Remove"
        destructive
        onCancel={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) onRemove(removing);
          setRemoving(null);
        }}
      />
    </section>
  );
}

function MovementDialog({
  kind,
  stockOf,
  onClose,
  onSave,
}: {
  kind: 'restock' | 'adjust' | null;
  stockOf: Map<string, number>;
  onClose: () => void;
  onSave: (lines: MovementLine[], note?: string) => Promise<void>;
}) {
  const [lines, setLines] = useState<MovementLine[]>([]);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const restock = kind === 'restock';
  const close = () => {
    setLines([]);
    setNote('');
    onClose();
  };
  return (
    <Dialog
      open={kind !== null}
      onOpenChange={(o) => !o && close()}
      width="md"
      title={restock ? 'Restock' : 'Count correction'}
      description={
        restock
          ? 'Stock that has arrived: add each product and how many came in.'
          : 'After a physical count: add each product that differs, with how many to add (or take off, with a minus).'
      }
      footer={
        <>
          <Button onClick={close}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            disabled={!lines.some((l) => l.qty !== 0)}
            onClick={async () => {
              setBusy(true);
              await onSave(
                lines.filter((l) => l.qty !== 0),
                note.trim() || undefined,
              );
              setBusy(false);
              setLines([]);
              setNote('');
            }}
          >
            {restock ? 'Add to stock' : 'Correct stock'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <ItemsEditor
          lines={lines}
          onChange={setLines}
          allowNegative={!restock}
          hint={(id) => `${stockOf.get(id) ?? 0} in stock now`}
        />
        <Field label={restock ? 'Supplier or reference (optional)' : 'Reason (optional)'}>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
