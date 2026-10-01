import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router';
import { useStore } from 'zustand';
import { BookOpen, ChevronLeft, ChevronRight, Layers, PanelRight, Sigma } from 'lucide-react';
import { buildScene, type PlanType } from '@maxsen/domain';
import { buttonClass, IconButton } from '@/components/ui';
import { cn } from '@/lib/cn';
import { fileUrl } from '@/lib/files';
import { useElementSize, useMediaQuery } from '@/lib/useElementSize';
import { useActions, useLevels, usePlans, useResolver, useSettings } from '@/lib/data/hooks';
import { TopBarSlot } from '@/app/shell/TopBarSlot';
import { useCurrentProject } from '@/features/project/useProjectContext';
import { PLAN_LABELS } from '@/features/setup/labels';
import { PlanStage } from './canvas/PlanStage';
import { LegendOverlay } from './canvas/LegendOverlay';
import { useStageViewport } from './canvas/useStageViewport';
import { Inspector } from './inspector/Inspector';
import { DeviceLibrary } from './library/DeviceLibrary';
import { LiveTotals } from './totals/LiveTotals';
import { createPlannerStore } from './store/plannerStore';
import { LevelSwitcher } from './LevelSwitcher';
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

  const [store] = useState(createPlannerStore);
  const document = useStore(store, (s) => s.document);
  const selection = useStore(store, (s) => s.selection);
  const tool = useStore(store, (s) => s.tool);

  useEffect(() => {
    const s = store.getState();
    const keep = s.planId === (plan?.id ?? null) ? s.selection : [];
    s.load({
      projectId: project.id,
      levelId,
      planType,
      planId: plan?.id ?? null,
      document: plan?.document ?? null,
    });
    if (keep.length) s.select(keep, 'replace');
  }, [store, project.id, levelId, planType, plan?.id, plan?.document]);

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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === 'v' || e.key === 'V') store.getState().setTool('select');
      if (e.key === 'h' || e.key === 'H') store.getState().setTool('pan');
      if (e.key === 'Escape') store.getState().select([], 'replace');
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
        <DeviceLibrary projectId={project.id} planType={planType} />
      </SidePanel>

      <div className="relative min-w-0 flex-1 bg-desk">
        <div
          ref={canvasRef}
          data-testid="plan-canvas"
          data-scale={view.zoom.toFixed(2)}
          data-viewport={`${v.x.toFixed(2)},${v.y.toFixed(2)},${v.scale.toFixed(5)}`}
          className="absolute inset-0 overflow-hidden"
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
              onMove={(ids, dx, dy) => {
                store.getState().moveElements(ids, dx, dy);
                actions.moveElements(plan.id, ids, dx, dy);
              }}
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
        <Toolbar
          tool={tool}
          onTool={(t) => store.getState().setTool(t)}
          zoom={view.zoom}
          onZoomIn={view.zoomIn}
          onZoomOut={view.zoomOut}
          onFit={view.fit}
          legendVisible={document.view.legendVisible}
          onLegend={(legendVisible) => plan && actions.setPlanView(plan.id, { legendVisible })}
          planType={planType}
          hidden={document.view.hiddenCategories}
          onHidden={(hiddenCategories) =>
            plan && actions.setPlanView(plan.id, { hiddenCategories })
          }
          settings={settings}
          disabled={!plan}
        />
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
              className={cn('size-3.5 text-ink-3 transition-transform', totalsOpen && '-rotate-90')}
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
  );
}
