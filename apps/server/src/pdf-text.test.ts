import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { buildApp } from './app.ts';

const invoice = readFileSync(
  path.resolve(import.meta.dirname, '../../web/e2e/fixtures/multipage-invoice.pdf'),
);

describe('reading a PDF’s text on the server', () => {
  const app = buildApp();

  it('gives each piece of text with its page and place', async () => {
    const res = await app.request('/api/pdf/text', {
      method: 'POST',
      headers: { 'content-type': 'application/pdf' },
      body: invoice,
    });
    expect(res.status).toBe(200);
    const { texts } = (await res.json()) as { texts: { page: number; str: string }[] };
    expect(new Set(texts.map((t) => t.page))).toEqual(new Set([1, 2]));
    expect(texts.some((t) => t.str.includes('Extra item number 28 for testing'))).toBe(true);
  });

  it('refuses what isn’t a PDF', async () => {
    const res = await app.request('/api/pdf/text', { method: 'POST', body: '<html></html>' });
    expect(res.status).toBe(400);
  });
});
