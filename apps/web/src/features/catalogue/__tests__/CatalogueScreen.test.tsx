import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore, visibleVariantsFor } from '@/lib/data/sample-store';

beforeEach(() => window.sessionStorage.clear());

describe('CatalogueScreen', () => {
  it('lists categories in fixed order with counts', async () => {
    render(<TestApp path="/catalogue" signedIn />);
    const nav = await screen.findByRole('list', { name: 'Categories' });
    const items = within(nav).getAllByRole('button');
    expect(items).toHaveLength(19);
    expect(items[0]).toHaveTextContent('Smart Switches');
  });

  it('catalogue edit is gated by the admin unlock dialog', async () => {
    const user = userEvent.setup();
    const store = createSampleStore();
    render(<TestApp path="/catalogue" signedIn store={store} />);
    expect(await screen.findByText('Unlock admin to edit')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit Ark Series' }));
    const dialog = await screen.findByRole('dialog', { name: 'Unlock admin' });
    await user.type(within(dialog).getByLabelText('Admin passcode'), 'wrong');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock' }));
    expect(
      await within(dialog).findByText("That admin passcode isn't right. Try again."),
    ).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText('Admin passcode'));
    await user.type(within(dialog).getByLabelText('Admin passcode'), 'admin');
    await user.click(within(dialog).getByRole('button', { name: 'Unlock' }));
    const editor = await screen.findByRole('dialog', { name: 'Edit product' });
    const name = within(editor).getByLabelText('Product name');
    await user.clear(name);
    await user.type(name, 'Ark Series II');
    await user.click(within(editor).getByRole('button', { name: 'Save product' }));
    expect(store.getState().products.find((p) => p.id === 'prod_ark')?.name).toBe('Ark Series II');
  });

  it('hiding a variant marks it hidden and removes it from visibleVariantsFor', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('maxsen.admin', '1');
    const store = createSampleStore();
    render(<TestApp path="/catalogue" signedIn store={store} />);
    await user.click(await screen.findByRole('button', { name: 'Show variants of Ark Series' }));
    await user.click(screen.getByRole('button', { name: 'Hide Ark Series, 1-gang' }));
    const v = store.getState().variants.find((x) => x.id === 'var_ark_1g')!;
    expect(v.hidden).toBe(true);
    expect(visibleVariantsFor(store.getState(), 'smart-home').some((x) => x.id === v.id)).toBe(
      false,
    );
    expect(screen.getByRole('button', { name: 'Unhide Ark Series, 1-gang' })).toBeInTheDocument();
  });
});
