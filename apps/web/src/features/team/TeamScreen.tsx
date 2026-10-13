import { useState } from 'react';
import { CloudOff, Lock, Mail, MessageCircle, Plus, TriangleAlert } from 'lucide-react';
import { byName, whatsappNumber, type TeamMember } from '@maxsen/domain';
import { Button, PageHeader } from '@/components/ui';
import { Page } from '@/components/Page';
import { useAdmin } from '@/app/auth/useAdmin';
import { cn } from '@/lib/cn';
import { useEnsureName } from '@/lib/shared/useEnsureName';
import { MemberDialog } from './MemberDialog';
import { useTeam } from './team-api';

/**
 * Everyone on the team, with their role and WhatsApp number: the timetable assigns and messages
 * people from here. Everyone signed in sees it; the admin keeps it.
 */
export function TeamScreen() {
  const { members, state, put, drop } = useTeam();
  const { unlocked, requireAdmin } = useAdmin();
  const { ensureName, dialog: nameDialog } = useEnsureName();
  const [opened, setOpened] = useState<TeamMember | 'new' | null>(null);
  const sorted = [...members].sort(byName);
  const missing = members.filter((m) => m.active && !(m.phone && whatsappNumber(m.phone).ok));

  if (state === 'unavailable')
    return (
      <Page>
        <PageHeader title="Team" />
        <p className="flex items-center gap-2 border-t border-rule py-10 text-body text-ink-2">
          <CloudOff aria-hidden className="size-5" />
          The team is kept on the team server, which can’t be reached from here.
        </p>
      </Page>
    );

  return (
    <Page wide>
      <PageHeader
        title="Team"
        description="Everyone at Maxsen with their role and WhatsApp number. The timetable assigns appointments to the team and messages them on these numbers."
        actions={
          unlocked ? (
            <Button
              variant="primary"
              icon={<Plus className="size-4" />}
              onClick={() => setOpened('new')}
            >
              Add person
            </Button>
          ) : (
            <Button
              variant="ghost"
              icon={<Lock className="size-4" />}
              onClick={() => void requireAdmin('change the team')}
            >
              Admin: edit team
            </Button>
          )
        }
      />
      {missing.length > 0 && (
        <p
          role="status"
          className="mb-4 flex items-start gap-2 border-l-[3px] border-warn bg-warn-tint px-3 py-2 text-control text-ink"
        >
          <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
          No WhatsApp number yet for {missing.map((m) => m.name).join(', ')}. Add it so the
          timetable can message them.
        </p>
      )}
      {state === 'offline' && (
        <p className="mb-3 flex items-center gap-1.5 text-meta text-ink-2">
          <CloudOff aria-hidden className="size-4" />
          Offline: showing the last copy
        </p>
      )}
      {sorted.length === 0 ? (
        <p className="border-t border-rule py-10 text-body text-ink-2">
          No one on the team yet. Unlock admin, then Add person.
        </p>
      ) : (
        <ul
          aria-label="Team"
          className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3"
        >
          {sorted.map((m) => {
            const number = m.phone ? whatsappNumber(m.phone) : null;
            return (
              <li
                key={m.id}
                className={cn(
                  'flex flex-col gap-2 rounded-md border border-rule bg-surface p-3',
                  !m.active && 'opacity-60',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        unlocked
                          ? setOpened(m)
                          : void requireAdmin('change the team').then((ok) => ok && setOpened(m))
                      }
                      className="text-left text-body font-medium text-ink hover:underline"
                    >
                      {m.name}
                    </button>
                    <p className="text-meta text-ink-2">
                      {m.role ?? 'No role set'}
                      {!m.active && ' · Inactive'}
                    </p>
                  </div>
                </div>
                {number?.ok ? (
                  <a
                    href={`https://wa.me/${number.digits}`}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`WhatsApp ${m.name}`}
                    className="inline-flex items-center gap-1.5 self-start rounded-chip bg-[#25D366]/10 px-2 py-0.5 text-control text-ink hover:bg-[#25D366]/20"
                  >
                    <MessageCircle aria-hidden className="size-4 text-[#1a9e4b]" />
                    {number.display}
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-meta text-warn">
                    <TriangleAlert aria-hidden className="size-3.5" />
                    {m.phone ? `Check the number: ${m.phone}` : 'No WhatsApp number'}
                  </span>
                )}
                {m.email && (
                  <a
                    href={`mailto:${m.email}`}
                    className="inline-flex items-center gap-1.5 text-meta text-ink-2 hover:text-ink"
                  >
                    <Mail aria-hidden className="size-3.5" />
                    {m.email}
                  </a>
                )}
                {m.notes && <p className="line-clamp-2 text-meta text-ink-3">{m.notes}</p>}
              </li>
            );
          })}
        </ul>
      )}
      {nameDialog}
      {opened && (
        <MemberDialog
          key={opened === 'new' ? 'new' : opened.id}
          member={opened === 'new' ? null : opened}
          ensureName={ensureName}
          requireAdmin={requireAdmin}
          onClose={() => setOpened(null)}
          onSaved={put}
          onDeleted={drop}
        />
      )}
    </Page>
  );
}
