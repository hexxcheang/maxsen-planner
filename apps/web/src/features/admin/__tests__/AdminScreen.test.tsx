import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';
import { createSampleStore } from '@/lib/data/sample-store';

beforeEach(() => window.sessionStorage.clear());

describe('AdminScreen', () => {
  it('requires unlock on entry', async () => {
    render(<TestApp path="/admin" signedIn />);
    expect(
      await screen.findByRole('heading', { name: 'Admin settings are locked' }),
    ).toBeInTheDocument();
  });

  it('admin icon size change updates settings.categoryStyles', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('maxsen.admin', '1');
    const store = createSampleStore();
    render(<TestApp path="/admin" signedIn store={store} />);
    await user.click(await screen.findByRole('tab', { name: 'Icon styles' }));
    const row = screen.getByRole('row', { name: /Downlights/ });
    await user.click(within(row).getByRole('radio', { name: 'L' }));
    expect(store.getState().settings.categoryStyles.downlights?.size).toBe(26);
    const hex = within(row).getByRole('textbox', { name: 'Downlights colour' });
    await user.clear(hex);
    await user.type(hex, '#123456{Enter}');
    expect(store.getState().settings.categoryStyles.downlights?.color).toBe('#123456');
  });

  it('favourites add and remove persist', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('maxsen.admin', '1');
    const store = createSampleStore();
    render(<TestApp path="/admin" signedIn store={store} />);
    await user.click(await screen.findByRole('tab', { name: 'Favourites' }));
    await user.click(screen.getByRole('button', { name: 'Remove Nova S8, Standard' }));
    expect(store.getState().settings.favouriteVariantIds).not.toContain('var_nova_s8');
    await user.type(screen.getByRole('searchbox', { name: 'Find a variant to add' }), 'outdoor');
    await user.click(screen.getByRole('button', { name: 'Add Outdoor Camera, Standard' }));
    expect(store.getState().settings.favouriteVariantIds.at(-1)).toBe('var_outdoor_cam');
  });

  it('branding saves contact details', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem('maxsen.admin', '1');
    const store = createSampleStore();
    render(<TestApp path="/admin" signedIn store={store} />);
    const wa = await screen.findByLabelText('WhatsApp number');
    await user.clear(wa);
    await user.type(wa, '+65 8111 2222');
    await user.click(screen.getByRole('button', { name: 'Save branding' }));
    expect(store.getState().settings.branding.whatsapp).toBe('+65 8111 2222');
  });
});
