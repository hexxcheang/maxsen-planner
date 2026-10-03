import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

describe('NewProjectScreen', () => {
  it('creates a blank project and opens setup', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path="/projects/new" signedIn store={store} />);
    await user.click(await screen.findByRole('radio', { name: /Start from blank/ }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    expect(await screen.findByText('Enter a project title')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Project title'), '  Ong Residence  ');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    const created = store.getState().projects.find((p) => p.title === 'Ong Residence');
    expect(created?.status).toBe('draft');
    expect(await screen.findByRole('heading', { name: 'Setup' })).toBeInTheDocument();
  });

  it('a template project copies the template levels', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path="/projects/new?template=tpl_hdb_4room" signedIn store={store} />);
    expect(await screen.findByRole('radio', { name: /HDB 4-room standard/ })).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.type(screen.getByLabelText('Project title'), 'Koh Residence');
    await user.click(screen.getByRole('button', { name: 'Create project' }));
    const p = store.getState().projects.find((x) => x.title === 'Koh Residence')!;
    expect(
      store
        .getState()
        .levels.filter((l) => l.projectId === p.id)
        .map((l) => l.name),
    ).toEqual(['Level 1']);
  });
});
