import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createVariantPicker } from '../src/magic/variant-picker.ts';
import { SAMPLE_PRODUCTS, SAMPLE_VARIANTS } from '../src/sample/catalogue.ts';

const name = (id: string | null) => {
  const v = SAMPLE_VARIANTS.find((x) => x.id === id);
  const p = SAMPLE_PRODUCTS.find((x) => x.id === v?.productId);
  return `${p?.name}, ${v?.name}`;
};

describe('createVariantPicker', () => {
  const pick = createVariantPicker({
    products: SAMPLE_PRODUCTS,
    variants: SAMPLE_VARIANTS,
    favouriteVariantIds: ['var_nova_pro_2g_black'],
  });

  it('keeps to the favourite switch range and matches gangs', () => {
    assert.equal(name(pick('smart-switches', { gangs: 3 })), 'Nova+ Pro, 3-gang, Black');
    assert.equal(name(pick('smart-switches', { gangs: 1 })), 'Nova+ Pro, 1-gang, Black');
  });

  it('chooses double curtain tracks for wide windows', () => {
    assert.match(name(pick('curtains-blinds', { wide: true })), /Double/);
    assert.match(name(pick('curtains-blinds')), /Single/);
  });

  it('chooses routers, mesh nodes and the right sensors by role', () => {
    assert.match(name(pick('network-devices', { role: 'router' })), /Router/);
    assert.match(name(pick('network-devices', { role: 'mesh' })), /Mesh/);
    assert.match(name(pick('sensors', { role: 'motion-sensor' })), /Motion/);
    assert.match(name(pick('sensors', { role: 'door-sensor' })), /Door/);
  });

  it('never picks hidden or system variants', () => {
    assert.equal(pick('misc-lighting') === 'var_sys_smart_led_driver', false);
    const none = createVariantPicker({ products: [], variants: [], favouriteVariantIds: [] });
    assert.equal(none('downlights'), null);
  });
});
