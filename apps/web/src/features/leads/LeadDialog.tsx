import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FolderPlus, MessageCircle, Phone, Trash2, TriangleAlert } from 'lucide-react';
import {
  LEAD_SOURCES,
  LEAD_STATUS_LABEL,
  LEAD_STATUSES,
  newId,
  whatsappLink,
  type Lead,
  type LeadStatus,
  type PropertyType,
} from '@maxsen/domain';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { useActions } from '@/lib/data/hooks';
import { formatUpdated, PROPERTY_TYPES } from '@/lib/format';
import { addLeadNote, deleteLead, LeadError, saveLead, type LeadInput } from './leads-api';

type Form = Omit<LeadInput, 'baseUpdatedAt'>;

const formOf = (l: Lead | null): Form => ({
  name: l?.name ?? '',
  phone: l?.phone ?? '',
  email: l?.email ?? '',
  address: l?.address ?? '',
  propertyType: l?.propertyType ?? '',
  source: l?.source ?? '',
  interest: l?.interest ?? '',
  budget: l?.budget ?? '',
  status: l?.status ?? 'new',
  assignedTo: l?.assignedTo ?? '',
  followUp: l?.followUp ?? '',
  projectId: l?.projectId,
});

/** Only filled-in fields go to the server. */
const clean = (f: Form): Form =>
  Object.fromEntries(
    Object.entries(f).filter(([, v]) => v !== undefined && v !== '' && v !== null),
  ) as Form;

/**
 * One lead: its details, saved together; and its notes, each added on its own, so a note never
 * clashes with anyone else's change. The list behind refreshes without touching what's typed here.
 */
