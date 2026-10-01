import { useState } from 'react';
import { Link } from 'react-router';
import { FolderOpen, Plus, Search } from 'lucide-react';
import { buttonClass, EmptyState, Input, PageHeader, Skeleton } from '@/components/ui';
import { Page } from '@/components/Page';
import { useProjects } from '@/lib/data/hooks';
import { ProjectRow } from './ProjectRow';

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
  const { data: projects } = useProjects(search);

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
      ) : (
        <>
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
              No projects match “{search.trim()}”
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
    </Page>
  );
}
