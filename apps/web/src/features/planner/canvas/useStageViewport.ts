import { useCallback, useEffect, useRef } from 'react';
import { useStore } from 'zustand';
import type { PlannerStore, Viewport } from '../store/plannerStore';

export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 6;
const FIT_PADDING = 32;

interface Size {
  width: number;
  height: number;
}

/**
 * Owns zoom and pan. `scale` is screen pixels per plan unit; zoom is that scale relative to the
 * scale that fits the whole sheet, clamped to 25 %–600 %.
 */
export function useStageViewport(store: PlannerStore, sheet: Size, container: Size) {
  const viewport = useStore(store, (s) => s.viewport);
  const setViewport = useStore(store, (s) => s.setViewport);
  const fitScale =
    container.width > 0 && sheet.width > 0
      ? Math.min(
          (container.width - FIT_PADDING * 2) / sheet.width,
          (container.height - FIT_PADDING * 2) / sheet.height,
        )
      : 1;

  const fit = useCallback(() => {
    if (container.width === 0) return;
    setViewport({
      scale: fitScale,
      x: (container.width - sheet.width * fitScale) / 2,
      y: (container.height - sheet.height * fitScale) / 2,
    });
  }, [container.width, container.height, sheet.width, sheet.height, fitScale, setViewport]);

  // Refit whenever the sheet or the available area changes size.
  const fitted = useRef('');
  useEffect(() => {
    const key = `${sheet.width}x${sheet.height}@${container.width}x${container.height}`;
    if (container.width > 0 && fitted.current !== key) {
      fitted.current = key;
      fit();
    }
  }, [fit, sheet.width, sheet.height, container.width, container.height]);

  const zoomTo = useCallback(
    (nextZoom: number, around?: { x: number; y: number }) => {
      const zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));
      const scale = zoom * fitScale;
      const v = store.getState().viewport;
      const p = around ?? { x: container.width / 2, y: container.height / 2 };
      const planX = (p.x - v.x) / v.scale;
      const planY = (p.y - v.y) / v.scale;
      const next: Viewport = { scale, x: p.x - planX * scale, y: p.y - planY * scale };
      setViewport(next);
    },
    [store, fitScale, container.width, container.height, setViewport],
  );

  const zoom = viewport.scale / fitScale;
  return {
    viewport,
    zoom,
    fit,
    zoomIn: () => zoomTo(zoom * 1.25),
    zoomOut: () => zoomTo(zoom / 1.25),
    zoomBy: (factor: number, around: { x: number; y: number }) => zoomTo(zoom * factor, around),
    panTo: (x: number, y: number) => setViewport({ ...store.getState().viewport, x, y }),
  };
}

export type StageViewport = ReturnType<typeof useStageViewport>;
