import { categoryById, type BadgeStyle, type CategoryId, type ElementKind } from '../categories.ts';
import type { IconShape } from '../icons.ts';
import type { Settings } from '../types.ts';

export interface CategoryStyle {
  color: string;
  badge: string;
  badgeStyle: BadgeStyle;
  /** Icon size in plan units. */
  size: number;
  shape: IconShape;
  kind: ElementKind;
  name: string;
}

/** Category defaults merged with the admin's global overrides; shape and kind are never overridable. */
export function resolveCategoryStyle(categoryId: CategoryId, settings: Settings): CategoryStyle {
  const def = categoryById(categoryId);
  const o = settings.categoryStyles[categoryId] ?? {};
  return {
    color: o.color ?? def.defaults.color,
    badge: o.badge ?? def.defaults.badge,
    badgeStyle: o.badgeStyle ?? def.defaults.badgeStyle,
    size: o.size ?? def.defaults.size,
    shape: def.shape,
    kind: def.kind,
    name: def.name,
  };
}

const WHITE = '#FFFFFF';
const INK = '#1F1D1A';

function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG contrast ratio between two `#RRGGBB` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (hi + 0.05) / (lo + 0.05);
}

/** Badge text colour for a filled icon: white unless the fill is too light, then ink. */
export function badgeTextColor(fill: string): string {
  return contrastRatio(fill, WHITE) >= 4.5 ? WHITE : INK;
}
