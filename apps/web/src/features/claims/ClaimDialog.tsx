import { useRef, useState } from 'react';
import { Check, FileText, ImagePlus, Trash2, X } from 'lucide-react';
import { CLAIM_CATEGORIES, newId, type Claim } from '@maxsen/domain';
import {
  Button,
  ConfirmDialog,
  Dialog,
  Field,
  IconButton,
  Input,
  NumberField,
  Select,
  Textarea,
  useToast,
} from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatDay, today } from '@/lib/dates';
import { formatUpdated } from '@/lib/format';
import { money } from '@/features/quote/quotation';
import {
  ClaimError,
  decideClaim,
  deleteClaim,
  receiptUrl,
  saveClaim,
  uploadReceipt,
  type ClaimInput,
} from './claims-api';

const isPdf = (r: Claim['receipts'][number]) => r.type === 'application/pdf';

/**
 * One claim: who claims fills in the date, amount and what it was for, and adds the receipts;
 * it can be changed or withdrawn until the admin approves or rejects it.
 */
export function ClaimDialog({
  claim,
  open,
  admin,
  ensureName,
  requireAdmin,
  onClose,
  onSaved,
  onDeleted,
}: {
  claim: Claim | null;
  open: boolean;
  /** Whether admin is unlocked on this device. */
  admin: boolean;
  ensureName: () => Promise<boolean>;
  requireAdmin: (action?: string) => Promise<boolean>;
  onClose: () => void;
  onSaved: (claim: Claim) => void;
  onDeleted: (id: string) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<ClaimInput>(() => ({
    date: claim?.date ?? today(),
    amount: claim?.amount ?? 0,
    purpose: claim?.purpose ?? '',
    category: claim?.category ?? '',
    site: claim?.site ?? '',
    receipts: claim?.receipts ?? [],
  }));
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState<'save' | 'approve' | 'reject' | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<ClaimInput>) => setForm((f) => ({ ...f, ...patch }));
  const editable = !claim || claim.status === 'pending';
  const ready =
    /^\d{4}-\d{2}-\d{2}$/.test(form.date) &&
    form.amount > 0 &&
    form.purpose.trim().length > 0 &&
    form.receipts.length > 0 &&
    uploading === 0;

  const fail = (title: string, e: unknown) =>
    toast({ title, body: e instanceof Error ? e.message : undefined, tone: 'danger' });

  const addFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    for (const file of Array.from(files)) {
      setUploading((n) => n + 1);
      try {
        const r = await uploadReceipt(file);
        setForm((f) => ({ ...f, receipts: [...f.receipts, r] }));
      } catch (e) {
        fail(`${file.name} wasn’t added`, e);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = async () => {
    if (!ready || !(await ensureName())) return;
    setBusy('save');
    try {
      const saved = await saveClaim(claim?.id ?? newId('cl'), {
        ...form,
        purpose: form.purpose.trim(),
        ...(form.category ? {} : { category: undefined }),
        ...(form.site?.trim() ? { site: form.site.trim() } : { site: undefined }),
      });
      onSaved(saved);
      toast({
        title: claim ? 'Claim updated' : 'Claim submitted',
        body: 'The admin will check it.',
      });
      onClose();
    } catch (e) {
      fail('Claim not saved', e);
    } finally {
      setBusy(null);
    }
  };

  const decide = async (status: 'approved' | 'rejected') => {
    if (!claim) return;
    if (!(await requireAdmin(status === 'approved' ? 'approve claims' : 'reject claims'))) return;
    if (!(await ensureName())) return;
    setBusy(status === 'approved' ? 'approve' : 'reject');
    try {
      const saved = await decideClaim(
        claim.id,
        status,
        status === 'rejected' ? reason.trim() : undefined,
      );
      onSaved(saved);
      toast({ title: status === 'approved' ? 'Claim approved' : 'Claim rejected' });
      onClose();
    } catch (e) {
      fail('Not saved', e);
    } finally {
      setBusy(null);
    }
  };

  const decided = claim && claim.status !== 'pending';

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => !o && onClose()}
        width="md"
        title={claim ? `Claim by ${claim.claimant}` : 'New claim'}
        description={
          claim
            ? `Submitted ${formatUpdated(claim.createdAt)}`
            : 'What you paid for work, with the receipt. The admin approves it.'
        }
        footer={
          <>
            {claim && (editable || admin) && (
              <Button
                variant="ghost"
                className="mr-auto"
                icon={<Trash2 className="size-4" />}
                onClick={() => setConfirming(true)}
              >
                {editable ? 'Withdraw' : 'Delete'}
              </Button>
            )}
            <Button onClick={onClose}>{editable ? 'Cancel' : 'Close'}</Button>
            {editable && (
              <Button
                variant="primary"
                loading={busy === 'save'}
                disabled={!ready}
                onClick={() => void submit()}
              >
                {claim ? 'Save changes' : 'Submit claim'}
              </Button>
            )}
          </>
        }
      >
        {decided && (
          <div
            role="status"
            className={cn(
              'mb-4 border-l-[3px] px-3 py-2 text-control',
              claim.status === 'approved' ? 'border-ok bg-ok/10' : 'border-danger bg-danger/10',
            )}
          >
            <p className="font-medium text-ink">
              {claim.status === 'approved' ? 'Approved' : 'Rejected'} by {claim.decidedBy}
              {claim.decidedAt ? `, ${formatUpdated(claim.decidedAt)}` : ''}
            </p>
            {claim.note && <p className="mt-0.5 text-ink-2">{claim.note}</p>}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <Field label="Date bought">
              <Input
                type="date"
                value={form.date}
                disabled={!editable}
                onChange={(e) => set({ date: e.target.value })}
              />
            </Field>
            <Field label="Amount (S$)">
              <NumberField
                live
                allowEmpty
                min={0}
                max={1_000_000}
                precision={2}
                value={form.amount || null}
                disabled={!editable}
                aria-label="Amount (S$)"
                onChange={(v) => set({ amount: v ?? 0 })}
              />
            </Field>
          </div>
          <Field label="What it was for">
            <Textarea
              rows={2}
              value={form.purpose}
              disabled={!editable}
              placeholder="e.g. Cable ties and trunking for the Tan residence install"
              onChange={(e) => set({ purpose: e.target.value })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3 max-[600px]:grid-cols-1">
            <Field label="Category" optional>
              <Select
                value={form.category ?? ''}
                placeholder="Choose"
                disabled={!editable}
                options={CLAIM_CATEGORIES.map((c) => ({ value: c, label: c }))}
                onChange={(v) => set({ category: v })}
              />
            </Field>
            <Field label="Project or site" optional>
              <Input
                value={form.site ?? ''}
                disabled={!editable}
                placeholder="e.g. Tan residence, Punggol"
                onChange={(e) => set({ site: e.target.value })}
              />
            </Field>
          </div>

          <section aria-label="Receipts" className="flex flex-col gap-2">
            <h3 className="text-control font-medium text-ink">Receipts</h3>
            <ul className="flex flex-wrap gap-2">
              {form.receipts.map((r) => (
                <li
                  key={r.id}
                  className="relative overflow-hidden rounded-md border border-rule bg-paper"
                >
                  <a
                    href={receiptUrl(r.id)}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`Open receipt ${r.name}`}
                    className="flex size-24 items-center justify-center"
                  >
                    {isPdf(r) ? (
                      <span className="flex flex-col items-center gap-1 px-1 text-center text-caption text-ink-2">
                        <FileText aria-hidden className="size-7" />
                        <span className="line-clamp-2 break-all">{r.name}</span>
                      </span>
                    ) : (
                      <img src={receiptUrl(r.id)} alt={r.name} className="size-full object-cover" />
                    )}
                  </a>
                  {editable && (
                    <IconButton
                      size="sm"
                      label={`Remove receipt ${r.name}`}
                      icon={<X className="size-3.5" />}
                      className="absolute top-1 right-1 bg-surface/90"
                      onClick={() => set({ receipts: form.receipts.filter((x) => x.id !== r.id) })}
                    />
                  )}
                </li>
              ))}
              {editable && (
                <li>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="flex size-24 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-rule-2 text-meta text-ink-2 hover:border-ink-3 hover:text-ink"
                  >
                    <ImagePlus aria-hidden className="size-6" />
                    {uploading ? 'Uploading…' : 'Add receipt'}
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    multiple
                    accept="image/*,application/pdf,.pdf"
                    aria-label="Receipt files"
                    className="sr-only"
                    onChange={(e) => {
                      void addFiles(e.target.files);
                      e.target.value = '';
                    }}
                  />
                </li>
              )}
            </ul>
            {editable && !form.receipts.length && (
              <p className="text-meta text-ink-3">
                A photo of each receipt, or its PDF. Photos are made smaller before they’re sent.
              </p>
            )}
          </section>

          {claim && (claim.status === 'pending' || admin) && (
            <section
              aria-label="Decision"
              className="flex flex-col gap-2 border-t border-rule pt-3"
            >
              <h3 className="text-control font-medium text-ink">
                {decided ? 'Change the decision (admin)' : 'Decision (admin)'}
              </h3>
              {rejecting ? (
                <>
                  <Field label="Why it’s rejected">
                    <Textarea
                      rows={2}
                      autoFocus
                      value={reason}
                      placeholder="e.g. Personal purchase, not for a job"
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </Field>
                  <div className="flex gap-2">
                    <Button onClick={() => setRejecting(false)}>Back</Button>
                    <Button
                      variant="danger"
                      loading={busy === 'reject'}
                      disabled={!reason.trim()}
                      onClick={() => void decide('rejected')}
                    >
                      Reject claim
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  {claim.status !== 'approved' && (
                    <Button
                      variant="primary"
                      icon={<Check className="size-4" />}
                      loading={busy === 'approve'}
                      onClick={() => void decide('approved')}
                    >
                      Approve {money(claim.amount)}
                    </Button>
                  )}
                  {claim.status !== 'rejected' && (
                    <Button icon={<X className="size-4" />} onClick={() => setRejecting(true)}>
                      Reject
                    </Button>
                  )}
                </div>
              )}
              {!admin && (
                <p className="text-meta text-ink-3">Only the admin can approve or reject claims.</p>
              )}
            </section>
          )}
          {claim && !editable && (
            <p className="text-meta text-ink-3">
              Bought {formatDay(claim.date)}. Decided claims can’t be changed.
            </p>
          )}
        </div>
      </Dialog>
      <ConfirmDialog
        open={confirming}
        title={editable ? 'Withdraw this claim?' : 'Delete this claim?'}
        body="It’s removed for everyone, with its receipts."
        confirmLabel={editable ? 'Withdraw claim' : 'Delete claim'}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={async () => {
          setConfirming(false);
          if (!claim) return;
          if (!editable && !(await requireAdmin('delete a claim'))) return;
          try {
            await deleteClaim(claim.id);
            onDeleted(claim.id);
            onClose();
          } catch (e) {
            fail(e instanceof ClaimError && e.needsAdmin ? 'Admin only' : 'Not removed', e);
          }
        }}
      />
    </>
  );
}
