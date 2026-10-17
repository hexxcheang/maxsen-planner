import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { FieldContext } from './field-context';

interface FieldProps {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** Adds "Optional" after the label. */
  optional?: boolean;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, optional, className, children }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ');
  return (
    <FieldContext.Provider
      value={{ id, describedBy: describedBy || undefined, invalid: Boolean(error) }}
    >
      <div className={cn('flex flex-col gap-1.5', className)}>
        <label htmlFor={id} className="text-control font-medium text-ink">
          {label}
          {optional && <span className="ml-1.5 font-normal text-ink-3">Optional</span>}
        </label>
        {children}
        {error && (
          <p id={errorId} className="text-meta text-danger">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={hintId} className="text-meta text-ink-2">
            {hint}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  );
}
