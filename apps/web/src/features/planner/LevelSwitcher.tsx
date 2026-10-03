import type { Level, PlanType } from '@maxsen/domain';
import { SegmentedControl, Select } from '@/components/ui';

interface LevelSwitcherProps {
  levels: Level[];
  levelId: string;
  planType: PlanType;
  onChange: (levelId: string, planType: PlanType) => void;
}

export function LevelSwitcher({ levels, levelId, planType, onChange }: LevelSwitcherProps) {
  return (
    <div className="absolute top-3 left-3 z-[var(--z-toolbar)] flex items-center gap-2 rounded-popover border border-rule bg-surface p-1 shadow-float">
      <Select
        compact
        aria-label="Level"
        className="w-36"
        value={levelId}
        onChange={(id) => onChange(id, planType)}
        options={levels.map((l) => ({ value: l.id, label: l.name }))}
      />
      <SegmentedControl<PlanType>
        label="Plan type"
        value={planType}
        onChange={(t) => onChange(levelId, t)}
        options={[
          { value: 'smart-home', label: 'Smart Home' },
          { value: 'lighting', label: 'Lighting' },
        ]}
      />
    </div>
  );
}
