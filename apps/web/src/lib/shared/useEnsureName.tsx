import { useRef, useState } from 'react';
import { Button, Dialog, Field, Input } from '@/components/ui';
import { savedByName, setSavedByName } from './api';

/**
 * Makes sure this device has a name to sign what it records with (who took stock out, who
 * scheduled an appointment), asking once if it hasn't. Render `dialog` somewhere on the screen.
 */
export function useEnsureName() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const pending = useRef<((ok: boolean) => void) | null>(null);

  const ensureName = (): Promise<boolean> => {
    if (savedByName()) return Promise.resolve(true);
    setOpen(true);
    return new Promise((resolve) => {
      pending.current = resolve;
    });
  };
  const settle = (ok: boolean) => {
    if (ok) setSavedByName(name.trim());
    pending.current?.(ok);
    pending.current = null;
    setOpen(false);
  };

  const dialog = (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && settle(false)}
      width="sm"
      title="Your name"
      description="Shown with what you record, so the team knows who did it. Asked once on this device."
      footer={
        <>
          <Button onClick={() => settle(false)}>Cancel</Button>
          <Button variant="primary" disabled={!name.trim()} onClick={() => settle(true)}>
            Continue
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) settle(true);
        }}
      >
        <Field label="Name">
          <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </form>
    </Dialog>
  );
  return { ensureName, dialog };
}
