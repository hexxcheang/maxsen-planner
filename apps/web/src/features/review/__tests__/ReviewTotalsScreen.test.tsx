import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

const TAN = '/projects/proj_sample_tan/review';

describe('ReviewTotalsScreen', () => {
  it('groups lines into Smart Home and Lighting sections', async () => {
    render(<TestApp path={TAN} signedIn />);
    expect(
      await screen.findByRole('rowgroup', { name: 'Smart Home Products' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('rowgroup', { name: 'Lighting Products' })).toBeInTheDocument();
  });

  it('editing export quantity marks the row adjusted and persists in the store', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path={TAN} signedIn store={store} />);
    const input = await screen.findByRole('textbox', {
      name: 'Export quantity for Luna Downlight, 3000K',
    });
    const row = input.closest('tr')!;
    expect(row).not.toHaveAttribute('data-adjusted');
    await user.clear(input);
    await user.type(input, '20{Enter}');
    expect(row).toHaveAttribute('data-adjusted', 'true');
    const adj = store.getState().projects.find((p) => p.id === 'proj_sample_tan')!
      .quantityAdjustments['variant:var_luna_dl_3000'];
    expect(adj?.quantity).toBe(20);
  });

  it('warning shows when calculated differs from calculatedAtAdjustment', async () => {
    render(<TestApp path={TAN} signedIn />);
    const input = await screen.findByRole('textbox', {
      name: 'Export quantity for Lumi Cove Strip, 3000K',
    });
    const row = input.closest('tr')!;
    expect(
      within(row).getByText(/Calculated quantity changed since you adjusted this \(was 4 m\)/),
    ).toBeInTheDocument();
    const fine = screen
      .getByRole('textbox', { name: 'Export quantity for Nova+ Pro, 2-gang, Black' })
      .closest('tr')!;
    expect(fine).toHaveAttribute('data-adjusted', 'true');
    expect(within(fine).queryByText(/Calculated quantity changed/)).not.toBeInTheDocument();
  });
});
