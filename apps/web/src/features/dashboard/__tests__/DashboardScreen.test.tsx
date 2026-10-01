import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

const rows = () =>
  screen.getAllByRole('listitem').filter((li) => li.closest('[aria-label="Projects"]'));

describe('DashboardScreen', () => {
  it('renders sample projects with status badges', async () => {
    render(<TestApp path="/" signedIn />);
    expect(
      await screen.findByRole('link', { name: 'Tan Residence — Tampines 4-room' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Lim Family Home — Serangoon Gardens' }),
    ).toBeInTheDocument();
    expect(screen.getByText('In progress')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(rows()).toHaveLength(3);
  });

  it('opens the planner from the title', async () => {
    render(<TestApp path="/" signedIn />);
    const link = await screen.findByRole('link', { name: 'Marina One Showflat' });
    expect(link).toHaveAttribute('href', '/projects/proj_sample_marina/plan');
  });

  it('search narrows rows', async () => {
    const user = userEvent.setup();
    render(<TestApp path="/" signedIn />);
    await user.type(await screen.findByRole('searchbox', { name: 'Search projects' }), 'chartwell');
    expect(rows()).toHaveLength(1);
    expect(
      screen.getByRole('link', { name: 'Lim Family Home — Serangoon Gardens' }),
    ).toBeInTheDocument();
    await user.clear(screen.getByRole('searchbox', { name: 'Search projects' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search projects' }), 'zzz');
    expect(screen.getByText('No projects match “zzz”')).toBeInTheDocument();
  });

  it('empty store shows the empty state with New project', async () => {
    render(<TestApp path="/" signedIn store={createSampleStore('empty')} />);
    expect(await screen.findByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'New project' }).length).toBeGreaterThan(0);
  });

  it('delete flow removes the row after confirm', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path="/" signedIn store={store} />);
    const row = (await screen.findByRole('link', { name: 'Marina One Showflat' })).closest('li')!;
    await user.click(
      within(row).getByRole('button', { name: 'More actions for Marina One Showflat' }),
    );
    await user.click(await screen.findByRole('menuitem', { name: 'Delete project' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent(
      'Delete Marina One Showflat? This permanently removes the project and its plans.',
    );
    await user.click(within(dialog).getByRole('button', { name: 'Delete project' }));
    expect(screen.queryByRole('link', { name: 'Marina One Showflat' })).not.toBeInTheDocument();
    expect(store.getState().projects).toHaveLength(2);
  });
});
