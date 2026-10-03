import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Layers,
  PanelRight,
  Sigma,
  Sparkles,
} from 'lucide-react';
import { alignPoint, buildScene, categoryById, type PlanType } from '@maxsen/domain';
import { Button, buttonClass, IconButton, useToast } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/lib/files';
import { useElementSize, useMediaQuery } from '@/lib/useElementSize';
import {
  useActions,
  useCatalogue,
  useLevels,
  usePlans,
  useResolver,
  useSettings,
} from '@/lib/data/hooks';
import { TopBarSlot } from '@/app/shell/TopBarSlot';
import { useCurrentProject } from '@/features/project/useProjectContext';
import { PLAN_LABELS } from '@/features/setup/labels';
import { ALIGNED_LIGHTS, lightSpots, SNAP_PX } from './canvas/align';
import { PlanStage } from './canvas/PlanStage';
import { LegendOverlay } from './canvas/LegendOverlay';
import { useStageViewport } from './canvas/useStageViewport';
import { Inspector } from './inspector/Inspector';
import { DeviceLibrary } from './library/DeviceLibrary';
import { LiveTotals } from './totals/LiveTotals';
import { createPlannerStore, type Armed } from './store/plannerStore';
import { PlannerContext } from './planner-context';
import { VARIANT_DRAG_TYPE } from './library/VariantTile';
import { LevelSwitcher } from './LevelSwitcher';
import { MagicPlanDialog, type MagicPlanOutcome } from './magic/MagicPlanDialog';
import { mergeMagic } from './magic/apply';
import { SaveState } from './SaveState';
import { Toolbar } from './Toolbar';

function SidePanel({
  side,
  open,
  overlay,
  title,
  icon,
  onToggle,
  children,
}: {
  side: 'left' | 'right';
  open: boolean;
  overlay: boolean;
  title: string;
  icon: ReactNode;
  onToggle: () => void;
  children: ReactNode;
}) {
  const left = side === 'left';
  if (!open) {
    return (
      <aside
        aria-label={title}
        className={cn(
          'flex w-11 shrink-0 flex-col items-center bg-surface py-2',
          left ? 'border-r border-rule' : 'border-l border-rule',
        )}
      >
        <IconButton label={`Show ${title.toLowerCase()}`} icon={icon} onClick={onToggle} />
      </aside>
    );
  }
  return (
    <aside
      aria-label={title}
      className={cn(
        'flex min-h-0 shrink-0 flex-col bg-surface',
        left
          ? 'w-[var(--library-w)] border-r border-rule'
          : 'w-[var(--inspector-w)] border-l border-rule',
        overlay && 'absolute inset-y-0 z-[var(--z-panel-overlay)] shadow-float',
        overlay && (left ? 'left-0' : 'right-0'),
      )}
    >
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-rule pr-1.5 pl-4">
        <h2 className="text-control font-semibold text-ink">{title}</h2>
        <IconButton
          size="sm"
          label={`Hide ${title.toLowerCase()}`}
          icon={left ? <ChevronLeft /> : <ChevronRight />}
          onClick={onToggle}
        />
      </div>
      {children}
    </aside>
  );
}

