import { useState } from 'react';
import { NavLink, Outlet, useParams } from 'react-router';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useProject } from '@/lib/data/hooks';
import { TopBarSlot } from '@/app/shell/TopBarSlot';
import { NotFoundScreen } from '@/features/NotFoundScreen';
import { ProjectDetailsDialog } from './ProjectDetailsDialog';
import type { Project } from '@maxsen/domain';

const TABS = [
  { to: 'setup', label: 'Setup' },
  { to: 'plan', label: 'Plan' },
  { to: 'review', label: 'Review totals' },
  { to: 'exports', label: 'Exports' },
] as const;

export interface ProjectOutletContext {
  project: Project;
}

export function ProjectLayout() {
  const { projectId } = useParams();
  const { data: project } = useProject(projectId);
  const [detailsOpen, setDetailsOpen] = useState(false);
  if (!project) return <NotFoundScreen />;

  return (
    <>
      <TopBarSlot slot="left">
        <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-3" />
        <button
          type="button"
          onClick={() => setDetailsOpen(true)}
          title="Edit project details"
          className="min-w-0 truncate rounded-control px-1 text-control font-medium text-ink hover:bg-paper"
        >
          {project.title}
        </button>
      </TopBarSlot>
      <TopBarSlot slot="center">
        <nav
          aria-label="Project"
          className="flex items-center gap-1 rounded-control border border-rule-2 bg-paper p-0.5"
        >
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={`/projects/${project.id}/${t.to}`}
              className={({ isActive }) =>
                cn(
                  'flex h-[26px] items-center rounded-[3px] px-2.5 text-control whitespace-nowrap transition-colors duration-[var(--dur)]',
                  isActive
                    ? 'bg-surface font-medium text-ink shadow-[0_0_0_1px_var(--rule-2)]'
                    : 'text-ink-2 hover:text-ink',
                )
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </TopBarSlot>
      <Outlet context={{ project } satisfies ProjectOutletContext} />
      <ProjectDetailsDialog project={project} open={detailsOpen} onOpenChange={setDetailsOpen} />
    </>
  );
}
