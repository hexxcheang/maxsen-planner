import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { FilePlus2, LayoutTemplate } from 'lucide-react';
import { Button, buttonClass, PageHeader } from '@/components/ui';
import { Page } from '@/components/Page';
import { cn } from '@/lib/cn';
import { useActions, useTemplates } from '@/lib/data/hooks';
import { EMPTY_DETAILS, ProjectDetailsForm } from '@/features/project/ProjectDetailsForm';

type Start = { kind: 'blank' } | { kind: 'template'; id: string };

export function NewProjectScreen() {
  const [params] = useSearchParams();
  const { data: templates } = useTemplates();
  const actions = useActions();
  const navigate = useNavigate();
  const preset = params.get('template');
  const [start, setStart] = useState<Start | null>(
    preset && templates.some((t) => t.id === preset) ? { kind: 'template', id: preset } : null,
  );
  const [step, setStep] = useState<1 | 2>(1);
  const template =
    start?.kind === 'template' ? templates.find((t) => t.id === start.id) : undefined;

  const options: {
    key: string;
    start: Start;
    title: string;
    body: string;
    icon: React.ReactNode;
  }[] = [
    {
      key: 'blank',
      start: { kind: 'blank' },
      title: 'Start from blank',
      body: 'One empty level. Add drawings, levels and plans in Setup.',
      icon: <FilePlus2 />,
    },
    ...templates.map((t) => ({
      key: t.id,
      start: { kind: 'template', id: t.id } as Start,
      title: t.name,
      body: t.description,
      icon: <LayoutTemplate />,
    })),
  ];
  const isSelected = (s: Start) =>
    start?.kind === s.kind &&
    (s.kind === 'blank' || (start.kind === 'template' && start.id === s.id));

  return (
    <Page>
      <div className="max-w-[720px]">
        <p className="text-meta text-ink-3">Step {step} of 2</p>
        <PageHeader
          title="New project"
          description={
            step === 1
              ? 'Start with an empty project or copy the layout of an approved template.'
              : template
                ? `Starting from the template ${template.name}. You’ll assign this project’s drawings in Setup.`
                : 'Only the title is required. Everything can be changed later.'
          }
        />
        {step === 1 ? (
          <>
            <div
              role="radiogroup"
              aria-label="How to start"
              className="flex flex-col border-t border-rule"
            >
              {options.map((o) => {
                const selected = isSelected(o.start);
                return (
                  <button
                    key={o.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setStart(o.start)}
                    className={cn(
                      'relative flex items-start gap-4 border-b border-rule px-4 py-4 text-left transition-colors duration-[var(--dur)]',
                      selected ? 'bg-brass-tint' : 'hover:bg-surface',
                      selected &&
                        'before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-brass',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 [&_svg]:size-5',
                        selected ? 'text-brass-2' : 'text-ink-2',
                      )}
                    >
                      {o.icon}
                    </span>
                    <span className="flex flex-col">
                      <span className="text-body font-semibold text-ink">{o.title}</span>
                      <span className="text-control text-ink-2">{o.body}</span>
                      {o.start.kind === 'template' && (
                        <span className="mt-1 text-meta text-ink-3">Template</span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex gap-2">
              <Button variant="primary" disabled={!start} onClick={() => setStep(2)}>
                Continue
              </Button>
              <Link to="/" className={buttonClass('secondary')}>
                Cancel
              </Link>
            </div>
          </>
        ) : (
          <>
            <ProjectDetailsForm
              id="new-project"
              initial={EMPTY_DETAILS}
              showStatus={false}
              onSubmit={(details) => {
                const id = actions.createProject({ ...details, templateId: template?.id ?? null });
                void navigate(`/projects/${id}/setup`);
              }}
            />
            <div className="mt-6 flex gap-2">
              <Button type="submit" form="new-project" variant="primary">
                Create project
              </Button>
              <Button onClick={() => setStep(1)}>Back</Button>
            </div>
          </>
        )}
      </div>
    </Page>
  );
}