export function PlannerScreen() {
  const project = useCurrentProject();
  const actions = useActions();
  const { data: levels } = useLevels(project.id);
  const { data: plans } = usePlans(project.id);
  const { data: settings } = useSettings();
  const { data: resolve } = useResolver(project.id);
  const [params, setParams] = useSearchParams();
  const narrow = useMediaQuery('(max-width: 1179px)');
  const [libraryOpen, setLibraryOpen] = useState(!narrow);
  const [inspectorOpen, setInspectorOpen] = useState(!narrow);
  const [totalsOpen, setTotalsOpen] = useState(true);

  const levelId =
    levels.find((l) => l.id === params.get('level'))?.id ??
    project.lastOpened?.levelId ??
    levels[0]?.id ??
    '';
  const typeParam = params.get('type');
  const planType: PlanType =
    typeParam === 'smart-home' || typeParam === 'lighting'
      ? typeParam
      : (project.lastOpened?.planType ?? 'smart-home');
  const level = levels.find((l) => l.id === levelId);
  const plan = plans.find((p) => p.levelId === levelId && p.type === planType);
  const levelPlans = {
    'smart-home': plans.find((p) => p.levelId === levelId && p.type === 'smart-home'),
    lighting: plans.find((p) => p.levelId === levelId && p.type === 'lighting'),
  };
  const [magicOpen, setMagicOpen] = useState(false);
  const { toast } = useToast();

  const [store] = useState(createPlannerStore);
  const document = useStore(store, (s) => s.document);
  const selection = useStore(store, (s) => s.selection);
  const tool = useStore(store, (s) => s.tool);
  const armed = useStore(store, (s) => s.armed);
  const draft = useStore(store, (s) => s.draft);
  const canUndo = useStore(store, (s) => s.past.length > 0);
  const canRedo = useStore(store, (s) => s.future.length > 0);
  const { data: catalogue } = useCatalogue();

  // The editor owns the open document; every change is saved straight back (autosave). A document
  // arriving from the data layer that we didn't just save (plan switch, external change) is loaded.
  const saved = useRef<unknown>(null);
  useEffect(() => {
    // Our own save coming back: nothing to load, as long as that plan is the one already open.
    // (Back on a plan after viewing another, it must be loaded even if it was the last one saved.)
    if (plan && plan.document === saved.current && store.getState().planId === plan.id) return;
    store.getState().load({
      projectId: project.id,
      levelId,
      planType,
      planId: plan?.id ?? null,
      document: plan?.document ?? null,
    });
  }, [store, project.id, levelId, planType, plan?.id, plan?.document, plan]);

  useEffect(
    () =>
      store.subscribe((s, prev) => {
        if (s.document === prev.document || !s.planId || s.planId !== prev.planId) return;
        saved.current = s.document;
        actions.setPlanDocument(s.planId, s.document);
      }),
    [store, actions],
  );

  const recordUse = (variantId: string) => actions.recordVariantUse(project.id, variantId);

  /** Puts Magic Plan's devices on the level's Smart Home and Lighting plans. */
  const applyMagic = ({ result, categories, replace }: MagicPlanOutcome) => {
    const variants = new Set<string>();
    for (const el of [...result.smartHome, ...result.lighting])
      if (el.kind !== 'note') variants.add(el.variantId);
    for (const v of variants) recordUse(v);
    const counts: string[] = [];
    for (const type of ['smart-home', 'lighting'] as const) {
      const target = levelPlans[type];
      const added = type === 'smart-home' ? result.smartHome : result.lighting;
      if (!target) continue;
      const current = target.id === plan?.id;
      const merged = mergeMagic(current ? store.getState().document : target.document, added, {
        replace,
        categories,
        resolve,
      });
      if (current) store.getState().applyDocument(merged);
      else actions.setPlanDocument(target.id, merged);
      if (added.length)
        counts.push(
          `${added.length} on the ${type === 'smart-home' ? 'Smart Home' : 'Lighting'} Plan`,
        );
    }
    toast({
      title: `Magic Plan placed ${result.placements.length} items`,
      body: `${counts.join(' and ')}. Undo (Ctrl+Z) takes them off the plan you’re viewing.`,
    });
  };
  const productById = useMemo(
    () => new Map(catalogue.products.map((p) => [p.id, p])),
    [catalogue.products],
  );
  const kindOf = (variantId: string) => {
    const v = catalogue.variants.find((x) => x.id === variantId);
    const p = v && productById.get(v.productId);
    return p ? categoryById(p.categoryId).kind : 'point';
  };
  /** Lights that line up with each other as they're placed: downlights and surface lights. */
  const alignsAsLight = (variantId: string) => {
    const v = catalogue.variants.find((x) => x.id === variantId);
    const p = v && productById.get(v.productId);
    return p ? ALIGNED_LIGHTS.includes(p.categoryId) : false;
  };
  const nameOf = (variantId: string) => {
    const v = catalogue.variants.find((x) => x.id === variantId);
    const p = v && productById.get(v.productId);
    return p && v ? `${p.name}, ${v.name}` : 'device';
  };

  const armVariant = (variantId: string) => {
    const s = store.getState();
    const current = s.armed && 'variantId' in s.armed ? s.armed.variantId : null;
    if (current === variantId) return s.arm(null);
    const kind = kindOf(variantId);
    s.arm(
      kind === 'point'
        ? { kind: 'marker', variantId }
        : { kind: 'path', variantId, elementKind: kind },
    );
    if (narrow) setLibraryOpen(false);
  };

  /** The variant a drawing tool uses: most recently used of that kind, then favourites, then the first. */
  const pickVariant = (kind: 'led-strip' | 'track') => {
    const visible = catalogue.visibleVariantsFor(planType).filter((v) => kindOf(v.id) === kind);
    const prefer = [...project.recentVariantIds, ...settings.favouriteVariantIds];
    return prefer.find((id) => visible.some((v) => v.id === id)) ?? visible[0]?.id;
  };

  const armTool = (t: 'led' | 'track' | 'loop' | 'note') => {
    const s = store.getState();
    let next: Armed | null = null;
    if (t === 'note') next = { kind: 'note' };
    else {
      const variantId = pickVariant(t === 'track' ? 'track' : 'led-strip');
      if (!variantId) return;
      next =
        t === 'loop'
          ? { kind: 'loop', variantId }
          : { kind: 'path', variantId, elementKind: t === 'led' ? 'led-strip' : 'track' };
    }
    const same = s.armed && JSON.stringify(s.armed) === JSON.stringify(next);
    s.arm(same ? null : next);
  };

  const place = (at: { x: number; y: number }, shiftKey: boolean) => {
    const s = store.getState();
    const a = s.armed;
    if (!a) return;
    if (a.kind === 'marker') {
      recordUse(a.variantId);
      s.addMarker(a.variantId, at);
    } else if (a.kind === 'note') {
      s.addNote(at);
      s.arm(null);
      s.select([s.document.elements.at(-1)!.id], 'replace');
    } else if (a.kind === 'loop') {
      recordUse(a.variantId);
      const id = s.addLoop(a.variantId, at, 40);
      s.arm(null);
      s.select([id], 'replace');
    } else {
      s.addDraftPoint(at, shiftKey);
    }
  };

  const finishDraft = () => {
    const s = store.getState();
    const a = s.armed;
    const id = s.finishDraft();
    if (id && a && 'variantId' in a) {
      recordUse(a.variantId);
      s.arm(null);
      s.select([id], 'replace');
      setInspectorOpen(true);
    }
  };

  const switchTo = (nextLevel: string, nextType: PlanType) => {
    setParams({ level: nextLevel, type: nextType }, { replace: true });
    actions.setLastOpened(project.id, nextLevel, nextType);
  };

  const canvasRef = useRef<HTMLDivElement>(null);
  const size = useElementSize(canvasRef);
  const sheet = useMemo(
    () => ({
      width: 1000,
      height: plan ? (1000 * plan.background.height) / plan.background.width : 700,
    }),
    [plan],
  );
  const view = useStageViewport(store, sheet, size);

  const scene = useMemo(
    () =>
      buildScene(
        document,
        { settings, resolve, width: sheet.width, height: sheet.height },
        {
          showLabels: true,
          showLedLengths: true,
          showTrackLabels: true,
          showNotes: true,
          hiddenCategories: document.view.hiddenCategories,
        },
      ),
    [document, settings, resolve, sheet],
  );

  const finishRef = useRef(finishDraft);
  finishRef.current = finishDraft;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement ||
        (e.target instanceof HTMLElement && e.target.closest('[role="dialog"]'))
      )
        return;
      const s = store.getState();
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if (mod && key === 'y') {
        e.preventDefault();
        s.redo();
      } else if (mod && key === 'd') {
        e.preventDefault();
        s.duplicateSelection(20);
      } else if (mod && key === 'c') {
        if (s.selection.length) {
          e.preventDefault();
          s.copySelection();
        }
      } else if (mod && key === 'v') {
        if (s.paste().length) e.preventDefault();
      } else if (mod && key === 'a') {
        e.preventDefault();
        s.selectAll();
      } else if (e.key === 'Escape') {
        if (s.armed) s.arm(null);
        else s.select([], 'replace');
      } else if (e.key === 'Enter' && s.armed?.kind === 'path') {
        finishRef.current();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && s.draft.length > 0) {
        e.preventDefault();
        s.popDraftPoint();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection.length) {
          e.preventDefault();
          s.deleteSelection();
        }
      } else if (e.key === ']' || e.key === '}') s.reorder(e.shiftKey ? 'front' : 'forward');
      else if (e.key === '[' || e.key === '{') s.reorder(e.shiftKey ? 'back' : 'backward');
      else if (!mod && key === 'v') s.setTool('select');
      else if (!mod && key === 'h') s.setTool('pan');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);

  const v = view.viewport;
  const legendStyle = {
    left: Math.max(12, v.x + 12),
    top: Math.min(size.height - 12, v.y + sheet.height * v.scale - 12),
    transform: 'translateY(-100%)',
  };

  return (
    <PlannerContext.Provider value={{ store, recordUse }}>
      <div data-screen-ready className="absolute inset-0 flex">
        <TopBarSlot slot="right">
          <SaveState />
        </TopBarSlot>
        <SidePanel
          side="left"
          title="Library"
          icon={<BookOpen />}
          open={libraryOpen}
          overlay={narrow}
          onToggle={() => setLibraryOpen((o) => !o)}
        >
          <DeviceLibrary
            projectId={project.id}
            planType={planType}
            armedVariantId={armed && 'variantId' in armed ? armed.variantId : null}
            onArm={armVariant}
          />
        </SidePanel>

        <div className="relative min-w-0 flex-1 bg-desk">
          <div
            ref={canvasRef}
            data-testid="plan-canvas"
            data-scale={view.zoom.toFixed(2)}
            data-viewport={`${v.x.toFixed(2)},${v.y.toFixed(2)},${v.scale.toFixed(5)}`}
            className="absolute inset-0 overflow-hidden"
            onDragOver={(e) => {
              if (plan && e.dataTransfer.types.includes(VARIANT_DRAG_TYPE)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
              }
            }}
            onDrop={(e) => {
              const variantId = e.dataTransfer.getData(VARIANT_DRAG_TYPE);
              if (!plan || !variantId) return;
              e.preventDefault();
              const rect = e.currentTarget.getBoundingClientRect();
              recordUse(variantId);
              const at = {
                x: (e.clientX - rect.left - v.x) / v.scale,
                y: (e.clientY - rect.top - v.y) / v.scale,
              };
              // A light dropped near others lines up with them (Alt/Option places it freely).
              const snapped =
                alignsAsLight(variantId) && !e.altKey
                  ? alignPoint(at, lightSpots(scene), SNAP_PX / v.scale).at
                  : at;
              store.getState().addMarker(variantId, snapped);
            }}
          >
            {plan && size.width > 0 && (
              <PlanStage
                width={size.width}
                height={size.height}
                background={{
                  url: fileUrl(plan.background.fileId),
                  width: sheet.width,
                  height: sheet.height,
                }}
                scene={scene}
                selection={selection}
                tool={tool}
                view={view}
                onSelect={(ids, mode) => store.getState().select(ids, mode)}
                onMove={(ids, dx, dy) => store.getState().moveElements(ids, dx, dy)}
                armed={armed}
                draft={draft}
                draftColor="#A8873A"
                onPlace={place}
                armedAligns={armed?.kind === 'marker' && alignsAsLight(armed.variantId)}
                onFinishDraft={finishDraft}
                onEditPoints={(id, points) => store.getState().updateElement(id, { points })}
              />
            )}
          </div>
          {!plan && level && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex max-w-sm flex-col items-start gap-3 border border-rule bg-surface p-6">
                <Layers aria-hidden className="size-5 text-ink-2" />
                <h2 className="text-section text-ink">
                  No {PLAN_LABELS[planType]} on {level.name} yet
                </h2>
                <p className="text-control text-ink-2">
                  Choose a drawing for it in Setup, then come back here to place devices.
                </p>
                <Link to={`/projects/${project.id}/setup`} className={buttonClass('primary', 'sm')}>
                  Set up in Setup
                </Link>
              </div>
            </div>
          )}
          {plan && document.view.legendVisible && (
            <LegendOverlay scene={scene} settings={settings} style={legendStyle} />
          )}
          {level && (
            <LevelSwitcher
              levels={levels}
              levelId={levelId}
              planType={planType}
              onChange={switchTo}
            />
          )}
          {level && (levelPlans['smart-home'] || levelPlans.lighting) && (
            <div className="absolute top-3 right-3 z-[var(--z-toolbar)] rounded-popover shadow-float">
              <Button
                variant="primary"
                icon={<Sparkles className="size-4" />}
                onClick={() => setMagicOpen(true)}
              >
                Magic Plan
              </Button>
            </div>
          )}
          {level && (
            <MagicPlanDialog
              open={magicOpen}
              onOpenChange={setMagicOpen}
              level={level}
              plans={levelPlans}
              onApply={applyMagic}
            />
          )}
          <Toolbar
            tool={tool}
            onTool={(t) => store.getState().setTool(t)}
            zoom={view.zoom}
            onZoomIn={view.zoomIn}
            onZoomOut={view.zoomOut}
            onFit={view.fit}
            legendVisible={document.view.legendVisible}
            onLegend={(legendVisible) => store.getState().setView({ legendVisible })}
            planType={planType}
            hidden={document.view.hiddenCategories}
            onHidden={(hiddenCategories) => store.getState().setView({ hiddenCategories })}
            settings={settings}
            disabled={!plan}
            armed={armed}
            onArmTool={armTool}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={() => store.getState().undo()}
            onRedo={() => store.getState().redo()}
          />
          {armed && plan && (
            <div
              role="status"
              className="absolute top-3 left-1/2 z-[var(--z-toolbar)] flex max-w-[60%] -translate-x-1/2 items-center gap-3 rounded-popover border border-brass/50 bg-surface px-3 py-1.5 text-control text-ink shadow-float max-[1179px]:top-16"
            >
              <span className="min-w-0">
                {armed.kind === 'marker' && (
                  <>
                    Click the plan to place{' '}
                    <strong className="font-semibold">{nameOf(armed.variantId)}</strong>. Keep
                    clicking to place more.
                  </>
                )}
                {armed.kind === 'path' &&
                  (draft.length === 0 ? (
                    <>
                      Click the start of the{' '}
                      {armed.elementKind === 'track'
                        ? 'track'
                        : armed.elementKind === 'curtain'
                          ? 'curtain (one end of the window)'
                          : 'LED strip'}{' '}
                      ({nameOf(armed.variantId)}).
                    </>
                  ) : (
                    <>
                      Click to add points, Shift for straight lines. Double-click or Enter to
                      finish.
                    </>
                  ))}
                {armed.kind === 'loop' && (
                  <>Click the centre of the LED loop ({nameOf(armed.variantId)}).</>
                )}
                {armed.kind === 'note' && <>Click where the note should go.</>}
              </span>
              <button
                type="button"
                onClick={() => store.getState().arm(null)}
                className="shrink-0 text-meta text-brass-2 hover:underline"
              >
                Stop (Esc)
              </button>
            </div>
          )}
        </div>

        <SidePanel
          side="right"
          title="Details"
          icon={<PanelRight />}
          open={inspectorOpen}
          overlay={narrow}
          onToggle={() => setInspectorOpen((o) => !o)}
        >
          <div className="min-h-0 flex-1 overflow-y-auto">
            <Inspector
              document={document}
              selection={selection}
              resolve={resolve}
              settings={settings}
              planType={planType}
            />
          </div>
          <div
            className={cn(
              'flex min-h-0 flex-col border-t border-rule-2',
              totalsOpen && 'max-h-[50%]',
            )}
          >
            <button
              type="button"
              aria-expanded={totalsOpen}
              onClick={() => setTotalsOpen((o) => !o)}
              className="flex h-10 shrink-0 items-center gap-2 px-4 text-left hover:bg-paper"
            >
              <Sigma aria-hidden className="size-4 text-ink-2" />
              <span className="flex-1 text-control font-semibold text-ink">Project totals</span>
              <span className="text-meta text-ink-3">All levels</span>
              <ChevronRight
                aria-hidden
                className={cn(
                  'size-3.5 text-ink-3 transition-transform',
                  totalsOpen && '-rotate-90',
                )}
              />
            </button>
            {totalsOpen && (
              <div className="min-h-0 overflow-y-auto border-t border-rule">
                <LiveTotals projectId={project.id} />
              </div>
            )}
          </div>
        </SidePanel>
      </div>
    </PlannerContext.Provider>
  );
}
