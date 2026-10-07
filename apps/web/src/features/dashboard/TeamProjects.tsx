import { useState } from 'react';
import { useNavigate } from 'react-router';
import { CloudDownload, Users } from 'lucide-react';
import type { ProjectStatus } from '@maxsen/domain';
import { Button, StatusBadge, useToast } from '@/components/ui';
import { useStoreContext } from '@/lib/data/store-context';
import { formatUpdated } from '@/lib/format';
import { loadShared } from '@/lib/shared/api';
import { useNow, useSharedList } from '@/lib/shared/useShared';

/** Projects the team has saved that aren't on this device yet, ready to open. */
export function TeamProjects({ localIds }: { localIds: Set<string> }) {
  const { store } = useStoreContext();
  const { toast } = useToast();
  const navigate = useNavigate();
  const now = useNow();
  const { enabled, projects } = useSharedList();
  const [opening, setOpening] = useState<string | null>(null);
  const fresh = projects.filter((p) => !localIds.has(p.id));
  if (!enabled || fresh.length === 0) return null;

  return (
    <section aria-label="Saved by the team" className="mt-8">
      <h2 className="mb-1 flex items-center gap-2 text-section text-ink">
        <Users aria-hidden className="size-4 text-ink-2" />
        Saved by the team
      </h2>
      <p className="mb-3 text-meta text-ink-2">
        Not on this device yet. Open one to bring it here with its drawings.
      </p>
      <ul className="border-t border-rule">
        {fresh.map((p) => (
          <li
            key={p.id}
            className="flex items-center gap-4 border-b border-rule py-3 max-[700px]:flex-wrap"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-body font-medium text-ink">{p.title}</p>
              <p className="truncate text-meta text-ink-2">
                {[p.customerName, p.propertyAddress].filter(Boolean).join(', ')}
              </p>
              <p className="text-meta text-ink-3">
                Saved by {p.savedBy}, {formatUpdated(p.savedAt, now)}
              </p>
            </div>
            <StatusBadge status={p.status as ProjectStatus} />
            <Button
              icon={<CloudDownload className="size-4" />}
              loading={opening === p.id}
              disabled={opening !== null}
              onClick={async () => {
                setOpening(p.id);
                try {
                  await loadShared(store, p.id);
                  void navigate(`/projects/${p.id}/plan`);
                } catch (e) {
                  toast({
                    title: 'The project couldn’t be opened',
                    body: e instanceof Error ? e.message : undefined,
                    tone: 'danger',
                  });
                } finally {
                  setOpening(null);
                }
              }}
            >
              Open
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
