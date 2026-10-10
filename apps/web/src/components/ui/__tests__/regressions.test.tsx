import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button, ConfirmDialog, DropdownMenu, NumberField, SegmentedControl } from '..';

describe('primitive regressions', () => {
  it('a segmented control with no matching value is still reachable by Tab', async () => {
    const user = userEvent.setup();
    render(
      <SegmentedControl
        label="Size"
        value=""
        onChange={() => {}}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />,
    );
    await user.tab();
    expect(screen.getByRole('radio', { name: 'A' })).toHaveFocus();
  });

  it('number field commits a retyped value equal to the current one', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<NumberField aria-label="Qty" value={5} onChange={onChange} />);
    const input = screen.getByRole('textbox', { name: 'Qty' });
    await user.click(input);
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
    await user.clear(input);
    await user.type(input, '5{Enter}');
    expect(onChange).toHaveBeenCalledWith(5);
  });

  it('a dialog opened from a menu item returns focus to the menu trigger', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <DropdownMenu
            trigger={<Button>Actions</Button>}
            items={[{ label: 'Delete', onSelect: () => setOpen(true) }]}
          />
          <ConfirmDialog
            open={open}
            title="Sure?"
            body="Really"
            confirmLabel="Delete"
            onConfirm={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await user.click(await screen.findByRole('menuitem', { name: 'Delete' }));
    await screen.findByRole('alertdialog');
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
  });
});
