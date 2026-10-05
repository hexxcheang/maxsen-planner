import type { ReactNode } from 'react';
import {
  Circle,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Eye,
  Magnet,
  Trash2,
  Hand,
  ListTree,
  Maximize,
  Minus,
  MousePointer2,
  Plus,
  Redo2,
  Spline,
  TextCursorInput,
  Undo2,
  Waypoints,
} from 'lucide-react';
import {
  categoriesForPlan,
  type CategoryId,
  type PlanType,
  type Settings,
  resolveCategoryStyle,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Checkbox, IconButton, Popover, Tooltip } from '@/components/ui';
import type { Armed, PlannerTool } from './store/plannerStore';

interface ToolbarProps {
  tool: PlannerTool;
  onTool: (tool: PlannerTool) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  legendVisible: boolean;
  onLegend: (visible: boolean) => void;
  planType: PlanType;
  hidden: CategoryId[];
  onHidden: (hidden: CategoryId[]) => void;
  settings: Settings;
  disabled: boolean;
  armed: Armed | null;
  /** Arms a drawing tool; undefined when the plan type has no variants for it. */
  onArmTool: (tool: 'led' | 'track' | 'loop' | 'note') => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  /** On-screen editing, for touch screens without Ctrl/Cmd keys. */
  hasSelection: boolean;
  canPaste: boolean;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  /** Lights snap into line; off places them freely (like holding Alt). */
  snap: boolean;
  onSnap: (snap: boolean) => void;
}

const Sep = () => <span aria-hidden className="mx-1 h-5 w-px bg-rule" />;

