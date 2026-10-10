import { describe, expect, it } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';
import { Dialog } from '../Dialog';
import { ConfirmDialog } from '../ConfirmDialog';

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Edit details</Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Project details"
        footer={<Button onClick={() => setOpen(false)}>Done</Button>}
      >
        <input aria-label="Title" />
      </Dialog>
    </>
  );
}

describe('Dialog', () => {
  it('dialog closes on Escape and returns focus', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Edit details' });
    await user.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Project details' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('confirm dialog calls onConfirm', async () => {
    const user = userEvent.setup();
    let confirmed = false;
    render(
      <ConfirmDialog
        open
        title="Delete plan?"
        body="This removes the Lighting Plan for Level 1."
        confirmLabel="Delete plan"
        destructive
        onConfirm={() => {
          confirmed = true;
        }}
        onCancel={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Delete plan' }));
    expect(confirmed).toBe(true);
  });
});
