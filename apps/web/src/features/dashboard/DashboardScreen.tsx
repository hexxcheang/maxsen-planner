import { useState } from 'react';
import { PROJECT_STATUSES, type ProjectStatus } from '@maxsen/domain';
import { Link } from 'react-router';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { buttonClass, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui';
import { Page } from '@/components/Page';
import { useProjects } from '@/lib/data/hooks';
import { STATUS_LABELS } from '@/lib/format';
import { cn } from '@/lib/cn';
import { ProjectRow } from './ProjectRow';
import { TeamProjects } from './TeamProjects';

function NewProjectLink() {
  return (
    <Link to="/projects/new" className={buttonClass('primary')}>
      <Plus aria-hidden className="size-4" />
      New project
    </Link>
  );
}

export function DashboardScreen() {
  const [search, setSearch] = useState('');
  const { data: all, isLoading } = useProjects();
  const { data: found } = useProjects(search);
  const [status, setStatus] = useState<ProjectStatus | 'all'>('all');
  const projects = status === 'all' ? found : found.filter((p) => p.status === status);
  const count = (s: ProjectStatus) => all.filter((p) => p.status === s).length;
  const localIds = new Set(all.map((p) => p.id));

  return (
    <Page>
      <PageHeader title="Projects" actions={all.length > 0 && <NewProjectLink />} />
      {isLoading ? (
        <ul aria-label="Loading projects" className="border-t border-rule">
          {Array.from({ length: 5 }, (_, i) => (
            <li key={i} className="flex items-center gap-5 border-b border-rule py-3">
              <Skeleton className="h-16 w-24" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-72" />
                <Skeleton className="h-3 w-48" />
              </div>
            </li>
          ))}
        </ul>
      ) : all.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No projects yet"
          body="Create your first project to start planning."
          action={<NewProjectLink />}
        />
      ) : null}
      {!isLoading && all.length > 0 && (
        <>
          <div role="group" aria-label="Filter by status" className="mb-3 flex flex-wrap gap-1.5">
            {(['all', ...PROJECT_STATUSES] as const).map((s) => {
              const n = s === 'all' ? all.length : count(s);
              if (s !== 'all' && n === 0 && status !== s) return null;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={status === s}
                  onClick={() => setStatus(s)}
                  className={cn(
                    'rounded-chip border px-2.5 py-1 text-meta font-medium',
                    status === s
                      ? 'border-ink bg-ink text-surface'
                      : 'border-rule-2 text-ink-2 hover:border-ink-3 hover:text-ink',
                  )}
                >
                  {s === 'all' ? 'All' : STATUS_LABELS[s]}{' '}
                  <span className="tnum opacity-70">{n}</span>
                </button>
              );
            })}
          </div>
          <div className="mb-3 max-w-sm">
            <Input
              type="search"
              aria-label="Search projects"
              leading={<Search />}
              placeholder="Search by title, customer or address"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {projects.length === 0 ? (
            <p className="border-t border-rule py-10 text-body text-ink-2">
              {search.trim()
                ? `No projects match “${search.trim()}”`
                : `No ${STATUS_LABELS[status as ProjectStatus].toLowerCase()} projects`}
            </p>
          ) : (
            <ul aria-label="Projects" className="border-t border-rule">
              {projects.map((p) => (
                <ProjectRow key={p.id} project={p} />
              ))}
            </ul>
          )}
        </>
      )}
      {!isLoading && <TeamProjects localIds={localIds} />}
    </Page>
  );
}
