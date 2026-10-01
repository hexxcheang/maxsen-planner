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
