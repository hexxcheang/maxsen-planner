import { cn } from '@/lib/cn';

export function ColorSwatch({
  color,
  size = 16,
  className,
}: {
  color: string;
  size?: number;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn('inline-block shrink-0 rounded-chip border border-ink/10', className)}
      style={{ width: size, height: size, background: color }}
    />
  );
}