export function LeadDialog({
  lead,
  open,
  people,
  ensureName,
  requireAdmin,
  onClose,
  onSaved,
  onDeleted,
}: {
  lead: Lead | null;
  open: boolean;
  people: string[];
  ensureName: () => Promise<boolean>;
  requireAdmin: (action?: string) => Promise<boolean>;
  onClose: () => void;
  onSaved: (lead: Lead) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const actions = useActions();
  const navigate = useNavigate();
  const [saved, setSaved] = useState<Lead | null>(lead);
  const [form, setForm] = useState<Form>(() => formOf(lead));
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<'save' | 'note' | null>(null);
  const [conflict, setConflict] = useState<Lead | null>(null);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<Form>) => setForm((f) => ({ ...f, ...patch }));
  const wa = form.phone ? whatsappLink(form.phone) : null;

  const save = async (patch: Partial<Form> = {}) => {
    if (!(await ensureName())) return null;
    setBusy('save');
    try {
      const next = await saveLead(saved?.id ?? newId('el').replace(/^el_/, 'ld_'), {
        ...clean({ ...form, ...patch }),
        ...(saved ? { baseUpdatedAt: saved.updatedAt } : {}),
      });
      setSaved(next);
      setForm(formOf(next));
      setConflict(null);
      onSaved(next);
      return next;
    } catch (e) {
      if (e instanceof LeadError && e.current) setConflict(e.current);
      else
        toast({
          title: 'Lead not saved',
          body: e instanceof Error ? e.message : undefined,
          tone: 'danger',
        });
      return null;
    } finally {
      setBusy(null);
    }
  };

  const addNote = async () => {
    if (!note.trim() || !(await ensureName())) return;
    setBusy('note');
    try {
      // A new lead is saved first, so the note has somewhere to go.
      const target = saved ?? (await save());
      if (!target) return;
      const next = await addLeadNote(target.id, note.trim());
      setSaved(next);
      setNote('');
      onSaved(next);
    } catch (e) {
      toast({
        title: 'Note not added',
        body: e instanceof Error ? e.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(null);
    }
  };

  const convert = async () => {
    const id = actions.createProject({
      title: form.name.trim(),
      customerName: form.name.trim(),
      customerContact: form.phone?.trim() ?? '',
      propertyAddress: form.address?.trim() ?? '',
      propertyType: PROPERTY_TYPES.includes(form.propertyType as PropertyType)
        ? (form.propertyType as PropertyType)
        : null,
      status: 'draft',
      templateId: null,
    });
    const next = await save({ projectId: id });
    if (next) {
      toast({ title: 'Project made from this lead' });
      onClose();
      void navigate(`/projects/${id}/setup`);
    }
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        width="lg"
        title={saved ? saved.name : 'New lead'}
        description={
          saved
            ? `Added by ${saved.createdBy} ${formatUpdated(saved.createdAt)} · last changed by ${saved.updatedBy} ${formatUpdated(saved.updatedAt)}`
            : 'Everyone on the team sees it.'
        }
        footer={
          <>
            {saved && (
              <Button
                variant="ghost"
                className="mr-auto"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (await requireAdmin('delete a lead')) setConfirming(true);
                }}
              >
                Delete
              </Button>
            )}
            {!form.projectId && form.name.trim() && (
              <Button icon={<FolderPlus className="size-4" />} onClick={() => void convert()}>
                Convert to project
              </Button>
            )}
            <Button onClick={onClose}>Close</Button>
            <Button
              variant="primary"
              loading={busy === 'save'}
              disabled={!form.name.trim()}
              onClick={async () => {
                if (await save()) toast({ title: saved ? 'Lead updated' : 'Lead added' });
              }}
            >
              {saved ? 'Save changes' : 'Add lead'}
            </Button>
          </>
        }
      >
        {conflict && (
          <div
            role="alert"
            className="mb-3 flex flex-wrap items-center gap-2 border-l-[3px] border-warn bg-warn-tint px-3 py-2 text-control text-ink"
          >
            <TriangleAlert aria-hidden className="size-4 text-warn" />
            <span className="flex-1">
              {conflict.updatedBy} changed this lead while you were editing it. Your changes aren’t
              saved yet.
            </span>
            <Button
              size="sm"
              onClick={() => {
                setSaved(conflict);
                setForm(formOf(conflict));
                setConflict(null);
              }}
            >
              Load theirs
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => {
                // Save mine over theirs, starting from their version.
                setSaved(conflict);
                setConflict(null);
                void (async () => {
                  setBusy('save');
                  try {
                    const next = await saveLead(conflict.id, {
                      ...clean(form),
                      baseUpdatedAt: conflict.updatedAt,
                    });
                    setSaved(next);
                    onSaved(next);
                  } finally {
                    setBusy(null);
                  }
                })();
              }}
            >
              Keep mine
            </Button>
          </div>
        )}
        <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-6 max-[800px]:grid-cols-1">
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
              <Field label="Name">
                <Input
                  autoFocus
                  value={form.name}
                  onChange={(e) => set({ name: e.target.value })}
                />
              </Field>
              <Field label="Phone">
                <div className="flex items-center gap-1">
                  <Input
                    type="tel"
                    value={form.phone ?? ''}
                    onChange={(e) => set({ phone: e.target.value })}
                  />
                  {form.phone && (
                    <a
                      href={`tel:${form.phone.replace(/\s/g, '')}`}
                      aria-label="Call"
                      className="rounded-control p-1.5 text-ink-2 hover:bg-paper"
                    >
                      <Phone className="size-4" />
                    </a>
                  )}
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="WhatsApp"
                      className="rounded-control p-1.5 text-ok hover:bg-paper"
                    >
                      <MessageCircle className="size-4" />
                    </a>
                  )}
                </div>
              </Field>
              <Field label="Status">
                <Select
                  value={form.status}
                  options={LEAD_STATUSES.map((s) => ({ value: s, label: LEAD_STATUS_LABEL[s] }))}
                  onChange={(v) => set({ status: v as LeadStatus })}
                />
              </Field>
              <Field label="Next follow-up">
                <Input
                  type="date"
                  value={form.followUp ?? ''}
                  onChange={(e) => set({ followUp: e.target.value })}
                />
              </Field>
              <Field label="Assigned to">
                <Input
                  list="lead-people"
                  value={form.assignedTo ?? ''}
                  onChange={(e) => set({ assignedTo: e.target.value })}
                />
                <datalist id="lead-people">
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
              </Field>
              <Field label="Where they came from">
                <Select
                  value={form.source ?? ''}
                  placeholder="Choose"
                  options={LEAD_SOURCES.map((s) => ({ value: s, label: s }))}
                  onChange={(v) => set({ source: v })}
                />
              </Field>
            </div>
            <Field label="Address">
              <Input
                value={form.address ?? ''}
                onChange={(e) => set({ address: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3 max-[600px]:grid-cols-1">
              <Field label="Property">
                <Select
                  value={form.propertyType ?? ''}
                  placeholder="Choose"
                  options={PROPERTY_TYPES.map((p) => ({ value: p, label: p }))}
                  onChange={(v) => set({ propertyType: v })}
                />
              </Field>
              <Field label="Budget">
                <Input
                  value={form.budget ?? ''}
                  placeholder="e.g. S$8–10k"
                  onChange={(e) => set({ budget: e.target.value })}
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ''}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Interested in">
              <Input
                value={form.interest ?? ''}
                placeholder="e.g. switches, lighting, curtains, door lock"
                onChange={(e) => set({ interest: e.target.value })}
              />
            </Field>
          </div>

          <section aria-label="Notes" className="flex min-w-0 flex-col gap-2">
            <h3 className="border-b border-rule pb-1 text-control font-semibold text-ink">Notes</h3>
            <form
              className="flex flex-col gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void addNote();
              }}
            >
              <Textarea
                rows={2}
                aria-label="New note"
                placeholder="e.g. Called, coming to the Tampines showroom on Saturday"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <Button
                type="submit"
                size="sm"
                className="self-end"
                loading={busy === 'note'}
                disabled={!note.trim() || !form.name.trim()}
              >
                Add note
              </Button>
            </form>
            <ol className="flex max-h-72 flex-col gap-2 overflow-y-auto">
              {[...(saved?.notes ?? [])].reverse().map((n, i) => (
                <li key={`${n.at}-${i}`} className="rounded-md bg-paper px-2.5 py-2">
                  <p className="text-control whitespace-pre-line text-ink">{n.text}</p>
                  <p className="mt-0.5 text-caption text-ink-3">
                    {n.by}, {formatUpdated(n.at)}
                  </p>
                </li>
              ))}
              {!saved?.notes.length && <li className="text-meta text-ink-3">No notes yet.</li>}
            </ol>
          </section>
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title="Delete this lead?"
        body="It goes for everyone, with its notes. To keep it on record, mark it Lost instead."
        confirmLabel="Delete lead"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          if (!saved) return;
          try {
            await deleteLead(saved.id);
            onDeleted(saved.id);
            onClose();
          } catch (e) {
            toast({
              title: 'Not deleted',
              body: e instanceof Error ? e.message : undefined,
              tone: 'danger',
            });
          }
        }}
      />
    </>
  );
}
