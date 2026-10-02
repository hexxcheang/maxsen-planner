import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES,
  categoryById,
  categoriesForPlan,
  SYSTEM_PRODUCT_IDS,
  SYSTEM_VARIANT_IDS,
  type CategoryId,
} from '../src/categories.ts';

const SPEC_SMART_HOME: [CategoryId, string][] = [
  ['smart-switches', 'Smart Switches'],
  ['control-panels', 'Control Panels'],
  ['curtains-blinds', 'Curtains / Blinds'],
  ['aircon-controllers', 'Aircon Controllers'],
  ['gateways', 'Gateways'],
  ['sensors', 'Sensors'],
  ['cameras', 'Cameras'],
  ['network-devices', 'Network Devices'],
  ['smart-locks', 'Smart Locks'],
  ['misc-smart-home', 'Miscellaneous Smart Home Accessories'],
];

const SPEC_LIGHTING: [CategoryId, string][] = [
  ['downlights', 'Downlights'],
  ['surface-lights', 'Surface Lights'],
  ['track-lights', 'Track Lights'],
  ['led-strips', 'LED Strips'],
  ['magnetic-track-lights', 'Magnetic Track Lights'],
  ['pendant-lights', 'Pendant Lights'],
  ['ceiling-fans', 'Ceiling Fans'],
  ['spotlights', 'Spotlights'],
  ['misc-lighting', 'Miscellaneous Lighting Accessories'],
];

describe('CATEGORIES', () => {
  it('has 19 categories in spec order', () => {
    const expected = [...SPEC_SMART_HOME, ...SPEC_LIGHTING];
    assert.equal(CATEGORIES.length, 19);
    assert.deepEqual(
      CATEGORIES.map((c) => [c.id, c.name]),
      expected,
    );
    assert.deepEqual(
      CATEGORIES.map((c) => c.order),
      Array.from({ length: 19 }, (_, i) => i + 1),
    );
  });

  it('smart-home has 10 and lighting has 9', () => {
    assert.equal(categoriesForPlan('smart-home').length, 10);
    assert.equal(categoriesForPlan('lighting').length, 9);
    assert.ok(categoriesForPlan('smart-home').every((c) => c.planType === 'smart-home'));
    assert.ok(categoriesForPlan('lighting').every((c) => c.planType === 'lighting'));
  });

  it('kinds: led-strips is led-strip, tracks are track, curtains are curtain, all others point', () => {
    for (const c of CATEGORIES) {
      const expected =
        c.id === 'led-strips'
          ? 'led-strip'
          : c.id === 'track-lights' || c.id === 'magnetic-track-lights'
            ? 'track'
            : c.id === 'curtains-blinds'
              ? 'curtain'
              : 'point';
      assert.equal(c.kind, expected, `${c.id} kind`);
    }
  });

  it('every category has defaults with a hex colour, a badge and a positive size', () => {
    for (const c of CATEGORIES) {
      assert.match(c.defaults.color, /^#[0-9A-Fa-f]{6}$/, `${c.id} colour`);
      assert.ok(c.defaults.badge.length >= 1 && c.defaults.badge.length <= 3, `${c.id} badge`);
      assert.ok(c.defaults.size > 0, `${c.id} size`);
      assert.ok(['filled', 'outline'].includes(c.defaults.badgeStyle));
    }
  });

  it('categoryById returns the definition and throws on unknown id', () => {
    assert.equal(categoryById('sensors').name, 'Sensors');
    assert.throws(() => categoryById('not-a-category' as CategoryId), /Unknown category/);
  });

  it('system ids are fixed strings', () => {
    assert.equal(SYSTEM_VARIANT_IDS.smartLedDriver, 'var_sys_smart_led_driver');
    assert.equal(SYSTEM_VARIANT_IDS.trackDriver, 'var_sys_track_driver');
    assert.equal(SYSTEM_PRODUCT_IDS.smartLedDriver, 'prod_sys_smart_led_driver');
    assert.equal(SYSTEM_PRODUCT_IDS.trackDriver, 'prod_sys_track_driver');
  });
});