export function Toolbar(p: ToolbarProps) {
  const cats = categoriesForPlan(p.planType);
  const group = (label: string, children: ReactNode) => (
    <div role="group" aria-label={label} className="flex items-center gap-0.5">
      {children}
    </div>
  );
  return (
    <div
      role="toolbar"
      aria-label="Plan tools"
      className="absolute bottom-4 left-1/2 z-[var(--z-toolbar)] flex -translate-x-1/2 items-center rounded-popover border border-rule bg-surface p-1 shadow-float"
    >
      {group(
        'Tools',
        <>
          <IconButton
            size="sm"
            label="Select (V)"
            icon={<MousePointer2 />}
            active={p.tool === 'select' && !p.armed}
            onClick={() => p.onTool('select')}
          />
          <IconButton
            size="sm"
            label="Pan (H or hold Space)"
            icon={<Hand />}
            active={p.tool === 'pan'}
            onClick={() => p.onTool('pan')}
          />
          {p.planType === 'lighting' && (
            <>
              <IconButton
                size="sm"
                label="Draw LED strip (click points, double-click to finish)"
                icon={<Spline />}
                active={p.armed?.kind === 'path' && p.armed.elementKind === 'led-strip'}
                onClick={() => p.onArmTool('led')}
                disabled={p.disabled}
              />
              <IconButton
                size="sm"
                label="Draw track (click points, double-click to finish)"
                icon={<Waypoints />}
                active={p.armed?.kind === 'path' && p.armed.elementKind === 'track'}
                onClick={() => p.onArmTool('track')}
                disabled={p.disabled}
              />
              <IconButton
                size="sm"
                label="Circle LED loop (click the centre)"
                icon={<Circle />}
                active={p.armed?.kind === 'loop'}
                onClick={() => p.onArmTool('loop')}
                disabled={p.disabled}
              />
            </>
          )}
          <IconButton
            size="sm"
            label="Add text note (click the plan)"
            icon={<TextCursorInput />}
            active={p.armed?.kind === 'note'}
            onClick={() => p.onArmTool('note')}
            disabled={p.disabled}
          />
        </>,
      )}
      <Sep />
      {group(
        'History',
        <>
          <IconButton
            size="sm"
            label="Undo (Ctrl+Z)"
            icon={<Undo2 />}
            onClick={p.onUndo}
            disabled={!p.canUndo}
          />
          <IconButton
            size="sm"
            label="Redo (Ctrl+Shift+Z)"
            icon={<Redo2 />}
            onClick={p.onRedo}
            disabled={!p.canRedo}
          />
        </>,
      )}
      <Sep />
      {group(
        'Edit',
        <>
          <IconButton
            size="sm"
            label="Copy (Ctrl+C)"
            icon={<Copy />}
            onClick={p.onCopy}
            disabled={!p.hasSelection}
          />
          <IconButton
            size="sm"
            label="Paste beside it (Ctrl+V)"
            icon={<ClipboardPaste />}
            onClick={p.onPaste}
            disabled={!p.canPaste}
          />
          <IconButton
            size="sm"
            label="Duplicate (Ctrl+D)"
            icon={<CopyPlus />}
            onClick={p.onDuplicate}
            disabled={!p.hasSelection}
          />
          <IconButton
            size="sm"
            label="Delete (Delete)"
            icon={<Trash2 />}
            onClick={p.onDelete}
            disabled={!p.hasSelection}
          />
        </>,
      )}
      <Sep />
      {group(
        'Zoom',
        <>
          <IconButton
            size="sm"
            label="Zoom out"
            icon={<Minus />}
            onClick={p.onZoomOut}
            disabled={p.disabled}
          />
          <Tooltip content="Reset zoom">
            <button
              type="button"
              onClick={p.onFit}
              disabled={p.disabled}
              aria-label={`Zoom ${Math.round(p.zoom * 100)}%, reset`}
              className="tnum h-[var(--control-h-compact)] w-12 rounded-control text-meta text-ink-2 hover:bg-desk/70 hover:text-ink"
            >
              {Math.round(p.zoom * 100)}%
            </button>
          </Tooltip>
          <IconButton
            size="sm"
            label="Zoom in"
            icon={<Plus />}
            onClick={p.onZoomIn}
            disabled={p.disabled}
          />
          <IconButton
            size="sm"
            label="Fit to screen"
            icon={<Maximize />}
            onClick={p.onFit}
            disabled={p.disabled}
          />
        </>,
      )}
      <Sep />
      {group(
        'View',
        <>
          {p.planType === 'lighting' && (
            <IconButton
              size="sm"
              label={
                p.snap
                  ? 'Lights snap into line (tap to place freely)'
                  : 'Lights placed freely (tap to snap into line)'
              }
              icon={<Magnet />}
              active={p.snap}
              onClick={() => p.onSnap(!p.snap)}
              disabled={p.disabled}
            />
          )}
          <IconButton
            size="sm"
            label={p.legendVisible ? 'Hide legend' : 'Show legend'}
            icon={<ListTree />}
            active={p.legendVisible}
            onClick={() => p.onLegend(!p.legendVisible)}
            disabled={p.disabled}
          />
          <Popover
            side="top"
            align="end"
            label="Category visibility"
            trigger={
              <IconButton
                size="sm"
                label="Show or hide categories"
                icon={<Eye />}
                active={p.hidden.length > 0}
                disabled={p.disabled}
              />
            }
          >
            <div className="flex w-64 flex-col gap-2">
              <p className="text-control font-semibold text-ink">Show on this plan</p>
              <p className="text-meta text-ink-2">Hiding a category never changes the totals.</p>
              <div className="flex flex-col gap-1.5 pt-1">
                {cats.map((c) => (
                  <Checkbox
                    key={c.id}
                    checked={!p.hidden.includes(c.id)}
                    onCheckedChange={(on) =>
                      p.onHidden(on ? p.hidden.filter((h) => h !== c.id) : [...p.hidden, c.id])
                    }
                    label={
                      <span className="flex items-center gap-2">
                        <CategoryGlyph
                          categoryId={c.id}
                          style={resolveCategoryStyle(c.id, p.settings)}
                          size={14}
                          showBadge={false}
                        />
                        {c.name}
                      </span>
                    }
                  />
                ))}
              </div>
            </div>
          </Popover>
        </>,
      )}
    </div>
  );
}
