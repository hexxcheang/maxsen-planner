import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { z } from 'zod';
import { AnalysisError, type Analyser } from './magic/analyse.ts';
import { RenderError, type Renderer } from './sample/render.ts';
import { createAuth, type Auth } from './auth.ts';
import { ID, type SharedStore } from './shared/store.ts';

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

const saveBody = z.object({
  baseVersion: z.number().int().min(0),
  savedBy: z.string().trim().min(1).max(80),
  force: z.boolean().optional(),
  bundle: z
    .object({
      project: z
        .object({
          id: z.string(),
          title: z.string(),
          customerName: z.string().default(''),
          propertyAddress: z.string().default(''),
          status: z.string().default('draft'),
        })
        .passthrough(),
    })
    .passthrough(),
});

const workspaceBody = z.object({
  baseVersion: z.number().int().min(0),
  savedBy: z.string().trim().min(1).max(80),
  force: z.boolean().optional(),
  workspace: z
    .object({
      products: z.array(z.unknown()),
      variants: z.array(z.unknown()),
      settings: z.object({}).passthrough(),
      templates: z.array(z.unknown()),
    })
    .passthrough(),
});

/** Drawings are rasterised pages and PDFs; anything bigger is refused. */
const MAX_FILE_BYTES = 60 * 1024 * 1024;

const RENDER_STATUS = { auth: 502, busy: 429, refused: 422, upstream: 502 } as const;

/**
 * The API. `analyse` is absent when no Anthropic credentials are configured, `render` when no
 * image model key is.
 */
export function buildApp({
  analyse,
  render,
  auth = createAuth({}),
  shared,
  persistent = true,
}: {
  analyse?: Analyser;
  render?: Renderer;
  auth?: Auth;
  shared?: SharedStore;
  /** Whether the team's saves survive a redeploy (on Render: kept on a disk). */
  persistent?: boolean;
} = {}) {
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

  // --- projects saved for the team -----------------------------------------------------------
  app.get('/api/shared/status', (c) =>
    c.json({ enabled: Boolean(shared), persistent: shared ? persistent : false }),
  );

  app.use('/api/shared/*', async (c, next) => {
    if (c.req.path === '/api/shared/status') return next();
    if (!shared)
      return c.json(
        { error: 'not-configured', message: 'Team saving is off on this server.' },
        503,
      );
    return next();
  });

  // The list also says which version of the shared catalogue and settings is current, so devices
  // only fetch those when they've changed.
  app.get('/api/shared/projects', async (c) =>
    c.json({
      projects: await shared!.list(),
      workspace: (await shared!.getWorkspace())?.meta ?? null,
    }),
  );

  app.get('/api/shared/projects/:id', async (c) => {
    const id = c.req.param('id');
    const found = ID.test(id) ? await shared!.get(id) : null;
    return found ? c.json(found) : c.json({ error: 'not-found' }, 404);
  });

  app.put('/api/shared/projects/:id', async (c) => {
    const id = c.req.param('id');
    const body = saveBody.safeParse(await c.req.json().catch(() => null));
    if (!ID.test(id) || !body.success || body.data.bundle.project.id !== id)
      return c.json({ error: 'bad-request', message: 'That project couldn’t be read.' }, 400);
    const { title, customerName, propertyAddress, status } = body.data.bundle.project;
    const result = await shared!.save(id, body.data, {
      title,
      customerName,
      propertyAddress,
      status,
    });
    return result.ok
      ? c.json({ meta: result.meta })
      : c.json({ error: 'conflict', meta: result.conflict }, 409);
  });

  app.delete('/api/shared/projects/:id', async (c) => {
    const id = c.req.param('id');
    if (!ID.test(id)) return c.json({ error: 'bad-request' }, 400);
    return c.json({ removed: await shared!.remove(id) });
  });

  app.get('/api/shared/workspace', async (c) => {
    const found = await shared!.getWorkspace();
    return found ? c.json(found) : c.json({ error: 'not-found' }, 404);
  });

  app.put('/api/shared/workspace', async (c) => {
    const body = workspaceBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    const result = await shared!.saveWorkspace(body.data);
    return result.ok
      ? c.json({ meta: result.meta })
      : c.json({ error: 'conflict', meta: result.conflict }, 409);
  });

  app.post('/api/shared/files/missing', async (c) => {
    const body = z
      .object({ ids: z.array(z.string()).max(5000) })
      .safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'bad-request' }, 400);
    return c.json({ missing: await shared!.missingFiles(body.data.ids) });
  });

  app.put('/api/shared/files/:id', async (c) => {
    const id = c.req.param('id');
    if (!ID.test(id)) return c.json({ error: 'bad-request' }, 400);
    const data = new Uint8Array(await c.req.arrayBuffer());
    if (data.byteLength > MAX_FILE_BYTES) return c.json({ error: 'too-large' }, 413);
    await shared!.putFile(id, data, c.req.header('content-type') ?? '');
    return c.json({ ok: true });
  });

  app.get('/api/shared/files/:id', async (c) => {
    const id = c.req.param('id');
    const file = ID.test(id) ? await shared!.getFile(id) : null;
    if (!file) return c.json({ error: 'not-found' }, 404);
    return c.body(new Uint8Array(file.data), 200, {
      'content-type': file.type,
      'cache-control': 'private, max-age=31536000, immutable',
    });
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
