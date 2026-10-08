import { useEffect, useState } from 'react';
import { Button, Dialog, Field, Textarea } from '@/components/ui';

/** The team list appointments are assigned from, one name per line. */
export function TeamDialog({
  open,
  people,
  onClose,
  onSave,
}: {
  open: boolean;
  people: string[];
  onClose: () => void;
  onSave: (people: string[]) => Promise<void>;
}) {
  const [text, setText] = useState(people.join('\n'));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) setText(people.join('\n'));
  }, [open, people]);
  const names = [
    ...new Set(
      text
        .split('\n')
        .map((n) => n.trim())
        .filter(Boolean),
    ),
  ];

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      width="sm"
      title="Team"
      description="The people appointments are assigned to: sales and installers. One name per line."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onSave(names);
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
      <Field label="Names">
        <Textarea rows={8} value={text} onChange={(e) => setText(e.target.value)} />
      </Field>
    </Dialog>
  );
}
