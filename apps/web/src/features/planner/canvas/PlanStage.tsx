import { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Path,
  Rect,
  Stage,
  Text,
} from 'react-konva';
import Konva from 'konva';
import { useCoarsePointer } from '@/lib/pointer';
import { alignPoint, snapToAxes, type AlignGuide, type Pt, type Scene } from '@maxsen/domain';
import { ALIGNED_LIGHTS, lightSpots, SNAP_PX, SNAP_REACH_PX } from './align';
import type { Armed, PlannerTool } from '../store/plannerStore';
import type { StageViewport } from './useStageViewport';
import { SceneLayer } from './SceneLayer';

const BRASS = '#A8873A';

// Keep receiving touch moves while something is dragged, so a second finger can start a pinch.
Konva.hitOnDragEnabled = true;
/** Smart guides: a clear magenta, drawn hairline-thin so they never hide the plan. */
const GUIDE = '#D6336C';

function useHtmlImage(url: string | null) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) return;
    const el = new window.Image();
    el.onload = () => setImg(el);
    el.src = url;
    return () => {
      el.onload = null;
    };
  }, [url]);
  return url ? img : null;
}

interface PlanStageProps {
  width: number;
  height: number;
  background: { url: string; width: number; height: number };
  scene: Scene;
  selection: string[];
  tool: PlannerTool;
  view: StageViewport;
  onSelect: (ids: string[], mode: 'replace' | 'toggle') => void;
  onMove: (ids: string[], dx: number, dy: number) => void;
  /** What a click places, if anything. */
  armed: Armed | null;
  draft: Pt[];
  draftColor: string;
  /** A click on the plan while something is armed, in plan units. */
  onPlace: (at: Pt, shift: boolean) => void;
  onFinishDraft: () => void;
  /** Moves or adds points of a selected LED strip or track (one undoable step). */
  onEditPoints?: (elementId: string, points: Pt[]) => void;
  /** The armed device is a light that lines up with the others as it's placed. */
  armedAligns?: boolean;
  /** Lights snap into line as they're placed or dragged (off: place freely, like holding Alt). */
  snap?: boolean;
}

/** Most points an LED strip or track run can be given with the + handle. */
export const MAX_PATH_POINTS = 8;
/** How far (plan units) a new point is placed beyond the last one; then drag it anywhere. */
const NEW_POINT_STEP = 50;

