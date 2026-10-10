import { useState, type ReactNode } from 'react';
import { CATEGORIES, PROJECT_STATUSES } from '@maxsen/domain';
import { FolderOpen, MoreHorizontal, Plus, Search, Trash2, ZoomIn } from 'lucide-react';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import {
  Badge,
  Button,
  Checkbox,
  ColorSwatch,
  ConfirmDialog,
  Dialog,
  DropdownMenu,
  EmptyState,
  Field,
  IconButton,
  Input,
  Kbd,
  LATER_PHASE,
  NumberField,
  PageHeader,
  Popover,
  SectionTitle,
  SegmentedControl,
  Select,
  Skeleton,
  StatusBadge,
  Switch,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Tr,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  useToast,
} from '@/components/ui';

const PALETTE = [
  'paper',
  'surface',
  'desk',
  'ink',
  'ink-2',
  'ink-3',
  'rule',
  'rule-2',
  'brass',
  'brass-2',
  'brass-tint',
  'warn',
  'warn-tint',
  'danger',
  'danger-tint',
  'ok',
] as const;

const TYPE_SCALE = [
  ['display', 'text-display', 'Marked floor plan'],
  ['title', 'text-title', 'Lim Family Home — Serangoon Gardens'],
  ['section', 'text-section', 'Smart Home Products'],
  ['body', 'text-body', 'Adjustments change export quantities only. Plans are never modified.'],
  ['control', 'text-control', 'Search by title, customer or address'],
  ['meta', 'text-meta', 'Updated 29 Sep 2026, 16:42'],
  ['caption', 'text-caption', 'Auto-added'],
] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-rule py-6">
      <SectionTitle className="mb-4">{title}</SectionTitle>
      {children}
    </section>
  );
}

