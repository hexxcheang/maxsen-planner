/**
 * The scene model: a renderer-neutral description of everything drawn on top of a plan
 * background. The Konva editor and the PDF export both draw from it, so what the planner sees
 * is what the export contains.
 */
import { CATEGORIES, type BadgeStyle, type CategoryId, type ElementKind } from '../categories.ts';
import { badgePlacement, iconPath, type IconShape } from '../icons.ts';
import {
  headPositions,
  pathMidpoint,
  polylineToSvgPath,
  smoothToSvgPath,
} from '../geometry/path.ts';
import type { VariantResolver } from '../totals/compute-totals.ts';
import type { PlanDocument, Pt, Settings } from '../types.ts';
import { badgeTextColor, resolveCategoryStyle } from './styles.ts';

export interface SceneOptions {
  showLabels: boolean;
  showLedLengths: boolean;
  showTrackLabels: boolean;
  showNotes: boolean;
  hiddenCategories: CategoryId[];
}

export interface SceneLabel {
  text: string;
  x: number;
  y: number;
  fontSize: number;
}

export interface SceneBadge {
  text: string;
  /** Text colour: readable on the fill for filled badges, the category colour for outline ones. */
  color: string;
  /** Offset from the icon centre in plan units, before rotation. */
  dx: number;
  dy: number;
  fontSize: number;
}

export interface SceneMarker {
  type: 'marker';
  elementId: string;
  z: number;
  categoryId: CategoryId;
  shape: IconShape;
  x: number;
  y: number;
  rotation: number;
  size: number;
  color: string;
  badgeStyle: BadgeStyle;
  badge: SceneBadge;
  /** Icon outline in the −0.5…0.5 unit box; scale by `size` and translate to (x, y). */
  pathD: string;
  label?: SceneLabel;
}

export interface SceneHead {
  x: number;
  y: number;
  angle: number;
  size: number;
}

export interface ScenePath {
  type: 'path';
  elementId: string;
  z: number;
  categoryId: CategoryId;
  kind: 'led-strip' | 'track' | 'curtain';
  shape: IconShape;
  d: string;
  points: Pt[];
  closed: boolean;
  smooth: boolean;
  strokeWidth: number;
  color: string;
  /** Dot pattern (dash, gap) for a dotted line (curtains); absent for a solid one. */
  dash?: [number, number];
  heads: SceneHead[];
  label?: SceneLabel;
}

export interface SceneNote {
  type: 'note';
  elementId: string;
  z: number;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  bold: boolean;
  color: string;
  highlight: string | null;
}

export type SceneItem = SceneMarker | ScenePath | SceneNote;

export interface SceneLegendEntry {
  categoryId: CategoryId;
  name: string;
  shape: IconShape;
  color: string;
  badge: string;
  badgeStyle: BadgeStyle;
  kind: ElementKind;
}

export interface Scene {
  width: number;
  height: number;
  /** Everything to draw, in ascending z order. */
  items: SceneItem[];
  /** Categories present among the drawn items, in fixed category order. */
  legend: SceneLegendEntry[];
}

export interface SceneContext {
  settings: Settings;
  resolve: VariantResolver;
  width: number;
  height: number;
}

const LABEL_OFFSET = 0.85;
const LABEL_FONT = 0.5;
const BADGE_FONT = 0.42;
const STROKE_FACTOR = 0.3;
const HEAD_FACTOR = 0.6;

/** Metres as entered, trimmed to at most two decimals; `?` while not yet entered. */
export function formatLedLabel(metres: number | null): string {
  if (metres === null) return '? m LED Strip';
  return `${Number(metres.toFixed(2))}m LED Strip`;
}

export function formatTrackLabel(categoryId: CategoryId, headCount: number): string {
  return categoryId === 'magnetic-track-lights'
    ? `${headCount}-module Magnetic Track`
    : `${headCount}-head Track`;
}

