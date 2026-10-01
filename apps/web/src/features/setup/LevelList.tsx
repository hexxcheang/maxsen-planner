import { useState, type KeyboardEvent } from 'react';
import { ArrowDown, ArrowUp, PencilLine, Plus } from 'lucide-react';
import type { Level, Plan } from '@maxsen/domain';
import { Button, IconButton, Input, SectionTitle } from '@/components/ui';
import { cn } from '@/lib/cn';
import { useActions } from '@/lib/data/hooks';

interface LevelListProps {
  projectId: string;
  levels: Level[];
  plans: Plan[];
  selectedId: string | undefined;
  onSelect: (levelId: string) => void;
}

export function LevelList({ projectId, levels, plans, selectedId, onSelect }: LevelListProps) {
  const actions = useActions();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  const commit = (levelId: string) => {
    actions.renameLevel(levelId, draft);
    setEditing(null);
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>, levelId: string) => {
    if (e.key === 'Enter') commit(levelId);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setEditing(null);
    }
  };

  return (
    <section aria-label="Levels section" className="flex min-h-0 flex-col">
      <SectionTitle
        className="mb-3"
        actions={
          <Button
            size="sm"
            icon={<Plus className="size-3.5" />}
            onClick={() => onSelect(actions.addLevel(projectId))}
          >
            Add level
          </Button>
        }
      >
        Levels
      </SectionTitle>
      <p className="mb-4 text-meta text-ink-2">
        In export order. Levels can be renamed and reordered but not deleted.
      </p>
      <ol aria-label="Levels" className="border-t border-rule">
        {levels.map((l, i) => {
          const selected = l.id === selectedId;
          const types = plans
            .filter((p) => p.levelId === l.id)
            .map((p) => (p.type === 'smart-home' ? 'Smart Home' : 'Lighting'));
          return (
            <li
              key={l.id}
              data-level-name={l.name}
              className={cn(
                'relative flex items-center gap-2 border-b border-rule py-2 pr-1 pl-3',
                selected &&
                  'bg-brass-tint before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brass',
              )}
            >
              {editing === l.id ? (
                <Input
                  compact
                  autoFocus
                  aria-label="Level name"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => onKey(e, l.id)}
                  onBlur={() => commit(l.id)}
                />
              ) : (
                <button
                  type="button"
                  aria-current={selected || undefined}
                  aria-label={l.name}
                  onClick={() => onSelect(l.id)}
                  className="flex min-w-0 flex-1 flex-col items-start text-left"
                >
                  <span className="w-full truncate text-control font-medium text-ink">
                    {l.name}
                  </span>
                  <span className="w-full truncate text-meta text-ink-2">
                    {types.length ? types.join(' and ') : 'No plans yet'}, {l.paperSize}{' '}
                    {l.orientation}
                  </span>
                </button>
              )}
              {editing !== l.id && (
                <span className="flex shrink-0 items-center">
                  <IconButton
                    size="sm"
                    label={`Rename ${l.name}`}
                    icon={<PencilLine />}
                    onClick={() => {
                      setDraft(l.name);
                      setEditing(l.id);
                    }}
                  />
                  <IconButton
                    size="sm"
                    label={`Move ${l.name} up`}
                    icon={<ArrowUp />}
                    disabled={i === 0}
                    className="disabled:text-ink-3 disabled:hover:bg-transparent"
                    onClick={() => actions.moveLevel(l.id, -1)}
                  />
                  <IconButton
                    size="sm"
                    label={`Move ${l.name} down`}
                    icon={<ArrowDown />}
                    disabled={i === levels.length - 1}
                    className="disabled:text-ink-3 disabled:hover:bg-transparent"
                    onClick={() => actions.moveLevel(l.id, 1)}
                  />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
