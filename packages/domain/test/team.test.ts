import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { whatsappNumber } from '../src/team.ts';

describe('WhatsApp numbers', () => {
  it('takes Singapore mobiles however they’re typed', () => {
    for (const typed of ['9123 4567', '91234567', '+65 9123 4567', '6591234567', '0065-9123-4567'])
      assert.deepEqual(whatsappNumber(typed), {
        ok: true,
        digits: '6591234567',
        display: '+65 9123 4567',
      });
  });

  it('takes other countries with their code', () => {
    assert.deepEqual(whatsappNumber('+60 12-345 6789'), {
      ok: true,
      digits: '60123456789',
      display: '+60123456789',
    });
  });

  it('says what’s wrong with a number that isn’t a WhatsApp mobile', () => {
    assert.match((whatsappNumber('6123 4567') as { reason: string }).reason, /start with 8 or 9/);
    assert.match((whatsappNumber('012 345 6789') as { reason: string }).reason, /country code/);
    assert.match((whatsappNumber('+65 1234') as { reason: string }).reason, /8 digits/);
    assert.equal(whatsappNumber('').ok, false);
  });
});
