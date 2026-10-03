import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '../Button';

describe('Button', () => {
  it('renders primary and secondary variants', () => {
    render(
      <>
        <Button variant="primary">Create project</Button>
        <Button variant="secondary">Cancel</Button>
      </>,
    );
    expect(screen.getByRole('button', { name: 'Create project' })).toHaveAttribute(
      'data-variant',
      'primary',
    );
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveAttribute(
      'data-variant',
      'secondary',
    );
  });

  it('respects disabled with reason tooltip text', async () => {
    const onClick = vi.fn();
    render(
      <Button disabledReason="Available in a later phase" onClick={onClick}>
        Generate
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Generate' });
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveAccessibleDescription('Available in a later phase');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('shows a busy state while loading and ignores clicks', async () => {
    const onClick = vi.fn();
    render(
      <Button loading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toHaveAttribute('aria-busy', 'true');
    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
