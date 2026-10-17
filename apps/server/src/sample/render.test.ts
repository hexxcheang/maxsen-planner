import { describe, expect, it, vi } from 'vitest';
import { buildApp } from '../app.ts';
import { createRenderer } from './render.ts';

const photo = 'A'.repeat(200);
const prompt = 'Place this switch on a wall in a luxury living room.';

describe('product sample renderer', () => {
  it('is off without an image model key', () => {
    expect(createRenderer({})).toBeUndefined();
  });

  it('asks Gemini for an image with the photo and prompt, and returns it', async () => {
    const fetcher = vi.fn((_url: string | URL | Request, _init?: RequestInit) =>
      Promise.resolve(
        Response.json({
          candidates: [
            { content: { parts: [{ inlineData: { mimeType: 'image/png', data: 'IMG' } }] } },
          ],
        }),
      ),
    );
    const r = createRenderer({ GEMINI_API_KEY: 'g-key', OPENAI_API_KEY: 'o' }, fetcher)!;
    expect(r.provider).toBe('gemini');
    const out = await r.render({ image: photo, mediaType: 'image/jpeg', prompt });
    expect(out).toEqual({ image: 'IMG', mediaType: 'image/png' });
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url as string).toContain('models/gemini-2.5-flash-image:generateContent');
    expect((init!.headers as Record<string, string>)['x-goog-api-key']).toBe('g-key');
    const body = JSON.parse(init!.body as string) as {
      contents: { parts: Record<string, unknown>[] }[];
    };
    expect(body.contents[0]!.parts).toEqual([
      { inline_data: { mime_type: 'image/jpeg', data: photo } },
      { text: prompt },
    ]);
  });

  it('uses OpenAI when that is the key there', async () => {
    const fetcher = vi.fn(() => Promise.resolve(Response.json({ data: [{ b64_json: 'PNG' }] })));
    const r = createRenderer({ OPENAI_API_KEY: 'o-key' }, fetcher)!;
    expect(r.provider).toBe('openai');
    expect(await r.render({ image: photo, mediaType: 'image/png', prompt })).toEqual({
      image: 'PNG',
      mediaType: 'image/png',
    });
  });

  it('turns a rejected key into a clear message', async () => {
    const fetcher = vi.fn(() => Promise.resolve(new Response('bad key', { status: 403 })));
    const app = buildApp({
      render: createRenderer({ GEMINI_API_KEY: 'x' }, fetcher),
    });
    const res = await app.request('/api/product-sample/render', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ image: photo, mediaType: 'image/jpeg', prompt }),
    });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { message: string }).message).toMatch(/key was rejected/);
  });

  it('reports whether it is set up', async () => {
    const off = await buildApp().request('/api/product-sample/status');
    expect(await off.json()).toEqual({ configured: false, provider: null });
    const res = await buildApp().request('/api/product-sample/render', {
      method: 'POST',
      body: '{}',
    });
    expect(res.status).toBe(503);
  });
});
