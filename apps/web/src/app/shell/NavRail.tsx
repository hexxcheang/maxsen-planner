import type { ReactNode } from 'react';
import { NavLink, useMatch } from 'react-router';
import {
  CircleHelp,
  FileDown,
  FolderOpen,
  Layers,
  LayoutTemplate,
  ListChecks,
  LogOut,
  MessageSquareText,
  Zap,
  Package,
  PencilRuler,
  ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { Tooltip } from '@/components/ui';
import { useAuth } from '../auth/auth-context';

interface RailItem {
  to: string;
  label: string;
  icon: ReactNode;
  end?: boolean;
}

const GLOBAL: RailItem[] = [
  { to: '/', label: 'Projects', icon: <FolderOpen />, end: true },
  { to: '/quote', label: 'Quote', icon: <MessageSquareText /> },
  { to: '/electrical', label: 'Electrical', icon: <Zap /> },
  { to: '/catalogue', label: 'Catalogue', icon: <Package /> },
  { to: '/templates', label: 'Templates', icon: <LayoutTemplate /> },
  { to: '/admin', label: 'Admin', icon: <ShieldCheck /> },
  { to: '/help', label: 'Help', icon: <CircleHelp /> },
];

const projectItems = (id: string): RailItem[] => [
  { to: `/projects/${id}/setup`, label: 'Setup', icon: <Layers /> },
  { to: `/projects/${id}/plan`, label: 'Plan', icon: <PencilRuler /> },
  { to: `/projects/${id}/review`, label: 'Review', icon: <ListChecks /> },
  { to: `/projects/${id}/exports`, label: 'Exports', icon: <FileDown /> },
];

function RailLink({ item }: { item: RailItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex h-12 w-full flex-col items-center justify-center gap-0.5 text-[10px] leading-3 transition-colors duration-[var(--dur)]',
          '[&_svg]:size-[18px] [&_svg]:stroke-[1.75]',
          isActive
            ? 'text-ink before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-brass [&_svg]:text-brass-2'
            : 'text-ink-2 hover:text-ink',
        )
      }
    >
      {item.icon}
      <span>{item.label}</span>
    </NavLink>
  );
}

export function NavRail() {
  const { signOut } = useAuth();
  const inProject = useMatch('/projects/:projectId/*');
  const projectId = inProject?.params.projectId;
  const showProject = projectId !== undefined && projectId !== 'new';

  return (
    <nav
      aria-label="Main"
      className="z-[var(--z-rail)] flex w-[var(--rail-w)] shrink-0 flex-col items-center border-r border-rule bg-surface"
    >
      <NavLinkLogo />
      <ul className="flex w-full flex-col">
        {GLOBAL.map((item) => (
          <li key={item.to}>
            <RailLink item={item} />
          </li>
        ))}
      </ul>
      {showProject && (
        <>
          <div aria-hidden className="mx-auto my-2 h-px w-8 bg-rule" />
          <ul aria-label="Current project" className="flex w-full flex-col">
            {projectItems(projectId).map((item) => (
              <li key={item.to}>
                <RailLink item={item} />
              </li>
            ))}
          </ul>
        </>
      )}
      <div className="mt-auto w-full pb-2">
        <Tooltip content="Sign out" side="right">
          <button
            type="button"
            onClick={signOut}
            aria-label="Sign out"
            className="flex h-11 w-full items-center justify-center text-ink-2 hover:text-ink [&_svg]:size-[18px]"
          >
            <LogOut />
          </button>
        </Tooltip>
      </div>
    </nav>
  );
}

function NavLinkLogo() {
  return (
    <NavLink
      to="/"
      aria-label="Maxsen Smart Home Planner, projects"
      className="flex h-[var(--topbar-h)] w-full shrink-0 items-center justify-center border-b border-rule"
    >
      <span
        aria-hidden
        className="flex size-7 items-center justify-center rounded-control bg-ink text-[13px] font-semibold text-surface"
      >
        M
      </span>
    </NavLink>
  );
}
