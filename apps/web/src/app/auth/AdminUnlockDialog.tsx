import { useState, type FormEvent } from 'react';
import { Button, Dialog, Field, Input } from '@/components/ui';

interface AdminUnlockDialogProps {
  open: boolean;
  /** What the user was trying to do, e.g. "edit the catalogue". */
  action?: string;
  /** Asks for the exclusive admin's passcode: the admin's isn't enough. */
  exclusive?: boolean;
  onUnlock: (passcode: string) => Promise<'exclusive' | 'admin' | null>;
  onDone: (unlocked: boolean) => void;
}

export function AdminUnlockDialog({
  open,
  action,
  exclusive = false,
  onUnlock,
  onDone,
}: AdminUnlockDialogProps) {
  const who = exclusive ? 'exclusive admin' : 'admin';
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
    try {
      const level = await onUnlock(passcode);
      if (level === 'exclusive' || (level === 'admin' && !exclusive)) close(true);
      else if (level === 'admin')
        setError('That’s the admin passcode. This needs the exclusive admin’s passcode.');
      else setError(`That ${who} passcode isn't right. Try again.`);
    } catch (e) {
      // Paused after too many wrong tries.
      setError(e instanceof Error ? e.message : `That ${who} passcode isn't right. Try again.`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) close(false);
      }}
      width="sm"
      title={exclusive ? 'Unlock exclusive admin' : 'Unlock admin'}
      description={
        action
          ? `Enter the ${who} passcode to ${action}.`
          : 'Enter the admin passcode to change protected settings.'
      }
    >
      <form id="admin-unlock" onSubmit={submit} className="flex flex-col gap-4">
        <Field label={exclusive ? 'Exclusive admin passcode' : 'Admin passcode'} error={error}>
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
