import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

beforeEach(() => window.sessionStorage.clear());

describe('TemplatesScreen', () => {
  it('links each template to a new project', async () => {
    render(<TestApp path="/templates" signedIn />);
    expect(await screen.findByRole('link', { name: 'Use HDB 4-room standard' })).toHaveAttribute(
      'href',
      '/projects/new?template=tpl_hdb_4room',
    );
  });

  it('admin can delete a template after confirming', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('maxsen.admin', '1');
    const store = createSampleStore();
    render(<TestApp path="/templates" signedIn store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Delete HDB 4-room standard' }));
    await user.click(
      within(await screen.findByRole('alertdialog')).getByRole('button', {
        name: 'Delete template',
      }),
    );
    expect(store.getState().templates).toHaveLength(0);
    expect(await screen.findByRole('heading', { name: 'No templates yet' })).toBeInTheDocument();
  });
});
