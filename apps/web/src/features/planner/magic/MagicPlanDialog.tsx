import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, FastForward, Sparkles, TriangleAlert } from 'lucide-react';
import {
  analysisFromLayout,
  withFoundRooms,
  categoryById,
  createVariantPicker,
  layoutFromAnalysis,
  magicPlan,
  MAGIC_CATEGORIES,
  resolveCategoryStyle,
  sample,
  type CategoryId,
  type FloorAnalysis,
  type Level,
  type MagicPlanResult,
  type Plan,
  type PlanType,
  type RoomLayout,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Button, Checkbox, Dialog, Switch } from '@/components/ui';
import { useActions, useCatalogue, useSettings } from '@/lib/data/hooks';
import { fileUrl } from '@/lib/files';
import { analyseBackground, magicPlanConfigured, MagicPlanError } from './analysis-source';
import { drawn, prepareRooms, roomsOnDrawing, startingLayout, windowAt } from './room-layouts';
import { RoomsStep } from './RoomsStep';

export interface MagicPlanOutcome {
  result: MagicPlanResult;
  categories: CategoryId[];
  replace: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: Level;
  plans: Partial<Record<PlanType, Plan>>;
  onApply: (outcome: MagicPlanOutcome) => void;
}

type Step =
  | { kind: 'rooms'; error?: string }
  | { kind: 'options' }
  | { kind: 'review'; analysis: FloorAnalysis; result: MagicPlanResult };

const PLAN_TITLES: Record<PlanType, string> = {
  'smart-home': 'Smart Home Plan',
  lighting: 'Lighting Plan',
};

