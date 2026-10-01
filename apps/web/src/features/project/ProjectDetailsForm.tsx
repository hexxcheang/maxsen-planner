import { useState, type FormEvent, type ReactNode } from 'react';
import { projectDetailsSchema, type ProjectDetails, type ProjectStatus } from '@maxsen/domain';
import { Field, Input, SegmentedControl, Select } from '@/components/ui';
import { PROPERTY_TYPES, STATUS_LABELS } from '@/lib/format';

interface ProjectDetailsFormProps {
  id: string;
  initial: ProjectDetails;
  onSubmit: (details: ProjectDetails) => void;
  showStatus?: boolean;
  children?: ReactNode;
}

/** Project title and customer fields, validated with the shared domain schema. */
export function ProjectDetailsForm({
  id,
  initial,
  onSubmit,
  showStatus = true,
  children,
}: ProjectDetailsFormProps) {
  const [values, setValues] = useState<ProjectDetails>(initial);
  const [errors, setErrors] = useState<Partial<Record<keyof ProjectDetails, string>>>({});
  const set = <K extends keyof ProjectDetails>(key: K, value: ProjectDetails[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const result = projectDetailsSchema.safeParse(values);
    if (!result.success) {
      const next: typeof errors = {};
      for (const issue of result.error.issues) {
        const key = issue.path[0] as keyof ProjectDetails;
        next[key] ??= issue.message;
      }
      setErrors(next);
      return;
    }
    onSubmit(result.data);
  };

  return (
    <form
      id={id}
      onSubmit={submit}
      noValidate
      className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2"
    >
      <Field
        label="Project title"
        error={errors.title}
        hint="Appears on export covers and in filenames"
        className="sm:col-span-2"
      >
        <Input value={values.title} onChange={(e) => set('title', e.target.value)} autoFocus />
      </Field>
      <Field label="Customer name" optional error={errors.customerName}>
        <Input value={values.customerName} onChange={(e) => set('customerName', e.target.value)} />
      </Field>
      <Field label="Contact number" optional error={errors.customerContact}>
        <Input
          type="tel"
          value={values.customerContact}
          onChange={(e) => set('customerContact', e.target.value)}
        />
      </Field>
      <Field
        label="Property address"
        optional
        error={errors.propertyAddress}
        className="sm:col-span-2"
      >
        <Input
          value={values.propertyAddress}
          onChange={(e) => set('propertyAddress', e.target.value)}
        />
      </Field>
      <Field label="Property type" optional>
        <Select
          value={values.propertyType ?? ''}
          placeholder="Not set"
          options={PROPERTY_TYPES.map((t) => ({ value: t, label: t }))}
          onChange={(v) =>
            set('propertyType', v === '' ? null : (v as ProjectDetails['propertyType']))
          }
        />
      </Field>
      {showStatus && (
        <div className="flex flex-col gap-1.5">
          <span className="text-control font-medium text-ink">Status</span>
          <SegmentedControl<ProjectStatus>
            label="Status"
            value={values.status}
            onChange={(v) => set('status', v)}
            options={(Object.keys(STATUS_LABELS) as ProjectStatus[]).map((s) => ({
              value: s,
              label: STATUS_LABELS[s],
            }))}
          />
        </div>
      )}
      {children}
    </form>
  );
}
