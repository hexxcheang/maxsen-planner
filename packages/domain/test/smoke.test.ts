import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { VERSION } from '../src/index.ts';

describe('domain package', () => {
  it('exports the package version', () => {
    assert.equal(VERSION, '0.1.0');
  });
});
