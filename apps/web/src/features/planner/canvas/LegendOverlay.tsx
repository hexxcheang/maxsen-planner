import type { Scene, Settings } from '@maxsen/domain';
import { resolveCategoryStyle } from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';

/** The plan legend: categories present and visible on this plan, in fixed order. */
export function LegendOverlay({
  scene,
  settings,
  style,
}: {
  scene: Scene;
  settings: Settings;
  style: React.CSSProperties;
}) {
  if (scene.legend.length === 0) return null;
  return (
    <section
      aria-label="Legend"
      style={style}
      className="pointer-events-none absolute z-[5] max-w-[340px] border border-rule-2 bg-surface/95 px-2.5 py-1.5"
    >
      <h2 className="mb-0.5 text-[10px] leading-4 font-semibold text-ink">Legend</h2>
      <ul
        className={
          scene.legend.length > 5 ? 'grid grid-cols-2 gap-x-3 gap-y-0' : 'grid grid-cols-1 gap-y-0'
        }
      >
        {scene.legend.map((e) => (
          <li
            key={e.categoryId}
            className="flex min-w-0 items-center gap-1.5 text-[10px] leading-4 text-ink"
          >
            <CategoryGlyph
              categoryId={e.categoryId}
              style={resolveCategoryStyle(e.categoryId, settings)}
              size={11}
              showBadge={false}
            />
            <span className="truncate">{e.name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