export function buildScene(doc: PlanDocument, ctx: SceneContext, opts: SceneOptions): Scene {
  const hidden = new Set<CategoryId>(opts.hiddenCategories);
  const present = new Set<CategoryId>();
  const items: SceneItem[] = [];
  const elements = [...doc.elements].sort((a, b) => a.z - b.z);

  for (const el of elements) {
    if (el.kind === 'note') {
      if (!opts.showNotes) continue;
      items.push({
        type: 'note',
        elementId: el.id,
        z: el.z,
        x: el.x,
        y: el.y,
        text: el.text,
        fontSize: el.fontSize,
        bold: el.bold,
        color: el.color,
        highlight: el.highlight,
      });
      continue;
    }

    const snapshot = ctx.resolve(el.variantId);
    const categoryId = snapshot?.categoryId ?? fallbackCategory(el.kind);
    if (hidden.has(categoryId)) continue;
    const style = resolveCategoryStyle(categoryId, ctx.settings);
    present.add(categoryId);

    if (el.kind === 'marker') {
      const placement = badgePlacement(style.shape);
      const badgeScale = style.badge.length > 2 ? 0.78 : 1;
      const marker: SceneMarker = {
        type: 'marker',
        elementId: el.id,
        z: el.z,
        categoryId,
        shape: style.shape,
        x: el.x,
        y: el.y,
        rotation: el.rotation,
        size: style.size,
        color: style.color,
        badgeStyle: style.badgeStyle,
        badge: {
          text: style.badge,
          color: style.badgeStyle === 'filled' ? badgeTextColor(style.color) : style.color,
          dx: placement.x * style.size,
          dy: placement.y * style.size,
          fontSize: style.size * BADGE_FONT * placement.scale * badgeScale,
        },
        pathD: iconPath(style.shape),
      };
      if (opts.showLabels && el.label.trim().length > 0) {
        marker.label = {
          text: el.label,
          x: el.x,
          y: el.y + style.size * LABEL_OFFSET,
          fontSize: style.size * LABEL_FONT,
        };
      }
      items.push(marker);
      continue;
    }

    if (el.kind === 'curtain') {
      // A curtain track: a dotted line along the window, a little heavier than an LED strip.
      const strokeWidth = style.size * STROKE_FACTOR * 1.1;
      items.push({
        type: 'path',
        elementId: el.id,
        z: el.z,
        categoryId,
        kind: 'curtain',
        shape: style.shape,
        d: polylineToSvgPath(el.points, false),
        points: el.points,
        closed: false,
        smooth: false,
        strokeWidth,
        color: style.color,
        dash: [0.001, strokeWidth * 1.9],
        heads: [],
      });
      continue;
    }

    const isLed = el.kind === 'led-strip';
    const closed = isLed ? el.closed : false;
    const smooth = isLed ? el.smooth : false;
    const path: ScenePath = {
      type: 'path',
      elementId: el.id,
      z: el.z,
      categoryId,
      kind: el.kind,
      shape: style.shape,
      d: smooth ? smoothToSvgPath(el.points, closed) : polylineToSvgPath(el.points, closed),
      points: el.points,
      closed,
      smooth,
      strokeWidth: style.size * STROKE_FACTOR,
      color: style.color,
      heads: isLed
        ? []
        : headPositions(el.points, el.headCount).map((h) => ({
            x: h.point.x,
            y: h.point.y,
            angle: h.angle,
            size: style.size * HEAD_FACTOR,
          })),
    };
    const wantLabel = isLed ? opts.showLedLengths : opts.showTrackLabels;
    if (wantLabel && el.showLabel) {
      const mid = pathMidpoint(el.points, closed);
      path.label = {
        text: isLed ? formatLedLabel(el.metres) : formatTrackLabel(categoryId, el.headCount),
        x: mid.point.x,
        y: mid.point.y,
        fontSize: style.size * LABEL_FONT,
      };
    }
    items.push(path);
  }

  const legend: SceneLegendEntry[] = CATEGORIES.filter((c) => present.has(c.id)).map((c) => {
    const style = resolveCategoryStyle(c.id, ctx.settings);
    return {
      categoryId: c.id,
      name: c.name,
      shape: c.shape,
      color: style.color,
      badge: style.badge,
      badgeStyle: style.badgeStyle,
      kind: c.kind,
    };
  });

  return { width: ctx.width, height: ctx.height, items, legend };
}

/** Category used when a variant cannot be resolved, so the element is still drawn. */
function fallbackCategory(kind: 'marker' | 'led-strip' | 'track' | 'curtain'): CategoryId {
  if (kind === 'led-strip') return 'led-strips';
  if (kind === 'curtain') return 'curtains-blinds';
  if (kind === 'track') return 'track-lights';
  return 'misc-smart-home';
}
