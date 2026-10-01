import { useEffect, useState } from 'react';
import { Group, Image as KonvaImage, Layer, Path, Rect, Stage } from 'react-konva';
import type Konva from 'konva';
import type { Scene } from '@maxsen/domain';
import type { PlannerTool } from '../store/plannerStore';
import type { StageViewport } from './useStageViewport';
import { SceneLayer } from './SceneLayer';

const BRASS = '#A8873A';

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
}

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
}: PlanStageProps) {
  const image = useHtmlImage(background.url);
  const { viewport } = view;
  const [spaceHeld, setSpaceHeld] = useState(false);
  const panning = tool === 'pan' || spaceHeld;

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

  const onPick = (id: string, e: Konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
    if (panning) return;
    const shift = 'shiftKey' in e.evt && e.evt.shiftKey;
    if (shift) onSelect([id], 'toggle');
    else if (!selection.includes(id)) onSelect([id], 'replace');
  };

  const selected = new Set(selection);
  const selectedItems = scene.items.filter((i) => selected.has(i.elementId));
  const px = 1 / viewport.scale;

  return (
    <Stage
      width={width}
      height={height}
      x={viewport.x}
      y={viewport.y}
      scaleX={viewport.scale}
      scaleY={viewport.scale}
      draggable={panning}
      style={{ cursor: panning ? 'grab' : 'default' }}
      onDragEnd={(e) => {
        if (e.target === e.target.getStage()) view.panTo(e.target.x(), e.target.y());
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
      onClick={(e) => {
        // Only a click on empty canvas (the background layer doesn't listen) clears the selection.
        if (e.target === e.target.getStage() && !panning) onSelect([], 'replace');
      }}
      onTap={(e) => {
        if (e.target === e.target.getStage() && !panning) onSelect([], 'replace');
      }}
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
          draggable={tool === 'select' && !panning}
          onPick={onPick}
          onMarkerDragEnd={(id, dx, dy) => onMove(selected.has(id) ? selection : [id], dx, dy)}
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
    </Stage>
  );
}
