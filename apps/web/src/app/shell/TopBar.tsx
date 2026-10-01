import { Lock } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui';
import { useAdmin } from '../auth/auth-context';

interface TopBarProps {
  leftRef: (el: HTMLDivElement | null) => void;
  centerRef: (el: HTMLDivElement | null) => void;
  rightRef: (el: HTMLDivElement | null) => void;
}

export function TopBar({ leftRef, centerRef, rightRef }: TopBarProps) {
  const admin = useAdmin();
  return (
    <header className="relative z-[var(--z-topbar)] flex h-[var(--topbar-h)] shrink-0 items-center gap-4 border-b border-rule bg-surface px-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link
          to="/"
          className="shrink-0 text-control font-semibold tracking-[-0.005em] text-ink max-[1180px]:sr-only"
        >
          Maxsen Smart Home Planner
        </Link>
        <div ref={leftRef} className="flex min-w-0 items-center gap-2 empty:hidden" />
      </div>
      <div ref={centerRef} className="flex shrink-0 items-center empty:hidden" />
      <div className="flex flex-1 items-center justify-end gap-3">
        <div ref={rightRef} className="flex items-center gap-3 empty:hidden" />
        {admin.unlocked && (
          <Button
            size="sm"
            variant="ghost"
            icon={<Lock className="size-3.5 text-brass-2" />}
            onClick={admin.lock}
            title="Lock admin"
          >
            Lock admin
          </Button>
        )}
      </div>
    </header>
  );
}
