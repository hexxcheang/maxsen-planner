import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { z } from 'zod';
import { AnalysisError, type Analyser } from './magic/analyse.ts';
import { RenderError, type Renderer } from './sample/render.ts';
import { createAuth, type Auth } from './auth.ts';

const analyseBody = z.object({
  image: z.string().min(100).max(15_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg']),
  notes: z.string().max(2000).optional(),
});

const renderBody = z.object({
  image: z.string().min(100).max(15_000_000),
  mediaType: z.enum(['image/png', 'image/jpeg', 'image/webp']),
  prompt: z.string().min(10).max(4000),
});

const RENDER_STATUS = { auth: 502, busy: 429, refused: 422, upstream: 502 } as const;

/**
 * The API. `analyse` is absent when no Anthropic credentials are configured, `render` when no
 * image model key is.
 */
export function buildApp({
  analyse,
  render,
  auth = createAuth({}),
}: { analyse?: Analyser; render?: Renderer; auth?: Auth } = {}) {
  const app = new Hono();

  app.use('/api/*', auth.guard());

  /** Whether the server checks the passcode (online), and whether this browser is signed in. */
  app.get('/api/auth/status', (c) =>
    c.json({ required: auth.required, signedIn: auth.signedIn(c) }),
  );
  app.post('/api/auth/sign-in', async (c) => {
    const body = (await c.req.json().catch(() => ({}))) as { passcode?: unknown };
    const ok = auth.signIn(c, typeof body.passcode === 'string' ? body.passcode : '');
    return c.json({ ok, required: auth.required }, ok ? 200 : 401);
  });
  app.post('/api/auth/sign-out', (c) => {
    auth.signOut(c);
    return c.json({ ok: true });
  });

  app.get('/api/product-sample/status', (c) =>
    c.json({ configured: Boolean(render), provider: render?.provider ?? null }),
  );

  app.post('/api/product-sample/render', async (c) => {
    if (!render) {
      return c.json(
        {
          error: 'not-configured',
          message: 'Product samples need an image model key (GEMINI_API_KEY) on the server.',
        },
        503,
      );
    }
    const body = renderBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json({ error: 'bad-request', message: 'Send a JPEG or PNG product photo.' }, 400);
    try {
      return c.json(await render.render(body.data));
    } catch (e) {
      if (e instanceof RenderError)
        return c.json({ error: e.code, message: e.message }, RENDER_STATUS[e.code]);
      console.error('Product sample failed', e);
      return c.json(
        { error: 'upstream', message: 'The picture couldn’t be made. Try again shortly.' },
        502,
      );
    }
  });

  app.get('/api/health', (c) => c.json({ ok: true }));

  app.get('/api/magic-plan/status', (c) => c.json({ configured: Boolean(analyse) }));

  app.post('/api/magic-plan/analyse', async (c) => {
    if (!analyse) {
      return c.json(
        {
          error: 'not-configured',
          message: 'Magic Plan needs an Anthropic API key on the server.',
        },
        503,
      );
    }
    const body = analyseBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      return c.json({ error: 'bad-request', message: 'Send a PNG or JPEG drawing.' }, 400);
    try {
      return c.json({ analysis: await analyse(body.data) });
    } catch (e) {
      if (e instanceof AnalysisError)
        return c.json({ error: 'unreadable', message: e.message }, 422);
      if (e instanceof Anthropic.AuthenticationError) {
        return c.json(
          {
            error: 'auth',
            message: 'The Anthropic API key was rejected. Check it and restart the app.',
          },
          502,
        );
      }
      if (e instanceof Anthropic.RateLimitError) {
        return c.json(
          { error: 'busy', message: 'Too many requests right now. Wait a minute and try again.' },
          429,
        );
      }
      if (e instanceof Anthropic.APIError) {
        console.error('Magic Plan analysis failed', e.status, e.message);
        return c.json(
          { error: 'upstream', message: 'The drawing service is unavailable. Try again shortly.' },
          502,
        );
      }
      throw e;
    }
  });

  return app;
}
