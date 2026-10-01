import { useState } from 'react';
import type { Orientation, PaperSize, PlanType } from '@maxsen/domain';
import { SectionTitle, SegmentedControl } from '@/components/ui';
import { useActions, useLevels, usePlans, useSourcePages } from '@/lib/data/hooks';
import { useCurrentProject } from '@/features/project/useProjectContext';
import { CropRotatePanel } from './CropRotatePanel';
import { LevelList } from './LevelList';
import { PlanAssignmentCard } from './PlanAssignmentCard';
import { SourcePanel } from './SourcePanel';
import { PLAN_LABELS } from './labels';

const TYPES: PlanType[] = ['smart-home', 'lighting'];

export function SetupScreen() {
  const project = useCurrentProject();
  const actions = useActions();
  const { data: levels } = useLevels(project.id);
  const { data: plans } = usePlans(project.id);
  const { data: sources } = useSourcePages(project.id);
  const [selected, setSelected] = useState<string | undefined>(
    project.lastOpened?.levelId ?? levels[0]?.id,
  );
  const [adjusting, setAdjusting] = useState<PlanType | null>(null);
  const level = levels.find((l) => l.id === selected) ?? levels[0];
  const levelPlans = plans.filter((p) => p.levelId === level?.id);
  const adjustPlan = levelPlans.find((p) => p.type === adjusting);

  return (
    <div data-screen-ready className="px-[var(--gutter)] pt-7 pb-16">
      <header className="pb-5">
        <h1 className="text-title text-ink">Setup</h1>
        <p className="mt-1 max-w-[68ch] text-body text-ink-2">
          Upload the customer’s drawings, arrange the levels, and give each level a Smart Home Plan,
          a Lighting Plan, or both.
        </p>
      </header>
      <div className="grid grid-cols-[240px_300px_minmax(0,1fr)] gap-8 max-[1180px]:grid-cols-[200px_260px_minmax(0,1fr)] max-[1180px]:gap-5">
        <SourcePanel files={sources.files} pages={sources.pages} plans={plans} levels={levels} />
        <LevelList
          projectId={project.id}
          levels={levels}
          plans={plans}
          selectedId={level?.id}
          onSelect={(id) => {
            setSelected(id);
            setAdjusting(null);
          }}
        />
        {level && (
          <section aria-label="Plans" className="flex min-w-0 flex-col">
            <SectionTitle className="mb-3">{level.name}</SectionTitle>
            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-meta text-ink-2">Export pages</span>
              <SegmentedControl<PaperSize>
                label="Paper size"
                size="sm"
                value={level.paperSize}
                onChange={(paperSize) => actions.setLevelPaper(level.id, { paperSize })}
                options={[
                  { value: 'A4', label: 'A4' },
                  { value: 'A3', label: 'A3' },
                ]}
              />
              <SegmentedControl<Orientation>
                label="Orientation"
                size="sm"
                value={level.orientation}
                onChange={(orientation) => actions.setLevelPaper(level.id, { orientation })}
                options={[
                  { value: 'portrait', label: 'Portrait' },
                  { value: 'landscape', label: 'Landscape' },
                ]}
              />
            </div>
            <div className="grid grid-cols-2 gap-4 max-[1180px]:grid-cols-1">
              {TYPES.map((type) => {
                const plan = levelPlans.find((p) => p.type === type);
                const page = sources.pages.find((p) => p.id === plan?.background.sourcePageId);
                return (
                  <PlanAssignmentCard
                    key={type}
                    projectId={project.id}
                    level={level}
                    type={type}
                    plan={plan}
                    page={page}
                    file={sources.files.find((f) => f.id === page?.sourceFileId)}
                    adjusting={adjusting === type}
                    onAdjust={() => setAdjusting((a) => (a === type ? null : type))}
                  />
                );
              })}
            </div>
            {adjustPlan && (
              <div className="mt-4">
                <CropRotatePanel
                  key={adjustPlan.id}
                  plan={adjustPlan}
                  title={PLAN_LABELS[adjustPlan.type]}
                />
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
