import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

describe('ExportsScreen', () => {
  it('export filename previews use the sanitised title', async () => {
    const store = createSampleStore();
    store.actions.updateProjectDetails('proj_sample_tan', {
      ...store.getState().projects.find((p) => p.id === 'proj_sample_tan')!,
      title: 'Tan / Lim: "Sky" Residence?*',
    });
    render(<TestApp path="/projects/proj_sample_tan/exports" signedIn store={store} />);
    expect(
      await screen.findByText('Tan Lim Sky Residence - Marked Floor Plan.pdf'),
    ).toBeInTheDocument();
    expect(screen.getByText('Tan Lim Sky Residence - Quantity List.xlsx')).toBeInTheDocument();
    expect(screen.getByText('Tan Lim Sky Residence - Product Description.pdf')).toBeInTheDocument();
  });

  it('toggling a category in floor-plan options updates exportSettings.floorPlan.hiddenCategories', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path="/projects/proj_sample_tan/exports" signedIn store={store} />);
    const group = await screen.findByRole('group', { name: 'Categories on the floor plan' });
    const cb = (await import('@testing-library/react'))
      .within(group)
      .getByRole('checkbox', { name: 'Cameras' });
    await user.click(cb);
    const fp = () =>
      store.getState().projects.find((p) => p.id === 'proj_sample_tan')!.exportSettings.floorPlan;
    expect(fp().hiddenCategories).toEqual(['cameras']);
    await user.click(cb);
    expect(fp().hiddenCategories).toEqual([]);
  });

  it('offers generate buttons for each export and for all of them', async () => {
    render(<TestApp path="/projects/proj_sample_tan/exports" signedIn />);
    expect(await screen.findByRole('button', { name: 'Generate all exports' })).not.toHaveAttribute(
      'aria-disabled',
    );
    expect(screen.getAllByRole('button', { name: 'Generate' })).toHaveLength(3);
  });
});
