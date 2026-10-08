import { useState } from 'react';
import { Link } from 'react-router';
import { MapPin, Trash2, TriangleAlert, X } from 'lucide-react';
import {
  minutesOf,
  TIMETABLE_KIND_LABEL,
  type TimetableEvent,
  type TimetableKind,
} from '@maxsen/domain';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  SegmentedControl,
  Select,
  Textarea,
} from '@/components/ui';
import { useProjects } from '@/lib/data/hooks';
import { formatDay } from '@/lib/dates';
import { formatUpdated } from '@/lib/format';
import type { EventInput } from './timetable-api';

/** An hour later, for a new appointment's end. */
const plusHours = (hhmm: string, h: number) => {
  const m = Math.min(23 * 60 + 59, minutesOf(hhmm) + h * 60);
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

/**
 * One appointment: the admin edits it (or makes a new one); everyone else sees its details.
 */
export function EventDialog({
  open,
  event,
  date,
  editable,
  people: team,
  clashWith,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  event: TimetableEvent | null;
  /** For a new appointment: its day. */
  date?: string;
  editable: boolean;
  people: string[];
  clashWith?: string[];
  onClose: () => void;
  onSave: (input: EventInput) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const { data: projects } = useProjects();
  const [kind, setKind] = useState<TimetableKind>(event?.kind ?? 'sales');
  const [day, setDay] = useState(event?.date ?? date ?? '');
  const [start, setStart] = useState(event?.start ?? '10:00');
  const [end, setEnd] = useState(event?.end ?? (event ? event.end : '11:00'));
  const [title, setTitle] = useState(event?.title ?? '');
  const [client, setClient] = useState(event?.client ?? '');
  const [address, setAddress] = useState(event?.address ?? '');
  const [people, setPeople] = useState<string[]>(event?.people ?? []);
  const [newPerson, setNewPerson] = useState('');
  const [projectId, setProjectId] = useState(event?.projectId ?? '');
  const [notes, setNotes] = useState(event?.notes ?? '');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // Project, client, address and notes can wait: folded away until there's something in them.
  const [more, setMore] = useState(
    () => !!(event?.projectId || event?.client || event?.address || event?.notes),
  );
  const project = projects.find((p) => p.id === (event?.projectId ?? projectId));

  if (!editable) {
    if (!event) return null;
    return (
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        width="sm"
        title={event.title}
        description={`${TIMETABLE_KIND_LABEL[event.kind]} · ${formatDay(event.date)}, ${event.start}–${event.end}`}
        footer={<Button onClick={onClose}>Close</Button>}
      >
        <dl className="grid grid-cols-[110px_1fr] gap-y-2 text-control">
          {event.client && (
            <>
              <dt className="text-ink-2">Client</dt>
              <dd>{event.client}</dd>
            </>
          )}
          {event.address && (
            <>
              <dt className="text-ink-2">Address</dt>
              <dd className="flex items-start gap-1">
                <MapPin aria-hidden className="mt-1 size-3.5 shrink-0" />
                <a
                  className="underline"
                  target="_blank"
                  rel="noreferrer"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(event.address)}`}
                >
                  {event.address}
                </a>
              </dd>
            </>
          )}
          <dt className="text-ink-2">Who</dt>
          <dd>{event.people.length ? event.people.join(', ') : 'Not assigned yet'}</dd>
          {project && (
            <>
              <dt className="text-ink-2">Project</dt>
              <dd>
                <Link className="underline" to={`/projects/${project.id}/plan`} onClick={onClose}>
                  {project.title}
                </Link>
              </dd>
            </>
          )}
          {event.notes && (
            <>
              <dt className="text-ink-2">Notes</dt>
              <dd className="whitespace-pre-line">{event.notes}</dd>
            </>
          )}
        </dl>
        <p className="mt-3 text-meta text-ink-3">
          Scheduled by {event.updatedBy}, {formatUpdated(event.updatedAt)}. Only the admin can
          change it.
        </p>
      </Dialog>
    );
  }

  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day) && end > start;
  const toggle = (p: string) =>
    setPeople((ps) => (ps.includes(p) ? ps.filter((x) => x !== p) : [...ps, p]));
  const choices = [...new Set([...team, ...people])];

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        width="md"
        title={event ? 'Appointment' : 'New appointment'}
        description="Everyone sees it on the timetable."
        footer={
          <>
            {event && (
              <Button
                variant="ghost"
                className="mr-auto"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirming(true)}
              >
                Delete
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button
              variant="primary"
              loading={busy}
              disabled={!valid}
              onClick={async () => {
                setBusy(true);
                try {
                  await onSave({
                    kind,
                    date: day,
                    start,
                    end,
                    // Left blank, it's named after its type, to fill in later.
                    title: title.trim() || TIMETABLE_KIND_LABEL[kind],
                    ...(client.trim() ? { client: client.trim() } : {}),
                    ...(address.trim() ? { address: address.trim() } : {}),
                    people,
                    ...(projectId ? { projectId } : {}),
                    ...(notes.trim() ? { notes: notes.trim() } : {}),
                  });
                } finally {
                  setBusy(false);
                }
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <SegmentedControl<TimetableKind>
            label="Type"
            className="self-start"
            value={kind}
            onChange={setKind}
            options={[
              { value: 'sales', label: 'Sales meet-up' },
              { value: 'installation', label: 'Installation' },
            ]}
          />
          <Field label="What" optional>
            <Input
              autoFocus
              value={title}
              placeholder={
                kind === 'sales'
                  ? 'e.g. Showroom visit, site measurement'
                  : 'e.g. Install switches and lights'
              }
              onChange={(e) => setTitle(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-[1fr_auto_auto] gap-3 max-[600px]:grid-cols-1">
            <Field label="Date">
              <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <Field label="From">
              <Input
                type="time"
                value={start}
                onChange={(e) => {
                  const v = e.target.value;
                  // Keep the same length when the start moves.
                  const length = (minutesOf(end) - minutesOf(start)) / 60;
                  setStart(v);
                  if (v) setEnd(plusHours(v, length > 0 ? length : 1));
                }}
              />
            </Field>
            <Field label="To" error={end <= start ? 'Ends before it starts' : undefined}>
              <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1 text-control font-medium text-ink">Who’s going</legend>
            <div className="flex flex-wrap gap-1.5">
              {choices.map((p) => (
                <button
                  key={p}
                  type="button"
                  aria-pressed={people.includes(p)}
                  onClick={() => toggle(p)}
                  className={
                    people.includes(p)
                      ? 'flex items-center gap-1 rounded-chip border border-ink bg-ink px-2 py-1 text-meta text-surface'
                      : 'rounded-chip border border-rule-2 px-2 py-1 text-meta text-ink-2 hover:border-ink-3'
                  }
                >
                  {p}
                  {people.includes(p) && <X aria-hidden className="size-3" />}
                </button>
              ))}
            </div>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const n = newPerson.trim();
                if (n && !people.includes(n)) setPeople([...people, n]);
                setNewPerson('');
              }}
            >
              <Input
                compact
                aria-label="Add someone"
                placeholder="Add someone not on the list"
                value={newPerson}
                onChange={(e) => setNewPerson(e.target.value)}
              />
              <Button size="sm" type="submit" disabled={!newPerson.trim()}>
                Add
              </Button>
            </form>
            {clashWith && clashWith.length > 0 && (
              <p className="flex items-center gap-1.5 text-meta text-warn">
                <TriangleAlert aria-hidden className="size-4" />
                {clashWith.join(', ')} {clashWith.length === 1 ? 'is' : 'are'} booked elsewhere at
                the same time.
              </p>
            )}
          </fieldset>
          <details
            open={more}
            onToggle={(e) => setMore(e.currentTarget.open)}
            className="border-t border-rule pt-2"
          >
            <summary className="cursor-pointer text-control font-medium text-ink-2">
              More details
            </summary>
            <div className="mt-3 flex flex-col gap-3">
              <Field label="Project">
                <Select
                  value={projectId}
                  placeholder="Not linked to a project"
                  options={projects.map((p) => ({ value: p.id, label: p.title }))}
                  onChange={(id) => {
                    setProjectId(id);
                    const p = projects.find((x) => x.id === id);
                    if (p) {
                      if (!client.trim()) setClient(p.customerName);
                      if (!address.trim()) setAddress(p.propertyAddress);
                      if (!title.trim()) setTitle(p.title);
                    }
                  }}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
                <Field label="Client">
                  <Input value={client} onChange={(e) => setClient(e.target.value)} />
                </Field>
                <Field label="Address">
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} />
                </Field>
              </div>
              <Field label="Notes">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </Field>
            </div>
          </details>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title="Delete this appointment?"
        body="It’s taken off the timetable for everyone."
        confirmLabel="Delete"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          await onDelete();
        }}
      />
    </>
  );
}
