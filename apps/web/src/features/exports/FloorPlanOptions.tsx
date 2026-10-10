import {
  CATEGORIES,
  categoriesForPlan,
  resolveCategoryStyle,
  type Level,
  type Plan,
  type Project,
  type Settings,
} from '@maxsen/domain';
import { CategoryGlyph } from '@/components/CategoryGlyph';
import { Checkbox, Switch } from '@/components/ui';
import { useActions } from '@/lib/data/hooks';

interface Props {
  project: Project;
  levels: Level[];
  plans: Plan[];
  settings: Settings;
}

export function CustomerToggles({
  project,
  which,
}: {
  project: Project;
  which: 'floorPlan' | 'productDescription';
}) {
  const actions = useActions();
  const s = project.exportSettings[which];
  const set = (
    key: 'showCustomerName' | 'showCustomerContact' | 'showPropertyAddress',
    v: boolean,
  ) =>
    actions.updateExportSettings(project.id, (e) => {
      e[which][key] = v;
    });
  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2 text-meta font-semibold text-ink-2">
        Customer details on the cover
      </legend>
      <Switch
        checked={s.showCustomerName}
        onCheckedChange={(v) => set('showCustomerName', v)}
        label="Customer name"
        description={project.customerName || 'Not entered'}
      />
      <Switch
        checked={s.showCustomerContact}
        onCheckedChange={(v) => set('showCustomerContact', v)}
        label="Contact number"
        description={project.customerContact || 'Not entered'}
      />
      <Switch
        checked={s.showPropertyAddress}
        onCheckedChange={(v) => set('showPropertyAddress', v)}
        label="Property address"
        description={project.propertyAddress || 'Not entered'}
      />
    </fieldset>
  );
}

export function FloorPlanOptions({ project, levels, plans, settings }: Props) {
  const actions = useActions();
  const fp = project.exportSettings.floorPlan;
  const update = (recipe: (f: typeof fp) => void) =>
    actions.updateExportSettings(project.id, (e) => recipe(e.floorPlan));

  return (
    <div className="flex flex-col gap-6">
      <CustomerToggles project={project} which="floorPlan" />
      <fieldset>
        <legend className="mb-2 text-meta font-semibold text-ink-2">Pages</legend>
        <ul className="flex flex-col gap-2">
          {levels.map((l) => {
            const entry = fp.levels[l.id] ?? { smartHome: true, lighting: true };
            const has = (t: Plan['type']) => plans.some((p) => p.levelId === l.id && p.type === t);
            return (
              <li key={l.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3">
                <span className="truncate text-control text-ink">
                  {l.name}{' '}
                  <span className="text-meta text-ink-3">
                    {l.paperSize} {l.orientation}
                  </span>
                </span>
                {(['smartHome', 'lighting'] as const).map((k) => {
                  const type = k === 'smartHome' ? 'smart-home' : 'lighting';
                  return has(type) ? (
                    <Checkbox
                      key={k}
                      checked={entry[k]}
                      label={k === 'smartHome' ? 'Smart Home' : 'Lighting'}
                      onCheckedChange={(v) =>
                        update((f) => {
                          f.levels[l.id] = { ...entry, [k]: v };
                        })
                      }
                    />
                  ) : (
                    <span key={k} className="text-meta text-ink-3">
                      No {k === 'smartHome' ? 'Smart Home' : 'Lighting'}
                    </span>
                  );
                })}
              </li>
            );
          })}
        </ul>
      </fieldset>
      <fieldset aria-label="Categories on the floor plan">
        <legend className="mb-1 text-meta font-semibold text-ink-2">
          Categories on the floor plan
        </legend>
        <p className="mb-2 text-meta text-ink-3">
          Hidden categories are left off the PDF only. Totals don’t change.
        </p>
        {(['smart-home', 'lighting'] as const).map((pt) => (
          <div key={pt} className="mb-2">
            <p className="mb-1 text-meta text-ink-2">
              {pt === 'smart-home' ? 'Smart Home' : 'Lighting'}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
              {categoriesForPlan(pt).map((c) => (
                <Checkbox
                  key={c.id}
                  checked={!fp.hiddenCategories.includes(c.id)}
                  onCheckedChange={(v) =>
                    update((f) => {
                      const next = v
                        ? f.hiddenCategories.filter((h) => h !== c.id)
                        : [...f.hiddenCategories, c.id];
                      f.hiddenCategories = CATEGORIES.map((x) => x.id).filter((id) =>
                        next.includes(id),
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
                      <span aria-hidden={false}>{c.name}</span>
                    </span>
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </fieldset>
      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2 text-meta font-semibold text-ink-2">On each page</legend>
        <Switch
          checked={fp.showLabels}
          onCheckedChange={(v) => update((f) => void (f.showLabels = v))}
          label="Device labels"
        />
        <Switch
          checked={fp.showLedLengths}
          onCheckedChange={(v) => update((f) => void (f.showLedLengths = v))}
          label="LED strip lengths"
        />
        <Switch
          checked={fp.showTrackLabels}
          onCheckedChange={(v) => update((f) => void (f.showTrackLabels = v))}
          label="Track labels"
        />
        <Switch
          checked={fp.showNotes}
          onCheckedChange={(v) => update((f) => void (f.showNotes = v))}
          label="Text notes"
        />
        <Switch
          checked={fp.showLegend}
          onCheckedChange={(v) => update((f) => void (f.showLegend = v))}
          label="Legend"
        />
      </fieldset>
    </div>
  );
}
