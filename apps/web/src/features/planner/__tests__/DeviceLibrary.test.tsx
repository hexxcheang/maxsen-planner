import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DataProvider } from '@/lib/data/DataProvider';
import { createSampleStore } from '@/lib/data/sample-store';
import { DeviceLibrary } from '../library/DeviceLibrary';

function renderLibrary(planType: 'smart-home' | 'lighting') {
  return render(
    <DataProvider store={createSampleStore()}>
      <DeviceLibrary projectId="proj_sample_tan" planType={planType} />
    </DataProvider>,
  );
}

const categoryHeadings = () =>
  screen
    .getAllByRole('button', { expanded: false })
    .concat(screen.queryAllByRole('button', { expanded: true }))
    .map((b) => b.getAttribute('data-category'))
    .filter(Boolean);

describe('DeviceLibrary', () => {
  it('shows only categories of the active plan type', () => {
    renderLibrary('lighting');
    const cats = categoryHeadings();
    expect(cats).toContain('downlights');
    expect(cats).toContain('led-strips');
    expect(cats).not.toContain('smart-switches');
    expect(cats).toHaveLength(9);
  });

  it('never offers the system drivers', async () => {
    const user = userEvent.setup();
    renderLibrary('lighting');
    await user.type(screen.getByRole('searchbox', { name: 'Search devices' }), 'driver');
    expect(screen.queryByText('Smart LED Driver')).not.toBeInTheDocument();
  });

  it('filters by search across product and variant names', async () => {
    const user = userEvent.setup();
    renderLibrary('smart-home');
    const search = screen.getByRole('searchbox', { name: 'Search devices' });
    await user.type(search, 'champagne');
    const results = screen.getByRole('list', { name: 'Search results' });
    const tiles = within(results).getAllByRole('listitem');
    expect(tiles.length).toBeGreaterThan(0);
    for (const t of tiles) expect(t).toHaveTextContent(/Champagne/);
    await user.clear(search);
    await user.type(search, 'lusano');
    expect(
      within(screen.getByRole('list', { name: 'Search results' }))
        .getAllByRole('listitem')
        .every((t) => /Lusano/.test(t.textContent ?? '')),
    ).toBe(true);
    await user.clear(search);
    await user.type(search, 'xyz');
    expect(screen.getByText('No devices match “xyz”')).toBeInTheDocument();
  });

  it('shows favourites and recently used for the plan type', () => {
    renderLibrary('lighting');
    expect(screen.getByRole('list', { name: 'Favourites' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Recently used' })).toBeInTheDocument();
  });
});
