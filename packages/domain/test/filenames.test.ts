import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { exportFilename, sanitiseFilename } from '../src/exports/filenames.ts';

describe('sanitiseFilename', () => {
  it('strips reserved characters', () => {
    assert.equal(sanitiseFilename('Tan / Lim: "Sky" Residence?*'), 'Tan Lim Sky Residence');
    assert.equal(sanitiseFilename('A<B>C|D\\E'), 'ABCDE');
  });

  it('collapses whitespace and trims', () => {
    assert.equal(sanitiseFilename('  Lim   Family\tHome \n'), 'Lim Family Home');
  });

  it('removes control characters and trailing dots', () => {
    assert.equal(sanitiseFilename('Marina\u0000 One...'), 'Marina One');
  });

  it('falls back to Project for empty', () => {
    assert.equal(sanitiseFilename(''), 'Project');
    assert.equal(sanitiseFilename('???'), 'Project');
  });

  it('caps at 100 characters', () => {
    const long = 'x'.repeat(150);
    assert.equal(sanitiseFilename(long).length, 100);
  });
});

describe('exportFilename', () => {
  it('patterns match the spec', () => {
    assert.equal(exportFilename('Tan Residence', 'floor-plan'), 'Tan Residence - Marked Floor Plan.pdf');
    assert.equal(
      exportFilename('Tan Residence', 'product-description'),
      'Tan Residence - Product Description.pdf',
    );
    assert.equal(exportFilename('Tan Residence', 'quantity'), 'Tan Residence - Quantity List.xlsx');
  });

  it('sanitises the title first', () => {
    assert.equal(exportFilename('A/B', 'quantity'), 'AB - Quantity List.xlsx');
  });
});
