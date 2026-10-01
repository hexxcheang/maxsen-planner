import type { HTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Table({ className, ...rest }: HTMLAttributes<HTMLTableElement>) {
  return <table className={cn('w-full border-collapse text-control', className)} {...rest} />;
}

export function THead({ className, ...rest }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('border-b border-rule-2', className)} {...rest} />;
}

export function TBody(props: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody {...props} />;
}

export function Tr({ className, ...rest }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('border-b border-rule last:border-b-0', className)} {...rest} />;
}

interface CellProps {
  /** Right-aligned, tabular numerals. */
  numeric?: boolean;
}

export function Th({
  numeric,
  className,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & CellProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-3 py-2 text-left text-meta font-medium text-ink-2 first:pl-0 last:pr-0',
        numeric && 'text-right',
        className,
      )}
      {...rest}
    />
  );
}

export function Td({
  numeric,
  className,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & CellProps) {
  return (
    <td
      className={cn(
        'px-3 py-2 align-middle text-ink first:pl-0 last:pr-0',
        numeric && 'numeric tnum text-right',
        className,
      )}
      {...rest}
    />
  );
}