export function PlanStage({
  width,
  height,
  background,
  scene,
  selection,
  tool,
  view,
  onSelect,
  onMove,
  armed,
  draft,
  draftColor,
  onPlace,
  onFinishDraft,
  onEditPoints,
  armedAligns = false,
  snap = true,
}: PlanStageProps) {
  // On a touch screen: one finger on empty plan pans, two fingers pinch to zoom and pan, and
  // handles are finger-sized.
  const coarse = useCoarsePointer();
  const hs = coarse ? 2 : 1;
  const pinch = useRef<{ dist: number; center: Pt } | null>(null);
  const [pinching, setPinching] = useState(false);
  /** When the last pinch ended: the lift of its fingers isn't a tap. */
  const pinchEnded = useRef(0);
  const justPinched = () => Date.now() - pinchEnded.current < 350;
  /**
   * When the plan was last touched. A tap is followed by a mouse click the browser makes up for
   * older pages; acting on both placed everything twice (two sensors, a curtain bent into an L).
   */
  const lastTouch = useRef(0);
  const fromTouch = () => Date.now() - lastTouch.current < 800;
  /** Smart guides shown while a light is dragged or about to be placed. */
  const [guides, setGuides] = useState<AlignGuide[]>([]);
  /** Points of the run being reshaped, while a handle is dragged. */
  const [reshaping, setReshaping] = useState<{ id: string; points: Pt[] } | null>(null);
  const [hover, setHover] = useState<Pt | null>(null);
  const image = useHtmlImage(background.url);
  const { viewport } = view;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panning = tool === 'pan' || spaceHeld;
  const fingerPan = coarse && !panning && !pinching;

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      // Space pans only from the canvas or the page itself; on buttons and fields it keeps its normal job.
      const onCanvas =
        !t || t === document.body || t.closest('[data-testid="plan-canvas"]') !== null;
      if (e.code === 'Space' && onCanvas) {
        e.preventDefault();
        setSpaceHeld(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpaceHeld(false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Konva reports any two quick clicks as a double-click; only a double-click on the last point
  // (where a finishing double-click lands) ends the path, so fast drawing doesn't end it early.
  const finishIfOnLastPoint = (p: Pt | null | undefined) => {
    const last = draft.at(-1);
    if (armed?.kind !== 'path' || !p || !last) return;
    if (Math.hypot(p.x - last.x, p.y - last.y) * viewport.scale <= 8) onFinishDraft();
  };

  const onPick = (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (panning || armed) return;
    if ('touches' in e.evt && e.evt.touches.length > 1) return;
    const shift = 'shiftKey' in e.evt && e.evt.shiftKey;
    if (shift) onSelect([id], 'toggle');
    else if (!selection.includes(id)) onSelect([id], 'replace');
  };

  const selected = new Set(selection);
  const selectedItems = scene.items.filter((i) => selected.has(i.elementId));
  const px = 1 / viewport.scale;
  const lightIds = new Set(
    scene.items.flatMap((i) =>
      i.type === 'marker' && ALIGNED_LIGHTS.includes(i.categoryId) ? [i.elementId] : [],
    ),
  );
  /** A light being dragged: snap it into line with the lights that aren't moving with it. */
  const alignDrag = (id: string, at: Pt, free: boolean): Pt | null => {
    if (free || !snap || !lightIds.has(id)) {
      if (guides.length) setGuides([]);
      return null;
    }
    const moving = new Set(selected.has(id) ? selection : [id]);
    const r = alignPoint(at, lightSpots(scene, moving), SNAP_PX * px, SNAP_REACH_PX * px);
    setGuides(r.guides);
    return r.at;
  };
  /** Where an armed light would be placed at `p`. */
  const placeAt = (p: Pt, free: boolean): { at: Pt; guides: AlignGuide[] } =>
    armedAligns && snap && !free
      ? alignPoint(p, lightSpots(scene), SNAP_PX * px, SNAP_REACH_PX * px)
      : { at: p, guides: [] };
  // One open LED strip or track selected: show its points as handles, plus a + to add a point.
  const editable =
    onEditPoints && tool === 'select' && !panning && !armed && selectedItems.length === 1
      ? selectedItems.find((i) => i.type === 'path' && !i.closed)
      : undefined;
  const editPath = editable?.type === 'path' ? editable : undefined;
  const editPoints =
    editPath && (reshaping?.id === editPath.elementId ? reshaping.points : editPath.points);
  const neighbours = (i: number) =>
    editPoints
      ? [editPoints[i - 1], editPoints[i + 1]].filter((q): q is Pt => q !== undefined)
      : [];
  /**
   * A + just past each end of the run, to extend it from either end: the new point goes on along
   * the run's direction there (then drag it anywhere).
   */
  const plusAt = (() => {
    if (!editPoints || editPoints.length >= MAX_PATH_POINTS) return [];
    const ends = [
      { end: 'end' as const, tip: editPoints.at(-1)!, before: editPoints.at(-2) },
      { end: 'start' as const, tip: editPoints[0]!, before: editPoints[1] },
    ];
    return ends.map(({ end, tip, before }) => {
      const from = before ?? { x: tip.x + (end === 'end' ? -1 : 1), y: tip.y };
      const d = Math.hypot(tip.x - from.x, tip.y - from.y) || 1;
      const dir = { x: (tip.x - from.x) / d, y: (tip.y - from.y) / d };
      const gap = 22 * hs * px;
      return { end, at: { x: tip.x + dir.x * gap, y: tip.y + dir.y * gap }, dir, tip };
    });
  })();
  const extend = (plus: (typeof plusAt)[number]) => {
    if (!editPath || !editPoints) return;
    const added = {
      x: Math.round((plus.tip.x + plus.dir.x * NEW_POINT_STEP) * 10) / 10,
      y: Math.round((plus.tip.y + plus.dir.y * NEW_POINT_STEP) * 10) / 10,
    };
    onEditPoints!(
      editPath.elementId,
      plus.end === 'end' ? [...editPoints, added] : [added, ...editPoints],
    );
  };

  return (
    <Stage
      width={width}
      height={height}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      draggable={panning || fingerPan}
      style={{ cursor: panning ? 'grab' : armed ? 'crosshair' : 'default' }}
      onDragEnd={(e) => {
        if (e.target === e.target.getStage()) view.panTo(e.target.x(), e.target.y());
      }}
      onTouchStart={() => {
        lastTouch.current = Date.now();
      }}
      onTouchMove={(e) => {
        const t = e.evt.touches;
        if (t.length !== 2) return;
        e.evt.preventDefault();
        const stage = e.target.getStage();
        if (!stage) return;
        // Two fingers: whatever one finger was dragging (the plan or a device) lets go.
        if (stage.isDragging()) {
          stage.stopDrag();
          view.panTo(stage.x(), stage.y());
        }
        if (!pinching) setPinching(true);
        const rect = stage.container().getBoundingClientRect();
        const a = { x: t[0]!.clientX - rect.left, y: t[0]!.clientY - rect.top };
        const b = { x: t[1]!.clientX - rect.left, y: t[1]!.clientY - rect.top };
        const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        const last = pinch.current;
        if (last && last.dist > 0) {
          view.zoomBy(dist / last.dist, center);
          view.panBy(center.x - last.center.x, center.y - last.center.y);
        }
        pinch.current = { dist, center };
      }}
      onTouchEnd={(e) => {
        lastTouch.current = Date.now();
        if (e.evt.touches.length < 2 && pinch.current) {
          pinch.current = null;
          pinchEnded.current = Date.now();
          setPinching(false);
        }
      }}
      onWheel={(e) => {
        e.evt.preventDefault();
        const stage = e.target.getStage();
        const p = stage?.getPointerPosition();
        if (!p) return;
        if (e.evt.ctrlKey || e.evt.metaKey || Math.abs(e.evt.deltaY) > 0) {
          view.zoomBy(Math.exp(-e.evt.deltaY * 0.0015), p);
        }
      }}
      onMouseMove={(e) => {
        if (!armed) return;
        const p = e.target.getStage()?.getRelativePointerPosition();
        if (!p) return;
        setHover(p);
        if (armedAligns) setGuides(placeAt(p, e.evt.altKey).guides);
      }}
      onMouseLeave={() => {
        setHover(null);
        if (armedAligns) setGuides([]);
      }}
      onClick={(e) => {
        if (panning || fromTouch()) return;
        if (armed) {
          const p = e.target.getStage()?.getRelativePointerPosition();
          if (p) onPlace(placeAt(p, e.evt.altKey).at, e.evt.shiftKey);
          setGuides([]);
          return;
        }
        // Only a click on empty canvas (the background layer doesn't listen) clears the selection.
        if (e.target === e.target.getStage()) onSelect([], 'replace');
      }}
      onTap={(e) => {
        if (panning || justPinched()) return;
        if (armed) {
          const p = e.target.getStage()?.getRelativePointerPosition();
          if (p) {
            const at = placeAt(p, false);
            onPlace(at.at, false);
            // Show where it lined up for a moment (no hover on a touch screen).
            setGuides(at.guides);
            if (at.guides.length) window.setTimeout(() => setGuides([]), 900);
          }
          return;
        }
        if (e.target === e.target.getStage()) onSelect([], 'replace');
      }}
      onDblClick={(e) => {
        if (!fromTouch()) finishIfOnLastPoint(e.target.getStage()?.getRelativePointerPosition());
      }}
      onDblTap={(e) => finishIfOnLastPoint(e.target.getStage()?.getRelativePointerPosition())}
    >
      <Layer listening={false}>
        <Rect
          width={background.width}
          height={background.height}
          fill="#FFFFFF"
          stroke="#CBC6BC"
          strokeWidth={px}
        />
        {image && <KonvaImage image={image} width={background.width} height={background.height} />}
      </Layer>
      <Layer>
        <SceneLayer
          scene={scene}
          draggable={tool === 'select' && !panning && !armed && !pinching}
          onPick={onPick}
          onDragMove={alignDrag}
          onDragEnd={(id, dx, dy) => {
            setGuides([]);
            onMove(selected.has(id) ? selection : [id], dx, dy);
          }}
        />
      </Layer>
      <Layer listening={false}>
        {selectedItems.map((item) => {
          if (item.type === 'marker') {
            const r = item.size * 0.75;
            return (
              <Rect
                key={item.elementId}
                x={item.x - r}
                y={item.y - r}
                width={r * 2}
                height={r * 2}
                stroke={BRASS}
                strokeWidth={1.5 * px}
                dash={[4 * px, 3 * px]}
              />
            );
          }
          if (item.type === 'path') {
            return (
              <Group key={item.elementId}>
                <Path
                  data={item.d}
                  stroke={BRASS}
                  strokeWidth={item.strokeWidth + 4 * px}
                  opacity={0.35}
                  lineCap="round"
                  lineJoin="round"
                />
                {item.points.map((pt, i) => (
                  <Rect
                    key={i}
                    x={pt.x - 3 * px}
                    y={pt.y - 3 * px}
                    width={6 * px}
                    height={6 * px}
                    fill="#FFFFFF"
                    stroke={BRASS}
                    strokeWidth={1.5 * px}
                  />
                ))}
              </Group>
            );
          }
          return (
            <Rect
              key={item.elementId}
              x={item.x - 3 * px}
              y={item.y - 3 * px}
              width={item.text.length * item.fontSize * 0.55 + 6 * px}
              height={item.fontSize * 1.3 + 6 * px}
              stroke={BRASS}
              strokeWidth={1.5 * px}
              dash={[4 * px, 3 * px]}
            />
          );
        })}
      </Layer>
      {editPath && editPoints && (
        <Layer>
          {reshaping && (
            <Line
              points={editPoints.flatMap((p) => [p.x, p.y])}
              stroke={editPath.color}
              strokeWidth={editPath.strokeWidth}
              opacity={0.6}
              lineCap="round"
              lineJoin="round"
              listening={false}
            />
          )}
          {editPoints.map((p, i) => (
            <Circle
              key={i}
              name={`point-${i}`}
              x={p.x}
              y={p.y}
              radius={7 * hs * px}
              hitStrokeWidth={10 * hs * px}
              fill="#FFFFFF"
              stroke={BRASS}
              strokeWidth={2 * px}
              draggable
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = 'move';
              }}
              onMouseLeave={(e) => {
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = '';
              }}
              onDragMove={(e) => {
                // Segments within a few degrees of level or plumb snap straight.
                const at = snapToAxes({ x: e.target.x(), y: e.target.y() }, neighbours(i));
                e.target.position(at);
                const next = editPoints.map((q, j) => (j === i ? at : q));
                setReshaping({ id: editPath.elementId, points: next });
              }}
              onDragEnd={(e) => {
                const at = snapToAxes({ x: e.target.x(), y: e.target.y() }, neighbours(i));
                const next = editPoints.map((q, j) =>
                  j === i ? { x: Math.round(at.x * 10) / 10, y: Math.round(at.y * 10) / 10 } : q,
                );
                setReshaping(null);
                onEditPoints!(editPath.elementId, next);
              }}
            />
          ))}
          {plusAt.map((plus) => (
            <Group
              key={plus.end}
              name={plus.end === 'end' ? 'add-point' : 'add-point-start'}
              x={plus.at.x}
              y={plus.at.y}
              onMouseEnter={(e) => {
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = 'pointer';
              }}
              onMouseLeave={(e) => {
                const c = e.target.getStage()?.container();
                if (c) c.style.cursor = '';
              }}
              onClick={(e) => {
                e.cancelBubble = true;
                if (!fromTouch()) extend(plus);
              }}
              onTap={(e) => {
                e.cancelBubble = true;
                extend(plus);
              }}
            >
              <Circle radius={9 * hs * px} fill={BRASS} stroke="#FFFFFF" strokeWidth={1.5 * px} />
              <Text
                text="+"
                fontSize={16 * hs * px}
                fontStyle="bold"
                fill="#FFFFFF"
                width={18 * hs * px}
                height={18 * hs * px}
                offsetX={9 * hs * px}
                offsetY={8.5 * hs * px}
                align="center"
                verticalAlign="middle"
              />
            </Group>
          ))}
        </Layer>
      )}
      {armed?.kind === 'path' && draft.length > 0 && (
        <Layer listening={false}>
          <Line
            points={[...draft, ...(hover ? [snapToAxes(hover, [draft.at(-1)!])] : [])].flatMap(
              (p) => [p.x, p.y],
            )}
            stroke={draftColor}
            strokeWidth={6}
            opacity={0.75}
            lineCap="round"
            lineJoin="round"
            dash={[10, 6]}
          />
          {draft.map((p, i) => (
            <Circle
              key={i}
              x={p.x}
              y={p.y}
              radius={4 * px}
              fill="#FFFFFF"
              stroke={BRASS}
              strokeWidth={1.5 * px}
            />
          ))}
        </Layer>
      )}
      {guides.length > 0 && (
        <Layer listening={false}>
          {armedAligns && hover && (
            <Circle
              {...placeAt(hover, false).at}
              radius={3.5 * px}
              stroke={GUIDE}
              strokeWidth={1.5 * px}
            />
          )}
          {guides.map((g, i) => {
            if (g.kind === 'line') {
              return (
                <Line
                  key={i}
                  points={[g.from.x, g.from.y, g.to.x, g.to.y]}
                  stroke={GUIDE}
                  strokeWidth={px}
                  dash={[5 * px, 4 * px]}
                />
              );
            }
            // An equal gap: a solid span with end ticks and an "=" at its middle.
            const horizontal = Math.abs(g.to.y - g.from.y) < Math.abs(g.to.x - g.from.x);
            const off = 9 * px;
            const t = 4 * px;
            const a = horizontal
              ? { x: g.from.x, y: g.from.y - off }
              : { x: g.from.x - off, y: g.from.y };
            const b = horizontal ? { x: g.to.x, y: g.to.y - off } : { x: g.to.x - off, y: g.to.y };
            const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
            return (
              <Group key={i}>
                <Line points={[a.x, a.y, b.x, b.y]} stroke={GUIDE} strokeWidth={px} />
                {[a, b].map((e, j) => (
                  <Line
                    key={j}
                    points={
                      horizontal ? [e.x, e.y - t, e.x, e.y + t] : [e.x - t, e.y, e.x + t, e.y]
                    }
                    stroke={GUIDE}
                    strokeWidth={px}
                  />
                ))}
                <Text
                  text="="
                  x={mid.x - 4 * px}
                  y={mid.y - 13 * px}
                  fontSize={11 * px}
                  fontStyle="bold"
                  fill={GUIDE}
                />
              </Group>
            );
          })}
        </Layer>
      )}
    </Stage>
  );
}