export function MagicPlanDialog({ open, onOpenChange, level, plans, onApply }: Props) {
  const actions = useActions();
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const [selected, setSelected] = useState<Set<CategoryId>>(
    () => new Set(MAGIC_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id)),
  );
  const hasContent = Object.values(plans).some((p) => p && p.document.elements.length > 0);
  const [replace, setReplace] = useState(hasContent);
  const [step, setStep] = useState<Step>({ kind: 'rooms' });
  const [configured, setConfigured] = useState(false);
  const [suggesting, setSuggesting] = useState(false);

  // The drawing the rooms are outlined on: the Smart Home Plan's, else the Lighting Plan's.
  const source = plans['smart-home'] ?? plans.lighting;
  const aspect = source ? source.background.width / source.background.height : 1.4;
  const builtIn = source ? Boolean(sample.sampleAnalysisFor(source.background.fileId)) : false;
  const [layout, setLayout] = useState<RoomLayout | null>(null);
  useEffect(() => {
    if (!open || !source) return;
    setStep({ kind: 'rooms' });
    setReplace(hasContent);
    const start = startingLayout(source);
    setLayout(start);
    // Read the drawing's walls now, so tapping a room outlines it straight away.
    prepareRooms(fileUrl(source.background.fileId));
    if (!builtIn) void magicPlanConfigured().then(setConfigured);
    // Only when the window opens: later saves of the layout must not reset it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const changeLayout = (next: RoomLayout) => {
    setLayout(next);
    if (source) actions.setMagicLayout(source.id, next);
  };

  const suggest = async () => {
    if (!source || !layout) return;
    setSuggesting(true);
    try {
      const { analysis } = await analyseBackground(source.background.fileId, '');
      const next = layoutFromAnalysis(analysis, aspect);
      changeLayout({
        ...next,
        presetId: layout.presetId,
        floorAreaM2: analysis.imageWidthMetres ? next.floorAreaM2 : layout.floorAreaM2,
      });
      setStep({ kind: 'rooms' });
    } catch (e) {
      console.error(e);
      setStep({
        kind: 'rooms',
        error:
          e instanceof MagicPlanError
            ? e.message
            : 'Claude couldn’t suggest the rooms. Outline them yourself.',
      });
    } finally {
      setSuggesting(false);
    }
  };

  const available = (planType: PlanType) => Boolean(plans[planType]);
  const chosen = MAGIC_CATEGORIES.filter(
    (c) => selected.has(c.id) && available(categoryById(c.id).planType),
  ).map((c) => c.id);
  const toggle = (id: CategoryId, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  const pick = useMemo(
    () =>
      createVariantPicker({
        products: catalogue.products,
        variants: catalogue.variants,
        favouriteVariantIds: settings.favouriteVariantIds,
      }),
    [catalogue.products, catalogue.variants, settings.favouriteVariantIds],
  );

  const outlined = layout?.rooms.filter(drawn) ?? [];
  const [skipping, setSkipping] = useState(false);
  /** Skips outlining: every room on the drawing is found and planned by its size and shape. */
  const skipRooms = async () => {
    if (!source || !layout) return;
    setSkipping(true);
    try {
      const found = await roomsOnDrawing(fileUrl(source.background.fileId));
      if (!found.length) {
        setStep({
          kind: 'rooms',
          error: 'No closed rooms found on this drawing, so they need outlining by hand.',
        });
        return;
      }
      changeLayout(withFoundRooms(layout, found));
      setStep({ kind: 'options' });
    } catch {
      setStep({ kind: 'rooms', error: 'The drawing couldn’t be read. Outline the rooms by hand.' });
    } finally {
      setSkipping(false);
    }
  };
  const run = () => {
    if (!source || !layout) return;
    const analysis = analysisFromLayout(layout, aspect);
    const sheet = { width: 1000, height: 1000 / aspect };
    const result = magicPlan({ analysis, sheet, categories: chosen, pick });
    const skipped = layout.rooms.filter((r) => !drawn(r)).map((r) => r.name);
    if (skipped.length)
      result.warnings.unshift(`Not outlined, so not planned: ${skipped.join(', ')}.`);
    const noDoor = outlined.filter((r) => !r.door).map((r) => r.name);
    if (noDoor.length) {
      result.warnings.unshift(
        `No door marked for ${noDoor.join(', ')}, so the switch went on the wall nearest the entrance.`,
      );
    }
    setStep({ kind: 'review', analysis, result });
  };

  const footer =
    step.kind === 'rooms' ? (
      <>
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        {outlined.length === 0 && (
          <Button
            icon={<FastForward className="size-4" />}
            loading={skipping}
            onClick={() => void skipRooms()}
          >
            Skip: find rooms for me
          </Button>
        )}
        <Button
          variant="primary"
          icon={<ArrowRight className="size-4" />}
          disabledReason={outlined.length === 0 ? 'Outline at least one room first.' : undefined}
          onClick={() => setStep({ kind: 'options' })}
        >
          Next
        </Button>
      </>
    ) : step.kind === 'review' ? (
      <>
        <Button onClick={() => setStep({ kind: 'options' })}>Back</Button>
        <Button
          variant="primary"
          icon={<Sparkles className="size-4" />}
          disabled={step.result.placements.length === 0}
          onClick={() => {
            onApply({ result: step.result, categories: chosen, replace });
            onOpenChange(false);
          }}
        >
          Place {step.result.placements.length} items
        </Button>
      </>
    ) : (
      <>
        <Button onClick={() => setStep({ kind: 'rooms' })}>Back</Button>
        <Button
          variant="primary"
          icon={<Sparkles className="size-4" />}
          disabled={chosen.length === 0}
          onClick={run}
        >
          Create Magic Plan
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width={step.kind === 'rooms' ? 'xl' : 'lg'}
      title="Magic Plan"
      description={
        step.kind === 'rooms'
          ? `Step 1 of 2: outline the rooms on the ${level.name} drawing so Magic Plan knows what each one is.`
          : `Step 2 of 2: choose what to place. Everything stays editable afterwards.`
      }
      footer={footer}
    >
      {step.kind === 'rooms' && source && layout && (
        <div className="flex flex-col gap-3">
          {step.error && (
            <p
              role="alert"
              className="flex items-start gap-2 border-l-[3px] border-danger bg-danger-tint px-3 py-2 text-control text-ink"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
              {step.error}
            </p>
          )}
          <RoomsStep
            imageUrl={fileUrl(source.background.fileId)}
            aspect={aspect}
            layout={layout}
            onChange={changeLayout}
            onSuggest={!builtIn && configured ? () => void suggest() : undefined}
            readWindow={(x, y) => windowAt(fileUrl(source.background.fileId), x, y)}
            findRooms={() => roomsOnDrawing(fileUrl(source.background.fileId))}
            suggesting={suggesting}
          />
        </div>
      )}

      {step.kind === 'options' && (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-6 max-[700px]:grid-cols-1">
            {(['smart-home', 'lighting'] as const).map((pt) => {
              const cats = MAGIC_CATEGORIES.filter((c) => categoryById(c.id).planType === pt);
              const enabled = available(pt);
              const allOn = cats.every((c) => selected.has(c.id));
              return (
                <fieldset
                  key={pt}
                  aria-label={`${PLAN_TITLES[pt]} categories`}
                  disabled={!enabled}
                  className="min-w-0"
                >
                  <div className="mb-2 flex items-center justify-between border-b border-rule pb-1.5">
                    <legend className="text-control font-semibold text-ink">
                      {PLAN_TITLES[pt]}
                    </legend>
                    {enabled && (
                      <button
                        type="button"
                        className="text-meta text-brass-2 hover:underline"
                        onClick={() => cats.forEach((c) => toggle(c.id, !allOn))}
                      >
                        {allOn ? 'Clear all' : 'Select all'}
                      </button>
                    )}
                  </div>
                  {!enabled ? (
                    <p className="text-meta text-ink-2">
                      No {PLAN_TITLES[pt]} on {level.name}. Set one up in Setup to include these.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {cats.map((c) => (
                        <Checkbox
                          key={c.id}
                          checked={selected.has(c.id)}
                          onCheckedChange={(on) => toggle(c.id, on)}
                          label={
                            <span className="flex items-center gap-2">
                              <CategoryGlyph
                                categoryId={c.id}
                                style={resolveCategoryStyle(c.id, settings)}
                                size={14}
                                showBadge={false}
                              />
                              {categoryById(c.id).name}
                              {c.note && <span className="text-meta text-ink-3">{c.note}</span>}
                            </span>
                          }
                        />
                      ))}
                    </div>
                  )}
                </fieldset>
              );
            })}
          </div>
          <Switch
            checked={replace}
            onCheckedChange={setReplace}
            label="Replace what’s already planned in these categories"
            description={
              replace
                ? 'Existing devices of the ticked categories are removed first. Notes stay.'
                : 'New devices are added alongside what’s there.'
            }
          />
        </div>
      )}

      {step.kind === 'review' && <Review analysis={step.analysis} result={step.result} />}
    </Dialog>
  );
}

function Review({ analysis, result }: { analysis: FloorAnalysis; result: MagicPlanResult }) {
  const { data: settings } = useSettings();
  const counts = new Map<CategoryId, number>();
  for (const p of result.placements) counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
  const rows = MAGIC_CATEGORIES.filter((c) => counts.has(c.id));
  // Extra areas of odd-shaped rooms aren't rooms of their own.
  const rooms = analysis.rooms.filter((r) => !r.partOf);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-control font-semibold text-ink">Found {rooms.length} rooms</p>
        {rooms.some((r) => r.type !== 'other') ? (
          <p className="mt-1 text-meta text-ink-2">{rooms.map((r) => r.name).join(', ')}</p>
        ) : (
          <p className="mt-1 text-meta text-ink-2">
            Each room is planned by its size and shape. Move or delete anything that doesn’t suit
            the room once it’s placed.
          </p>
        )}
      </div>
      <table className="w-full text-control">
        <thead>
          <tr className="border-b border-rule-2 text-left text-meta text-ink-2">
            <th className="py-1.5 font-medium">Category</th>
            <th className="py-1.5 font-medium">Plan</th>
            <th className="py-1.5 text-right font-medium">Items</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.id} className="border-b border-rule">
              <td className="py-1.5">
                <span className="flex items-center gap-2">
                  <CategoryGlyph
                    categoryId={c.id}
                    style={resolveCategoryStyle(c.id, settings)}
                    size={14}
                    showBadge={false}
                  />
                  {categoryById(c.id).name}
                </span>
              </td>
              <td className="py-1.5 text-ink-2">{PLAN_TITLES[categoryById(c.id).planType]}</td>
              <td className="tnum py-1.5 text-right">{counts.get(c.id)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.placements.length === 0 && (
        <p className="text-control text-ink-2">Nothing to place with these choices.</p>
      )}
      {result.warnings.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {result.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-meta text-ink">
              <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0 text-warn" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
