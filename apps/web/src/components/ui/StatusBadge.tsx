import type { ProjectStatus } from '@maxsen/domain';
import { cn } from '@/lib/cn';
import { STATUS_LABELS } from '@/lib/format';

const DOT: Record<ProjectStatus, string> = {
  draft: 'bg-ink-3',
  'in-progress': 'bg-brass',
  completed: 'bg-ok',
};

const TEXT: Record<ProjectStatus, string> = {
  draft: 'text-ink-2',
  'in-progress': 'text-brass-2',
  completed: 'text-ok',
};

export function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      data-status={status}
      className={cn(
        'inline-flex items-center gap-1.5 text-meta font-medium whitespace-nowrap',
        TEXT[status],
      )}
    >
      <span aria-hidden className={cn('size-1.5 rounded-full', DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}
