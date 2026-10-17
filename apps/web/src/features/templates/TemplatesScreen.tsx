import { useState } from 'react';
import { Link } from 'react-router';
import { LayoutTemplate, PencilLine, Trash2 } from 'lucide-react';
import type { Template } from '@maxsen/domain';
import {
  Button,
  buttonClass,
  ConfirmDialog,
  Dialog,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
} from '@/components/ui';
import { Page } from '@/components/Page';
import { formatDate } from '@/lib/format';
import { useActions, useTemplates } from '@/lib/data/hooks';
import { useAdminAction } from '@/app/auth/useAdminAction';

function levelsSummary(t: Template) {
  const ls = [...t.structure.levels].sort((a, b) => a.sortOrder - b.sortOrder);
  return ls
    .map((l) => {
      const types = l.plans
        .map((p) => (p.type === 'smart-home' ? 'Smart Home' : 'Lighting'))
        .join(' and ');
      return `${l.name} (${types || 'no plans'})`;
    })
    .join(', ');
}

export function TemplatesScreen() {
  const { data: templates } = useTemplates();
  const actions = useActions();
  const asAdmin = useAdminAction();
  const [renaming, setRenaming] = useState<Template | null>(null);
  const [name, setName] = useState('');
  const [deleting, setDeleting] = useState<Template | null>(null);

  return (
    <Page>
      <PageHeader
        title="Templates"
        description="Approved starting layouts. A new project copies the template’s levels and export settings, then gets its own drawings in Setup. Copying placed devices comes with drawing assignment in a later phase."
      />
      {templates.length === 0 ? (
        <EmptyState
          icon={<LayoutTemplate />}
          title="No templates yet"
          body="Admins can save a finished project as a template from its menu on the projects page."
          action={
            <Link to="/projects/new" className={buttonClass('primary')}>
              Start a blank project
            </Link>
          }
        />
      ) : (
        <ul aria-label="Templates" className="border-t border-rule">
          {templates.map((t) => (
            <li
              key={t.id}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-rule py-4"
            >
              <div className="min-w-0">
                <p className="text-body font-semibold text-ink">{t.name}</p>
                <p className="max-w-[72ch] text-control text-ink-2">{t.description}</p>
                <p className="mt-1 text-meta text-ink-3">
                  {levelsSummary(t)}. Updated {formatDate(t.updatedAt)}.
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={`/projects/new?template=${t.id}`}
                  aria-label={`Use ${t.name}`}
                  className={buttonClass('secondary', 'sm')}
                >
                  Use template
                </Link>
                <IconButton
                  size="sm"
                  label={`Rename ${t.name}`}
                  icon={<PencilLine />}
                  onClick={() =>
                    asAdmin('rename templates', () => {
                      setName(t.name);
                      setRenaming(t);
                    })
                  }
                />
                <IconButton
                  size="sm"
                  label={`Delete ${t.name}`}
                  icon={<Trash2 />}
                  onClick={() => asAdmin('delete templates', () => setDeleting(t))}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
      <Dialog
        open={renaming !== null}
        onOpenChange={(o) => !o && setRenaming(null)}
        width="sm"
        title="Rename template"
        footer={
          <>
            <Button onClick={() => setRenaming(null)}>Cancel</Button>
            <Button type="submit" form="rename-template" variant="primary">
              Save name
            </Button>
          </>
        }
      >
        <form
          id="rename-template"
          onSubmit={(e) => {
            e.preventDefault();
            if (renaming && name.trim()) actions.renameTemplate(renaming.id, name);
            setRenaming(null);
          }}
        >
          <Field label="Template name">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
        </form>
      </Dialog>
      <ConfirmDialog
        open={deleting !== null}
        title="Delete template"
        body={`Delete ${deleting?.name ?? ''}? Projects already started from it are not affected.`}
        confirmLabel="Delete template"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) actions.deleteTemplate(deleting.id);
          setDeleting(null);
        }}
      />
    </Page>
  );
}
