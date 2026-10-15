import { useState } from 'react';
import { Button, Dialog, Field, NumberField } from '@/components/ui';

/**
 * After a line is marked along something of known length: asks how long it really is, which sets
 * the plan's scale, so every LED run without a typed length is estimated from the drawing.
 */
export function ScaleDialog({
  onSave,
  onClose,
}: {
  onSave: (metres: number) => void;
  onClose: () => void;
}) {
  const [metres, setMetres] = useState<number | null>(null);
  const ok = metres !== null && metres > 0;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      width="sm"
      title="How long is that line?"
      description="Its real length, e.g. a wall with its dimension written on the drawing. LED runs without a typed length are then estimated from it."
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!ok} onClick={() => ok && onSave(metres)}>
            Set scale
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onSave(metres);
        }}
      >
        <Field label="Real length" hint="Millimetres on the drawing? 3600 mm is 3.6 m.">
          <NumberField
            live
            value={metres}
            unit="m"
            precision={2}
            min={0}
            allowEmpty
            onChange={setMetres}
          />
        </Field>
      </form>
    </Dialog>
  );
}
