import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

const LIM = '/projects/proj_sample_lim/setup';

const levelNames = () =>
  within(screen.getByRole('list', { name: 'Levels' }))
    .getAllByRole('listitem')
    .map((li) => li.getAttribute('data-level-name'));

describe('SetupScreen', () => {
  it('lists levels in order and renames inline', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path={LIM} signedIn store={store} />);
    await screen.findByRole('list', { name: 'Levels' });
    expect(levelNames()).toEqual(['Level 1', 'Level 2', 'Attic']);
    await user.click(screen.getByRole('button', { name: 'Rename Attic' }));
    const input = screen.getByRole('textbox', { name: 'Level name' });
    await user.clear(input);
    await user.type(input, 'Roof terrace{Enter}');
    expect(levelNames()).toEqual(['Level 1', 'Level 2', 'Roof terrace']);
    expect(store.getState().levels.find((l) => l.id === 'lvl_lim_3')?.name).toBe('Roof terrace');
  });

  it('moving a level down swaps order', async () => {
    const user = userEvent.setup();
    render(<TestApp path={LIM} signedIn />);
    await user.click(await screen.findByRole('button', { name: 'Move Level 1 down' }));
    expect(levelNames()).toEqual(['Level 2', 'Level 1', 'Attic']);
  });

  it('has no way to delete a level', async () => {
    render(<TestApp path={LIM} signedIn />);
    await screen.findByRole('list', { name: 'Levels' });
    expect(screen.queryByRole('button', { name: /Delete level/i })).not.toBeInTheDocument();
  });

  it('deleting a plan asks for confirmation and removes it', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path={LIM} signedIn store={store} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Level 1' }));
    const card = await screen.findByRole('region', { name: 'Lighting Plan' });
    await user.click(within(card).getByRole('button', { name: 'Delete plan' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(store.getState().plans.some((p) => p.id === 'plan_lim_1_lt')).toBe(true);
    await user.click(within(dialog).getByRole('button', { name: 'Delete plan' }));
    expect(store.getState().plans.some((p) => p.id === 'plan_lim_1_lt')).toBe(false);
    expect(
      within(screen.getByRole('region', { name: 'Lighting Plan' })).getByText('Not set up yet'),
    ).toBeInTheDocument();
  });

  it('plan card without background shows the choose-drawing empty state', async () => {
    const user = userEvent.setup();
    render(<TestApp path={LIM} signedIn />);
    await user.click(await screen.findByRole('button', { name: 'Attic' }));
    const card = screen.getByRole('region', { name: 'Smart Home Plan' });
    expect(within(card).getByText('Not set up yet')).toBeInTheDocument();
    expect(within(card).getByRole('button', { name: 'Choose a drawing' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });

  it('paper size and orientation update the level', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path={LIM} signedIn store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Level 1' }));
    await user.click(screen.getByRole('radio', { name: 'A4' }));
    await user.click(screen.getByRole('radio', { name: 'Portrait' }));
    const level = store.getState().levels.find((l) => l.id === 'lvl_lim_1');
    expect(level).toMatchObject({ paperSize: 'A4', orientation: 'portrait' });
  });
});
