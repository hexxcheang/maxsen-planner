import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { byTime, clashes, type TimetableEvent } from '../src/timetable.ts';

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
