import { useEffect, useMemo, useState } from 'react';
import { Loader2, Sparkles, TriangleAlert } from 'lucide-react';
import {
  categoryById,
  createVariantPicker,
  FloorReadError,
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
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import {
  Button,
  Checkbox,
  Dialog,
  Field,
  SegmentedControl,
  Switch,
  Textarea,
} from '@/components/ui';
import { useCatalogue, useSettings, useSourcePages } from '@/lib/data/hooks';
import { fileUrl } from '@/lib/files';
import { analyseBackground, magicPlanConfigured, MagicPlanError } from './analysis-source';
import { CheckStep } from './CheckStep';
import { readPlanLocally, type ReadStage } from './local-reader';

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

type Method = 'local' | 'claude';

type Step =
  | { kind: 'options'; error?: string }
  | { kind: 'working'; stage: ReadStage | 'claude' | 'planning' }
  | { kind: 'check'; analysis: FloorAnalysis; issues: string[] }
  | {
      kind: 'review';
      analysis: FloorAnalysis;
      result: MagicPlanResult;
      /** What was read, when it can be checked again from the review. */
      reading?: { issues: string[] };
    };

const WORKING: Record<Extract<Step, { kind: 'working' }>['stage'], [string, string?]> = {
  labels: ['Reading room names…', 'Using the PDF’s text, or reading the words on the drawing.'],
  walls: ['Finding the rooms…'],
  claude: [
    'Reading the drawing…',
    'Finding rooms, doors and windows. This can take up to a minute.',
  ],
  planning: ['Planning…'],
};

const PLAN_TITLES: Record<PlanType, string> = {
  'smart-home': 'Smart Home Plan',
  lighting: 'Lighting Plan',
};

export function MagicPlanDialog({ open, onOpenChange, level, plans, onApply }: Props) {
  const { data: catalogue } = useCatalogue();
  const { data: settings } = useSettings();
  const [selected, setSelected] = useState<Set<CategoryId>>(
    () => new Set(MAGIC_CATEGORIES.filter((c) => c.defaultOn).map((c) => c.id)),
  );
  const [notes, setNotes] = useState('');
  const hasContent = Object.values(plans).some((p) => p && p.document.elements.length > 0);
  const [replace, setReplace] = useState(hasContent);
  const [step, setStep] = useState<Step>({ kind: 'options' });
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [method, setMethod] = useState<Method>('local');

  // The drawing Magic Plan reads: the Smart Home Plan's, else the Lighting Plan's.
  const source = plans['smart-home'] ?? plans.lighting;
  const builtIn = source ? Boolean(sample.sampleAnalysisFor(source.background.fileId)) : false;
  const { data: uploads } = useSourcePages(source?.projectId);

  useEffect(() => {
    if (!open) return;
    setStep({ kind: 'options' });
    setReplace(hasContent);
    if (!builtIn) void magicPlanConfigured().then(setConfigured);
  }, [open, builtIn, hasContent]);

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

  const plan = (analysis: FloorAnalysis, reading?: { issues: string[] }) => {
    if (!source) return;
    const sheet = {
      width: 1000,
      height: (1000 * source.background.height) / source.background.width,
    };
    const result = magicPlan({ analysis, sheet, categories: chosen, pick });
    setStep({ kind: 'review', analysis, result, reading });
  };

  const run = async () => {
    if (!source) return;
    try {
      if (builtIn || method === 'claude') {
        setStep({ kind: 'working', stage: builtIn ? 'planning' : 'claude' });
        const { analysis } = await analyseBackground(source.background.fileId, notes);
        plan(analysis);
        return;
      }
      setStep({ kind: 'working', stage: 'labels' });
      const { analysis, issues } = await readPlanLocally(source, uploads, (stage) =>
        setStep({ kind: 'working', stage }),
      );
      // Only stop to check when the reading looks unsure.
      if (issues.length > 0) setStep({ kind: 'check', analysis, issues });
      else plan(analysis, { issues });
    } catch (e) {
      console.error(e);
      setStep({
        kind: 'options',
        error:
          e instanceof MagicPlanError || e instanceof FloorReadError
            ? e.message
            : 'Something went wrong while planning. Try again.',
      });
    }
  };

  const blocked = !builtIn && method === 'claude' && configured === false;

  const footer =
    step.kind === 'check' ? (
      <>
        <Button onClick={() => setStep({ kind: 'options' })}>Back</Button>
        <Button
          variant="primary"
          icon={<Sparkles className="size-4" />}
          onClick={() => plan(step.analysis, { issues: step.issues })}
        >
          Plan these rooms
        </Button>
      </>
    ) : step.kind === 'review' ? (
      <>
        {step.reading && (
          <Button
            className="mr-auto"
            onClick={() =>
              setStep({ kind: 'check', analysis: step.analysis, issues: step.reading!.issues })
            }
          >
            Check rooms
          </Button>
        )}
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
        <Button onClick={() => onOpenChange(false)}>Cancel</Button>
        <Button
          variant="primary"
          icon={<Sparkles className="size-4" />}
          loading={step.kind === 'working'}
          disabled={chosen.length === 0 || blocked}
          onClick={() => void run()}
        >
          Create Magic Plan
        </Button>
      </>
    );

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      width="lg"
      title="Magic Plan"
      description={`Reads the ${level.name} drawing and places devices for you. Everything stays editable afterwards.`}
      footer={footer}
    >
      {step.kind === 'working' && (
        <div role="status" className="flex flex-col items-center gap-3 py-16 text-center">
          <Loader2 aria-hidden className="size-6 animate-spin text-brass" />
          <p className="text-body text-ink">{WORKING[step.stage][0]}</p>
          {WORKING[step.stage][1] && (
            <p className="text-meta text-ink-2">{WORKING[step.stage][1]}</p>
          )}
        </div>
      )}

      {step.kind === 'check' && source && (
        <CheckStep
          analysis={step.analysis}
          issues={step.issues}
          imageUrl={fileUrl(source.background.fileId)}
          aspect={source.background.width / source.background.height}
          onChange={(analysis) => setStep({ ...step, analysis })}
        />
      )}

      {step.kind === 'options' && (
        <div className="flex flex-col gap-5">
          {step.error && (
            <p
              role="alert"
              className="flex items-start gap-2 border-l-[3px] border-danger bg-danger-tint px-3 py-2 text-control text-ink"
            >
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
              {step.error}
            </p>
          )}
          {!builtIn && (
            <Field
              label="Read the drawing"
              hint={
                method === 'local'
                  ? 'Read on this computer. Nothing is uploaded; you’ll be asked to check anything it isn’t sure of.'
                  : configured
                    ? 'Sent to Claude to read. Better with unusual or hand-drawn plans.'
                    : 'Claude needs an Anthropic API key in the project’s .env file (see the README), then restart the app.'
              }
            >
              <SegmentedControl
                label="Read the drawing"
                value={method}
                onChange={setMethod}
                options={[
                  { value: 'local', label: 'On this computer' },
                  { value: 'claude', label: 'With Claude', disabled: configured !== true },
                ]}
              />
            </Field>
          )}
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
          {!builtIn && method === 'claude' && (
            <Field
              label="Notes for Magic Plan"
              optional
              hint="Helps Claude read the drawing, for example “the room at the top right is the master bedroom”."
            >
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          )}
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
  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-control font-semibold text-ink">Found {analysis.rooms.length} rooms</p>
        <p className="mt-1 text-meta text-ink-2">{analysis.rooms.map((r) => r.name).join(', ')}</p>
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
