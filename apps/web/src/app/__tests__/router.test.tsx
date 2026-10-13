import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TestApp } from '@/test/TestApp';

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe('routing and access gate', () => {
  it('visiting / while signed out redirects to /login', async () => {
    render(<TestApp path="/" />);
    expect(
      await screen.findByRole('heading', { name: 'Enter the team passcode' }),
    ).toBeInTheDocument();
  });

  it('signing in with maxsen shows the dashboard', async () => {
    const user = userEvent.setup();
    render(<TestApp path="/" />);
    await user.type(await screen.findByLabelText('Passcode'), 'maxsen');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeInTheDocument();
  });

  it('a wrong passcode shows an error', async () => {
    const user = userEvent.setup();
    render(<TestApp path="/" />);
    await user.type(await screen.findByLabelText('Passcode'), 'nope');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText("That passcode isn't right. Try again.")).toBeInTheDocument();
  });

  it('unknown route shows Not found', async () => {
    render(<TestApp path="/nowhere" signedIn />);
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });

  it('help covers each tab, with the eight planning steps', async () => {
    render(<TestApp path="/help" signedIn />);
    const list = await screen.findByRole('list', { name: 'Projects steps' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(8);
    const topics = screen.getByRole('navigation', { name: 'Help topics' });
    for (const tab of ['Leads', 'Timetable', 'Inventory', 'Claims', 'Team', 'Quote', 'Admin'])
      expect(within(topics).getByRole('link', { name: tab })).toBeInTheDocument();
  });
});
