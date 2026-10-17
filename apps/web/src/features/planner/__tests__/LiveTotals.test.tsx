import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { computeTotals, SYSTEM_VARIANT_IDS } from '@maxsen/domain';
import { DataProvider } from '@/lib/data/DataProvider';
import { createSampleStore, plansOf, resolverFor } from '@/lib/data/sample-store';
import { LiveTotals } from '../totals/LiveTotals';

describe('LiveTotals', () => {
  it('lists Smart LED Driver as auto-added with the sample count', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    const s = store.getState();
    const project = s.projects.find((p) => p.id === 'proj_sample_tan')!;
    const expected = computeTotals(
      plansOf(s, project.id).map((p) => p.document),
      resolverFor(project, s),
    ).find((l) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver)!;
    expect(expected.calculated).toBeGreaterThan(0);
    render(
      <DataProvider store={store}>
        <LiveTotals projectId="proj_sample_tan" />
      </DataProvider>,
    );
    await user.click(screen.getByRole('button', { name: /Miscellaneous Lighting Accessories/ }));
    const row = screen.getByText('Smart LED Driver').closest('li')!;
    expect(within(row).getByText('Auto-added')).toBeInTheDocument();
    expect(within(row).getByText(String(expected.calculated))).toBeInTheDocument();
  });
});
