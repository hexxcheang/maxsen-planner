import { describe, expect, it } from 'vitest';
import { sample } from '@maxsen/domain';
import { buildApp } from '../app.ts';
import { AnalysisError, normaliseAnalysis } from './analyse.ts';

const body = { image: 'x'.repeat(200), mediaType: 'image/png' as const };
const post = (app: ReturnType<typeof buildApp>, payload: unknown) =>
  app.request('/api/magic-plan/analyse', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

describe('Magic Plan API', () => {
  it('reports when it is not configured', async () => {
    const app = buildApp();
    expect(await (await app.request('/api/magic-plan/status')).json()).toEqual({
      configured: false,
    });
    const res = await post(app, body);
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: 'not-configured' });
  });

  it('returns the analysis from the analyser', async () => {
    const analysis = sample.sampleAnalysisFor('file_sample_plan_hdb')!;
    let notes: string | undefined;
    const app = buildApp({
      analyse: (input) => {
        notes = input.notes;
        return Promise.resolve(analysis);
      },
    });
    const res = await post(app, { ...body, notes: 'TV wall faces the window' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ analysis });
    expect(notes).toBe('TV wall faces the window');
  });

  it('rejects requests without an image', async () => {
    const app = buildApp({
      analyse: () => Promise.resolve(sample.sampleAnalysisFor('file_sample_plan_hdb')!),
    });
    expect((await post(app, { mediaType: 'image/png' })).status).toBe(400);
  });

  it('turns unreadable drawings into a 422 with a message', async () => {
    const app = buildApp({
      analyse: () => Promise.reject(new AnalysisError('The drawing could not be read reliably.')),
    });
    const res = await post(app, body);
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ error: 'unreadable' });
  });
});

describe('normaliseAnalysis', () => {
  it('drops references to rooms that do not exist and clamps points', () => {
    const a = normaliseAnalysis({
      rooms: [{ id: 'a', name: 'Living', type: 'living', x: 0.1, y: 0.1, w: 0.5, h: 0.5 }],
      doors: [
        {
          id: 'd',
          hinge: { x: 0.1, y: 1.4 },
          latch: { x: 0.2, y: 0.6 },
          swingsInto: 'ghost',
          sides: ['a', 'ghost', 'extra'],
          isMainEntrance: true,
        },
      ],
      windows: [],
      imageWidthMetres: 0,
    });
    expect(a.doors[0]).toMatchObject({
      swingsInto: null,
      sides: ['a', null],
      hinge: { x: 0.1, y: 1.05 },
    });
    expect(a.imageWidthMetres).toBeNull();
  });

  it('rejects an analysis with no rooms', () => {
    expect(() =>
      normaliseAnalysis({ rooms: [], doors: [], windows: [], imageWidthMetres: null }),
    ).toThrow(AnalysisError);
  });
});
