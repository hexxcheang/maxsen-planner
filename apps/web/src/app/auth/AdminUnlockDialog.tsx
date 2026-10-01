import { useState, type FormEvent } from 'react';
import { Button, Dialog, Field, Input } from '@/components/ui';

interface AdminUnlockDialogProps {
  open: boolean;
  /** What the user was trying to do, e.g. "edit the catalogue". */
  action?: string;
  onUnlock: (passcode: string) => Promise<boolean>;
  onDone: (unlocked: boolean) => void;
}

export function AdminUnlockDialog({ open, action, onUnlock, onDone }: AdminUnlockDialogProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = (ok: boolean) => {
    setPasscode('');
    setError(null);
    onDone(ok);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const ok = await onUnlock(passcode);
    setBusy(false);
    if (ok) close(true);
    else setError("That admin passcode isn't right. Try again.");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
      width="sm"
      title="Unlock admin"
      description={
        action
          ? `Enter the admin passcode to ${action}.`
          : 'Enter the admin passcode to change protected settings.'
      }
    >
      <form id="admin-unlock" onSubmit={submit} className="flex flex-col gap-4">
        <Field label="Admin passcode" error={error}>
          <Input
            type="password"
            autoComplete="off"
            autoFocus
            value={passcode}
            onChange={(e) => {
              setPasscode(e.target.value);
              setError(null);
            }}
          />
        </Field>
        <div className="flex justify-end gap-2">
          <Button onClick={() => close(false)}>Cancel</Button>
          <Button type="submit" variant="primary" loading={busy}>
            Unlock
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
