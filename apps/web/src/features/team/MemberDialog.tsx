import { useState } from 'react';
import { CircleCheck, MessageCircle, Trash2, TriangleAlert } from 'lucide-react';
import { newId, TEAM_ROLES, whatsappNumber, type TeamMember } from '@maxsen/domain';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  Input,
  Select,
  Switch,
  Textarea,
  useToast,
} from '@/components/ui';
import { deleteMember, saveMember, type MemberInput } from './team-api';

/** One person's profile, with their WhatsApp number checked as it's typed. */
export function MemberDialog({
  member,
  ensureName,
  requireAdmin,
  onClose,
  onSaved,
  onDeleted,
}: {
  member: TeamMember | null;
  ensureName: () => Promise<boolean>;
  requireAdmin: (action?: string) => Promise<boolean>;
  onClose: () => void;
  onSaved: (m: TeamMember) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<MemberInput>(() => ({
    name: member?.name ?? '',
    role: member?.role ?? '',
    phone: member?.phone ?? '',
    email: member?.email ?? '',
    joined: member?.joined ?? '',
    notes: member?.notes ?? '',
    active: member?.active ?? true,
  }));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const set = (patch: Partial<MemberInput>) => setForm((f) => ({ ...f, ...patch }));
  const number = form.phone?.trim() ? whatsappNumber(form.phone) : null;
  const ready = form.name.trim() && (!number || number.ok);

  const save = async () => {
    if (!ready) return;
    if (!(await requireAdmin('change the team')) || !(await ensureName())) return;
    setBusy(true);
    try {
      const clean = Object.fromEntries(
        Object.entries({
          ...form,
          name: form.name.trim(),
          // Kept in one form, so WhatsApp finds it: "+65 9123 4567".
          phone: number?.ok ? number.display : undefined,
        }).filter(([, v]) => v !== '' && v !== undefined),
      ) as MemberInput;
      const saved = await saveMember(member?.id ?? newId('el').replace(/^el_/, 'tm_'), clean);
      onSaved(saved);
      toast({ title: member ? 'Profile updated' : `${saved.name} added to the team` });
      onClose();
    } catch (e) {
      toast({
        title: 'Not saved',
        body: e instanceof Error ? e.message : undefined,
        tone: 'danger',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => !o && onClose()}
        width="md"
        title={member ? member.name : 'Add to the team'}
        description="The timetable assigns appointments to the team and messages them on these WhatsApp numbers."
        footer={
          <>
            {member && (
              <Button
                variant="ghost"
                className="mr-auto"
                icon={<Trash2 className="size-4" />}
                onClick={async () => {
                  if (await requireAdmin('change the team')) setConfirming(true);
                }}
              >
                Remove
              </Button>
            )}
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" loading={busy} disabled={!ready} onClick={() => void save()}>
              {member ? 'Save' : 'Add to team'}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <Field label="Name">
              <Input autoFocus value={form.name} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Role" optional>
              <Select
                value={form.role ?? ''}
                placeholder="Choose"
                options={TEAM_ROLES.map((r) => ({ value: r, label: r }))}
                onChange={(v) => set({ role: v })}
              />
            </Field>
          </div>
          <Field
            label="WhatsApp number"
            error={number && !number.ok ? number.reason : undefined}
            hint={
              number?.ok
                ? undefined
                : 'A Singapore mobile (e.g. 9123 4567), or another country’s with its code (+60…).'
            }
          >
            <Input
              type="tel"
              value={form.phone ?? ''}
              placeholder="e.g. 9123 4567"
              onChange={(e) => set({ phone: e.target.value })}
            />
          </Field>
          {number?.ok && (
            <p className="-mt-1 flex flex-wrap items-center gap-2 text-meta text-ink-2">
              <CircleCheck aria-hidden className="size-4 text-ok" />
              Saved as {number.display}.
              <a
                href={`https://wa.me/${number.digits}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-ink underline"
              >
                <MessageCircle aria-hidden className="size-3.5" />
                Test it: open their WhatsApp chat
              </a>
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <Field label="Email" optional>
              <Input
                type="email"
                value={form.email ?? ''}
                onChange={(e) => set({ email: e.target.value })}
              />
            </Field>
            <Field label="Joined" optional>
              <Input
                type="date"
                value={form.joined ?? ''}
                onChange={(e) => set({ joined: e.target.value })}
              />
            </Field>
          </div>
          <Field label="Notes" optional>
            <Textarea
              rows={2}
              value={form.notes ?? ''}
              placeholder="e.g. Licensed electrician; covers the east"
              onChange={(e) => set({ notes: e.target.value })}
            />
          </Field>
          <Switch
            checked={form.active}
            label="Active: assigned and messaged from the timetable"
            onCheckedChange={(active) => set({ active })}
          />
          {!form.active && (
            <p className="flex items-center gap-1.5 text-meta text-ink-2">
              <TriangleAlert aria-hidden className="size-4 text-warn" />
              Kept on record, but no longer offered on the timetable.
            </p>
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title={`Remove ${member?.name ?? 'this person'}?`}
        body="Their profile goes for everyone. To keep it on record, switch them to inactive instead."
        confirmLabel="Remove"
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          if (!member) return;
          try {
            await deleteMember(member.id);
            onDeleted(member.id);
            onClose();
          } catch (e) {
            toast({
              title: 'Not removed',
              body: e instanceof Error ? e.message : undefined,
              tone: 'danger',
            });
          }
        }}
      />
    </>
  );
}
