import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMetres, formatUpdated } from '../format';

describe('format', () => {
  it('formats dates in Singapore time with short month names', () => {
    expect(formatDateTime('2026-09-29T08:42:00.000Z')).toBe('29 Sep 2026, 16:42');
  });
  it('formats recent updates relatively', () => {
    const now = new Date('2026-10-01T10:00:00.000Z');
    expect(formatUpdated('2026-10-01T09:48:00.000Z', now)).toBe('12 minutes ago');
    expect(formatUpdated('2026-10-01T07:00:00.000Z', now)).toBe('3 hours ago');
    expect(formatUpdated('2026-09-29T08:42:00.000Z', now)).toBe('29 Sep 2026, 16:42');
  });
  it('formats metres to one decimal', () => {
    expect(formatMetres(4.5)).toBe('4.5 m');
    expect(formatMetres(17)).toBe('17 m');
  });
});