export function StyleguideScreen() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [plan, setPlan] = useState<'smart-home' | 'lighting'>('smart-home');
  const [paper, setPaper] = useState<'A4' | 'A3'>('A3');
  const [on, setOn] = useState(true);
  const [checked, setChecked] = useState(true);
  const [qty, setQty] = useState<number | null>(12);
  const [metres, setMetres] = useState<number | null>(4.5);
  const [type, setType] = useState('Landed');

  return (
    <div data-screen-ready className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)] py-8">
      <PageHeader
        title="Styleguide"
        description="Every primitive in every state, the type scale, the palette and all eighteen category glyphs. Development only."
      />

      <Section title="Palette">
        <div className="grid grid-cols-4 gap-x-6 gap-y-3 sm:grid-cols-8">
          {PALETTE.map((name) => (
            <div key={name} className="flex flex-col gap-1.5">
              <span
                className="h-10 rounded-control border border-rule"
                style={{ background: `var(--${name})` }}
              />
              <span className="text-meta text-ink-2">--{name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Type">
        <dl className="flex flex-col gap-3">
          {TYPE_SCALE.map(([name, cls, sample]) => (
            <div key={name} className="grid grid-cols-[96px_1fr] items-baseline gap-4">
              <dt className="text-meta text-ink-3">{name}</dt>
              <dd className={cls}>{sample}</dd>
            </div>
          ))}
          <div className="grid grid-cols-[96px_1fr] items-baseline gap-4">
            <dt className="text-meta text-ink-3">tabular</dt>
            <dd className="tnum text-body">1,234 pcs, 4.5 m, 17.0 m, 0 m</dd>
          </div>
        </dl>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-col gap-4">
          {(['primary', 'secondary', 'ghost', 'danger'] as const).map((v) => (
            <div key={v} className="flex flex-wrap items-center gap-3">
              <span className="w-20 text-meta text-ink-3">{v}</span>
              <Button variant={v}>Create project</Button>
              <Button variant={v} size="sm">
                Small
              </Button>
              <Button variant={v} icon={<Plus className="size-4" />}>
                With icon
              </Button>
              <Button variant={v} loading>
                Saving
              </Button>
              <Button variant={v} disabledReason={LATER_PHASE}>
                Deferred
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-20 text-meta text-ink-3">icon</span>
            <IconButton label="Zoom in" icon={<ZoomIn />} />
            <IconButton label="Open" icon={<FolderOpen />} variant="secondary" />
            <IconButton label="Selected" icon={<Search />} active />
            <IconButton label="Delete" icon={<Trash2 />} disabledReason={LATER_PHASE} />
          </div>
        </div>
      </Section>

      <Section title="Form controls">
        <div className="grid max-w-3xl grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Project title" hint="Used for every export filename">
            <Input defaultValue="Tan Residence — Tampines 4-room" />
          </Field>
          <Field label="Project title" error="Enter a project title">
            <Input defaultValue="" placeholder="e.g. Lim Family Home" />
          </Field>
          <Field label="Search">
            <Input leading={<Search />} placeholder="Search by title, customer or address" />
          </Field>
          <Field label="Disabled">
            <Input disabled defaultValue="Locked background" />
          </Field>
          <Field label="Property type" optional>
            <Select
              value={type}
              onChange={setType}
              options={['HDB', 'Condo', 'Landed', 'Commercial', 'Other'].map((v) => ({
                value: v,
                label: v,
              }))}
            />
          </Field>
          <Field label="Contact page wording">
            <Textarea defaultValue="Thank you for planning your home with Maxsen." />
          </Field>
          <Field label="Export quantity">
            <NumberField value={qty} onChange={setQty} min={0} />
          </Field>
          <Field label="LED length">
            <NumberField
              value={metres}
              onChange={setMetres}
              min={0}
              precision={1}
              unit="m"
              allowEmpty
            />
          </Field>
          <Field label="Head count">
            <NumberField value={3} min={1} stepper />
          </Field>
        </div>
      </Section>

      <Section title="Choices">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <SegmentedControl
              label="Plan type"
              value={plan}
              onChange={setPlan}
              options={[
                { value: 'smart-home', label: 'Smart Home' },
                { value: 'lighting', label: 'Lighting' },
              ]}
            />
            <SegmentedControl
              label="Paper size"
              size="sm"
              value={paper}
              onChange={setPaper}
              options={[
                { value: 'A4', label: 'A4' },
                { value: 'A3', label: 'A3' },
              ]}
            />
          </div>
          <div className="flex max-w-sm flex-col gap-3">
            <Switch checked={on} onCheckedChange={setOn} label="Show device labels" />
            <Switch checked={false} label="Disabled switch" disabled />
            <Checkbox checked={checked} onCheckedChange={setChecked} label="Smart Switches" />
            <Checkbox checked="indeterminate" label="Lighting (some selected)" />
          </div>
          <Tabs defaultValue="a">
            <TabsList label="Example tabs">
              <TabsTrigger value="a">Branding</TabsTrigger>
              <TabsTrigger value="b">Icon styles</TabsTrigger>
              <TabsTrigger value="c">Favourites</TabsTrigger>
            </TabsList>
            <TabsContent value="a" className="pt-3 text-body text-ink-2">
              Tab content
            </TabsContent>
          </Tabs>
        </div>
      </Section>

      <Section title="Status and badges">
        <div className="flex flex-wrap items-center gap-4">
          {PROJECT_STATUSES.map((s) => (
            <StatusBadge key={s} status={s} />
          ))}
          <Badge>Hidden</Badge>
          <Badge tone="brass">Auto-added</Badge>
          <Badge tone="warn">Changed</Badge>
          <Badge tone="danger">Error</Badge>
          <Badge tone="ok">Saved</Badge>
          <Kbd>⌘</Kbd>
          <Kbd>Z</Kbd>
          <ColorSwatch color="#2F5FB3" />
        </div>
      </Section>

      <Section title="Table">
        <Table>
          <THead>
            <tr>
              <Th>Category</Th>
              <Th>Product</Th>
              <Th>Variant</Th>
              <Th numeric>Quantity</Th>
            </tr>
          </THead>
          <TBody>
            <Tr>
              <Td>Smart Switches</Td>
              <Td>Nova+ Pro</Td>
              <Td>2-gang, Black</Td>
              <Td numeric>3</Td>
            </Tr>
            <Tr>
              <Td>LED Strips</Td>
              <Td>Lumi Cove Strip</Td>
              <Td>3000K</Td>
              <Td numeric>17.4 m</Td>
            </Tr>
          </TBody>
        </Table>
      </Section>

      <Section title="Overlays">
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            Delete plan
          </Button>
          <Popover trigger={<Button>Popover</Button>} label="Example popover">
            <p className="w-56 text-control text-ink-2">
              Popover content sits on a surface with the float shadow.
            </p>
          </Popover>
          <DropdownMenu
            trigger={
              <IconButton label="More actions" icon={<MoreHorizontal />} variant="secondary" />
            }
            items={[
              { label: 'Rename', onSelect: () => {} },
              { label: 'Save as template', disabledReason: LATER_PHASE },
              'separator',
              { label: 'Delete project', destructive: true, icon: <Trash2 />, onSelect: () => {} },
            ]}
          />
          <Button
            onClick={() => toast({ title: 'Project saved', body: 'All changes are stored.' })}
          >
            Show toast
          </Button>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Project details"
          description="These appear on the cover of each export."
          footer={
            <>
              <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
              <Button variant="primary" onClick={() => setDialogOpen(false)}>
                Save details
              </Button>
            </>
          }
        >
          <Field label="Customer name">
            <Input defaultValue="Mr & Mrs Tan" />
          </Field>
        </Dialog>
        <ConfirmDialog
          open={confirmOpen}
          title="Delete the Lighting Plan for Level 1?"
          body="Its background and every element on it are removed. You can add the plan again later with a new drawing."
          confirmLabel="Delete plan"
          destructive
          onConfirm={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </Section>

      <Section title="Empty and loading">
        <EmptyState
          icon={<FolderOpen />}
          title="No projects yet"
          body="Create your first project to start planning."
          action={<Button variant="primary">New project</Button>}
        />
        <div className="mt-6 flex flex-col gap-3">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
      </Section>

      <Section title="Category glyphs">
        <div className="grid grid-cols-1 gap-x-8 sm:grid-cols-2">
          {CATEGORIES.map((c) => (
            <div key={c.id} className="flex items-center gap-4 border-b border-rule py-2">
              <span className="flex items-center gap-3">
                <CategoryGlyph categoryId={c.id} size={16} />
                <CategoryGlyph categoryId={c.id} size={24} />
                <CategoryGlyph categoryId={c.id} size={32} />
              </span>
              <span className="text-control text-ink">{c.name}</span>
              <span className="ml-auto text-meta text-ink-3">
                {c.planType === 'smart-home' ? 'Smart Home' : 'Lighting'}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}
