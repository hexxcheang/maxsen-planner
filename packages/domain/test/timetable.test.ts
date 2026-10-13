import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  appointmentMessage,
  byTime,
  clashes,
  whatsappMessageLink,
  type TimetableEvent,
} from '../src/timetable.ts';

const ev = (
  id: string,
  date: string,
  start: string,
  end: string,
  people: string[],
): TimetableEvent => ({
  id,
  kind: 'sales',
  date,
  start,
  end,
  title: id,
  people,
  updatedAt: '',
  updatedBy: '',
});

describe('timetable', () => {
  it('orders by day, then time', () => {
    const list = [
      ev('b', '2026-10-12', '14:00', '15:00', []),
      ev('c', '2026-10-13', '09:00', '10:00', []),
      ev('a', '2026-10-12', '09:30', '10:00', []),
    ].sort(byTime);
    assert.deepEqual(
      list.map((e) => e.id),
      ['a', 'b', 'c'],
    );
  });

  it('finds the same person booked twice at once, and only that', () => {
    const found = clashes([
      ev('meet', '2026-10-12', '10:00', '11:00', ['Jo', 'Sam']),
      ev('install', '2026-10-12', '10:30', '16:00', ['Jo', 'Ali']),
      // Back to back is fine; someone else at the same time is fine; another day is fine.
      ev('after', '2026-10-12', '16:00', '17:00', ['Jo']),
      ev('other', '2026-10-12', '10:00', '11:00', ['Ali2']),
      ev('tomorrow', '2026-10-13', '10:00', '11:00', ['Jo']),
    ]);
    assert.deepEqual(Object.fromEntries(found), { meet: ['Jo'], install: ['Jo'] });
  });
});

describe('telling the people assigned on WhatsApp', () => {
  const event = {
    kind: 'installation' as const,
    title: 'Install switches, Tan residence',
    date: '2026-10-14',
    start: '10:30',
    end: '16:00',
    client: 'Mr Tan',
    address: '12 Punggol Field',
    people: ['Jo', 'Sam'],
    notes: 'Bring the ladder',
  };

  it('writes what, when, where (with a map link), who else and the notes', () => {
    const text = appointmentMessage(event, 'Jo', { from: 'Hexiang' });
    assert.equal(
      text,
      [
        "Hi Jo, you're scheduled for an installation:",
        '*Install switches, Tan residence*',
        'Wed 14 Oct 2026, 10:30–16:00',
        'Client: Mr Tan',
        'Address: 12 Punggol Field',
        'https://www.google.com/maps/search/?api=1&query=12%20Punggol%20Field',
        'With: Sam',
        'Notes: Bring the ladder',
        '',
        '– Hexiang, Maxsen',
      ].join('\n'),
    );
    assert.match(
      appointmentMessage(event, 'Sam', { changed: true }),
      /^Hi Sam, your installation has been updated:/,
    );
  });

  it('links to the number (Singapore numbers get +65), or to choosing the contact', () => {
    assert.equal(whatsappMessageLink('9123 4567', 'Hi'), 'https://wa.me/6591234567?text=Hi');
    assert.equal(whatsappMessageLink('+60 12-345 6789', 'Hi'), 'https://wa.me/60123456789?text=Hi');
    assert.equal(whatsappMessageLink(undefined, 'Hi there'), 'https://wa.me/?text=Hi%20there');
  });
});
