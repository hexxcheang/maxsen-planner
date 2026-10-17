import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { byNewest, claimsTotal, matchClaim, type Claim } from '../src/claims.ts';

const claim = (id: string, patch: Partial<Claim> = {}): Claim => ({
  id,
  claimant: 'Jo',
  date: '2026-10-10',
  amount: 10,
  purpose: id,
  receipts: [],
  status: 'pending',
  createdAt: '2026-10-10T00:00:00.000Z',
  updatedAt: '2026-10-10T00:00:00.000Z',
  ...patch,
});

describe('claims', () => {
  it('lists waiting claims first, newest first', () => {
    const list = [
      claim('old-approved', { status: 'approved', date: '2026-10-12' }),
      claim('older', { date: '2026-10-01' }),
      claim('newer', { date: '2026-10-11' }),
    ].sort(byNewest);
    assert.deepEqual(
      list.map((c) => c.id),
      ['newer', 'older', 'old-approved'],
    );
  });

  it('adds up to the cent, and searches what for, who and where', () => {
    assert.equal(claimsTotal([claim('a', { amount: 0.1 }), claim('b', { amount: 0.2 })]), 0.3);
    const c = claim('Cable ties', { site: 'Tan residence', category: 'Materials' });
    assert.ok(matchClaim(c, 'tan res'));
    assert.ok(matchClaim(c, 'materials'));
    assert.ok(!matchClaim(c, 'lunch'));
  });
});
