import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, Dialog, IconButton, Input } from '@/components/ui';

interface Member {
  name: string;
  phone: string;
}

/** The team appointments are assigned to, with each person's WhatsApp number. */
export function TeamDialog({
  open,
  people,
  phones,
  onClose,
  onSave,
}: {
  open: boolean;
  people: string[];
  phones: Record<string, string>;
  onClose: () => void;
  onSave: (people: string[], phones: Record<string, string>) => Promise<void>;
}) {
  const fromTeam = () => [
    ...people.map((name) => ({ name, phone: phones[name] ?? '' })),
    { name: '', phone: '' },
  ];
  const [rows, setRows] = useState<Member[]>(fromTeam);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setRows(fromTeam());
    // Fresh from the team each time it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const update = (i: number, patch: Partial<Member>) =>
    setRows((rs) => {
      const next = rs.map((r, j) => (j === i ? { ...r, ...patch } : r));
      // Always a blank row at the end, for the next person.
      return next.at(-1)!.name || next.at(-1)!.phone ? [...next, { name: '', phone: '' }] : next;
    });
  const filled = rows.filter((r) => r.name.trim());
  const names = [...new Set(filled.map((r) => r.name.trim()))];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width="md"
      title="Team"
      description="The people appointments are assigned to: sales and installers. Their WhatsApp numbers are used to tell them about their appointments."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(
                  names,
                  Object.fromEntries(
                    filled
                      .filter((r) => r.phone.trim())
                      .map((r) => [r.name.trim(), r.phone.trim()]),
                  ),
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Save team
          </Button>
        </>
      }
    >
      <ul aria-label="Team members" className="flex flex-col gap-2">
        <li className="grid grid-cols-[1fr_1fr_32px] gap-2 text-meta text-ink-2">
          <span>Name</span>
          <span>WhatsApp number</span>
        </li>
        {rows.map((r, i) => (
          <li key={i} className="grid grid-cols-[1fr_1fr_32px] items-center gap-2">
            <Input
              compact
              aria-label={`Name ${i + 1}`}
              placeholder={i === rows.length - 1 ? 'Add someone' : undefined}
              value={r.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <Input
              compact
              type="tel"
              aria-label={`WhatsApp number of ${r.name || `person ${i + 1}`}`}
              placeholder="e.g. 9123 4567"
              value={r.phone}
              onChange={(e) => update(i, { phone: e.target.value })}
            />
            {i < rows.length - 1 ? (
              <IconButton
                size="sm"
                label={`Remove ${r.name || 'this person'}`}
                icon={<Trash2 className="size-4" />}
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
              />
            ) : (
              <Plus aria-hidden className="size-4 justify-self-center text-ink-3" />
            )}
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
