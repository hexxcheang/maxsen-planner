import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { byPriority, isOverdue, matchLead, whatsappLink, type Lead } from '../src/leads.ts';

const lead = (id: string, patch: Partial<Lead> = {}): Lead => ({
  id,
  name: id,
  status: 'new',
  notes: [],
  createdAt: `2026-10-0${id.length}`,
  createdBy: 'x',
  updatedAt: '',
  updatedBy: 'x',
  ...patch,
});

describe('leads', () => {
  it('puts overdue follow-ups first, closed leads last', () => {
    const today = '2026-10-08';
    const list = [
      lead('won', { status: 'won', followUp: '2026-10-01' }),
      lead('later', { followUp: '2026-10-20' }),
      lead('late', { followUp: '2026-10-05' }),
      lead('soon', { followUp: '2026-10-09' }),
    ].sort(byPriority(today));
    assert.deepEqual(
      list.map((l) => l.id),
      ['late', 'soon', 'later', 'won'],
    );
    assert.equal(isOverdue(list[0]!, today), true);
    assert.equal(isOverdue(list[3]!, today), false, 'a won lead is never overdue');
  });

  it('finds leads by name, phone or what was noted', () => {
    const l = lead('Mr Tan', {
      phone: '9123 4567',
      notes: [{ at: '', by: 'Jo', text: 'Wants curtains in the master bedroom' }],
    });
    assert.equal(matchLead(l, '9123'), true);
    assert.equal(matchLead(l, 'curtains'), true);
    assert.equal(matchLead(l, 'lighting'), false);
  });

  it('makes WhatsApp links, adding +65 to local numbers', () => {
    assert.equal(whatsappLink('9123 4567'), 'https://wa.me/6591234567');
    assert.equal(whatsappLink('+60 12-345 6789'), 'https://wa.me/60123456789');
    assert.equal(whatsappLink('123'), null);
  });
});
