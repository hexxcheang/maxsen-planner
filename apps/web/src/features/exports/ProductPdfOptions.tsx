import {
  CATEGORIES,
  categoriesForPlan,
  resolveCategoryStyle,
  type Project,
  type Settings,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Checkbox } from '@/components/ui';
import { useActions } from '@/lib/data/hooks';
import { CustomerToggles } from './FloorPlanOptions';

export function ProductPdfOptions({ project, settings }: { project: Project; settings: Settings }) {
  const actions = useActions();
  const excluded = project.exportSettings.productDescription.excludedCategories;
  return (
    <div className="flex flex-col gap-6">
      <CustomerToggles project={project} which="productDescription" />
      <fieldset aria-label="Categories in the product description">
        <legend className="mb-1 text-meta font-semibold text-ink-2">Categories to include</legend>
        <p className="mb-2 text-meta text-ink-3">Drivers are never listed in this document.</p>
        {(['smart-home', 'lighting'] as const).map((pt) => (
          <div key={pt} className="mb-2">
            <p className="mb-1 text-meta text-ink-2">
              {pt === 'smart-home' ? 'Smart Home' : 'Lighting'}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {categoriesForPlan(pt).map((c) => (
                <Checkbox
                  key={c.id}
                  checked={!excluded.includes(c.id)}
                  onCheckedChange={(v) =>
                    actions.updateExportSettings(project.id, (e) => {
                      const cur = e.productDescription.excludedCategories;
                      const next = v ? cur.filter((x) => x !== c.id) : [...cur, c.id];
                      e.productDescription.excludedCategories = CATEGORIES.map((x) => x.id).filter(
                        (id) => next.includes(id),
                      );
                    })
                  }
                  label={
                    <span className="flex items-center gap-1.5">
                      <CategoryGlyph
                        categoryId={c.id}
                        style={resolveCategoryStyle(c.id, settings)}
                        size={12}
                        showBadge={false}
                      />
                      {c.name}
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </fieldset>
    </div>
  );
}
