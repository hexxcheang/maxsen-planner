import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseQuoteMessage, splitPhrases, withLedDrivers } from '../src/quote/parse-message.ts';
import { SAMPLE_PRODUCTS, SAMPLE_VARIANTS } from '../src/sample/catalogue.ts';
import { SYSTEM_VARIANT_IDS } from '../src/categories.ts';

const catalogue = { products: SAMPLE_PRODUCTS, variants: SAMPLE_VARIANTS };
const read = (text: string, preferred?: string[]) =>
  parseQuoteMessage(text, catalogue, preferred ? { preferred } : {});
const qty = (r: ReturnType<typeof read>) =>
  Object.fromEntries(r.lines.map((l) => [l.variantId, l.quantity]));

describe('parseQuoteMessage', () => {
  it('reads a WhatsApp-style list into catalogue lines', () => {
    const r = read(`Hi, I just got my 5 room HDB keys. Need quote for:
- 10 switches
- 3 x 2 gang lusano switches
- 15 downlights warm white
- 2 motorised curtains
- 20m LED strip
- Nova S8 panel
- 4 aircon controllers
Thanks!`);
    assert.deepEqual(qty(r), {
      var_ark_1g: 10,
      var_lusano_2g: 3,
      var_luna_dl_3000: 15,
      var_curtain_single: 2,
      var_lumi_cove_3000: 20,
      var_nova_s8: 1,
      var_ir_aircon: 4,
    });
    assert.equal(r.lines.find((l) => l.variantId === 'var_lumi_cove_3000')!.unit, 'm');
    // "5 room HDB" is about the home, not an item.
    assert.deepEqual(r.unread, []);
  });

  it('picks variants from the details and reads a sentence', () => {
    const r = read(
      'can quote 12 downlight cool white, 2 track lights black, 30 metres cob strip and 1 digital lock pro? also 2 cctv',
    );
    assert.deepEqual(qty(r), {
      var_luna_dl_4000: 12,
      var_luna_track_black: 2,
      var_lumi_cob_3000: 30,
      var_lenovo_lock_pro: 1,
      var_indoor_cam: 2,
    });
  });

  it('reads sizes and colour temperatures as details, not quantities', () => {
    const r = read('a ceiling fan 52 inch; 4000K downlights x 6; nova pro 3 gang black');
    assert.deepEqual(qty(r), {
      var_breeze_fan_52: 1,
      var_luna_dl_4000: 6,
      var_nova_pro_3g_black: 1,
    });
  });

  it('prefers a favourite variant when the message gives no details', () => {
    const r = read('8 switches', ['var_nova_pro_2g_black']);
    assert.deepEqual(qty(r), { var_nova_pro_2g_black: 8 });
  });

  it('adds up the same item asked for twice, and hands back what it could not read', () => {
    const r = read('5 downlights\n3 downlights\n2 bidets');
    assert.deepEqual(qty(r), { var_luna_dl_3000: 8 });
    assert.deepEqual(r.unread, ['2 bidets']);
  });

  it('adds LED drivers for the strip, one per 5 m, unless asked for', () => {
    const lines = withLedDrivers(read('22m led strip').lines, 5);
    assert.equal(lines.find((l) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver)!.quantity, 5);
    const asked = withLedDrivers(read('22m led strip, 2 drivers').lines, 5);
    assert.equal(asked.find((l) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver)!.quantity, 2);
  });

  it('adds no drivers for an add-on-only strip line (RGBCCT)', () => {
    const lines = withLedDrivers(
      [
        { variantId: 'var_lumi_cove_3000', quantity: 10, unit: 'm', source: '' },
        { variantId: 'var_lumi_cove_rgbcct', quantity: 30, unit: 'm', source: '' },
      ],
      5,
      (id) => id === 'var_lumi_cove_rgbcct',
    );
    assert.equal(lines.find((l) => l.variantId === SYSTEM_VARIANT_IDS.smartLedDriver)!.quantity, 2);
  });

  it('splits on lines, commas and joining words, without the list bullets', () => {
    assert.deepEqual(splitPhrases('1. 2 fans\n• 3 locks, 4 plugs and 5 cams'), [
      '2 fans',
      '3 locks',
      '4 plugs',
      '5 cams',
    ]);
  });
});
