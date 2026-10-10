import { useState } from 'react';
import { Link } from 'react-router';
import {
  Check,
  ChevronDown,
  LayoutTemplate,
  MoreHorizontal,
  PencilLine,
  Trash2,
} from 'lucide-react';
import { PROJECT_STATUSES, type Project, type ProjectStatus } from '@maxsen/domain';
import { ConfirmDialog, DropdownMenu, IconButton, LATER_PHASE, StatusBadge } from '@/components/ui';
import { fileUrl } from '@/lib/files';
import { formatUpdated, STATUS_LABELS } from '@/lib/format';
import { useActions } from '@/lib/data/hooks';
import { ProjectDetailsDialog } from '@/features/project/ProjectDetailsDialog';
import { ProjectSchedule } from './ProjectSchedule';

export function ProjectThumbnail({
  fileId,
  className = '',
}: {
  fileId: string | null;
  className?: string;
}) {
  return (
    <span
      className={`flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-chip border border-rule bg-surface ${className}`}
    >
      {fileId ? (
        <img src={fileUrl(fileId)} alt="" className="size-full object-contain p-1" loading="lazy" />
      ) : (
        <span className="text-caption text-ink-3">No drawing</span>
      )}
    </span>
  );
}

export function ProjectRow({ project }: { project: Project }) {
  const actions = useActions();
  const [confirming, setConfirming] = useState(false);
  const [editing, setEditing] = useState(false);
  const href = `/projects/${project.id}/plan`;
  const setStatus = (status: ProjectStatus) =>
    actions.updateProjectDetails(project.id, {
      title: project.title,
      customerName: project.customerName,
      customerContact: project.customerContact,
      propertyAddress: project.propertyAddress,
      propertyType: project.propertyType,
      status,
    });
  const meta = [project.customerName, project.propertyAddress].filter(Boolean).join(', ');

  return (
    <li className="grid grid-cols-[96px_minmax(0,1fr)_auto_auto] items-center gap-x-5 border-b border-rule py-3 max-[900px]:grid-cols-[96px_minmax(0,1fr)_auto]">
      <Link to={href} tabIndex={-1} aria-hidden className="hover:opacity-90 max-[900px]:row-span-2">
        <ProjectThumbnail fileId={project.thumbnailFileId} />
      </Link>
      <div className="min-w-0">
        <Link
          to={href}
          className="block truncate text-body font-semibold text-ink hover:text-brass-2"
        >
          {project.title}
        </Link>
        {meta && <p className="truncate text-control text-ink-2">{meta}</p>}
      </div>
      <div className="flex w-[300px] items-center gap-6 max-[900px]:col-start-2 max-[900px]:row-start-2 max-[900px]:w-auto max-[900px]:gap-3">
        <span className="w-32">
          <DropdownMenu
            align="start"
            trigger={
              <button
                type="button"
                aria-label={`Status of ${project.title}: ${STATUS_LABELS[project.status]}. Change status`}
                className="-mx-1.5 inline-flex items-center gap-1 rounded-chip px-1.5 py-1 hover:bg-paper data-[state=open]:bg-paper"
              >
                <StatusBadge status={project.status} />
                <ChevronDown aria-hidden className="size-3 text-ink-3" />
              </button>
            }
            items={PROJECT_STATUSES.map((s) => ({
              label: STATUS_LABELS[s],
              icon: s === project.status ? <Check /> : <span className="size-4" />,
              onSelect: () => setStatus(s),
            }))}
          />
        </span>
        <span className="tnum text-meta whitespace-nowrap text-ink-2">
          Updated {formatUpdated(project.updatedAt)}
        </span>
      </div>
      <div className="max-[900px]:col-start-3 max-[900px]:row-span-2 max-[900px]:row-start-1">
        <DropdownMenu
          trigger={
            <IconButton
              label={`More actions for ${project.title}`}
              icon={<MoreHorizontal />}
              noTooltip
            />
          }
          items={[
            { label: 'Edit details', icon: <PencilLine />, onSelect: () => setEditing(true) },
            { label: 'Save as template', icon: <LayoutTemplate />, disabledReason: LATER_PHASE },
            'separator',
            {
              label: 'Delete project',
              icon: <Trash2 />,
              destructive: true,
              onSelect: () => setConfirming(true),
            },
          ]}
        />
      </div>
      <div className="col-start-2 col-end-[-1] mt-3 border-t border-dashed border-rule pt-2.5 max-[900px]:row-start-3">
        <ProjectSchedule project={project} />
      </div>
      <ConfirmDialog
        open={confirming}
        title="Delete project"
        body={
          project.shared
            ? `Delete ${project.title}? It’s shared, so it goes for everyone on the team, with its plans. (The server keeps a copy in its trash folder.)`
            : `Delete ${project.title}? This permanently removes the project and its plans.`
        }
        confirmLabel="Delete project"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          actions.deleteProject(project.id);
        }}
      />
      <ProjectDetailsDialog project={project} open={editing} onOpenChange={setEditing} />
    </li>
  );
}
